import { defineFunction } from '@aws-amplify/backend';
export const publicContent = defineFunction({
  name: 'fullrank-public-content', entry: './handler.ts', resourceGroupName: 'data', timeoutSeconds: 30, runtime: 22,
});
