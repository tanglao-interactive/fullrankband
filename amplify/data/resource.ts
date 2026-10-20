import { a, defineData, type ClientSchema } from '@aws-amplify/backend';
import { publicContent } from '../functions/public-content/resource';
const schema = a.schema({
  HomePage: a.model({
    heroTitle: a.string(), heroSubtitle: a.string(), heroDate: a.string(),
    venueName: a.string(), addressLine1: a.string(), addressLine2: a.string(), callout: a.string(),
    footerText: a.string(), heroImageUrl: a.string(), heroImageKey: a.string(),
    bookingEmail: a.email(), customHtml: a.string(),
  }).authorization(allow => [allow.group('Admins')]),
  Event: a.model({
    title: a.string().required(), date: a.string(), time: a.string(), venue: a.string(), address: a.string(),
    ticketInfo: a.string(), description: a.string(), imageUrl: a.string(), imageKey: a.string(),
    sortOrder: a.integer().default(0), isPublished: a.boolean().default(false),
  }).authorization(allow => [allow.group('Admins')]),
  publicContent: a.query().returns(a.json()).handler(a.handler.function(publicContent))
    .authorization(allow => [allow.guest(), allow.authenticated()]),
});
export type Schema = ClientSchema<typeof schema>;
export const data = defineData({ schema, authorizationModes: { defaultAuthorizationMode: 'iam' } });
