'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {installRuntime}=require('./runtime.cjs');
const sha256=data=>crypto.createHash('sha256').update(data).digest('hex');
const escapeRegExp=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function modulePattern(id){
 if(!Number.isSafeInteger(Number(id)))throw new Error('Некорректный идентификатор модуля');
 return new RegExp('(?<![0-9])'+id+':t=>\\{"use strict";t\\.exports=JSON\\.parse\\((\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*")\\)\\}','g');
}
function extractModule(source,id){
 const matches=[...source.matchAll(modulePattern(id))];
 if(matches.length!==1)throw new Error(`Модуль ${id}: ожидалось одно совпадение, найдено ${matches.length}`);
 // The regexp accepts a single quoted string literal only, never a JS expression.
 const serialized=vm.runInNewContext(matches[0][1],Object.create(null),{timeout:1000});
 return JSON.parse(serialized);
}
function replaceOnce(source,anchor,replacement){
 const first=source.indexOf(anchor);
 if(first<0||source.indexOf(anchor,first+anchor.length)>=0)throw new Error('Ожидаемый участок (anchor) отсутствует или повторяется');
 return source.slice(0,first)+replacement+source.slice(first+anchor.length);
}
function buildPatchedBundle(source,manifest,locales,staticStrings){
 let code=source;
 const pieces=[];let cursor=0;
 for(const edit of [...(manifest.reactiveEdits||[])].sort((a,b)=>a.start-b.start)){
  if(!Number.isSafeInteger(edit.start)||edit.start<cursor||edit.start>source.length||typeof edit.original!=='string'||typeof edit.replacement!=='string'||source.slice(edit.start,edit.start+edit.original.length)!==edit.original)throw new Error('Ожидаемый участок reactive edit не совпадает');
  pieces.push(source.slice(cursor,edit.start),edit.replacement);cursor=edit.start+edit.original.length;
 }
 if(pieces.length)code=pieces.join('')+source.slice(cursor);
 for(const [namespace,id] of Object.entries(manifest.ruModules)){
  extractModule(code,id);
  if(!locales[namespace])throw new Error(`Нет перевода: ${namespace}`);
  const replacement=`${id}:t=>{"use strict";t.exports=JSON.parse(${JSON.stringify(JSON.stringify(locales[namespace]))})}`;
  code=code.replace(modulePattern(id),()=>replacement);
 }
 code=replaceOnce(code,manifest.sharedAnchor,manifest.sharedReplacementPrefix+JSON.stringify(locales.shared)+manifest.sharedReplacementSuffix);
 code=replaceOnce(code,manifest.i18nAnchor,manifest.i18nReplacement);
 if(manifest.dateAnchor)code=replaceOnce(code,manifest.dateAnchor,manifest.dateReplacement);
 let staticOccurrences=0;const used=new Set();
 const properties=/(\b(?:children|placeholder|title|label|description|tooltip|alt)|"aria-(?:label|description)"):(\[)?("(?:\\.|[^"\\])*")/g;
 code=code.replace(properties,(whole,prop,array,literal)=>{
  const text=JSON.parse(literal);
  if(!Object.hasOwn(staticStrings,text)||text===staticStrings[text])return whole;
  staticOccurrences++;used.add(text);
  return `${prop}:${array||''}globalThis.__lmStudioRuText(${literal})`;
 });
 const helper=';('+installRuntime.toString()+')('+JSON.stringify(staticStrings)+');\n';
 code=helper+code;
 // Parse the complete bundle without executing the application.
 new vm.Script(code,{filename:'main_window.js'});
 return {code,staticOccurrences,staticPhrases:used.size};
}
function isAppRunning(appDir){
 if(process.platform!=='win32')return false;
 // Get-Process reads process names only; no command lines, tokens or user files.
 const result=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"@(Get-Process -Name 'LM Studio' -ErrorAction SilentlyContinue).Count"],{encoding:'utf8',windowsHide:true});
 const count=Number(result.trim());
 if(!Number.isFinite(count))throw new Error('Не удалось проверить процессы LM Studio');
 return count>0;
}
function atomicWrite(file,bytes){
 const temp=file+`.lmru-${process.pid}-${crypto.randomBytes(4).toString('hex')}.tmp`;
 let fd;
 try{
  fd=fs.openSync(temp,'wx');fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
  fs.renameSync(temp,file);
 }finally{if(fd!==undefined)fs.closeSync(fd);if(fs.existsSync(temp))fs.unlinkSync(temp)}
}
function withLock(root,callback){
 const lock=path.join(root,'.lm-studio-ru-lock');
 try{fs.mkdirSync(lock)}catch(error){if(error.code==='EEXIST')throw new Error('Другая установка уже выполняется или осталась блокировка .lm-studio-ru-lock');throw error}
 try{return callback()}finally{fs.rmdirSync(lock)}
}
function operate(options){
 const {manifest,locales,staticStrings,action='status',dryRun=false}=options;
 if(!['status','apply','restore'].includes(action))throw new Error('Неизвестное действие');
 const root=options.root||path.join(options.appDir,'resources','app');
 const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
 if(version!==manifest.version)throw new Error(`Неподдерживаемая версия ${version}. Нужна ${manifest.version}`);
 const bundle=path.resolve(root,manifest.bundle);
 if(!bundle.startsWith(path.resolve(root)+path.sep))throw new Error('Путь бандла выходит за папку приложения');
 const current=fs.readFileSync(bundle);const currentHash=sha256(current);
 const backupDir=path.join(root,'.lm-studio-ru-backup');
 const originalFile=path.join(backupDir,'main_window.js.original');
 const stateFile=path.join(backupDir,'state.json');
 let state=null;
 if(fs.existsSync(stateFile)){
  state=JSON.parse(fs.readFileSync(stateFile,'utf8'));
  if(state.originalSha256!==manifest.sha256||sha256(fs.readFileSync(originalFile))!==manifest.sha256)throw new Error('Повреждена резервная копия (SHA-256)');
 }
 const status=currentHash===manifest.sha256?'original':state&&currentHash===state.patchedSha256?'installed':'modified';
 if(status==='modified')throw new Error('SHA-256 не совпадает: файл изменён другой версией или сторонним патчем');
 if(action==='status')return {state:status,version,sha256:currentHash,backup:!!state};
 if((options.isRunning||isAppRunning)(options.appDir))throw new Error('Сначала полностью закройте LM Studio, включая значок в трее');
 if(action==='restore'){
  if(status==='original')return {state:'original',version};
  if(!state)throw new Error('Резервная копия отсутствует');
  if(!dryRun)withLock(root,()=>{
   if(sha256(fs.readFileSync(bundle))!==currentHash)throw new Error('Файл изменился во время отката');
   const backup=fs.readFileSync(originalFile);
   if(sha256(backup)!==manifest.sha256)throw new Error('Резервная копия изменилась во время отката');
   atomicWrite(bundle,backup);
   if(sha256(fs.readFileSync(bundle))!==manifest.sha256)throw new Error('Проверка SHA-256 после отката не пройдена');
  });
  return {state:dryRun?'ready-to-restore':'original',version};
 }
 const original=status==='installed'?fs.readFileSync(originalFile):current;
 const built=buildPatchedBundle(original.toString('utf8'),manifest,locales,staticStrings);
 const patchedSha256=sha256(Buffer.from(built.code));
 if(status==='installed'&&patchedSha256===currentHash)return {state:'installed',version,alreadyInstalled:true};
 if(dryRun)return {state:status==='installed'?'ready-to-update':'ready',version,patchedSha256,staticPhrases:built.staticPhrases,staticOccurrences:built.staticOccurrences};
 // One lock serializes all mutations including backup creation and restore.
 withLock(root,()=>{
  if(sha256(fs.readFileSync(bundle))!==currentHash)throw new Error('Файл изменился во время установки');
  fs.mkdirSync(backupDir,{recursive:true});
  if(fs.existsSync(originalFile)){
   if(sha256(fs.readFileSync(originalFile))!==manifest.sha256)throw new Error('Существующая резервная копия повреждена');
  }else{
   const fd=fs.openSync(originalFile,'wx');try{fs.writeFileSync(fd,original);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}
  }
  const metadata={patchVersion:manifest.patchVersion,appVersion:version,originalSha256:manifest.sha256,patchedSha256,installedAt:new Date().toISOString()};
  atomicWrite(stateFile,Buffer.from(JSON.stringify(metadata,null,2)+'\n'));
  atomicWrite(bundle,Buffer.from(built.code));
  if(sha256(fs.readFileSync(bundle))!==patchedSha256)throw new Error('Проверка записи не пройдена; резервная копия сохранена');
 });
 return {state:'installed',version,patchedSha256,updated:status==='installed',staticPhrases:built.staticPhrases,staticOccurrences:built.staticOccurrences};
}
module.exports={sha256,extractModule,buildPatchedBundle,operate,isAppRunning};
