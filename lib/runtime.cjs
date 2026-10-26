'use strict';
// This self-contained function is serialized into the local renderer bundle.
function installRuntime(dictionary){
 const isRussian=()=>{const i18n=globalThis.__lmStudioRuI18n;return !!i18n&&/^ru(?:[-_]|$)/i.test(i18n.resolvedLanguage||i18n.language||'')};
 globalThis.__lmStudioRuText=function(text){return isRussian()&&Object.hasOwn(dictionary,text)?dictionary[text]:text};
 globalThis.__lmStudioRuWrapDate=function(original){return function(date,options){
  if(!isRussian())return original(date,options);
  try{
   if(!Number.isFinite(date.getTime()))return 'Неизвестно';
   const seconds=Math.floor(Math.abs((options?.baseDate??new Date()).getTime()-date.getTime())/1000);
   const absolute=new Intl.DateTimeFormat('ru-RU',{year:'numeric',month:'long',day:'numeric'}).format(date);
   let relative;
   if(seconds<45)relative='Только что';
   else if(seconds<60)relative='Меньше минуты назад';
   else{const unit=seconds<3600?'minute':seconds<86400?'hour':'day';const count=Math.floor(seconds/(unit==='minute'?60:unit==='hour'?3600:86400));relative=new Intl.RelativeTimeFormat('ru-RU',{numeric:'always'}).format(-count,unit)}
   return options?.dateOnly===true?absolute:options?.timeAgoOnly===true?relative:`${absolute} (${relative})`;
  }catch{return 'Неизвестно'}
 }};
}
module.exports={installRuntime};
