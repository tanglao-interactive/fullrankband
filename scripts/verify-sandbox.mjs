import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { signIn, confirmSignIn, signOut, fetchAuthSession } from 'aws-amplify/auth';
import { uploadData, getUrl } from 'aws-amplify/storage';
import { fromIni } from '@aws-sdk/credential-providers';
import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminDeleteUserCommand, DescribeUserPoolCommand } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
const outputs=JSON.parse(await readFile('amplify_outputs.json','utf8'));
if(!outputs.custom?.stackName?.includes('sandbox'))throw new Error('Sandbox verification requires sandbox outputs.');
Amplify.configure(outputs);const client=generateClient({authMode:'userPool'});
const config={region:'us-west-1',credentials:fromIni({profile:'franznoel'})};
const cognito=new CognitoIdentityProviderClient(config),s3=new S3Client(config),db=DynamoDBDocumentClient.from(new DynamoDBClient(config));
const pool=outputs.auth.user_pool_id,run=randomUUID(),ids=[`verify-published-${run}`,`verify-draft-${run}`];
const forbiddenEvent=`verify-forbidden-${run}`,forbiddenPage=`verify-forbidden-home-${run}`;
const usernames=[];const key=`website/verification/${run}.png`;const results=[];
function data(result){if(result.errors?.length)throw new Error(result.errors.map(e=>e.message).join('; '));return result.data;}
async function denied(operation){try{const result=await operation();assert.ok(result.errors?.length,'Unauthorized operation unexpectedly succeeded');}catch(error){if(error.code==='ERR_ASSERTION')throw error;}}
async function createUser(admin){
 const username=`verify-${admin?'admin':'reader'}-${run}@example.com`,password=`A!${randomUUID()}z9`;
 await cognito.send(new AdminCreateUserCommand({UserPoolId:pool,Username:username,TemporaryPassword:password,MessageAction:'SUPPRESS',UserAttributes:[{Name:'email',Value:username},{Name:'email_verified',Value:'true'}]}));usernames.push(username);
 if(admin)await cognito.send(new AdminAddUserToGroupCommand({UserPoolId:pool,Username:username,GroupName:'Admins'}));
 let step=await signIn({username,password});assert.equal(step.nextStep.signInStep,'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED');
 step=await confirmSignIn({challengeResponse:`B!${randomUUID()}y8`});assert.equal(step.isSignedIn,true);results.push(admin?'Admin temporary-password login passed':'Non-admin temporary-password login passed');
}
try{
 const poolConfig=await cognito.send(new DescribeUserPoolCommand({UserPoolId:pool}));assert.equal(poolConfig.UserPool.AdminCreateUserConfig.AllowAdminCreateUserOnly,true);results.push('Public registration disabled');
 await createUser(true);
 for(const [i,id] of ids.entries())data(await client.models.Event.create({id,title:`Verification ${i}`,isPublished:i===0,sortOrder:9999}));
 data(await client.models.Event.update({id:ids[0],title:'Verified published edit'}));
 const saved=data(await client.models.Event.get({id:ids[0]}));assert.equal(saved.title,'Verified published edit');results.push('Admin event create, read and update passed');
 const page=data(await client.models.HomePage.get({id:'home'}));assert.ok(page?.heroTitle);results.push('Migrated homepage readable by administrator');
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 await uploadData({path:key,data:image,options:{contentType:'image/png'}}).result;
 const first=await getUrl({path:key,options:{expiresIn:60}});assert.equal((await fetch(first.url)).ok,true);results.push('Admin upload and resolved S3 image passed');
 data(await client.models.Event.delete({id:ids[1]}));data(await client.models.Event.create({id:ids[1],title:'Hidden draft',isPublished:false}));results.push('Admin event delete passed');
 await signOut();
 const content=data(await client.queries.publicContent({authMode:'identityPool'}));const parsed=typeof content==='string'?JSON.parse(content):content;
 assert.ok(parsed.events.some(e=>e.id===ids[0]));assert.ok(!parsed.events.some(e=>e.id===ids[1]));results.push('Anonymous public query includes published event and excludes draft');
 await denied(()=>client.models.Event.list({authMode:'identityPool'}));await denied(()=>client.models.Event.create({id:forbiddenEvent,title:'Unauthorized draft',isPublished:false},{authMode:'identityPool'}));results.push('Anonymous model reads/writes denied');
 const guestUrl=await getUrl({path:key,options:{expiresIn:60}});assert.equal((await fetch(guestUrl.url)).ok,true);const renewed=await getUrl({path:key,options:{expiresIn:3600}});assert.equal((await fetch(renewed.url)).ok,true);results.push('Guest S3 reads and renewed URLs passed');
 let guestUpload=false;try{await uploadData({path:key,data:image}).result;guestUpload=true;}catch{}assert.equal(guestUpload,false);results.push('Guest upload denied');
 await createUser(false);await denied(()=>client.models.Event.list());await denied(()=>client.models.HomePage.create({id:forbiddenPage,heroTitle:'Unauthorized'}));
 let unauthorizedUpload=false;try{await uploadData({path:key,data:image}).result;unauthorizedUpload=true;}catch{}assert.equal(unauthorizedUpload,false);results.push('Non-admin reads, edits and uploads denied');
 await signOut();results.push('Logout passed');
}finally{
 await signOut().catch(()=>{});
 for(const id of [...ids,forbiddenEvent])await db.send(new DeleteCommand({TableName:outputs.custom.eventTable,Key:{id}}));
 await db.send(new DeleteCommand({TableName:outputs.custom.homeTable,Key:{id:forbiddenPage}}));
 await s3.send(new DeleteObjectCommand({Bucket:outputs.storage.bucket_name,Key:key}));
 for(const Username of usernames)await cognito.send(new AdminDeleteUserCommand({UserPoolId:pool,Username}));
 await writeFile('/Users/franz.tanglao/Downloads/fullrank-migration-backup-2026-10-19/sandbox-verification.json',JSON.stringify({results,cleanedUp:true},null,2),{mode:0o600});
}
console.log(JSON.stringify({passed:results.length,results,testResourcesRemoved:true},null,2));
