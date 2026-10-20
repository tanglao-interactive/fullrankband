import test from 'node:test';
import assert from 'node:assert/strict';
import { publishedEvents, project, homeFields } from '../amplify/functions/public-content/project.ts';
import { rewriteMedia, shouldImport, migrationHash, normalizeHome } from '../scripts/migration-core.mjs';
test('public content excludes drafts, missing publish flags and internal metadata',()=>{
 const events=publishedEvents([{id:'draft',isPublished:false},{id:'legacy'},{id:'yes',isPublished:true,sortOrder:2,privateNote:'secret'}]);
 assert.deepEqual(events,[{id:'yes',sortOrder:2,isPublished:true}]);
 assert.deepEqual(project({id:'home',privateNote:'secret'},homeFields),{id:'home'});
});
test('migration rewrites uploads to stable object keys including custom HTML',()=>{
 const assets=[{sourceUrl:'https://firebase.test/a',key:'website/migrated/a'}];
 assert.deepEqual(rewriteMedia({heroImageUrl:assets[0].sourceUrl,customHtml:'<img src="https://firebase.test/a">'},assets,'home'),{heroImageUrl:'',heroImageKey:assets[0].key,customHtml:'<img src="s3://website/migrated/a">'});
});
test('repeat imports skip identical records and never overwrite newer edits',()=>{
 const record={id:'a',updatedAt:'2026-10-01T00:00:00Z'},hash=migrationHash(record);
 assert.equal(shouldImport({...record,_migrationHash:hash},record,hash),false);
 assert.equal(shouldImport({updatedAt:'2026-10-02T00:00:00Z'},record,hash),false);
 assert.equal(shouldImport(null,record,hash),true);
});
test('legacy poster defaults normalize without replacing deliberate new content',()=>{
 assert.equal(normalizeHome({heroSubtitle:'Indie Rock Night'}).heroSubtitle,'Original music. Live and loud.');
 assert.equal(normalizeHome({heroSubtitle:'Custom title'}).heroSubtitle,'Custom title');
});
