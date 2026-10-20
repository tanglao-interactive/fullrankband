import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { CognitoIdentityProviderClient, AdminGetUserCommand, AdminCreateUserCommand, AdminAddUserToGroupCommand } from '@aws-sdk/client-cognito-identity-provider';
import { fromIni } from '@aws-sdk/credential-providers';
import { homeFields, eventFields, pick, normalizeHome, rewriteMedia, migrationHash, shouldImport } from './migration-core.mjs';
const directory = resolve(process.env.FULLRANK_MIGRATION_DIR || '/Users/franz.tanglao/Downloads/fullrank-migration-backup-2026-10-19');
const outputs = JSON.parse(await readFile('amplify_outputs.json','utf8'));
const source = JSON.parse(await readFile(join(directory,'firebase-export.json'),'utf8'));
const region = 'us-west-1', credentials = fromIni({ profile: 'franznoel' });
if (outputs.auth?.aws_region !== region || !outputs.custom?.homeTable || !outputs.custom?.eventTable) throw new Error('Expected Full Rank sandbox outputs in us-west-1.');
if (!outputs.custom.stackName?.includes('sandbox') && !process.argv.includes('--allow-production')) throw new Error('Only sandbox imports are enabled by default.');
const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region, credentials }), { marshallOptions: { removeUndefinedValues:true } });
const s3 = new S3Client({ region, credentials });
const cognito = new CognitoIdentityProviderClient({ region, credentials });
const bucket = outputs.storage.bucket_name, pool = outputs.auth.user_pool_id;
const report = { migratedAt:new Date().toISOString(), sourceCounts:{ pages:source.pages.length,events:source.events.length,users:source.users.length,assets:source.assets.length },records:[],assets:[],admins:[],invitationsSent:false };
for (const asset of source.assets) {
  const bytes = await readFile(join(directory,asset.file));
  if(createHash('sha256').update(bytes).digest('hex') !== asset.sha256)throw new Error('Backup checksum mismatch.');
  try {
    const existing = await s3.send(new HeadObjectCommand({ Bucket:bucket,Key:asset.key }));
    if(existing.Metadata?.sha256 !== asset.sha256)throw new Error('Existing S3 object differs from backup; refusing overwrite.');
  } catch(error) {
    if(error.name !== 'NotFound' && error.$metadata?.httpStatusCode !== 404)throw error;
    await s3.send(new PutObjectCommand({ Bucket:bucket,Key:asset.key,Body:bytes,ContentType:asset.contentType,Metadata:{sha256:asset.sha256} }));
  }
  const verified=await s3.send(new HeadObjectCommand({Bucket:bucket,Key:asset.key}));
  if(verified.ContentLength !== asset.bytes || verified.Metadata?.sha256 !== asset.sha256)throw new Error('S3 reconciliation failed.');
  report.assets.push({key:asset.key,verified:true});
}
const defaults = {id:'home',heroTitle:'FULL RANK',heroSubtitle:'Original music. Live and loud.',heroImageUrl:'media/band-portrait.webp',bookingEmail:'admin@fullrankband.com',footerText:`© ${new Date().getFullYear()} Full Rank. All rights reserved.`};
const pages = source.pages.length ? source.pages : [defaults];
for (const [model,records,fields,table] of [['home',pages,homeFields,outputs.custom.homeTable],['event',source.events,eventFields,outputs.custom.eventTable]]) {
 for(const raw of records) {
  if(model==='home' && raw.id !== 'home') {report.records.push({model,id:raw.id,status:'skipped-non-home-document'});continue;}
  const normalized = model==='home' ? normalizeHome(raw) : raw;
  const record={...pick(rewriteMedia(normalized,source.assets,model),fields),id:raw.id,createdAt:raw.createdAt || source.exportedAt,updatedAt:raw.updatedAt || source.exportedAt};
  if(model==='event'){record.sortOrder=Number(record.sortOrder||0);record.isPublished=raw.isPublished !== false;}
  const hash=migrationHash(record);const existing=(await db.send(new GetCommand({TableName:table,Key:{id:record.id},ConsistentRead:true}))).Item;
  if(!shouldImport(existing,record,hash)){report.records.push({model,id:record.id,status:existing?._migrationHash===hash?'unchanged':'skipped-newer'});continue;}
  await db.send(new PutCommand({TableName:table,Item:{...record,_migrationHash:hash},ConditionExpression:existing?'#updated = :previous':'attribute_not_exists(id)',...(existing?{ExpressionAttributeNames:{'#updated':'updatedAt'},ExpressionAttributeValues:{':previous':existing.updatedAt}}:{})}));
  const saved=(await db.send(new GetCommand({TableName:table,Key:{id:record.id},ConsistentRead:true}))).Item;
  if(saved?._migrationHash!==hash)throw new Error('Record reconciliation failed.');
  report.records.push({model,id:record.id,status:'imported'});
 }
}
const emails=[...new Set(source.users.filter(u=>!u.disabled&&u.email).map(u=>u.email))];
if(!emails.length)emails.push('admin@fullrankband.com');
for(const email of emails) {
 let exists=true;
 try{await cognito.send(new AdminGetUserCommand({UserPoolId:pool,Username:email}));}
 catch(error){if(error.name!=='UserNotFoundException')throw error;exists=false;}
 if(!exists)await cognito.send(new AdminCreateUserCommand({UserPoolId:pool,Username:email,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:email},{Name:'email_verified',Value:'true'}]}));
 await cognito.send(new AdminAddUserToGroupCommand({UserPoolId:pool,Username:email,GroupName:'Admins'}));
 report.admins.push({email,status:exists?'existing':'created-invitation-suppressed'});
}
await writeFile(join(directory,'migration-report.json'),JSON.stringify(report,null,2),{mode:0o600});
await writeFile(join(directory,'invitation-list.json'),JSON.stringify({userPoolId:pool,admins:report.admins,sent:false},null,2),{mode:0o600});
console.log(JSON.stringify({report:join(directory,'migration-report.json'),records:report.records,assets:report.assets.length,admins:report.admins.length,invitationsSent:false}));
