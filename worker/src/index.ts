import { neon } from '@neondatabase/serverless';

export interface Env {
  DATABASE_URL: string;
  RESEND_API_KEY: string;
  ADMIN_KEY: string;
  RATE_LIMITER: RateLimit;
  PHOTOS: R2Bucket;
}

interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

const ALLOWED_ORIGINS = [
  'https://lakeformosa.org',
  'https://www.lakeformosa.org',
  'http://localhost:4322',
];

const SITE_URL = 'https://lakeformosa.org';

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-Session-Id',
  };
}

function json(data: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function makeToken(): string {
  return (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '');
}

type Sql = ReturnType<typeof neon>;

async function checkAdmin(request: Request, env: Env, sql: Sql, origin: string | null): Promise<Response | null> {
  // Programmatic access via admin key
  if (request.headers.get('X-Admin-Key') === env.ADMIN_KEY) return null;

  // Session-based access (UI login)
  const sessionId = request.headers.get('X-Session-Id');
  if (sessionId) {
    const rows = await sql`
      SELECT 1 FROM admin_sessions
      WHERE session_id = ${sessionId} AND expires_at > NOW()
    `;
    if (rows.length > 0) return null;
  }

  return json({ error: 'Unauthorized' }, 401, origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    const { pathname } = url;
    const sql = neon(env.DATABASE_URL);

    try {
      // GET / or /health
      if (pathname === '/' || pathname === '/health') {
        return json({ ok: true, message: 'Lake Formosa Neighborhood Association API' }, 200, origin);
      }

      // Rate limit all mutating requests (enforced on Workers Paid plan only; no-op on free)
      if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
        const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
        const { success } = await env.RATE_LIMITER.limit({ key: ip });
        if (!success) return json({ error: 'Too many requests. Please try again later.' }, 429, origin);
      }

      // ── AUTH ──────────────────────────────────────────────────────────────────

      // POST /auth/request — send magic link
      if (pathname === '/auth/request' && request.method === 'POST') {
        const { email } = await request.json() as { email?: string };
        if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, origin);
        const normalized = email.trim().toLowerCase();

        const authorized = await sql`SELECT name FROM admin_users WHERE email = ${normalized}`;
        // Return same response whether authorized or not (prevents email enumeration)
        if (authorized.length > 0) {
          const token = makeToken();
          await sql`INSERT INTO admin_tokens (token, email) VALUES (${token}, ${normalized})`;
          await sql`DELETE FROM admin_tokens WHERE expires_at < NOW()`;

          const link = `${SITE_URL}/admin/verify?token=${token}`;
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'LFNA Admin <onboarding@resend.dev>',
              to: [normalized],
              subject: 'Your Lake Formosa NA sign-in link',
              text: `Hi ${authorized[0].name || 'there'},\n\nClick the link below to sign in to the LFNA admin panel. This link expires in 1 hour and can only be used once.\n\n${link}\n\nIf you didn't request this, you can safely ignore this email.`,
            }),
          });
        }

        return json({ ok: true }, 200, origin);
      }

      // GET /auth/verify?token=xxx — exchange token for session
      if (pathname === '/auth/verify' && request.method === 'GET') {
        const token = url.searchParams.get('token');
        if (!token) return json({ error: 'Missing token' }, 400, origin);

        const rows = await sql`
          SELECT email FROM admin_tokens
          WHERE token = ${token} AND expires_at > NOW() AND used_at IS NULL
        `;
        if (!rows.length) return json({ error: 'Invalid or expired sign-in link' }, 401, origin);

        const { email } = rows[0] as { email: string };
        await sql`UPDATE admin_tokens SET used_at = NOW() WHERE token = ${token}`;

        const sessionId = makeToken();
        await sql`INSERT INTO admin_sessions (session_id, email) VALUES (${sessionId}, ${email})`;
        await sql`DELETE FROM admin_sessions WHERE expires_at < NOW()`;

        const nameRows = await sql`SELECT name FROM admin_users WHERE email = ${email}`;
        const name = (nameRows[0] as { name: string } | undefined)?.name ?? email;

        return json({ session_id: sessionId, email, name }, 200, origin);
      }

      // DELETE /auth/session — sign out
      if (pathname === '/auth/session' && request.method === 'DELETE') {
        const sessionId = request.headers.get('X-Session-Id');
        if (sessionId) await sql`DELETE FROM admin_sessions WHERE session_id = ${sessionId}`;
        return json({ ok: true }, 200, origin);
      }

      // ── ADMIN USERS ───────────────────────────────────────────────────────────

      // GET /admin-users — list authorized admins
      if (pathname === '/admin-users' && request.method === 'GET') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const rows = await sql`SELECT email, name, created_at FROM admin_users ORDER BY created_at`;
        return json(rows, 200, origin);
      }

      // POST /admin-users — add an authorized admin
      if (pathname === '/admin-users' && request.method === 'POST') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const { email, name = '' } = await request.json() as { email?: string; name?: string };
        if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, origin);
        const normalized = email.trim().toLowerCase();
        await sql`
          INSERT INTO admin_users (email, name) VALUES (${normalized}, ${name})
          ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
        `;
        return json({ ok: true }, 200, origin);
      }

      // DELETE /admin-users/:email — remove an admin
      const adminUserMatch = pathname.match(/^\/admin-users\/([^/]+)$/);
      if (adminUserMatch && request.method === 'DELETE') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const email = decodeURIComponent(adminUserMatch[1]);
        await sql`DELETE FROM admin_users WHERE email = ${email}`;
        return json({ ok: true }, 200, origin);
      }

      // ── PHOTOS ────────────────────────────────────────────────────────────────

      // POST /upload-photo — admin only, stores in R2
      if (pathname === '/upload-photo' && request.method === 'POST') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        if (!file) return json({ error: 'No file provided' }, 400, origin);
        const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!ALLOWED_TYPES.includes(file.type))
          return json({ error: 'Only JPEG, PNG, WebP, or GIF images are allowed' }, 400, origin);
        if (file.size > 5 * 1024 * 1024)
          return json({ error: 'File must be under 5MB' }, 400, origin);
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const key = `headshots/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        await env.PHOTOS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        const photoUrl = `${new URL(request.url).origin}/photos/${key}`;
        return json({ url: photoUrl }, 200, origin);
      }

      // GET /photos/:key — serve from R2 (public)
      if (pathname.startsWith('/photos/') && request.method === 'GET') {
        const key = pathname.slice('/photos/'.length);
        const object = await env.PHOTOS.get(key);
        if (!object) return new Response('Not found', { status: 404 });
        return new Response(object.body, {
          headers: {
            'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
            'Cache-Control': 'public, max-age=31536000',
            ...corsHeaders(origin),
          },
        });
      }

      // ── BOARD MEMBERS ─────────────────────────────────────────────────────────

      // GET /board-members — public
      if (pathname === '/board-members' && request.method === 'GET') {
        const rows = await sql`SELECT * FROM board_members ORDER BY "order"`;
        return json(rows, 200, origin);
      }

      // GET /board-members/:id — public
      const memberMatch = pathname.match(/^\/board-members\/([^/]+)$/);
      if (memberMatch && request.method === 'GET') {
        const rows = await sql`SELECT * FROM board_members WHERE id = ${memberMatch[1]}`;
        if (!rows.length) return json({ error: 'Not found' }, 404, origin);
        return json(rows[0], 200, origin);
      }

      // POST /board-members — admin
      if (pathname === '/board-members' && request.method === 'POST') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const data = await request.json() as Record<string, unknown>;
        const rows = await sql`
          INSERT INTO board_members (name, role, "order", bio, email, headshot_url)
          VALUES (
            ${data.name}, ${data.role}, ${data.order ?? 99},
            ${data.bio ?? ''}, ${data.email ?? ''}, ${data.headshot_url ?? null}
          ) RETURNING *`;
        return json(rows[0], 201, origin);
      }

      // PUT /board-members/:id — admin
      if (memberMatch && request.method === 'PUT') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const data = await request.json() as Record<string, unknown>;
        const rows = await sql`
          UPDATE board_members SET
            name         = ${data.name},
            role         = ${data.role},
            "order"      = ${data.order ?? 99},
            bio          = ${data.bio ?? ''},
            email        = ${data.email ?? ''},
            headshot_url = ${data.headshot_url ?? null}
          WHERE id = ${memberMatch[1]}
          RETURNING *`;
        if (!rows.length) return json({ error: 'Not found' }, 404, origin);
        return json(rows[0], 200, origin);
      }

      // DELETE /board-members/:id — admin
      if (memberMatch && request.method === 'DELETE') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        await sql`DELETE FROM board_members WHERE id = ${memberMatch[1]}`;
        return json({ ok: true }, 200, origin);
      }

      // ── EVENTS ────────────────────────────────────────────────────────────────

      // GET /events — public upcoming, or all with ?all=1
      if (pathname === '/events' && request.method === 'GET') {
        const showAll = url.searchParams.get('all') === '1';
        const rows = showAll
          ? await sql`SELECT * FROM events ORDER BY date`
          : await sql`SELECT * FROM events WHERE date >= CURRENT_DATE ORDER BY date`;
        return json(rows, 200, origin);
      }

      // GET /events/:id — public
      const eventMatch = pathname.match(/^\/events\/([^/]+)$/);
      if (eventMatch && request.method === 'GET') {
        const rows = await sql`SELECT * FROM events WHERE id = ${eventMatch[1]}`;
        if (!rows.length) return json({ error: 'Not found' }, 404, origin);
        return json(rows[0], 200, origin);
      }

      // POST /events — admin
      if (pathname === '/events' && request.method === 'POST') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const data = await request.json() as Record<string, unknown>;
        const rows = await sql`
          INSERT INTO events (title, date, time, location, description)
          VALUES (${data.title}, ${data.date}, ${data.time}, ${data.location}, ${data.description ?? ''})
          RETURNING *`;
        return json(rows[0], 201, origin);
      }

      // PUT /events/:id — admin
      if (eventMatch && request.method === 'PUT') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const data = await request.json() as Record<string, unknown>;
        const rows = await sql`
          UPDATE events SET
            title       = ${data.title},
            date        = ${data.date},
            time        = ${data.time},
            location    = ${data.location},
            description = ${data.description ?? ''}
          WHERE id = ${eventMatch[1]}
          RETURNING *`;
        if (!rows.length) return json({ error: 'Not found' }, 404, origin);
        return json(rows[0], 200, origin);
      }

      // DELETE /events/:id — admin
      if (eventMatch && request.method === 'DELETE') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        await sql`DELETE FROM events WHERE id = ${eventMatch[1]}`;
        return json({ ok: true }, 200, origin);
      }

      // ── SIGNUPS / GET-INVOLVED / CONTACT ──────────────────────────────────────

      // POST /signup
      if (pathname === '/signup' && request.method === 'POST') {
        const { first_name, last_name = '', email } = await request.json() as Record<string, string>;
        if (!first_name?.trim()) return json({ error: 'First name cannot be empty' }, 400, origin);
        if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, origin);
        try {
          const rows = await sql`
            INSERT INTO signups (first_name, last_name, email)
            VALUES (${first_name.trim()}, ${last_name.trim()}, ${email.trim().toLowerCase()})
            RETURNING *`;
          return json({ ok: true, data: rows[0] }, 200, origin);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('unique') || msg.includes('duplicate')) {
            return json({ error: 'This email is already signed up' }, 409, origin);
          }
          throw e;
        }
      }

      // GET /signups — admin
      if (pathname === '/signups' && request.method === 'GET') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const rows = await sql`SELECT * FROM signups ORDER BY created_at DESC`;
        return json(rows, 200, origin);
      }

      // POST /get-involved
      if (pathname === '/get-involved' && request.method === 'POST') {
        const { first_name, last_name = '', email, address = '', interests = [] } =
          await request.json() as Record<string, unknown>;
        if (!first_name || !(first_name as string).trim())
          return json({ error: 'First name cannot be empty' }, 400, origin);
        if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, origin);
        const rows = await sql`
          INSERT INTO get_involved (first_name, last_name, email, address, interests)
          VALUES (
            ${(first_name as string).trim()}, ${(last_name as string).trim()},
            ${(email as string).trim().toLowerCase()}, ${(address as string).trim()},
            ${interests as string[]}
          ) RETURNING *`;
        return json({ ok: true, data: rows[0] }, 200, origin);
      }

      // GET /get-involved — admin
      if (pathname === '/get-involved' && request.method === 'GET') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const rows = await sql`SELECT * FROM get_involved ORDER BY created_at DESC`;
        return json(rows, 200, origin);
      }

      // POST /contact
      if (pathname === '/contact' && request.method === 'POST') {
        const { name, email, subject = 'General', message } =
          await request.json() as Record<string, string>;
        if (!name?.trim() || !message?.trim())
          return json({ error: 'Name and message are required' }, 400, origin);
        if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, origin);

        const rows = await sql`
          INSERT INTO contact_messages (name, email, subject, message)
          VALUES (${name.trim()}, ${email.trim().toLowerCase()}, ${subject.trim()}, ${message.trim()})
          RETURNING *`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'LFNA Contact Form <onboarding@resend.dev>',
            to: ['lakeformosanaorl@gmail.com', 'chrisduffy90@gmail.com'],
            reply_to: email.trim().toLowerCase(),
            subject: `New contact: ${subject.trim()}`,
            text: `Name: ${name.trim()}\nEmail: ${email.trim()}\nSubject: ${subject.trim()}\n\n${message.trim()}`,
          }),
        });

        return json({ ok: true, data: rows[0] }, 200, origin);
      }

      // GET /contact — admin
      if (pathname === '/contact' && request.method === 'GET') {
        const deny = await checkAdmin(request, env, sql, origin);
        if (deny) return deny;
        const rows = await sql`SELECT * FROM contact_messages ORDER BY created_at DESC`;
        return json(rows, 200, origin);
      }

      return json({ error: 'Not found' }, 404, origin);
    } catch (e) {
      console.error(e);
      return json({ error: 'Something went wrong' }, 500, origin);
    }
  },
};
