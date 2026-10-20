import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
const directory = resolve(process.env.FULLRANK_MIGRATION_DIR || '/Users/franz.tanglao/Downloads/fullrank-migration-backup-2026-10-19');
if (directory.startsWith(resolve('public')) || directory.startsWith(resolve('dist'))) throw new Error('Backup must be outside public and dist.');
await mkdir(directory, { recursive: true, mode: 0o700 });
const require = createRequire(import.meta.url);
let auth;
try { auth = require('firebase-tools/lib/auth.js'); }
catch { throw new Error('The one-time exporter requires firebase-tools. Install it temporarily with npm install --no-save --package-lock=false firebase-tools, export, then run npm ci.'); }
const account = auth.getGlobalDefaultAccount();
if (!account) throw new Error('Firebase CLI login required for this one-time export.');
const { access_token: token } = await auth.getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase']);
async function request(url) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Firebase export HTTP ${response.status}: ${new URL(url).pathname}`);
  return response.json();
}
function decode(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decode(v)]));
  throw new Error('Unsupported Firestore value type.');
}
async function collection(name) {
  const records = []; let pageToken;
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/fullrankband/databases/(default)/documents/${name}`);
    url.searchParams.set('pageSize', '100'); if (pageToken) url.searchParams.set('pageToken', pageToken);
    const page = await request(url); pageToken = page.nextPageToken;
    for (const doc of page.documents || []) records.push({ id: doc.name.split('/').at(-1), ...Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v]) => [k,decode(v)])) });
  } while (pageToken);
  return records;
}
const pages = await collection('site'); const events = await collection('events');
// Exported separately using Firebase CLI. Keep only identities, never password hashes.
const exportedUsers = JSON.parse(await readFile(join(directory, 'firebase-users.json'), 'utf8'));
const users = (exportedUsers.users || []).map(user => ({ uid: user.localId || user.uid, email: user.email, disabled: Boolean(user.disabled) }));
await writeFile(join(directory, 'firebase-users.json'), JSON.stringify({ users }, null, 2), { mode: 0o600 });
const urls = new Set();
function findUrls(value) {
  if (typeof value === 'string') for (const match of value.matchAll(/https:\/\/firebasestorage\.googleapis\.com\/[^\s"'<>]+/g)) urls.add(match[0].replaceAll('&amp;', '&'));
  else if (Array.isArray(value)) value.forEach(findUrls);
  else if (value && typeof value === 'object') Object.values(value).forEach(findUrls);
}
findUrls(pages); findUrls(events);
const assets = [];
await mkdir(join(directory, 'assets'), { recursive: true, mode: 0o700 });
for (const url of urls) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Referenced Firebase upload unavailable (${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const filename = decodeURIComponent(new URL(url).pathname.split('/o/')[1] || '').split('/').at(-1).replace(/[^a-zA-Z0-9._-]/g, '-');
  const file = `assets/${sha256}-${filename}`;
  await writeFile(join(directory, file), bytes, { mode: 0o600 });
  assets.push({ sourceUrl: url, file, key: `website/migrated/${sha256}-${filename}`, sha256, bytes: bytes.length, contentType: response.headers.get('content-type') || 'application/octet-stream' });
}
const backup = { version: 1, project: 'fullrankband', exportedAt: new Date().toISOString(), pages, events, users, assets };
await writeFile(join(directory, 'firebase-export.json'), JSON.stringify(backup, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ backup: join(directory, 'firebase-export.json'), pages: pages.length, events: events.length, users: users.length, referencedAssets: assets.length }));
