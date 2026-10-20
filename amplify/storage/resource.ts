import { defineStorage } from '@aws-amplify/backend';
export const storage = defineStorage({
  name: 'fullRankMedia',
  access: allow => ({
    'website/*': [allow.guest.to(['get']), allow.authenticated.to(['get']), allow.groups(['Admins']).to(['read', 'write', 'delete'])],
  }),
});
