import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(join(directory, entry.name)) : [join(directory, entry.name)]);
}
const files = walk('dist');
const firebase = files.filter(file => /\.(js|html)$/.test(file) && /firebase|firestore/i.test(readFileSync(file, 'utf8')));
if (firebase.length) throw new Error(`Firebase references in build: ${firebase.join(', ')}`);
if (files.some(file => /migration|inventory|backup|legacy/.test(file))) throw new Error('Private migration material in build.');
for (const required of ['dist/index.html', 'dist/admin/index.html', 'dist/sitemap.xml', 'dist/robots.txt', 'dist/media/live-on-stage.mp4', 'dist/media/2-bot-rehearsal.mp3']) {
  if (!files.includes(required)) throw new Error(`Missing required build asset: ${required}`);
}
const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
if (!sitemap.includes('<loc>https://fullrankband.com/</loc>') || sitemap.includes('/admin')) throw new Error('Sitemap must include the public homepage and exclude admin.');
if (!readFileSync('dist/robots.txt', 'utf8').includes('Sitemap: https://fullrankband.com/sitemap.xml')) throw new Error('Missing sitemap discovery in robots.txt.');
console.log('Build artifacts verified: both entrypoints and media present; no Firebase or private migration data.');
