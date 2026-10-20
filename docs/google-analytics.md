# Google Analytics record

Verified October 20, 2026 in the existing Google Analytics account:

- Account: Full Rank Band (`337778267`).
- GA4 property: fullrankband (`468806792`).
- Web stream: `13036482608`, displayed as Web.
- Website URL: `https://fullrankband.com`.
- Measurement ID: `G-S2RKQ7Q046`.
- [Open the web stream](https://analytics.google.com/analytics/web/#/a337778267p468806792/admin/streams/table/13036482608).
- Google reported that data collection was active in the past 48 hours.
- The reports snapshot for September 22–October 19, 2026 showed 8 active users
  and 9 sessions. These are historical observed values, not a live counter.

`public/scripts/analytics.js` initializes the existing tag once on the public
production hostnames. Localhost, Amplify previews, and admin pages are excluded.
No new property or stream was created; the existing reporting history is retained.
The admin template contains no Analytics tag.

Realtime is the appropriate place to check new visits after publication; standard
reports can take longer to reflect newly collected activity. Browser blockers or
visitor privacy settings may prevent collection. No Google account permissions,
advertising settings, or consent settings were changed by this code update.
