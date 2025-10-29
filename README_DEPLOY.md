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

---

If you want, after you add the Netlify secrets and site ID I will monitor the first run and report the deployed URL and function logs.
