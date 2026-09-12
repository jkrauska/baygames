const PRACTICE_RE = /\bpractice\b/i;
const BONDING_RE = /\bbonding\b/i;
const GAME_SEGMENT_RE = /\s-\s+Game\b/i;
const GAME_RE =
  /\b(?:vs\.?|playoffs?|semifinals?|quarterfinals?|championship|tournament)\b/i;

export type FilterStats = {
  kept: number;
  dropped: number;
};

export type FilterOptions = {
  calendarName?: string;
  team?: string;
};

export const DEFAULT_CALENDAR_NAME = "Sports Games";

export type FilterResult = {
  ics: string;
  stats: FilterStats;
  teamName?: string;
};

export type TeamSummary = {
  name: string;
  slug: string;
  games: number;
};

export type UpcomingGame = {
  summary: string;
  location?: string;
  when: string;
  sortKey: string;
};

const RESERVED_PATHS = new Set([
  "",
  "games",
  "calendar",
  "google",
  "apple",
  "robots.txt",
  "favicon.ico",
]);

/** RFC 5545 unfolding: a CRLF/LF followed by a single space or tab continues the previous line. */
export function unfoldIcal(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

export function icalUnescape(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function getProperty(block: string, name: string): string | undefined {
  const re = new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "mi");
  const match = block.match(re);
  return match ? icalUnescape(match[1]).replace(/\s+/g, " ").trim() : undefined;
}

export function normalizeName(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

export function slugify(value: string): string {
  return normalizeName(value)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function teamGroupName(name: string): string {
  return normalizeName(
    name.replace(/\bjunior\s+varsity\b/gi, " ").replace(/\bjv\b/gi, " ").replace(/\bvarsity\b/gi, " "),
  );
}

function teamLevel(name: string): number {
  if (/\bjunior\s+varsity\b/i.test(name) || /\bjv\b/i.test(name)) return 0;
  if (/\bvarsity\b/i.test(name)) return 1;
  return 0;
}

/** Sort by sport, ignoring JV/Varsity, then JV before Varsity. */
export function compareTeamNames(a: string, b: string): number {
  const group = teamGroupName(a).localeCompare(teamGroupName(b), undefined, { sensitivity: "base" });
  if (group !== 0) return group;
  const level = teamLevel(a) - teamLevel(b);
  if (level !== 0) return level;
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

export function extractTeam(summary: string): string | undefined {
  const text = normalizeName(summary);
  if (!text) return undefined;

  const allSports = text.match(/^(.*?)\s+-\s+(?:practice|game)\b/i);
  if (allSports) return normalizeName(allSports[1]);

  const stripped = text
    .replace(/^(?:practice|team photo(?: day)?|team bonding)\s+/i, "")
    .replace(/\s+vs\.?\b.*$/i, "")
    .replace(/\s+-\s+(?:home|away|neutral|tbd)\s*$/i, "")
    .replace(/^(?:semifinal playoff|quarterfinal playoff|championship|playoff)\s+/i, "");
  const team = normalizeName(stripped);
  return team || undefined;
}

export function isGameSummary(summary: string): boolean {
  const text = normalizeName(summary);
  if (!text) return false;
  if (PRACTICE_RE.test(text) || BONDING_RE.test(text)) return false;
  if (GAME_SEGMENT_RE.test(text)) return true;
  return GAME_RE.test(text);
}

export function isGameEvent(eventBlock: string): boolean {
  return isGameSummary(getProperty(eventBlock, "SUMMARY") ?? "");
}

export function teamMatches(summary: string, requested: string): boolean {
  const team = extractTeam(summary);
  if (!team) return false;
  const wanted = normalizeName(requested);
  if (!wanted) return false;
  return slugify(team) === slugify(wanted) || team.toLowerCase() === wanted.toLowerCase();
}

/** Team page already names the team; keep opponent / home-away from the school SUMMARY. */
export function displayGameSummary(summary: string, teamName: string): string {
  const text = normalizeName(summary);
  const team = normalizeName(teamName);
  if (!text || !team) return text;
  const escaped = team.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const rest = normalizeName(text.replace(new RegExp(`^${escaped}\\s+-\\s+Game\\b\\s*`, "i"), "").replace(/^-\s+/, ""));
  return rest || text;
}

export function parseTeamRequest(pathname: string, searchParams: URLSearchParams): string | undefined {
  const query = searchParams.get("team") ?? searchParams.get("q");
  if (query) {
    const fromQuery = normalizeName(query.replace(/\+/g, " "));
    if (fromQuery) return fromQuery;
  }

  const trimmed = pathname.replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return undefined;
  let rest = decodeURIComponent(trimmed.slice(1).replace(/\+/g, " "));
  if (rest.toLowerCase().endsWith(".ics")) rest = rest.slice(0, -4);
  rest = rest.replace(/^v\d+(?:\/|$)/i, "");
  rest = normalizeName(rest);
  if (!rest || RESERVED_PATHS.has(rest.toLowerCase())) return undefined;
  return rest;
}

export function listGameTeams(ics: string): TeamSummary[] {
  const { events } = splitEvents(unfoldIcal(ics));
  const counts = new Map<string, { name: string; games: number }>();
  for (const event of events) {
    const summary = getProperty(event, "SUMMARY") ?? "";
    if (!isGameSummary(summary)) continue;
    const name = extractTeam(summary);
    if (!name) continue;
    const key = slugify(name);
    const current = counts.get(key) ?? { name, games: 0 };
    current.games += 1;
    counts.set(key, current);
  }
  return [...counts.values()]
    .map((team) => ({ ...team, slug: slugify(team.name) }))
    .sort((a, b) => compareTeamNames(a.name, b.name));
}

export function listUpcomingGames(ics: string, now = new Date(), limit = 12): UpcomingGame[] {
  const { events } = splitEvents(unfoldIcal(ics));
  const today = pacificDayKey(now);
  return events
    .map((event) => toUpcomingGame(event))
    .filter((game): game is UpcomingGame => game !== undefined)
    .filter((game) => game.sortKey.slice(0, 8) >= today)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.summary.localeCompare(b.summary))
    .slice(0, limit);
}

function splitEvents(unfolded: string): { prelude: string[]; events: string[] } {
  const lines = unfolded.replace(/^\uFEFF/, "").split("\n");
  const prelude: string[] = [];
  const events: string[] = [];
  let current: string[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");
    if (line === "BEGIN:VEVENT") {
      current = [line];
      continue;
    }
    if (line === "END:VEVENT" && current) {
      current.push(line);
      events.push(current.join("\n"));
      current = null;
      continue;
    }
    if (current) {
      current.push(line);
      continue;
    }
    if (line === "END:VCALENDAR") continue;
    prelude.push(line);
  }

  if (prelude.length === 0 || prelude[0] !== "BEGIN:VCALENDAR") {
    throw new Error("Upstream response is not a VCALENDAR feed");
  }

  return { prelude, events };
}

function withCalendarName(prelude: string[], name: string): string[] {
  const withoutName = prelude.filter(
    (line) =>
      !/^X-WR-CALNAME(?:;[^:]*)?:/i.test(line) &&
      !/^NAME(?:;[^:]*)?:/i.test(line) &&
      !/^REFRESH-INTERVAL(?:;[^:]*)?:/i.test(line) &&
      !/^X-PUBLISHED-TTL(?:;[^:]*)?:/i.test(line),
  );
  const insertAt = Math.max(
    1,
    withoutName.findIndex((line) => /^PRODID(?:;[^:]*)?:/i.test(line)) + 1,
  );
  const next = [...withoutName];
  next.splice(
    insertAt,
    0,
    `X-WR-CALNAME:${name}`,
    `NAME:${name}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  );
  return next;
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

function icalLineValue(line: string): string {
  const colon = line.lastIndexOf(":");
  return colon >= 0 ? line.slice(colon + 1) : "";
}

function addMinutesToIcalDateTime(value: string, minutes: number): string {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const hour = Number(value.slice(9, 11));
  const minute = Number(value.slice(11, 13));
  const second = value.length >= 15 ? Number(value.slice(13, 15)) : 0;
  const next = new Date(Date.UTC(year, month - 1, day, hour, minute, second) + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}${pad(next.getUTCMonth() + 1)}${pad(next.getUTCDate())}T${pad(next.getUTCHours())}${pad(next.getUTCMinutes())}${pad(next.getUTCSeconds())}`;
}

/** Google keeps the first subscribed copy unless SEQUENCE increases and DTSTAMP moves forward. */
const EVENT_REVISION = 1;
const EVENT_REVISION_STAMP = "20260912T000100Z";

function stampNumber(value: string): number {
  return Number(value.replace(/[^\d]/g, "").padEnd(14, "0"));
}

function upsertProperty(event: string, name: string, value: string): string {
  const line = `${name}:${value}`;
  const re = new RegExp(`^${name}(?:;[^:]*)?:.*$`, "im");
  if (re.test(event)) return event.replace(re, line);
  const anchor = event.match(/^DTSTART(?:;[^:]*)?:.*$/im)?.[0];
  if (anchor) return event.replace(anchor, `${anchor}\n${line}`);
  return `${event}\n${line}`;
}

function markRevised(event: string): string {
  const current = Number(getProperty(event, "SEQUENCE") ?? "0");
  const sequence = Number.isFinite(current) ? Math.max(current, EVENT_REVISION) : EVENT_REVISION;
  let next = upsertProperty(event, "SEQUENCE", String(sequence));
  next = upsertProperty(next, "LAST-MODIFIED", EVENT_REVISION_STAMP);
  const stamp = getProperty(event, "DTSTAMP");
  if (!stamp || stampNumber(stamp) < stampNumber(EVENT_REVISION_STAMP)) {
    next = upsertProperty(next, "DTSTAMP", EVENT_REVISION_STAMP);
  }
  return next;
}

/** School feed often copies DTEND from DTSTART. Keep a 2-hour window so calendar apps show a real game. */
export function ensureGameDuration(event: string, minutes = 120): string {
  const startLine = event.match(/^DTSTART(?:;[^:]*)?:.*$/im)?.[0];
  if (!startLine) return markRevised(event);
  const startValue = icalLineValue(startLine);
  if (!startValue.includes("T")) return markRevised(event);

  const endLine = event.match(/^DTEND(?:;[^:]*)?:.*$/im)?.[0];
  const endValue = endLine ? icalLineValue(endLine) : "";
  if (endLine && startValue !== endValue) return markRevised(event);

  const newEndValue = addMinutesToIcalDateTime(startValue, minutes);
  const newEndLine = endLine
    ? `${endLine.slice(0, endLine.length - endValue.length)}${newEndValue}`
    : startLine.replace(/^DTSTART/i, "DTEND").replace(startValue, newEndValue);
  const withEnd = endLine ? event.replace(endLine, newEndLine) : event.replace(startLine, `${startLine}\n${newEndLine}`);
  return markRevised(withEnd);
}

function isPrivateCalendarUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return host.includes("myschoolapp.com") || path.includes("ical.ashx") || path.includes("/podium/feed");
  } catch {
    return false;
  }
}

/** Drop only private school-feed links. Every other event property is passed through. */
function sanitizeEvent(event: string): string {
  return event
    .split("\n")
    .filter((line) => {
      const match = line.match(/^URL(?:;[^:]*)?:(.*)$/i);
      if (!match) return true;
      return !isPrivateCalendarUrl(icalUnescape(match[1]));
    })
    .join("\n");
}

function serialize(lines: string[]): string {
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

function pacificDayKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" })
    .format(now)
    .replaceAll("-", "");
}

function toUpcomingGame(event: string): UpcomingGame | undefined {
  const summary = getProperty(event, "SUMMARY");
  const start = getProperty(event, "DTSTART");
  if (!summary || !start) return undefined;
  const end = getProperty(event, "DTEND");
  const { when, sortKey } = formatWhen(start, end);
  return {
    summary,
    location: getProperty(event, "LOCATION"),
    when,
    sortKey,
  };
}

function formatClock(digits: string): string {
  const hour = Number(digits.slice(8, 10));
  const minute = Number(digits.slice(10, 12));
  const hour12 = ((hour + 11) % 12) + 1;
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function formatWhen(start: string, end?: string): { when: string; sortKey: string } {
  const digits = start.replace(/[^\d]/g, "");
  if (digits.length < 8) return { when: start, sortKey: digits.padEnd(8, "0") };
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
  if (digits.length < 12) {
    return { when: dateLabel, sortKey: `${digits}000000` };
  }
  const startClock = formatClock(digits);
  const endDigits = end?.replace(/[^\d]/g, "") ?? "";
  if (endDigits.length >= 12 && endDigits !== digits) {
    const endClock = formatClock(endDigits);
    const sameMeridiem = startClock.slice(-2) === endClock.slice(-2);
    const startPart = sameMeridiem ? startClock.slice(0, -3) : startClock;
    return {
      when: `${dateLabel} · ${startPart}–${endClock}`,
      sortKey: digits.padEnd(14, "0"),
    };
  }
  return {
    when: `${dateLabel} · ${startClock}`,
    sortKey: digits.padEnd(14, "0"),
  };
}

export function filterGames(ics: string, calendarNameOrOptions: string | FilterOptions = {}): FilterResult {
  const options: FilterOptions =
    typeof calendarNameOrOptions === "string"
      ? { calendarName: calendarNameOrOptions }
      : calendarNameOrOptions;
  const { prelude, events } = splitEvents(unfoldIcal(ics));
  const games = events.filter(isGameEvent);
  const requested = options.team?.trim();
  const keptEvents = requested ? games.filter((event) => teamMatches(getProperty(event, "SUMMARY") ?? "", requested)) : games;
  const teamName = requested
    ? extractTeam(getProperty(keptEvents[0] ?? "", "SUMMARY") ?? "") ?? normalizeName(requested)
    : undefined;
  const calendarName = options.calendarName || teamName || DEFAULT_CALENDAR_NAME;
  const lines = [
    ...withCalendarName(prelude, calendarName),
    ...keptEvents.flatMap((event) => sanitizeEvent(ensureGameDuration(event)).split("\n")),
    "END:VCALENDAR",
  ].filter((line) => line.length > 0);

  return {
    ics: serialize(lines),
    stats: { kept: keptEvents.length, dropped: events.length - keptEvents.length },
    teamName,
  };
}
