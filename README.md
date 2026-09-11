# Bay Sports Games

Proxy a school iCal feed and republish calendars that **only contain games**.

Subscribe links are built from whatever host the Worker is serving, so the app code does not hardcode a public domain.

- `/` — all teams
- `/boys-varsity-flag-football` — one team
- `/boys-varsity-flag-football.ics` — that team’s feed for Google Calendar

Pretty names also work (`/Boys Varsity Flag Football`) and are canonicalized to a slug.

## Secrets

The school feed URL includes an access token. **Never put it in git, HTML, or the public `.ics`.**

| Where | How |
| --- | --- |
| Local | `.dev.vars` (gitignored) |
| Production | `npx wrangler secret put SOURCE_ICAL_URL` |

The Worker fetches that URL server-side. Attach a custom domain in the Cloudflare dashboard (or `wrangler deploy --domains`), not in source.

## Filter rules

An event is kept when it is a game (` - Game`, `vs`, playoff, championship) and is not a practice or bonding event.

Optional `?team=` or the path selects one team from the all-sports feed.

## Local development

```bash
cp .dev.vars.example .dev.vars
# paste the school HTTPS feed URL into SOURCE_ICAL_URL
npm install
npm test
npm run dev
```

## Deploy

```bash
npx wrangler secret put SOURCE_ICAL_URL
npm run deploy
# then attach the public hostname in Cloudflare, or:
# npx wrangler deploy --domains example.org --domains www.example.org
```

Do not set `FEED_TOKEN` unless you want the public site itself locked. Google Calendar needs a stable public HTTPS URL.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Team list + Add to Google Calendar |
| `/games.ics` | All games |
| `/{team}` | Team page |
| `/{team}.ics` | Team games |
| `/google` | Redirect into Google Calendar subscribe |
