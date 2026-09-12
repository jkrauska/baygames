import { describe, expect, it } from "vitest";
import {
  compareTeamNames,
  DEFAULT_CALENDAR_NAME,
  displayGameSummary,
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
DESCRIPTION:Bring water. Meet at the field.
LOCATION:Paul Goode - Field A/B
STATUS:CONFIRMED
CLASS:PUBLIC
URL:https://example.myschoolapp.com/podium/feed/iCal.ashx?z=token
END:VEVENT
BEGIN:VEVENT
UID:soccer
SUMMARY:Boys Varsity Soccer - Game Drew School SF - Home
DTSTART;TZID=America/Los_Angeles:20260915T160000
URL:https://maps.google.com/?q=Kezar+Stadium
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
    expect(displayGameSummary(
      "Boys Varsity Flag Football - Game The Nueva School - Home",
      "Boys Varsity Flag Football",
    )).toBe("The Nueva School - Home");
    expect(displayGameSummary("Cross Country - Game - Neutral", "Cross Country")).toBe("Neutral");
    expect(displayGameSummary("vs Drew School", "Boys Varsity Soccer")).toBe("vs Drew School");
  });

  it("parses path and ?team=", () => {
    expect(parseTeamRequest("/Boys%20Varsity%20Flag%20Football", new URLSearchParams())).toBe(
      "Boys Varsity Flag Football",
    );
    expect(parseTeamRequest("/boys-varsity-flag-football.ics", new URLSearchParams())).toBe(
      "boys-varsity-flag-football",
    );
    expect(parseTeamRequest("/v1/boys-varsity-flag-football.ics", new URLSearchParams())).toBe(
      "boys-varsity-flag-football",
    );
    expect(parseTeamRequest("/games.ics", new URLSearchParams())).toBeUndefined();
    expect(parseTeamRequest("/v1/games.ics", new URLSearchParams())).toBeUndefined();
    expect(parseTeamRequest("/", new URLSearchParams("team=Boys+Varsity+Soccer"))).toBe(
      "Boys Varsity Soccer",
    );
  });
});

describe("filterGames", () => {
  it("keeps games only and passes event fields through", () => {
    const { ics, stats } = filterGames(SAMPLE, "Example Athletics");
    const unfolded = unfoldIcal(ics);

    expect(stats).toEqual({ kept: 2, dropped: 2 });
    expect(unfolded).toContain("X-WR-CALNAME:Example Athletics");
    expect(unfolded).toContain("- Game SF University High School - Away");
    expect(unfolded).toContain("DESCRIPTION:Bring water. Meet at the field.");
    expect(unfolded).toContain("LOCATION:Paul Goode - Field A/B");
    expect(unfolded).toContain("STATUS:CONFIRMED");
    expect(unfolded).toContain("CLASS:PUBLIC");
    expect(unfolded).toContain("URL:https://maps.google.com/?q=Kezar+Stadium");
    expect(unfolded).not.toMatch(/Practice/);
    expect(unfolded).not.toMatch(/Bonding/);
    expect(unfolded).not.toMatch(/myschoolapp\.com/);
  });

  it("uses the default calendar name when none is provided", () => {
    const unfolded = unfoldIcal(filterGames(SAMPLE).ics);
    expect(unfolded).toContain(`X-WR-CALNAME:${DEFAULT_CALENDAR_NAME}`);
  });

  it("fills in a 90-minute DTEND when the school feed copies start into end", () => {
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
    expect(unfolded).toContain("DTEND;TZID=America/Los_Angeles:20260915T173000");
    expect(unfolded).toContain("SEQUENCE:2");
    expect(unfolded).toContain("LAST-MODIFIED:20260912T011500Z");
    expect(unfolded).toContain("DTSTAMP:20260912T011500Z");
  });

  it("adds a 90-minute DTEND when the school feed omits it", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:missing
SUMMARY:Boys Varsity Flag Football - Game The Nueva School - Home
DTSTART;TZID=America/Los_Angeles:20260915T160000
END:VEVENT
END:VCALENDAR`;
    const unfolded = unfoldIcal(filterGames(ics).ics);
    expect(unfolded).toContain("DTEND;TZID=America/Los_Angeles:20260915T173000");
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
    expect(unfolded).toContain("SEQUENCE:2");
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
