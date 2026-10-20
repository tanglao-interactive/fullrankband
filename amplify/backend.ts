import { Stack } from 'aws-cdk-lib';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { publicContent } from './functions/public-content/resource';
const backend = defineBackend({ auth, data, storage, publicContent });
backend.auth.resources.cfnResources.cfnUserPool.adminCreateUserConfig = { allowAdminCreateUserOnly: true };
for (const [model, variable] of [['HomePage', 'HOME_TABLE'], ['Event', 'EVENT_TABLE']] as const) {
  const table = backend.data.resources.tables[model];
  table.grantReadData(backend.publicContent.resources.lambda);
  (backend.publicContent.resources.lambda as LambdaFunction).addEnvironment(variable, table.tableName);
}
backend.addOutput({ custom: {
  homeTable: backend.data.resources.tables.HomePage.tableName,
  stackName: Stack.of(backend.data.resources.tables.HomePage).stackName,
  eventTable: backend.data.resources.tables.Event.tableName,
} });
