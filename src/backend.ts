import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { getUrl, uploadData } from 'aws-amplify/storage';
import { fetchAuthSession, getCurrentUser, signOut } from 'aws-amplify/auth';
import outputs from 'virtual:amplify-config';
import type { Schema } from '../amplify/data/resource';
export const cloudEnabled = Boolean(outputs);
if (outputs) Amplify.configure(outputs);
const client = cloudEnabled ? generateClient<Schema>({ authMode: 'userPool' }) : null;
function requireClient() { if (!client) throw new Error('This is an offline preview. Connect an AWS sandbox to edit content.'); return client; }
function checked<T>(result: { data?: T; errors?: readonly { message: string }[] }) {
  if (result.errors?.length) throw new Error(result.errors.map(e => e.message).join('; '));
  return result.data;
}
export async function adminSession() {
  if (!cloudEnabled) return null;
  try {
    const user = await getCurrentUser();
    const session = await fetchAuthSession();
    const groups = session.tokens?.accessToken.payload['cognito:groups'];
    if (!Array.isArray(groups) || !groups.includes('Admins')) { await signOut(); throw new Error('This account is not a CMS administrator.'); }
    return user;
  } catch (error) {
    if ((error as Error).message.includes('not a CMS')) throw error;
    return null;
  }
}
export async function resolveMedia(key?: string | null, fallback?: string | null) {
  if (!key) return fallback || '';
  if (!key.startsWith('website/')) throw new Error('Unsupported website media path.');
  return (await getUrl({ path: key, options: { expiresIn: 3600, validateObjectExistence: true } })).url.toString();
}
export async function publicContent() {
  if (!cloudEnabled) return { page: null, events: [] };
  const session = await fetchAuthSession();
  const result = checked(await requireClient().queries.publicContent({ authMode: session.tokens ? 'userPool' : 'identityPool' }));
  const content = typeof result === 'string' ? JSON.parse(result) : result;
  const { page, events = [] } = content as any;
  if (page) {
    page.heroImageUrl = await resolveMedia(page.heroImageKey, page.heroImageUrl);
    if (page.customHtml) {
      const html = new DOMParser().parseFromString(page.customHtml, 'text/html');
      await Promise.all([...html.querySelectorAll('[src^="s3://"], [href^="s3://"]')].map(async element => {
        for (const attribute of ['src', 'href']) {
          const value = element.getAttribute(attribute);
          if (value?.startsWith('s3://')) element.setAttribute(attribute, await resolveMedia(value.slice(5)));
        }
      }));
      page.customHtml = html.body.innerHTML;
    }
  }
  await Promise.all(events.map(async (event: any) => { event.imageUrl = await resolveMedia(event.imageKey, event.imageUrl); }));
  return { page, events };
}
export async function getPage() { return checked(await requireClient().models.HomePage.get({ id: 'home' })); }
export async function listEvents() {
  const items: any[] = []; let nextToken: string | null | undefined;
  do {
    const result = await requireClient().models.Event.list({ nextToken, limit: 100 });
    items.push(...(checked(result) || [])); nextToken = result.nextToken;
  } while (nextToken);
  return items.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id.localeCompare(b.id));
}
export async function savePage(values: any) {
  values = { ...values, bookingEmail: values.bookingEmail || null };
  const existing = await getPage();
  if (existing) return checked(await requireClient().models.HomePage.update({ ...values, id: 'home' }));
  return checked(await requireClient().models.HomePage.create({ ...values, id: 'home' }));
}
export async function saveEvent(id: string, values: any) {
  return id ? checked(await requireClient().models.Event.update({ ...values, id })) : checked(await requireClient().models.Event.create(values));
}
export async function deleteEvent(id: string) { checked(await requireClient().models.Event.delete({ id })); }
export async function uploadImage(file: File, folder: string) {
  requireClient();
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const filename = file.name.replace(/[^a-z0-9._-]/gi, '-').toLowerCase();
  const path = `website/${folder}/${crypto.randomUUID()}-${filename}`;
  await uploadData({ path, data: file, options: { contentType: file.type } }).result;
  return path;
}
