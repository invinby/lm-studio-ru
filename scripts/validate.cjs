'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validate}=require('../lib/validate.cjs');
const root=path.resolve(__dirname,'..');
function loadResources(){
 const locales={};let total=0,translated=0;const errors=[];const namespaces={};
 for(const file of fs.readdirSync(path.join(root,'locales/en')).filter(f=>f.endsWith('.json'))){
  const ns=path.basename(file,'.json');
  const en=JSON.parse(fs.readFileSync(path.join(root,'locales/en',file),'utf8'));
  const ru=JSON.parse(fs.readFileSync(path.join(root,'locales/ru',file),'utf8'));
  const check=validate(en,ru);total+=check.total;translated+=check.translated;errors.push(...check.errors.map(e=>ns+':'+e));namespaces[ns]={total:check.total,translated:check.translated};locales[ns]=ru;
 }
 const staticStrings=JSON.parse(fs.readFileSync(path.join(root,'locales/static-ru.json'),'utf8'));
 for(const [en,ru] of Object.entries(staticStrings))if(typeof ru!=='string'||!ru.trim())errors.push('Пустой статический перевод: '+en);
 if(errors.length)throw new Error(errors.join('\n'));
 return {locales,staticStrings,report:{total,translated,staticDictionaryPhrases:Object.keys(staticStrings).length,namespaces}};
}
if(require.main===module){try{console.log(JSON.stringify(loadResources().report,null,2))}catch(error){console.error(error.message);process.exitCode=1}}
module.exports={loadResources};
