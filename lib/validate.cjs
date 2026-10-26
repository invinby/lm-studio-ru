'use strict';
const variableNames=s=>[...new Set([...s.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map(m=>m[1]))].sort();
const markup=s=>[...s.matchAll(/<\/?([A-Za-z0-9]+)(?:\s[^>]*)?\/?>/g)].filter(m=>m[1]!=='Empty').map(m=>m[0].replace(/\s+/g,' ')).sort();
function validate(english,russian){
 const errors=[];let total=0,translated=0;
 function walk(en,ru,prefix=''){
  for(const [key,value] of Object.entries(en)){
   const full=prefix?prefix+'.'+key:key;
   if(value&&typeof value==='object'&&!Array.isArray(value)){
    walk(value,ru&&typeof ru[key]==='object'?ru[key]:{},full);continue;
   }
   total++;const actual=ru?.[key];
   if(typeof actual!=='string'||(value.trim()&&!actual.trim())){errors.push(`${full}: отсутствует строка перевода`);continue}
   translated++;
   if(JSON.stringify(variableNames(value))!==JSON.stringify(variableNames(actual)))errors.push(`${full}: изменены переменные интерполяции`);
   if(JSON.stringify(markup(value))!==JSON.stringify(markup(actual)))errors.push(`${full}: изменена разметка`);
  }
 }
 walk(english,russian);return {total,translated,errors};
}
module.exports={validate};
