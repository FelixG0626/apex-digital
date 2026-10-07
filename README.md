# Apex Digital

A public agency homepage and private admin workspace for a Malaysian Website-as-a-Service agency.

Run `npm start`, `node server.js`, or `./start.ps1`, then open http://localhost:8100.

The public homepage includes services, pricing, onboarding steps, FAQs, and an enquiry download form. It does not send emails. Admin login is at `/admin`; the protected dashboard is at `/workspace`.

On first start, the server generates one admin account. Its username and random password are saved in `data/admin-credentials.txt`. The password hash is stored using scrypt in `data/admin.json`; no public registration is available. Keep the credentials file private. Sessions last eight hours and end on logout or server restart. Login attempts are rate limited; writes require a matching origin and session CSRF token.

Features: client subscriptions and MRR, payment-gated onboarding, launch pipeline, edit requests with a 48-hour target, monthly minor-edit allowance, custom work estimates at RM 150/hour, JSON backup export/import, and responsive layouts.

Starts empty. Records are saved on the server in `data/workspace.json` and are only accessible through the authenticated API. Previous browser records are migrated after admin login when the server workspace is empty; otherwise use backup export/import to consolidate them. Export backups regularly. Payment and mandate confirmations are manual tracking fields; this version does not charge clients, register domains, deploy client websites, send emails, or submit e-invoices. Revenue charts show projections, not collected payments. Contract minimums are reference pricing, not executed contracts.

The server binds to localhost. No third-party packages are required. Fonts optionally load from Google Fonts with local fallbacks.

With the server running, `node check-auth.mjs` verifies authentication, route protection, cookie flags, write validation, CSRF checks, persistence, and logout. This uses the locally generated admin credentials and writes back the existing workspace unchanged.

## Online deployment

For GitHub Pages, the included `pages.yml` workflow publishes the public homepage on pushes to `main`. Enable Settings → Pages → Source → GitHub Actions. `node build-pages.mjs` produces only `index.html`, homepage CSS/JS, and `.nojekyll`; it excludes all admin files, secrets, and workspace records. Relative asset links work at a repository subpath. GitHub Pages does not include an online admin workspace.

Use a GitHub-connected Node or Docker host with HTTPS and a persistent disk. GitHub Pages cannot run this admin backend. Start with `node server.js`; there are no packages to install. Docker deployments use the included Dockerfile.

Configure `NODE_ENV=production`, `APP_URL` to the exact public HTTPS origin, and `DATA_DIR` to the persistent disk mount (Docker: `/app/data`). Configure `ADMIN_USERNAME` and a private `ADMIN_PASSWORD` of at least 16 characters before first start. The admin password is hashed onto the persistent disk, and changing the environment value afterward does not reset an existing account. Production does not write a plaintext credentials file. The host must forward its assigned `PORT` and terminate TLS. Health endpoint: `/health`. Run one server instance; file storage and sessions are not shared between instances. Restarts sign the admin out.

Do not commit credentials, workspace data, or local environment files. No local admin credentials or client records are included in deployment files. Online workspace starts empty; transfer a backup only if desired after signing in.
