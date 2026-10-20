// Explicit projection keeps internal model metadata and unpublished events out of the public API.
export const homeFields = ['id', 'heroTitle', 'heroSubtitle', 'heroDate', 'venueName', 'addressLine1', 'addressLine2', 'callout', 'footerText', 'heroImageUrl', 'heroImageKey', 'bookingEmail', 'customHtml'];
export const eventFields = ['id', 'title', 'date', 'time', 'venue', 'address', 'ticketInfo', 'description', 'imageUrl', 'imageKey', 'sortOrder', 'isPublished'];
export function project(record: Record<string, unknown> | undefined, fields: string[]) {
  if (!record) return null;
  return Object.fromEntries(fields.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
}
export function publishedEvents(records: Record<string, unknown>[]) {
  return records.filter(record => record.isPublished === true)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.id).localeCompare(String(b.id)))
    .map(record => project(record, eventFields));
}
