# Lost & Found — Vercel + FastAPI + Supabase

This package combines the existing Lost & Found frontend with a Vercel-ready FastAPI backend and Supabase database/Auth integration.

## Architecture

Browser -> Vercel static frontend
                 |
                 +-> /api/* -> FastAPI serverless function
                                  |
                                  +-> Supabase Auth
                                  +-> Supabase PostgreSQL
                                  +-> Supabase Storage (photos)

## Before deploying

1. In Supabase SQL Editor, run your original schema.
2. Then run `schema_patch.sql` from this folder.
3. In Supabase Storage, create a bucket named `lost-found` and make it public if you want uploaded item photos to display directly.
4. Create/link your staff account. A staff Auth UUID must be stored in `admins.auth_user_id`.
5. Push this folder to GitHub or deploy it directly with Vercel.

## Vercel environment variables

Set these in Vercel Project Settings -> Environment Variables:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL
- SESSION_SECRET
- STORAGE_BUCKET=lost-found
- SCHOOL_EMAIL_DOMAIN=your-school-domain (optional)

Use the Supabase **Transaction Pooler** connection string for `DATABASE_URL` when available. Do not commit `.env`.

## Deploy

From this folder:

    npm i -g vercel
    vercel

For production:

    vercel --prod

Or import the GitHub repository in the Vercel dashboard. Vercel detects `vercel.json` and `api/index.py`.

## Local test

    python -m venv .venv
    .venv\\Scripts\\activate       # Windows
    pip install -r requirements.txt
    uvicorn api.index:app --reload --port 8000

For local frontend testing, you can serve the folder with a static server, but production uses same-origin `/api/*`, so `js/config.js` has `apiBase: ''` and `mock: false`.

## Important security notes

- Never expose SUPABASE_SERVICE_ROLE_KEY in browser code.
- The frontend uses an HttpOnly session cookie.
- The Vercel production cookie is Secure.
- Supabase Auth owns passwords; the students/admins tables only store the Auth UUID link.
- Restrict Vercel environment variables to the environments where needed.
