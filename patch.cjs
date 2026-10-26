#!/usr/bin/env node
'use strict';
const path=require('node:path'),fs=require('node:fs');
const {operate}=require('./lib/patcher.cjs');
const {loadResources}=require('./scripts/validate.cjs');
function main(args){
 const action=args.shift()||'status';
 if(action==='help'||action==='--help'){
  console.log('LM Studio RU\n\nnode patch.cjs status|apply|restore [--app "папка LM Studio"] [--dry-run]\n\nПоддерживается Windows, LM Studio 0.4.26+4. Перед установкой и откатом полностью закройте приложение.\nРезервная копия: resources/app/.lm-studio-ru-backup/');return;
 }
 let appDir=process.env.LOCALAPPDATA?path.join(process.env.LOCALAPPDATA,'Programs','LM Studio'):null;
 let dryRun=false;
 while(args.length){const option=args.shift();if(option==='--app'){if(!args.length)throw new Error('Укажите путь после --app');appDir=path.resolve(args.shift())}else if(option==='--dry-run')dryRun=true;else throw new Error('Неизвестный аргумент: '+option)}
 if(!appDir)throw new Error('Укажите папку установки: --app "путь"');
 const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'manifests','0.4.26+4-win32.json'),'utf8'));
 if(process.platform!==manifest.platform)throw new Error('Эта версия патчера предназначена для Windows');
 const resources=loadResources();
 const result=operate({appDir,action,dryRun,manifest,...resources});
 console.log(JSON.stringify({...result,dictionaryKeys:resources.report.total},null,2));
 if(action==='apply'&&result.state==='installed')console.log('Русификатор установлен. Запустите LM Studio и выберите русский язык в настройках.');
 if(action==='restore'&&result.state==='original')console.log('Исходный файл восстановлен.');
}
try{main(process.argv.slice(2))}catch(error){console.error('Ошибка: '+error.message);process.exitCode=1}
