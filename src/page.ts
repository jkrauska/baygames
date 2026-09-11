export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type SubscribeLinks = {
  httpsUrl: string;
  webcalUrl: string;
  googleUrl: string;
};

export function subscribeLinks(icsUrl: string): SubscribeLinks {
  const webcalUrl = icsUrl.replace(/^https?:/, "webcal:");
  const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
  return { httpsUrl: icsUrl, webcalUrl, googleUrl };
}

const SPORT_GLYPHS: Array<[RegExp, string]> = [
  [/\bflag football\b/i, "🏈"],
  [/\bwater polo\b/i, "🤽"],
  [/\bcross country\b/i, "🏃"],
  [/\bfield hockey\b/i, "🏑"],
  [/\btrack(?:\s*(?:and|&)\s*field)?\b/i, "🏃"],
  [/\bfootball\b/i, "🏈"],
  [/\bsoccer\b/i, "⚽"],
  [/\bbasketball\b/i, "🏀"],
  [/\bvolleyball\b/i, "🏐"],
  [/\bbaseball\b/i, "⚾"],
  [/\bsoftball\b/i, "🥎"],
  [/\btennis\b/i, "🎾"],
  [/\bgolf\b/i, "⛳"],
  [/\blacrosse\b/i, "🥍"],
  [/\bhockey\b/i, "🏒"],
  [/\bswim/i, "🏊"],
  [/\bwrestl/i, "🤼"],
  [/\b(?:crew|rowing)\b/i, "🚣"],
  [/\bsailing\b/i, "⛵"],
  [/\bbadminton\b/i, "🏸"],
  [/\brugby\b/i, "🏉"],
  [/\bfencing\b/i, "🤺"],
  [/\bultimate\b/i, "🥏"],
];

export function sportGlyph(name: string): string {
  for (const [pattern, glyph] of SPORT_GLYPHS) {
    if (pattern.test(name)) return glyph;
  }
  return "🏅";
}

const ICON_GOOGLE = `<svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>`;
const ICON_APPLE = `<svg class="brand-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>`;

function titledName(name: string): string {
  return `<span class="sport" aria-hidden="true">${sportGlyph(name)}</span>${escapeHtml(name)}`;
}

type TeamLink = {
  name: string;
  slug: string;
  games: number;
  href: string;
  googleUrl: string;
  webcalUrl: string;
};

type UpcomingGameView = {
  summary: string;
  location?: string;
  when: string;
};

const STYLES = `
:root {
  color-scheme: light;
  --navy: #002776;
  --navy-deep: #002159;
  --sky: #6cc4e8;
  --gold: #f5b400;
  --orange: #e87712;
  --ink: #002776;
  --line: #b9d4ea;
  --bg: #d7eef8;
  --card: #ffffff;
}
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: var(--bg); color: var(--navy); }
.masthead { background: var(--navy-deep); }
.masthead-inner { max-width: 42rem; margin: 0 auto; padding: 1.15rem 1.15rem 1.05rem; }
.brand { text-decoration: none; color: var(--gold); font-weight: 750; font-size: 1.15rem; letter-spacing: 0.04em; }
.tag { margin: 0.25rem 0 0; color: var(--sky); font-size: 0.82rem; }
.skyline { height: 6px; background: linear-gradient(90deg, var(--gold), var(--orange), var(--sky)); }
main { max-width: 42rem; margin: 0 auto; padding: 1.75rem 1.15rem 4rem; }
h1 { font-size: 1.85rem; letter-spacing: -0.03em; margin: 0 0 0.4rem; color: var(--orange); }
h2 { color: var(--navy); }
.lede { color: var(--navy); margin: 0 0 1.5rem; font-weight: 550; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 1rem; padding: 1rem 1.05rem; margin: 0 0 0.75rem; color: var(--navy); }
a.btn, button.btn { display: inline-flex; align-items: center; gap: 0.3rem; text-decoration: none; border: 2px solid transparent; cursor: pointer; border-radius: 999px; padding: 0.38rem 0.72rem; font-size: 0.82rem; font-weight: 700; }
.btn-primary { background: var(--orange); color: var(--navy-deep); border-color: var(--orange); }
.btn-secondary { background: var(--navy); color: #fff; border-color: var(--navy); }
.brand-icon { width: 0.95em; height: 0.95em; flex: none; display: block; }
.sport { font-size: 1.15em; line-height: 1; }
.row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.85rem 0 0.2rem; }
.meta { color: var(--navy); font-size: 0.92rem; margin: 0; opacity: 0.85; }
ol { list-style: none; padding: 0; margin: 1rem 0 0; }
li { padding: 0.75rem 0; border-top: 1px solid var(--line); color: var(--navy); }
.when { display: block; font-size: 0.82rem; color: var(--orange); font-weight: 650; margin-bottom: 0.15rem; }
input { width: 100%; margin-top: 0.35rem; padding: 0.55rem 0.65rem; border-radius: 0.5rem; border: 1px solid var(--line); font: inherit; color: var(--navy); background: #fff; }
.team h2 a { color: inherit; text-decoration: none; display: flex; align-items: center; gap: 0.45rem; }
.team h2 { font-size: 1.05rem; margin: 0 0 0.2rem; }
h1.team-title, h2.with-sport { display: flex; align-items: center; gap: 0.45rem; }
.hint { font-size: 0.88rem; color: var(--navy); }
.hint a { color: var(--orange); font-weight: 650; }
.unofficial { margin: 1.5rem 0 0; font-size: 0.8rem; color: var(--navy); opacity: 0.75; }
.feed { margin: 0.85rem 0 0; }
.feed-heading { display: flex; align-items: center; gap: 0.4rem; font-size: 0.92rem; }
.help { position: relative; display: inline-flex; }
.help summary {
  list-style: none;
  width: 1.15rem;
  height: 1.15rem;
  border-radius: 999px;
  border: 1.5px solid var(--navy);
  background: #fff;
  color: var(--navy);
  font: italic 700 0.72rem/1.05 ui-serif, Georgia, serif;
  cursor: pointer;
  display: grid;
  place-items: center;
  opacity: 0.7;
}
.help summary::-webkit-details-marker { display: none; }
.help summary::marker { content: ""; }
.help summary:hover,
.help[open] summary { opacity: 1; background: var(--sky); }
.help-pop {
  position: absolute;
  left: 0;
  top: calc(100% + 0.45rem);
  z-index: 3;
  width: min(22rem, calc(100vw - 2.5rem));
  margin: 0;
  padding: 0.7rem 0.8rem;
  background: var(--navy-deep);
  color: #fff;
  border-radius: 0.7rem;
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.4;
  box-shadow: 0 10px 28px rgba(0, 33, 89, 0.28);
}
.help-pop::before {
  content: "";
  position: absolute;
  top: -6px;
  left: 0.35rem;
  border: 6px solid transparent;
  border-bottom-color: var(--navy-deep);
  border-top-width: 0;
}
`

