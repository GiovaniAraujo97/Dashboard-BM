# Quick deploy & secrets

This file lists exact steps to enable automatic Netlify deploys and secure Gist synchronization.

1) Netlify Functions (already included)
- `netlify/functions/gist-read.js`
- `netlify/functions/gist-write.js`

2) Configure Netlify site
- Connect repository on Netlify (Sites → New site from Git → GitHub)
- In Site settings → Build & deploy → Environment, add:
  - `NETLIFY_GIST_TOKEN` = (GitHub PAT with gist scope)
  - `GIST_ID` = `004c3f9e832b7a8ad79fdb6a7e1796d5`
- Build command: `npm run build`
- Publish directory: `dist/dashboard-bm/browser`

3) Configure GitHub secrets for automatic Netlify deploy (optional)
- In GitHub repo → Settings → Secrets and variables → Actions add:
  - `NETLIFY_AUTH_TOKEN` (Netlify personal access token)
  - `NETLIFY_SITE_ID` (Netlify site ID)

4) Triggers
- Pushing to `main` will run the CI workflow (tests + build) and then the Netlify deploy workflow which publishes to your Netlify site.

5) Local testing
- Install Netlify CLI: `npm i -g netlify-cli`
- Run locally: `netlify dev` to test functions at `/.netlify/functions/*`

6) Supabase configuration (Auth + CORS)
- In your Supabase project Settings → API, add your app origin (for local dev `http://localhost:4200`) to the Allowed origins / CORS list.
- If your project was paused, resume it before testing — paused projects will not serve API requests.
- If you use Netlify Functions that call Supabase server-side, set `SUPABASE_SERVICE_ROLE_KEY` as an environment variable in Netlify site settings (never expose service_role key in frontend).

7) Environment variables for build
- Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` to Netlify Site settings → Build & deploy → Environment. The repository includes `scripts/inject-env.js` which injects these into `src/index.html` during build.
Example `.env` file (local dev):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=sb_publishable_xxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Netlify-specific notes:
- In Netlify Site settings → Build & deploy → Environment add:
  - `SUPABASE_URL` = https://your-project.supabase.co
  - `SUPABASE_ANON_KEY` = sb_publishable_xxx
  - `SUPABASE_SERVICE_ROLE_KEY` = (only if you use server functions that call Supabase with elevated privileges)

After adding these variables push to `main` (or trigger a deploy) — Netlify will run `npm run build` which injects the env vars into `src/index.html`.

Quick test locally (node):
1. Create a `.env` in the project root with `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
2. Run:
```
node scripts/test-supabase.js
```
This script attempts a signup call server-side (ignores browser CORS). If it returns 200/201 the Supabase project is active and accepting requests.

---

If you want, after you add the Netlify secrets and site ID I will monitor the first run and report the deployed URL and function logs.
