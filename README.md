# baygames

The default school athletics calendar includes **every sport and every practice** — hundreds of events most people don't want. This Worker proxies that feed and republishes per-team calendars that **only contain games**, with a one-click "Add to Google Calendar" / "Add to Apple Calendar" for each team.

That makes it easy to share just the games with extended family (grandparents, aunts, uncles) who want to know when to show up, but don't need every practice on their calendar.

Families subscribe to this Worker. The school’s original feed URL stays on the server.

- `/` — all teams
- `/boys-varsity-soccer` — one team
- `/v1/boys-varsity-soccer.ics` — that team’s feed for Google Calendar / Apple Calendar

Pretty names also work (`/Boys Varsity Soccer`) and are canonicalized to a slug.

## Use it for your school

This is meant to be forked. Point it at **your** athletics calendar, set a public name, and deploy.

### 1. Get the school calendar URL

The Worker needs one HTTPS iCal URL in `SOURCE_ICAL_URL`. Prefer the **combined Athletics** feed (all teams). The Worker splits that into per-team pages and `.ics` files.

#### Blackbaud (Education Management / Core / mySchoolApp)

Most independent schools on Blackbaud publish a live iCal from the portal calendar ([Blackbaud: add a webcal feed](https://kb.blackbaud.com/knowledgebase/Article/97155)):

1. Sign in to the school portal (`*.myschoolapp.com`).
2. Open **Calendar**.
3. Expand **Individual Filter Feeds**.
4. Filter to **Athletics** (all sports, not a single team).
5. Right-click the blue calendar / iCal link → **Copy Link Address**.

The URL looks like:

```text
https://your-school.myschoolapp.com/podium/feed/iCal.aspx?z=...
```

If the copied address starts with `webcal://`, change the scheme to `https://` before saving it. Keep the entire `?z=...` query string — that token is what authorizes the feed.

Treat that URL as a **secret**. It is a rolling feed (about 14 months of events). Do not put it in git, HTML, or the public `.ics`.

On Blackbaud, athletics events are usually titled like:

```text
Boys Varsity Soccer - Game Lincoln High School - Away
Boys Varsity Soccer - Practice -
Team Bonding Boys Varsity Soccer
```

That `{Team} - Game …` / `{Team} - Practice -` shape is what this filter is built for.

#### Other calendar systems

Any HTTPS iCal URL can work if game summaries look similar (` - Game`, `vs`, playoff, championship) and practices are labeled `Practice`. Finalsite, FACTS, and other SIS/calendar products sometimes expose a subscribe link the same way: copy the link, switch `webcal://` to `https://`, and store it as `SOURCE_ICAL_URL`.

If your titles are a different shape, games may be dropped or team pages may not split correctly. Adjust `src/filter.ts` (and the tests) for your feed.

### 2. Brand it

Set `CALENDAR_NAME` to the public title for this instance (page header and iCal calendar name). The committed default is `Sports Games`.

| Where | How |
| --- | --- |
| Local | `.dev.vars` |
| Production | `vars.CALENDAR_NAME` in `wrangler.jsonc` |

If you fork the repo, also change `"name"` in `wrangler.jsonc` / `package.json` to your Cloudflare Worker name (this repo’s Worker is `baygames`).

### 3. Keep the feed URL secret

| Where | How |
| --- | --- |
| Local | `.dev.vars` (gitignored) |
| Production | `npx wrangler secret put SOURCE_ICAL_URL` |

The Worker fetches that URL server-side. Event `URL:` properties that point at Blackbaud / mySchoolApp (`myschoolapp.com`, `/podium/feed`, `iCal.ashx`) are stripped from the public `.ics`. Attach a custom domain in the Cloudflare dashboard (or `wrangler deploy --domains`), not in source.

## Local development

```bash
cp .dev.vars.example .dev.vars
# paste the school HTTPS feed URL into SOURCE_ICAL_URL
# set CALENDAR_NAME to your site title
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

## Filter rules

An event is kept when it is a game (` - Game`, `vs`, playoff, championship) and is not a practice or bonding event.

Optional `?team=` or the path selects one team from the all-sports feed.

Blackbaud (and similar) feeds often omit `DTEND`, or copy `DTSTART` into `DTEND`, so calendar apps show a zero-length event. Timed games then get a **guessed 90-minute window** (`DTSTART` + 90 minutes). The event `DESCRIPTION` (calendar Notes) includes `End time is a guess.` Real end times and all-day dates are left alone.

## Routes

| Path | Purpose |
| --- | --- |
| `/` | Team list + Add to Google Calendar |
| `/{team}` | Team page |
| `/v1/games.ics` | All games |
| `/v1/{team}.ics` | Team games |
| `/google` | Redirect into Google Calendar subscribe |

`/games.ics` and `/{team}.ics` still work; subscribe buttons use the `/v1/` URLs so a later filter change can keep old calendar subscriptions working.
