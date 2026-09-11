import { describe, expect, it } from "vitest";
import { renderHome, renderTeam, sportGlyph, subscribeLinks } from "./page";

describe("sportGlyph", () => {
  it("picks a glyph from the sport in the team name", () => {
    expect(sportGlyph("Boys Varsity Flag Football")).toBe("🏈");
    expect(sportGlyph("Boys JV Soccer")).toBe("⚽");
    expect(sportGlyph("Girls Varsity Volleyball")).toBe("🏐");
    expect(sportGlyph("Girls JV Tennis")).toBe("🎾");
    expect(sportGlyph("Girls Varsity Golf")).toBe("⛳");
    expect(sportGlyph("Cross Country")).toBe("🏃");
  });

  it("falls back for unknown teams", () => {
    expect(sportGlyph("Chess Club")).toBe("🏅");
  });
});

describe("renderHome", () => {
  it("labels the combined feed All Sports and includes calendar brand icons", () => {
    const html = renderHome({
      siteName: "Bay Sports Games",
      allGames: subscribeLinks("https://example.test/games.ics"),
      teams: [
        {
          name: "Boys Varsity Soccer",
          slug: "boys-varsity-soccer",
          games: 3,
          href: "/boys-varsity-soccer",
          googleUrl: "https://calendar.google.com/example",
          webcalUrl: "webcal://example.test/boys-varsity-soccer.ics",
        },
      ],
    });
    expect(html).toContain("All Sports");
    expect(html).not.toContain("All games");
    expect(html).toContain("⚽");
    expect(html).toContain("class=\"brand-icon\"");
    expect(html).toContain("Google Calendar");
    expect(html).toContain("Apple Calendar");
    expect(html).toContain("webcal://example.test/boys-varsity-soccer.ics");
    expect(html).toContain("Click a team to see upcoming games details.");
    expect(html).not.toMatch(/<h1>[^<]*Bay Sports Games/);
    expect(html).toContain("Not an official school site.");
  });
});

describe("renderTeam", () => {
  it("labels the list Upcoming Games", () => {
    const html = renderTeam({
      siteName: "Bay Sports Games",
      teamName: "Boys Varsity Soccer",
      links: subscribeLinks("https://example.test/boys-varsity-soccer.ics"),
      games: [{ summary: "vs Drew School", when: "Tue, Sep 15 · 4:00 PM", location: "Home" }],
    });
    expect(html).toContain("<h2>Upcoming Games</h2>");
    expect(html).toContain("vs Drew School");
    expect(html).toContain("All Sports");
    expect(html).toContain("Not an official school site.");
  });
});
