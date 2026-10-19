export const DEFAULT_PROFILE = {
  fullName:'', email:'', phone:'', location:'', linkedin:'', cvText:'',
  roles:['Business Development Manager','Business Development Executive','Sales Development Representative','Account Manager','Key Account Manager','Sales Manager','Partnerships Manager','Commercial Manager','SaaS Sales','Technology Sales','Customer Success'],
  countries:['United Kingdom','Germany','Netherlands','Ireland'], minMatch:80, salaryMin:'', salaryCurrency:'GBP', workMode:'Any', startDate:'',
  workAuthorisation:'', sponsorshipRequired:true, languages:[], skills:['B2B sales','business development','outbound prospecting','lead generation','account management','FinTech','EdTech','CRM','Salesforce'],
  mode:'review', dailyLimit:5
};
export function sponsorshipAssessment(job) {
  const text=`${job.title||''} ${job.description||''}`.toLowerCase();
  const explicitNo = /(?:we do not|we don't|cannot|can't|unable to|will not|not able to) (?:provide|offer|support|sponsor).{0,50}(?:visa|sponsorship|work permit)|no (?:visa )?sponsorship|sponsorship (?:is )?not (?:available|provided|offered)/i.test(text);
  const explicitYes = /(?:visa )?sponsorship (?:is )?(?:available|provided|offered|supported)|(?:we|the company) (?:can|will) sponsor|skilled worker sponsorship|sponsorship available/i.test(text);
  const generic = /(?:visa|immigration|sponsor|sponsorship|right to work|work permit)/i.test(text);
  if(explicitNo) return {status:'Explicitly unavailable',level:0,reason:'The vacancy text contains wording that says sponsorship is unavailable.',evidence:excerpt(text,/no (?:visa )?sponsorship|sponsorship (?:is )?not (?:available|provided|offered)|(?:we do not|we don't|cannot|can't|unable to|will not|not able to) (?:provide|offer|support|sponsor)/i)};
  if(explicitYes) return {status:'Stated for this vacancy',level:3,reason:'The advert contains explicit sponsorship wording. Verify the full context with the employer.',evidence:excerpt(text,/sponsorship|sponsor|skilled worker/i)};
  if(generic) return {status:'Ambiguous',level:1,reason:'The advert mentions work authorisation or immigration, but does not clearly confirm sponsorship for this vacancy.',evidence:excerpt(text,/visa|immigration|sponsor|sponsorship|right to work|work permit/i)};
  return {status:'Unverified',level:0,reason:'No clear vacancy-level sponsorship statement was found in the available job text.',evidence:null};
}
function excerpt(text, regex) { const m=text.match(regex); if(!m)return null; return text.slice(Math.max(0,m.index-70),Math.min(text.length,m.index+190)).trim(); }
export function matchJob(profile, job) {
  const cv = `${profile.cvText||''} ${(profile.skills||[]).join(' ')} ${(profile.roles||[]).join(' ')}`.toLowerCase();
  const jobText=`${job.title||''} ${job.description||''}`.toLowerCase();
  const terms=[...new Set((profile.skills||[]).concat(profile.roles||[]).flatMap(x=>x.toLowerCase().split(/[^a-z0-9+#]+/)).filter(x=>x.length>2))];
  const matched=terms.filter(t=>cv.includes(t)&&jobText.includes(t));
  const requiredTerms=[...new Set((job.title+' '+job.description).toLowerCase().split(/[^a-z0-9+#]+/).filter(x=>x.length>3))].slice(0,150);
  const relevant=requiredTerms.filter(t=>cv.includes(t));
  const titleTerms=(job.title||'').toLowerCase().split(/[^a-z0-9]+/).filter(t=>t.length>2);
  const titleHit=titleTerms.some(t=>(profile.roles||[]).some(r=>r.toLowerCase().includes(t)));
  const skillScore=terms.length ? Math.round(matched.length/Math.max(1,Math.min(terms.length,14))*65) : 0;
  const titleScore=titleHit?25:Math.min(20,Math.round(relevant.length/Math.max(1,requiredTerms.length)*25));
  const countryScore=profile.countries?.some(c=>(job.location||'').toLowerCase().includes(c.toLowerCase()))?10:5;
  const score=Math.max(0,Math.min(100,skillScore+titleScore+countryScore));
  const missing=requiredTerms.filter(t=>!cv.includes(t)).slice(0,8);
  return {score,matchedTerms:matched.slice(0,12),relevantTerms:relevant.slice(0,12),missingTerms:missing,method:'Transparent keyword overlap + role-title relevance + location preference. Not an AI hiring prediction.'};
}
export function makeDrafts(profile, job) {
  const name=profile.fullName || '[Your name]';
  const cv = (profile.cvText||'').trim();
  const knownSkills=(profile.skills||[]).filter(s=>cv.toLowerCase().includes(s.toLowerCase()) || !cv).slice(0,5);
  const evidence=knownSkills.length ? knownSkills.join(', ') : 'the relevant experience detailed in my CV';
  return {
    coverLetter:`Dear Hiring Team,\n\nI am writing to express my interest in the ${job.title} position at ${job.employer}. My background includes experience relevant to ${evidence}. I am interested in bringing a customer-focused, commercially minded approach to your team.\n\nI would welcome the opportunity to discuss how my experience aligns with the requirements of this role. Please find my CV for your consideration.\n\nKind regards,\n${name}`,
    note:`Application draft for ${job.title} at ${job.employer}. Review every statement against your CV before use. This draft does not claim unverified achievements or work-authorisation status.`
  };
}
export function canProceedToSubmit({mode,approved,hasUnresolvedLegalQuestions=false}) {
  return mode==='review' && approved===true && !hasUnresolvedLegalQuestions;
}
export function dedupeJobs(jobs) { return [...new Map(jobs.filter(j=>j.applicationUrl).map(j=>[j.applicationUrl,j])).values()]; }
