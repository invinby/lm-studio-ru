'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
let api;try{api=require('../lib/patcher.cjs')}catch{api={}}
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lmru-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const root=path.join(dir,'resources','app');fs.mkdirSync(path.join(root,'.webpack','renderer'),{recursive:true});
 fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({version:'0.4.26+4'}));
 const source='const modules={12:t=>{"use strict";t.exports=JSON.parse(\'{"hello":"Hello"}\')}};const ru={shared:void 0};const instance={language:"ru"};globalThis.fake=instance;const ui={children:"Staff picks",title:"Keep Original"};';
 const bundle=path.join(root,'.webpack','renderer','main_window.js');fs.writeFileSync(bundle,source);
 const manifest={version:'0.4.26+4',patchVersion:'1.0.0',bundle:'.webpack/renderer/main_window.js',sha256:hash(source),ruModules:{chat:12},sharedAnchor:'const ru={shared:void 0};',sharedReplacementPrefix:'const ru={shared:',sharedReplacementSuffix:'};',i18nAnchor:'globalThis.fake=instance;',i18nReplacement:'globalThis.fake=instance;globalThis.__lmStudioRuI18n=instance;'};
 return {dir,root,source,bundle,manifest,locales:{chat:{hello:'Привет'},shared:{save:'Сохранить'}},staticStrings:{'Staff picks':'Подборка команды'}};
}
test('patcher API exists',()=>{assert.equal(typeof api.operate,'function');assert.equal(typeof api.buildPatchedBundle,'function')});
test('patch translates Russian resources and static labels, leaves unrelated text',t=>{
 const f=fixture(t);const result=api.buildPatchedBundle(f.source,f.manifest,f.locales,f.staticStrings);
 const sandbox={};vm.runInNewContext(result.code,sandbox);assert.equal(sandbox.__lmStudioRuText('Staff picks'),'Подборка команды');
 sandbox.fake.language='en';assert.equal(sandbox.__lmStudioRuText('Staff picks'),'Staff picks');
 assert.ok(result.code.includes('Keep Original'));assert.equal(result.staticOccurrences,1);
 assert.deepEqual(api.extractModule(result.code,12),{hello:'Привет'});
});
test('dry run does not write a backup or change application bytes',t=>{
 const f=fixture(t);const r=api.operate({...f,action:'apply',dryRun:true,isRunning:()=>false});
 assert.equal(r.state,'ready');assert.equal(fs.readFileSync(f.bundle,'utf8'),f.source);assert.equal(fs.existsSync(path.join(f.root,'.lm-studio-ru-backup')),false);
});
test('apply, repeated apply and byte-exact restore',t=>{
 const f=fixture(t);assert.equal(api.operate({...f,action:'apply',isRunning:()=>false}).state,'installed');
 const changed=fs.readFileSync(f.bundle);assert.notEqual(hash(changed),f.manifest.sha256);
 assert.equal(api.operate({...f,action:'apply',isRunning:()=>false}).state,'installed');assert.deepEqual(fs.readFileSync(f.bundle),changed);
 assert.equal(api.operate({...f,action:'restore',isRunning:()=>false}).state,'original');assert.equal(fs.readFileSync(f.bundle,'utf8'),f.source);
 assert.equal(api.operate({...f,action:'restore',isRunning:()=>false}).state,'original');
});
test('rejects unknown version before writing',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'package.json'),'{"version":"0.5.0"}');assert.throws(()=>api.operate({...f,action:'apply',isRunning:()=>false}),/version|верси/i);assert.equal(fs.readFileSync(f.bundle,'utf8'),f.source)});
test('rejects changed source hash before writing',t=>{const f=fixture(t);fs.appendFileSync(f.bundle,'/*foreign*/');assert.throws(()=>api.operate({...f,action:'apply',isRunning:()=>false}),/hash|хеш|SHA/i);assert.equal(fs.existsSync(path.join(f.root,'.lm-studio-ru-backup')),false)});
test('refuses modification while app is running; status remains available',t=>{const f=fixture(t);assert.throws(()=>api.operate({...f,action:'apply',isRunning:()=>true}),/running|закрой/i);assert.equal(api.operate({...f,action:'status',isRunning:()=>true}).state,'original')});
test('refuses tampered backup',t=>{const f=fixture(t);api.operate({...f,action:'apply',isRunning:()=>false});fs.appendFileSync(path.join(f.root,'.lm-studio-ru-backup','main_window.js.original'),'tampered');assert.throws(()=>api.operate({...f,action:'restore',isRunning:()=>false}),/backup|копи|hash|SHA/i)});
test('refuses overwriting third-party modification after install',t=>{const f=fixture(t);api.operate({...f,action:'apply',isRunning:()=>false});fs.appendFileSync(f.bundle,'foreign');assert.throws(()=>api.operate({...f,action:'restore',isRunning:()=>false}),/hash|SHA|измен/i)});
test('rejects missing anchors and modules',t=>{const f=fixture(t);assert.throws(()=>api.buildPatchedBundle(f.source,{...f.manifest,sharedAnchor:'missing'},f.locales,f.staticStrings),/anchor|участок/i);assert.throws(()=>api.extractModule(f.source,999),/module|модул/i)});
test('rejects duplicate anchors',t=>{const f=fixture(t);assert.throws(()=>api.buildPatchedBundle(f.source+f.manifest.i18nAnchor,f.manifest,f.locales,f.staticStrings),/anchor|участок/i)});
test('literal extraction supports apostrophes and backslashes without executing code',()=>{assert.deepEqual(api.extractModule('1:t=>{"use strict";t.exports=JSON.parse(\'{"text":"Don\\\'t", "path":"C:\\\\tmp"}\')}',1),{text:"Don't",path:'C:\tmp'});assert.throws(()=>api.extractModule('1:t=>{"use strict";t.exports=JSON.parse(process.exit())}',1),/module|модул/i)});
test('restore respects installation lock and refuses concurrent writes',t=>{const f=fixture(t);api.operate({...f,action:'apply',isRunning:()=>false});fs.mkdirSync(path.join(f.root,'.lm-studio-ru-lock'));assert.throws(()=>api.operate({...f,action:'restore',isRunning:()=>false}),/блокиров|установка/i)});
test('translates leading UI fragments in children arrays without touching following expressions',t=>{const f=fixture(t);const result=api.buildPatchedBundle(f.source+'const fragment={children:["More from ","untranslated author"]};',f.manifest,f.locales,{'More from ':'Ещё от '});assert.ok(result.code.includes('children:[globalThis.__lmStudioRuText("More from "),"untranslated author"]'))});
test('reapply installs changed translations from original backup without stacking injections',t=>{const f=fixture(t);api.operate({...f,action:'apply',isRunning:()=>false});const first=fs.readFileSync(f.bundle);f.locales.chat.hello='Обновлённый перевод';const dry=api.operate({...f,action:'apply',dryRun:true,isRunning:()=>false});assert.equal(dry.state,'ready-to-update');assert.deepEqual(fs.readFileSync(f.bundle),first);const r=api.operate({...f,action:'apply',isRunning:()=>false});assert.equal(r.updated,true);assert.equal(api.extractModule(fs.readFileSync(f.bundle,'utf8'),12).hello,'Обновлённый перевод');assert.equal((fs.readFileSync(f.bundle,'utf8').match(/function installRuntime/g)||[]).length,1);api.operate({...f,action:'restore',isRunning:()=>false});assert.equal(fs.readFileSync(f.bundle,'utf8'),f.source)});
test('reactive source edits subscribe memoized components and invalidate language dependencies',t=>{const f=fixture(t);const suffix='function component(){const label={children:"Staff picks"};return label}const deps=[];';const source=f.source+suffix;f.manifest.reactiveEdits=[{start:source.indexOf('const label='),original:'',replacement:'globalThis.__lmStudioRuUseTranslation();'},{start:source.lastIndexOf('[]'),original:'[]',replacement:'[globalThis.__lmStudioRuI18n?.language]'}];const result=api.buildPatchedBundle(source,f.manifest,f.locales,f.staticStrings);let subscribed=0;const sandbox={__lmStudioRuUseTranslation:()=>{subscribed++}};vm.runInNewContext(result.code+'globalThis.getLabel=component;globalThis.getDeps=()=>deps;',sandbox);assert.equal(sandbox.getLabel().children,'Подборка команды');assert.equal(subscribed,1);assert.equal(sandbox.getDeps()[0],'ru');sandbox.fake.language='en';assert.equal(sandbox.getLabel().children,'Staff picks');assert.equal(subscribed,2)});
test('reactive edits reject an unexpected source span',t=>{const f=fixture(t);f.manifest.reactiveEdits=[{start:1,original:'wrong',replacement:'x'}];assert.throws(()=>api.buildPatchedBundle(f.source,f.manifest,f.locales,f.staticStrings),/участок|edit/i)});
