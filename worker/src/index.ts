import { neon } from '@neondatabase/serverless';

export interface Env {
  DATABASE_URL: string;
}

const ALLOWED_ORIGINS = [
  'https://lakeformosa.org',
  'https://www.lakeformosa.org',
  'http://localhost:4322',
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const { pathname } = new URL(request.url);
    const sql = neon(env.DATABASE_URL);

    try {
      // GET /  GET /health
      if (pathname === '/' || pathname === '/health') {
        return json({ ok: true, message: 'Lake Formosa Neighborhood Association API' }, 200, origin);
      }

      // POST /signup
      if (pathname === '/signup' && request.method === 'POST') {
        const { first_name, last_name = '', email } = await request.json() as Record<string, string>;

        if (!first_name?.trim()) return json({ error: 'First name cannot be empty' }, 400, origin);
        if (!isValidEmail(email)) return json({ error: 'Invalid email address' }, 400, origin);

        try {
          const rows = await sql`
            INSERT INTO signups (first_name, last_name, email)
            VALUES (${first_name.trim()}, ${last_name.trim()}, ${email.trim().toLowerCase()})
            RETURNING *
          `;
          return json({ ok: true, data: rows[0] }, 200, origin);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : '';
          if (msg.includes('unique') || msg.includes('duplicate')) {
            return json({ error: 'This email is already signed up' }, 409, origin);
          }
          throw e;
        }
      }

      // GET /signups
      if (pathname === '/signups' && request.method === 'GET') {
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
            ${(first_name as string).trim()},
            ${(last_name as string).trim()},
            ${(email as string).trim().toLowerCase()},
            ${(address as string).trim()},
            ${interests as string[]}
          )
          RETURNING *
        `;
        return json({ ok: true, data: rows[0] }, 200, origin);
      }

      // GET /get-involved
      if (pathname === '/get-involved' && request.method === 'GET') {
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
          RETURNING *
        `;
        return json({ ok: true, data: rows[0] }, 200, origin);
      }

      // GET /contact
      if (pathname === '/contact' && request.method === 'GET') {
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
