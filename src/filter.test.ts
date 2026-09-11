import { describe, expect, it } from "vitest";
import {
  compareTeamNames,
  extractTeam,
  filterGames,
  isGameSummary,
  listGameTeams,
  parseTeamRequest,
  slugify,
  unfoldIcal,
} from "./filter";

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//WhippleHill Communications//Podium//EN
BEGIN:VTIMEZONE
TZID:America/Los_Angeles
END:VTIMEZONE
BEGIN:VEVENT
UID:practice-1
SUMMARY:Boys Varsity Flag Football - Practice -
DTSTART;TZID=America/Los_Angeles:20260911T144500
END:VEVENT
BEGIN:VEVENT
UID:game-1
SUMMARY:Boys Varsity Flag Football - Game SF University High School - Away
DTSTART;TZID=America/Los_Angeles:20260908T153000
URL:https://example.invalid/secret-feed?z=token
END:VEVENT
BEGIN:VEVENT
UID:soccer
SUMMARY:Boys Varsity Soccer - Game Drew School SF - Home
DTSTART;TZID=America/Los_Angeles:20260915T160000
END:VEVENT
BEGIN:VEVENT
UID:bonding
SUMMARY:Team Bonding Boys Varsity Flag Football
DTSTART;TZID=America/Los_Angeles:20260912T170000
END:VEVENT
END:VCALENDAR
`.replace(/\n/g, "\r\n");

describe("isGameSummary", () => {
  it("drops practices and bonding", () => {
    expect(isGameSummary("Boys Varsity Flag Football - Practice -")).toBe(false);
    expect(isGameSummary("Team Bonding Picnic")).toBe(false);
  });

  it("keeps all-sports Game events", () => {
    expect(isGameSummary("Boys Varsity Flag Football - Game SF University High School - Away")).toBe(
      true,
    );
    expect(isGameSummary("Cross Country - Game - Neutral")).toBe(true);
  });
});

describe("team matching", () => {
  it("slugifies pretty names", () => {
    expect(slugify("Boys Varsity Flag Football")).toBe("boys-varsity-flag-football");
    expect(extractTeam("Boys Varsity Flag Football - Game Drew School SF - Home")).toBe(
      "Boys Varsity Flag Football",
    );
  });

  it("parses path and ?team=", () => {
    expect(parseTeamRequest("/Boys%20Varsity%20Flag%20Football", new URLSearchParams())).toBe(
      "Boys Varsity Flag Football",
    );
    expect(parseTeamRequest("/boys-varsity-flag-football.ics", new URLSearchParams())).toBe(
      "boys-varsity-flag-football",
    );
    expect(parseTeamRequest("/games.ics", new URLSearchParams())).toBeUndefined();
    expect(parseTeamRequest("/", new URLSearchParams("team=Boys+Varsity+Soccer"))).toBe(
      "Boys Varsity Soccer",
    );
  });
});

describe("filterGames", () => {
  it("keeps games only and strips URL properties", () => {
    const { ics, stats } = filterGames(SAMPLE, "Bay Sports Games");
    const unfolded = unfoldIcal(ics);

    expect(stats).toEqual({ kept: 2, dropped: 2 });
    expect(unfolded).toContain("X-WR-CALNAME:Bay Sports Games");
    expect(unfolded).toContain("- Game SF University High School - Away");
    expect(unfolded).not.toMatch(/Practice/);
    expect(unfolded).not.toMatch(/Bonding/);
    expect(unfolded).not.toMatch(/example\.invalid/);
  });

  it("fills in a 2-hour DTEND when the school feed copies start into end", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:zero
SUMMARY:Boys Varsity Soccer - Game Drew School SF - Home
DTSTART;TZID=America/Los_Angeles:20260915T160000
DTEND;TZID=America/Los_Angeles:20260915T160000
END:VEVENT
END:VCALENDAR`;
    const unfolded = unfoldIcal(filterGames(ics).ics);
    expect(unfolded).toContain("DTSTART;TZID=America/Los_Angeles:20260915T160000");
    expect(unfolded).toContain("DTEND;TZID=America/Los_Angeles:20260915T180000");
  });

  it("leaves real end times and all-day dates alone", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:real
SUMMARY:Cross Country - Game - Away
DTSTART;TZID=America/Los_Angeles:20260829T090000
DTEND;TZID=America/Los_Angeles:20260829T123000
END:VEVENT
BEGIN:VEVENT
UID:allday
SUMMARY:Boys Varsity Flag Football - Game - Home
DTSTART;VALUE=DATE:20261014
DTEND;VALUE=DATE:20261015
END:VEVENT
END:VCALENDAR`;
    const unfolded = unfoldIcal(filterGames(ics).ics);
    expect(unfolded).toContain("DTEND;TZID=America/Los_Angeles:20260829T123000");
    expect(unfolded).toContain("DTEND;VALUE=DATE:20261015");
  });

  it("filters to one team by pretty name or slug", () => {
    const pretty = filterGames(SAMPLE, { team: "Boys Varsity Flag Football" });
    expect(pretty.stats.kept).toBe(1);
    expect(pretty.teamName).toBe("Boys Varsity Flag Football");
    expect(unfoldIcal(pretty.ics)).not.toContain("Soccer");

    const slug = filterGames(SAMPLE, { team: "boys-varsity-flag-football" });
    expect(slug.stats.kept).toBe(1);
  });

  it("lists teams that have games", () => {
    expect(listGameTeams(SAMPLE).map((team) => team.slug)).toEqual([
      "boys-varsity-flag-football",
      "boys-varsity-soccer",
    ]);
  });
});

describe("compareTeamNames", () => {
  it("groups JV with Varsity of the same sport", () => {
    const names = [
      "Girls Varsity Volleyball",
      "Girls Varsity Tennis",
      "Girls JV Tennis",
      "Girls Varsity Golf",
      "Boys Varsity Soccer",
      "Boys JV Soccer",
      "Boys Varsity Flag Football",
      "Boys JV Flag Football",
      "Cross Country",
    ];
    expect([...names].sort(compareTeamNames)).toEqual([
      "Boys JV Flag Football",
      "Boys Varsity Flag Football",
      "Boys JV Soccer",
      "Boys Varsity Soccer",
      "Cross Country",
      "Girls Varsity Golf",
      "Girls JV Tennis",
      "Girls Varsity Tennis",
      "Girls Varsity Volleyball",
    ]);
  });
});
