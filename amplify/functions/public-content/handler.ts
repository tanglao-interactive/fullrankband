import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { homeFields, project, publishedEvents } from './project';
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
export const handler = async () => {
  const home = await db.send(new GetCommand({ TableName: process.env.HOME_TABLE!, Key: { id: 'home' } }));
  const events: Record<string, unknown>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = await db.send(new ScanCommand({ TableName: process.env.EVENT_TABLE!,
      FilterExpression: '#published = :yes', ExpressionAttributeNames: { '#published': 'isPublished' },
      ExpressionAttributeValues: { ':yes': true }, ExclusiveStartKey: cursor }));
    events.push(...(result.Items || [])); cursor = result.LastEvaluatedKey;
  } while (cursor);
  return { page: project(home.Item, homeFields), events: publishedEvents(events) };
};
