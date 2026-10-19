export const GREENHOUSE_BOARDS = [
  'stripe','hubspot','datadog','cloudflare','figma','monday','deel','revolut','wise','pleo','personio','mollie','snyk','contentful','intercom','gocardless','samsara','mongodb','canva','adyen'
];
export const LEVER_SITES = [
  'pleo','mollie','personio','snyk','remote','deel','revolut','wise','monzo','octopusenergy','elastic','canonical','automattic'
];

const clean = (v='') => String(v).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
export async function fetchGreenhouse(board, fetcher=fetch) {
  const res = await fetcher(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`, {headers:{'accept':'application/json'}, signal:AbortSignal.timeout(10000)});
  if (!res.ok) throw new Error(`Greenhouse ${board}: HTTP ${res.status}`);
  const json = await res.json();
  return (json.jobs || []).map(j => ({
    id:`gh:${board}:${j.id}`, source:'Greenhouse', sourceCompany:board,
    employer:clean(j.company_name || board), title:clean(j.title), location:clean(j.location?.name || ''),
    description:clean(j.content || ''), postedAt:j.updated_at || null,
    sourceUrl:j.absolute_url, applicationUrl:j.absolute_url, salary:null,
    dateFound:new Date().toISOString(), lastChecked:new Date().toISOString(), expired:false
  }));
}
export async function fetchLever(site, fetcher=fetch) {
  const res = await fetcher(`https://api.lever.co/v0/postings/${encodeURIComponent(site)}?mode=json`, {headers:{'accept':'application/json'}, signal:AbortSignal.timeout(10000)});
  if (!res.ok) throw new Error(`Lever ${site}: HTTP ${res.status}`);
  const json = await res.json();
  return (Array.isArray(json) ? json : []).map(j => ({
    id:`lever:${site}:${j.id}`, source:'Lever', sourceCompany:site,
    employer:clean(j.categories?.team || site), title:clean(j.text), location:clean(j.categories?.location || j.categories?.allLocations?.join(', ') || ''),
    description:clean([j.descriptionPlain, ...(j.lists||[]).map(x=>x.content), j.additionalPlain].filter(Boolean).join(' ')),
    postedAt:j.createdAt ? new Date(j.createdAt).toISOString() : null,
    sourceUrl:j.hostedUrl, applicationUrl:j.applyUrl || j.hostedUrl, salary:clean(j.salaryRange?.text || '') || null,
    dateFound:new Date().toISOString(), lastChecked:new Date().toISOString(), expired:false
  }));
}
export async function discoverJobs({query='', countries=['United Kingdom','Germany','Netherlands','Ireland'], limit=80, fetcher=fetch}={}) {
  const errors=[]; const jobs=[];
  const wanted = query.toLowerCase().split(/[^a-z0-9+]+/).filter(w=>w.length>2);
  const tasks = [
    ...GREENHOUSE_BOARDS.map(async b=>{try{jobs.push(...await fetchGreenhouse(b,fetcher));}catch(e){errors.push({source:`Greenhouse/${b}`,error:e.message});}}),
    ...LEVER_SITES.map(async b=>{try{jobs.push(...await fetchLever(b,fetcher));}catch(e){errors.push({source:`Lever/${b}`,error:e.message});}})
  ];
  await Promise.all(tasks);
  const unique = [...new Map(jobs.filter(j=>j.title && j.applicationUrl).map(j=>[j.applicationUrl,j])).values()];
  const filtered = unique.filter(j=> {
    const text=`${j.title} ${j.employer} ${j.location} ${j.description}`.toLowerCase();
    const queryMatch = !wanted.length || wanted.some(w=>text.includes(w));
    const countryMatch = countries.length===0 || countries.some(c=>text.includes(c.toLowerCase()) || (c==='United Kingdom' && /\b(uk|united kingdom|england|scotland|wales|london|bristol|manchester|leeds|remote - uk)\b/.test(text)));
    return queryMatch && countryMatch;
  }).slice(0, Math.max(1,Math.min(limit,200)));
  return {jobs:filtered, errors, checkedAt:new Date().toISOString(), providerCounts:{Greenhouse:jobs.filter(j=>j.source==='Greenhouse').length,Lever:jobs.filter(j=>j.source==='Lever').length}};
}
