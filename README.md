# Lake Formosa Neighborhood Association

Website for the Lake Formosa Neighborhood Association, Orlando FL.
Live at [lakeformosa.org](https://lakeformosa.org).

## Infrastructure

| Layer | Service | Notes |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Static Astro build, auto-deploys from `main` |
| API | [Cloudflare Workers](https://workers.cloudflare.com) | `lakeformosa-api.chrisduffy90.workers.dev` |
| Database | [Neon](https://neon.tech) | Postgres, project: LFNA |
| Auth | [Supabase](https://supabase.com) | Admin panel login only |
| Email | [Resend](https://resend.com) | Contact form notifications |
| Domain | Namecheap | DNS pointed at Vercel |

## Data

| Table | What it stores |
|---|---|
| `signups` | Newsletter signup form submissions |
| `contact_messages` | Contact form submissions |
| `get_involved` | Get involved form submissions |

## API endpoints

Worker lives at `https://lakeformosa-api.chrisduffy90.workers.dev`

| Method | Path | Description |
|---|---|---|
| POST | `/signup` | Newsletter signup |
| POST | `/contact` | Contact form |
| POST | `/get-involved` | Get involved form |
| GET | `/signups` | All signups |
| GET | `/contact` | All contact messages |
| GET | `/get-involved` | All get-involved submissions |
| GET | `/health` | Health check |

## Local development

```sh
# Frontend
npm install
npm run dev        # runs at localhost:4321

# Worker (API)
cd worker
npm install
npm run dev        # runs at localhost:8787
```

The Worker reads `worker/.dev.vars` for local secrets (not committed):

```
DATABASE_URL=your_neon_connection_string
RESEND_API_KEY=your_resend_api_key
```

Contact form submissions trigger an email notification to `lakeformosanaorl@gmail.com` and `chrisduffy90@gmail.com` via Resend. The reply-to is set to the submitter's email so you can reply directly.

## Deployment

- **Frontend** — push to `main`, Vercel auto-deploys
- **Worker** — `cd worker && npm run deploy`
