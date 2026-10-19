# ApplyPilot AI

ApplyPilot AI is an independent, runnable job-search workspace. This release implements live public Greenhouse and Lever job discovery, deduplication, transparent keyword-based matching, sponsorship-evidence classification, CV text upload, factual document drafts, application tracking, activity logging, browser speech input/output, and review-before-submit guardrails.

## Run locally

Requirements: Node.js 20+; no npm dependencies required.

```bash
cp .env.example .env
npm start
```

Open http://localhost:3000. Data is stored in `data/applypilot.json` for this local single-user build. Back it up before deleting the folder.

## Real source adapters

- Greenhouse public job board API (`boards-api.greenhouse.io`), with board tokens configurable in `src/providers.js`.
- Lever public postings API (`api.lever.co`), with site slugs configurable in `src/providers.js`.

The app reports source errors rather than inventing jobs. Public APIs do not represent all vacancies on LinkedIn, Indeed, Glassdoor, Workday, or the internet.

## Safety and current limitations

- Sponsorship classification is evidence-based keyword triage, not legal advice or a visa determination. Employer sponsor-list membership alone is not treated as vacancy-level confirmation.
- Applications are tracked and documents can be prepared. Automated real-world submission is intentionally not enabled in this release; there is no fake “submitted” status. Use the source application link and record an outcome manually.
- Voice uses browser SpeechRecognition and speechSynthesis when available; browser support and microphone permissions vary.
- Local JSON persistence is for local development/single-user use, not a multi-user production database. Before public launch, add managed PostgreSQL, real authentication, private object storage, background jobs, CSRF/rate limiting, and security review.
- AI drafting is optional and not wired to an external model by default. Drafts in this release use verified profile fields and templates, avoiding invented credentials.

## Tests

```bash
npm test
```

## Deployment

A real public deployment requires access to a hosting account, repository provider, persistent database, and any chosen AI service. None are bundled here. Do not deploy this local JSON single-user configuration as a multi-user service.
