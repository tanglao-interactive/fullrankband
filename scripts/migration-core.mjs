import { createHash } from 'node:crypto';
export const homeFields = ['heroTitle','heroSubtitle','heroDate','venueName','addressLine1','addressLine2','callout','footerText','heroImageUrl','heroImageKey','bookingEmail','customHtml'];
export const eventFields = ['title','date','time','venue','address','ticketInfo','description','imageUrl','imageKey','sortOrder','isPublished'];
export function pick(record, fields) { return Object.fromEntries(fields.filter(key => record[key] !== undefined && record[key] !== null).map(key => [key,record[key]])); }
export function normalizeHome(record) {
  const legacy = { heroSubtitle:'Indie Rock Night',heroDate:'Dec 28 - 9 PM',venueName:"Moon Moon's Bar & Cafe",addressLine1:'Triangle Island Plaza, 2nd Floor Narra Street',addressLine2:'Shopping - Bacolod City',callout:'NO DOOR CHARGE',footerText:'© 2024 Full Rank | All Rights Reserved',heroImageUrl:'images/full-rank-bank-wish-bg.jpeg' };
  const modern = { heroSubtitle:'Original music. Live and loud.',heroDate:'',venueName:'',addressLine1:'',addressLine2:'',callout:'',footerText:`© ${new Date().getFullYear()} Full Rank. All rights reserved.`,heroImageUrl:'media/band-portrait.webp' };
  const next = { ...record };
  for (const [field,value] of Object.entries(legacy)) if(next[field] === value) next[field] = modern[field];
  return next;
}
export function rewriteMedia(record, assets, type) {
  const next = { ...record };
  const urlField = type === 'home' ? 'heroImageUrl' : 'imageUrl';
  const keyField = type === 'home' ? 'heroImageKey' : 'imageKey';
  const asset = assets.find(asset => asset.sourceUrl === next[urlField]);
  if (asset) { next[keyField] = asset.key; next[urlField] = ''; }
  if (next.customHtml) for (const asset of assets) {
    next.customHtml = next.customHtml.replaceAll(asset.sourceUrl, `s3://${asset.key}`).replaceAll(asset.sourceUrl.replaceAll('&', '&amp;'), `s3://${asset.key}`);
  }
  return next;
}
export function migrationHash(record) { return createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(record).sort(([a],[b])=>a.localeCompare(b))))).digest('hex'); }
export function shouldImport(existing, incoming, hash) {
  if (!existing) return true;
  if (existing._migrationHash === hash) return false;
  if (!incoming.updatedAt) return false;
  return Date.parse(existing.updatedAt || 0) <= Date.parse(incoming.updatedAt);
}
