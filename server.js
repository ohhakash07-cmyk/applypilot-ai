import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';
import {discoverJobs} from './providers.js'; import {readStore,writeStore,logActivity} from './store.js'; import {DEFAULT_PROFILE,sponsorshipAssessment,matchJob,makeDrafts} from './core.js';
const here=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const publicDir=path.join(here,'public');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const send=(res,status,data,type='application/json; charset=utf-8')=>{res.writeHead(status,{'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','cache-control':'no-store','content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'"});res.end(type.startsWith('application/json')?JSON.stringify(data):data);};
async function body(req){let s='';for await(const c of req){s+=c;if(s.length>8_000_000)throw Error('Request too large');}return s?JSON.parse(s):{};}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(req.method==='GET'&&u.pathname==='/api/health')return send(res,200,{ok:true,app:'ApplyPilot AI',version:'0.1.0',time:new Date().toISOString()});
  if(req.method==='GET'&&u.pathname.startsWith('/api/')){const db=readStore();if(u.pathname==='/api/state')return send(res,200,{profile:db.profile,applications:db.applications,activity:db.activity,savedSearches:db.savedSearches,settings:db.settings,jobCount:db.jobs.length});if(u.pathname==='/api/jobs')return send(res,200,{jobs:db.jobs});return send(res,404,{error:'Not found'});}
  if(req.method==='POST'&&u.pathname.startsWith('/api/')){
   const input=await body(req); const db=readStore();
   if(u.pathname==='/api/profile'){db.profile={...DEFAULT_PROFILE,...db.profile,...input};logActivity(db,'profile','Candidate profile updated');writeStore(db);return send(res,200,{profile:db.profile});}
   if(u.pathname==='/api/search'){
    const query=String(input.query||'').slice(0,160);const countries=Array.isArray(input.countries)?input.countries.filter(x=>['United Kingdom','Germany','Netherlands','Ireland','France','Spain','Sweden','Denmark','Poland','Belgium'].includes(x)):db.profile.countries;
    const result=await discoverJobs({query,countries,limit:Math.min(200,Number(input.limit)||100)});
    const old=new Map(db.jobs.map(j=>[j.applicationUrl,j]));
    const enriched=result.jobs.map(j=>{const assessment=sponsorshipAssessment(j);const match=matchJob(db.profile,j);return {...j,sponsorship:assessment,match,eligibleForReview:match.score>=(Number(db.profile.minMatch)||80)&&(!db.profile.sponsorshipRequired||assessment.level>=3)};});
    for(const j of enriched)old.set(j.applicationUrl,{...old.get(j.applicationUrl),...j});db.jobs=[...old.values()].sort((a,b)=>(b.match?.score||0)-(a.match?.score||0));
    logActivity(db,'search',`Checked public job sources: ${enriched.length} matching vacancies returned`,{query,countries,providerCounts:result.providerCounts,errors:result.errors.length});writeStore(db);
    return send(res,200,{...result,jobs:enriched.sort((a,b)=>(b.match?.score||0)-(a.match?.score||0)),totalStored:db.jobs.length});
   }
   if(u.pathname==='/api/upload-cv'){
    const filename=String(input.filename||'cv.txt').slice(0,150);const text=String(input.text||'').slice(0,500000);if(!text.trim())return send(res,400,{error:'No readable CV text received. Upload a text-based CV or paste its text.'});
    db.profile={...db.profile,cvText:text};logActivity(db,'document',`CV text imported (${filename})`,{characters:text.length});writeStore(db);return send(res,200,{ok:true,characters:text.length,profile:db.profile});
   }
   if(u.pathname==='/api/draft'){
    const job=db.jobs.find(j=>j.id===input.jobId)||db.jobs.find(j=>j.applicationUrl===input.applicationUrl);if(!job)return send(res,404,{error:'Job not found in saved search results. Search again first.'});const drafts=makeDrafts(db.profile,job);logActivity(db,'document',`Prepared editable draft for ${job.title} at ${job.employer}`,{jobId:job.id});writeStore(db);return send(res,200,{job,drafts});
   }
   if(u.pathname==='/api/applications'){
    const job=db.jobs.find(j=>j.id===input.jobId);if(!job)return send(res,404,{error:'Choose a saved job first.'});if(db.applications.some(a=>a.applicationUrl===job.applicationUrl))return send(res,409,{error:'This vacancy is already in your application tracker.'});
    const status='Awaiting approval';const app={id:crypto.randomUUID(),jobId:job.id,employer:job.employer,title:job.title,location:job.location,source:job.source,sourceUrl:job.sourceUrl,applicationUrl:job.applicationUrl,matchScore:job.match?.score??0,sponsorship:job.sponsorship||sponsorshipAssessment(job),status,createdAt:new Date().toISOString(),notes:String(input.notes||''),drafts:input.drafts||null,confirmation:null};db.applications.unshift(app);logActivity(db,'application',`Added ${job.title} at ${job.employer} to tracker; no application was submitted`,{applicationId:app.id});writeStore(db);return send(res,201,{application:app});
   }
   if(u.pathname.startsWith('/api/applications/')){const id=u.pathname.split('/').pop();const app=db.applications.find(a=>a.id===id);if(!app)return send(res,404,{error:'Application not found'});const allowed=['Awaiting approval','Ready to apply','Submitted — confirmation verified','Submission uncertain','Assessment','Interview','Offer','Rejected','Withdrawn','Follow-up required','Documents being prepared','Eligible for review'];if(!allowed.includes(input.status))return send(res,400,{error:'Invalid status'});if(input.status==='Submitted — confirmation verified'&&!String(input.confirmation||'').trim())return send(res,400,{error:'A real confirmation reference or evidence note is required before marking submitted.'});app.status=input.status;app.updatedAt=new Date().toISOString();if(input.confirmation)app.confirmation=String(input.confirmation).slice(0,1000);if(input.notes!==undefined)app.notes=String(input.notes).slice(0,5000);logActivity(db,'application',`Updated ${app.title} at ${app.employer}: ${app.status}`,{applicationId:app.id});writeStore(db);return send(res,200,{application:app});}
   if(u.pathname==='/api/saved-searches'){db.savedSearches=Array.isArray(input.savedSearches)?input.savedSearches.slice(0,12).map(s=>({query:String(s.query||'').slice(0,160),countries:Array.isArray(s.countries)?s.countries.slice(0,10):[],createdAt:s.createdAt||new Date().toISOString()})):db.savedSearches;logActivity(db,'settings','Saved search list updated');writeStore(db);return send(res,200,{savedSearches:db.savedSearches});}
   if(u.pathname==='/api/settings'){const mode=['research','review','batch'].includes(input.mode)?input.mode:'review';const dailyLimit=Math.max(1,Math.min(25,Number(input.dailyLimit)||5));db.settings={...db.settings,mode,dailyLimit};db.profile={...db.profile,...(input.profile||{}),mode,dailyLimit};logActivity(db,'settings',`Automation policy set to ${mode}; daily limit ${dailyLimit}`);writeStore(db);return send(res,200,{settings:db.settings});}
   return send(res,404,{error:'Not found'});
  }
  const pathname=u.pathname==='/README.md'?'/project-notes.md':(u.pathname==='/'?'/index.html':u.pathname);const file=path.resolve(publicDir,'.'+pathname);if(!file.startsWith(publicDir+path.sep))return send(res,403,{error:'Forbidden'});if(!fs.existsSync(file)||!fs.statSync(file).isFile())return send(res,404,'Not found','text/plain; charset=utf-8');return send(res,200,fs.readFileSync(file),mime[path.extname(file)]||'application/octet-stream');
 }catch(e){send(res,500,{error:'Request failed',detail:process.env.NODE_ENV==='production'?'Please retry or inspect server logs.':String(e.message||e)});}
});
const port=Number(process.env.PORT)||3000;server.listen(port,'0.0.0.0',()=>console.log(`ApplyPilot AI listening on http://localhost:${port}`));
