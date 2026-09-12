import {
  DEFAULT_CALENDAR_NAME,
  displayGameSummary,
  filterGames,
  listGameTeams,
  listUpcomingGames,
  parseTeamRequest,
  slugify,
} from "./filter";
import { renderHome, renderTeam, subscribeLinks } from "./page";

export interface Env {
  SOURCE_ICAL_URL: string;
  CALENDAR_NAME?: string;
  FEED_TOKEN?: string;
}

const CACHE_TTL_SECONDS = 300;
const USER_AGENT = "Mozilla/5.0 (compatible; GamesCal/1.0)";
const UPSTREAM_CACHE_KEY = "https://internal/upstream.ics?v=2";
const FEED_CACHE_VERSION = "4";
const PUBLIC_FEED_VERSION = 1;

class ConfigError extends Error {}
class UpstreamError extends Error {}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405 });
    }

    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    if (!tokenAllowed(url, env)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const team = parseTeamRequest(url.pathname, url.searchParams);
    const calendarRequest = wantsCalendar(request, url);

    if (url.pathname === "/google" || url.pathname.endsWith("/google")) {
      const icsUrl = feedUrl(url, team);
      return Response.redirect(subscribeLinks(icsUrl).googleUrl, 302);
    }

    if (calendarRequest) {
      return cachedCalendar(request, env, ctx, team);
    }

    return landing(request, env, ctx, team);
  },
} satisfies ExportedHandler<Env>;

function calendarName(env: Env): string {
  return env.CALENDAR_NAME?.trim() || DEFAULT_CALENDAR_NAME;
}

function tokenAllowed(url: URL, env: Env): boolean {
  if (!env.FEED_TOKEN) return true;
  return url.searchParams.get("token") === env.FEED_TOKEN;
}

function wantsCalendar(request: Request, url: URL): boolean {
  if (url.pathname === "/games.ics" || url.pathname === "/calendar.ics") return true;
  if (url.pathname.toLowerCase().endsWith(".ics")) return true;
  if (url.searchParams.get("format") === "ics") return true;
  const accept = request.headers.get("Accept") ?? "";
  if (accept.includes("text/calendar")) return true;
  const ua = request.headers.get("User-Agent") ?? "";
  return /Google-Calendar|GoogleCalendar|iCal|CalendarAgent|Lightning/i.test(ua);
}

function publicOrigin(url: URL): string {
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return url.origin;
  return `https://${url.host}`;
}

function feedUrl(url: URL, team?: string): string {
  const origin = publicOrigin(url);
  const prefix = `${origin}/v${PUBLIC_FEED_VERSION}`;
  if (!team) return `${prefix}/games.ics`;
  return `${prefix}/${slugify(team)}.ics`;
}

async function cachedCalendar(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  team?: string,
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(`${feedUrl(new URL(request.url), team)}?v=${FEED_CACHE_VERSION}`, {
    method: "GET",
  });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return request.method === "HEAD" ? headOnly(cached) : cached;
  }

  const fresh = await buildFeed(env, ctx, team);
  if (fresh.ok) {
    ctx.waitUntil(cache.put(cacheKey, fresh.clone()));
  }
  return request.method === "HEAD" ? headOnly(fresh) : fresh;
}

async function loadUpstream(env: Env, ctx: ExecutionContext): Promise<string> {
  if (!env.SOURCE_ICAL_URL) {
    throw new ConfigError();
  }
  const cache = caches.default;
  const cacheKey = new Request(UPSTREAM_CACHE_KEY, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached.text();

  let upstream: Response;
  try {
    upstream = await fetch(env.SOURCE_ICAL_URL, {
      headers: {
        Accept: "text/calendar, text/plain, */*",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
    });
  } catch {
    throw new UpstreamError();
  }
  if (!upstream.ok) {
    throw new UpstreamError();
  }
  const body = await upstream.text();
  ctx.waitUntil(
    cache.put(
      cacheKey,
      new Response(body, {
        headers: { "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}` },
      }),
    ),
  );
  return body;
}

function publicFailure(error: unknown): Response {
  const status = error instanceof ConfigError ? 500 : 502;
  const message = error instanceof ConfigError ? "Calendar is not configured" : "School calendar is unavailable";
  return new Response(message, { status });
}

async function buildFeed(env: Env, ctx: ExecutionContext, team?: string): Promise<Response> {
  let body: string;
  try {
    body = await loadUpstream(env, ctx);
  } catch (error) {
    return publicFailure(error);
  }

  let result;
  try {
    const siteName = calendarName(env);
    result = filterGames(body, {
      team,
      calendarName: team ? undefined : siteName,
    });
  } catch {
    return new Response("School calendar is unavailable", { status: 502 });
  }

  if (team && result.stats.kept === 0) {
    return new Response(`No games found for ${team}`, { status: 404 });
  }

  const filename = `${team ? slugify(result.teamName || team) : "games"}.ics`;
  return new Response(result.ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      "X-Games-Kept": String(result.stats.kept),
      "X-Games-Dropped": String(result.stats.dropped),
    },
  });
}

async function landing(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  team?: string,
): Promise<Response> {
  const url = new URL(request.url);
  const siteName = calendarName(env);

  let ics: string;
  try {
    ics = await loadUpstream(env, ctx);
  } catch (error) {
    return publicFailure(error);
  }

  const origin = publicOrigin(url);

  if (team) {
    const filtered = filterGames(ics, { team });
    if (filtered.stats.kept === 0) {
      return new Response(`No games found for ${team}`, { status: 404 });
    }
    const teamName = filtered.teamName || team;
    const slug = slugify(teamName);
    if (slugify(url.pathname.replace(/\/+$/, "").slice(1)) !== slug && !url.searchParams.has("team")) {
      return Response.redirect(`${origin}/${slug}`, 302);
    }
    const html = renderTeam({
      siteName,
      teamName,
      links: subscribeLinks(feedUrl(url, slug)),
      games: listUpcomingGames(filtered.ics).map((game) => ({
        ...game,
        summary: displayGameSummary(game.summary, teamName),
      })),
    });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const teams = listGameTeams(ics).map((item) => {
    const links = subscribeLinks(feedUrl(url, item.slug));
    return {
      name: item.name,
      slug: item.slug,
      games: item.games,
      href: `/${item.slug}`,
      googleUrl: links.googleUrl,
      webcalUrl: links.webcalUrl,
    };
  });

  const html = renderHome({
    siteName,
    allGames: subscribeLinks(feedUrl(url)),
    teams,
  });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function headOnly(response: Response): Response {
  return new Response(null, { status: response.status, headers: response.headers });
}
