# Firebase to Amplify migration

## Source backup

- Firebase project: `fullrankband`.
- Private backup: `/Users/franz.tanglao/Downloads/fullrank-migration-backup-2026-10-19/firebase-export.json`.
- Export completed: 0 saved homepage documents, 0 event documents, 2 user identities,
  and 0 referenced Firebase Storage uploads.
- Password hashes were removed from the identity export. No invitations were sent.
- With no saved homepage data, the AWS sandbox is seeded with the approved redesign
  defaults and `admin@fullrankband.com` as the public booking address.
- Existing curated photos, videos, and audio remain local repository assets and
  are included in the frontend build. Private inventories are excluded.

## Destination and release boundary

- AWS profile: `franznoel` (SSO), account `040636573990`, region `us-west-1`.
- Amplify sandbox identifier: `fullrankband`.
- Hosting and DNS production cutover are not part of this change.
- Firebase services remain intact for rollback.

## Validation

Results from sandbox import and API authorization checks are recorded in the
private `migration-report.json` and sandbox verification report. Unit tests cover
public draft exclusion, metadata projection, media key rewriting, repeat imports,
newer-edit protection, and old-poster default normalization.

Live administrator invitation delivery and password-reset email delivery require
separate explicit approval and are not exercised by the migration.

## Initial sandbox results (October 19, 2026)

- Sandbox deployed successfully; no Amplify Hosting app, production branch, or DNS
  association was created.
- Imported one new default homepage and recreated the two active Firebase users
  in the Cognito `Admins` group. A second import reported the homepage unchanged;
  no duplicate records or users were created.
- Thirteen live sandbox checks passed, including temporary-password login, admin
  event CRUD, public draft exclusion, denied guest/non-admin writes, S3 upload and
  guest reads, renewed media URLs, disabled self-registration, and logout.
- Browser checks passed for administrator login, homepage save → public rendering,
  draft creation, publish → public rendering, restoring the approved copy, and
  logout. Temporary test users, content, S3 objects, and credentials were removed.
- Type checks, four unit tests, and the production Vite build passed. Build scanning
  confirmed no Firebase references or private migration artifacts.
- Production dependency audit: zero known vulnerabilities. npm still reports
  advisories in transitive development/deployment tooling; these are not bundled
  into the public frontend.
- Initial invitations and password-reset email delivery were not sent/tested.
  Existing administrators require the separately authorized invitation step before
  first login.
- Compiled local preview: http://127.0.0.1:4173/ (uses the sandbox backend).
  `npm start` serves the independent offline preview on 5173.


## Eleventy production release (October 20, 2026)

- Replaced Vite with Eleventy 3.1.7. Both pages are generated from `site/`;
  esbuild bundles the existing CMS browser scripts. Curated media and design remain.
- Fixed the clean-install failure using npm 10.9.4, a consistent peer policy,
  and explicit missing nested OpenTelemetry entries in the dependency lockfile.
  Fresh `npm ci`, type checks, all four tests, offline/connected builds, and
  artifact checks passed locally. Production dependency audit: zero advisories.
- Existing Amplify Hosting app `d3dzwpn8nt32ng` in `us-west-2` is connected to
  `tanglao-interactive/fullrankband`. Job 2 succeeded for commit `de6b9ed`.
  The development sandbox in `us-west-1` remains intact.
- Corrected `/admin` routing and removed the SPA catch-all. Automatic branch builds
  are disabled; pushing code does not itself publish another release.
- Production backend created successfully. Imported one default homepage and
  recreated two administrators with invitations suppressed. No source events or
  referenced Firebase uploads existed to migrate. Private results are in
  `production-migration-report.json` and `production-invitation-list.json` beside
  the original private backup. No invitations or password-reset emails were sent.
- Verified `https://fullrankband.com/` shows the redesign, portrait and artwork
  load, rehearsal audio plays, live video plays, booking links to the public email,
  and `/admin` shows the connected login. No browser warnings/errors were observed.
- Route 53 records were not changed during this release. The existing apex alias
  points to this Amplify distribution. `www` remains unconfigured.
