import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url'; import {DEFAULT_PROFILE} from './core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=path.join(root,'data'); const dbPath=path.join(dataDir,'applypilot.json');
const initial=()=>({profile:DEFAULT_PROFILE,jobs:[],applications:[],activity:[],savedSearches:[],settings:{mode:'review',dailyLimit:5},updatedAt:new Date().toISOString()});
export function readStore(){fs.mkdirSync(dataDir,{recursive:true});if(!fs.existsSync(dbPath))fs.writeFileSync(dbPath,JSON.stringify(initial(),null,2));try{return JSON.parse(fs.readFileSync(dbPath,'utf8'));}catch{return initial();}}
export function writeStore(db){db.updatedAt=new Date().toISOString();fs.mkdirSync(dataDir,{recursive:true});const tmp=dbPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,dbPath);return db;}
export function logActivity(db,type,message,details={}){db.activity.unshift({id:crypto.randomUUID(),type,message,details,at:new Date().toISOString()});db.activity=db.activity.slice(0,300);}
