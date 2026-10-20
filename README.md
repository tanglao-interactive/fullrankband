# Full Rank Band

The Full Rank website and CMS use AWS Amplify Gen 2, Cognito, Amplify Data
(AppSync/DynamoDB), and S3. The approved charcoal, warm-white, and amber design
uses the band's actual portrait, artwork, performance videos, and rehearsal audio.
No production deployment or DNS cutover is performed by local development commands.

## Offline preview

Use Node.js 22 or later (Node 24 recommended):

```sh
npm ci
npm start
```

Open **http://127.0.0.1:5173/**. No AWS credentials, Firebase, or Java are required.
The homepage uses bundled defaults and curated media. `/admin/` clearly identifies
the offline mode and disables editing. The port is fixed; stop an existing Vite
instance before starting another rather than changing backend ports.

```sh
npm run build:local
npm run preview
```

The built offline preview is at **http://127.0.0.1:4173/**.

## AWS sandbox and full CMS

Selected AWS profile: `franznoel`; account `040636573990`; region `us-west-1`.
Use an AWS SSO login for this profile:

```sh
aws sso login --profile franznoel
npm run sandbox
npm run start:aws
```

`npm run sandbox` provisions/updates the isolated `fullrankband` sandbox once and
writes ignored `amplify_outputs.json`. It creates billable AWS resources but does
not create an Amplify Hosting site or change DNS. `sandbox:watch` is an optional
human-operated watcher. The frontend command reads sandbox outputs and runs on
5173; stop the offline server with Ctrl-C first. Reload/restart Vite after sandbox
outputs change. Stop development servers with Ctrl-C for a clean shutdown.

Cognito has no public self-registration. Only users in the `Admins` group may
use the CMS, read draft records, or upload images. The login supports temporary
password setup and emailed password reset. Imported administrators are created
with invitations suppressed. No passwords or invitations are printed or sent by
the migration. Sending initial invitations is a separate explicit operation.

The public site uses a Lambda-backed query that projects homepage settings and
published events only; it cannot query draft models. Uploaded website images
live under `website/` in S3. Content records store stable keys; URLs are resolved
on load and refreshed with content every five minutes and on tab visibility.
Video and audio remain curated static Hosting assets, use native controls, and
do not autoplay. Starting one recording pauses the others.

## Build and checks

```sh
npm test
npm run typecheck
npm run build
npm run check:build
npm run preview
```

`build` requires Amplify outputs and creates `dist/`. It refuses to silently build
an offline CMS for production. The frontend has two entrypoints: `/` and
`/admin/index.html`. Configure the exact `/admin` → `/admin/index.html` HTTP 200
rewrite from `docs/amplify-rewrites.json`; do not add an SPA catch-all that masks
missing media. Amplify's Git pipeline uses `amplify.yml`; configure Hosting
headers from `customHttp.yml` before production release. Do not connect or deploy
the production branch until preview approval.

## Migration and rollback

See `docs/migration-report.md`. Private exports, user lists, and generated outputs
are excluded from Git and Hosting. The approved backup is in
`/Users/franz.tanglao/Downloads/fullrank-migration-backup-2026-10-19/`; keep it private. `FULLRANK_MIGRATION_DIR` overrides that path.

The one-time exporter uses an existing Firebase CLI session (no credentials are
printed). When rerunning it after Firebase development dependencies are removed,
install the migration-only CLI with `npm install --no-save --package-lock=false
firebase-tools`, run the exporter, then `npm ci` to restore the normal dependency
set. Export identities separately with `firebase auth:export` into that same
private directory before `npm run migrate:export`.

`npm run migrate:import` copies referenced uploads with SHA-256 metadata, imports
records conditionally, recreates active administrators without sending invitations,
and writes private reconciliation/invitation reports. Stable IDs and hashes make
retries safe; newer AWS edits are skipped. Default imports require sandbox outputs.
No Firebase cloud resources are deleted. Retained legacy source/configuration is
for rollback only and is never included in `dist/`.

`npm run verify:sandbox` creates temporary test users and records, performs live
AWS authorization checks, and removes them. It sends no invitations. Run only
against the sandbox with the selected AWS profile.

## Media

Optimized curated assets are in `public/media/`; original archive filenames and
checksums are in `docs/media-sources.json`. Private Messenger messages, unrelated
attachments, and the full archive inventory are not deployed. Captions/transcripts
for the selected recordings have not been authored.