function layout(title: string, siteName: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <header class="masthead">
    <div class="masthead-inner">
      <a class="brand" href="/">${escapeHtml(siteName)}</a>
      <p class="tag">Unofficial games calendar</p>
    </div>
  </header>
  <div class="skyline"></div>
  <main>${body}</main>
</body>
</html>`;
}

function calendarButtons(links: Pick<SubscribeLinks, "googleUrl" | "webcalUrl">): string {
  return `<div class="row">
    <a class="btn btn-primary" href="${escapeHtml(links.googleUrl)}">${ICON_GOOGLE} Google Calendar</a>
    <a class="btn btn-secondary" href="${escapeHtml(links.webcalUrl)}">${ICON_APPLE} Apple Calendar</a>
  </div>`;
}

function subscribeBlock(links: SubscribeLinks): string {
  return `${calendarButtons(links)}
  <div class="feed">
    <div class="feed-heading">
      Feed URL
      <details class="help">
        <summary aria-label="How to add this calendar">i</summary>
        <p class="help-pop">Google Calendar can take up to a day to refresh. If the button does not work, use <b>Other calendars → From URL</b> and paste this feed URL.</p>
      </details>
    </div>
    <input readonly aria-label="Feed URL" value="${escapeHtml(links.httpsUrl)}">
  </div>`;
}

export function renderHome(opts: {
  siteName: string;
  allGames: SubscribeLinks;
  teams: TeamLink[];
}): string {
  const teams = opts.teams
    .map(
      (team) => `<article class="card team">
      <h2><a href="${escapeHtml(team.href)}">${titledName(team.name)}</a></h2>
      <p class="meta">${team.games} game${team.games === 1 ? "" : "s"}</p>
      ${calendarButtons(team)}
    </article>`,
    )
    .join("");

  return layout(
    opts.siteName,
    opts.siteName,
    `<p class="lede">Click a team to see upcoming games details.</p>
    <section class="card">
      <h2 class="with-sport"><span class="sport" aria-hidden="true">🏅</span>All Sports</h2>
      ${subscribeBlock(opts.allGames)}
    </section>
    ${teams || `<p class="hint">No games found in the school feed right now.</p>`}
    <p class="unofficial">Not an official school site.</p>`,
  );
}

export function renderTeam(opts: {
  siteName: string;
  teamName: string;
  links: SubscribeLinks;
  games: UpcomingGameView[];
}): string {
  const upcoming = opts.games
    .map(
      (game) => `<li>
        <span class="when">${escapeHtml(game.when)}${game.location ? ` · ${escapeHtml(game.location)}` : ""}</span>
        <span>${escapeHtml(game.summary)}</span>
      </li>`,
    )
    .join("");

  return layout(
    `${opts.teamName} · ${opts.siteName}`,
    opts.siteName,
    `<p class="hint"><a href="/">All Sports</a></p>
    <h1 class="team-title">${titledName(opts.teamName)}</h1>
    <p class="lede">Games only — no practices or bonding events.</p>
    <section class="card">
      ${subscribeBlock(opts.links)}
    </section>
    <h2>Upcoming Games</h2>
    <ol>${upcoming || `<li class="hint">No upcoming games on the school calendar.</li>`}</ol>
    <p class="unofficial">Not an official school site.</p>`,
  );
}
