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

  it("covers winter sports from last year", () => {
    expect(sportGlyph("Boys Varsity Basketball")).toBe("🏀");
    expect(sportGlyph("Boys JV Basketball")).toBe("🏀");
    expect(sportGlyph("Boys Intramural Basketball")).toBe("🏀");
    expect(sportGlyph("Girls Varsity Basketball")).toBe("🏀");
    expect(sportGlyph("Girls Soccer")).toBe("⚽");
  });

  it("covers spring sports from last year", () => {
    expect(sportGlyph("Baseball")).toBe("⚾");
    expect(sportGlyph("Boys Varsity Baseball")).toBe("⚾");
    expect(sportGlyph("Boys Golf")).toBe("⛳");
    expect(sportGlyph("Boys Varsity Lacrosse")).toBe("🥍");
    expect(sportGlyph("Boys JV Lacrosse")).toBe("🥍");
    expect(sportGlyph("Girls Varsity Lacrosse")).toBe("🥍");
    expect(sportGlyph("Boys Tennis")).toBe("🎾");
    expect(sportGlyph("Boys Varsity Volleyball")).toBe("🏐");
    expect(sportGlyph("Track and Field")).toBe("🏃");
    expect(sportGlyph("Softball")).toBe("🥎");
  });

  it("falls back for unknown teams", () => {
    expect(sportGlyph("Chess Club")).toBe("🏅");
  });
});

describe("renderHome", () => {
  it("labels the combined feed All Sports and includes calendar brand icons", () => {
    const html = renderHome({
      siteName: "Example Athletics",
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
    expect(html).toContain('<a class="meta" href="/boys-varsity-soccer">3 games</a>');
    expect(html).toContain("webcal://example.test/boys-varsity-soccer.ics");
    expect(html).toContain('<a class="brand" href="/">Example Athletics</a>');
    expect(html).toContain("class=\"unofficial\"");
    expect(html).toContain(">About</summary>");
    expect(html).toContain('href="https://github.com/jkrauska/baygames"');
    expect(html).not.toContain("&lt;p");
    expect(html).toContain("Not an official school site.");
  });
});

describe("renderTeam", () => {
  it("labels the list Upcoming Games", () => {
    const html = renderTeam({
      siteName: "Example Athletics",
      teamName: "Boys Varsity Soccer",
      links: subscribeLinks("https://example.test/boys-varsity-soccer.ics"),
      games: [{ summary: "Drew School SF - Home", when: "Tue, Sep 15 · 4:00–6:00 PM", location: "Kezar Stadium" }],
    });
    expect(html).toContain("<h2>Upcoming Games</h2>");
    expect(html).toContain("Drew School SF - Home");
    expect(html).not.toContain("Boys Varsity Soccer - Game");
    expect(html).toContain('href="https://maps.google.com/maps?q=Kezar%20Stadium"');
    expect(html).toContain("Kezar Stadium");
    expect(html).toContain("All Sports");
    expect(html).toContain("class=\"unofficial\"");
    expect(html).toContain(">About</summary>");
    expect(html).toContain('href="https://github.com/jkrauska/baygames"');
    expect(html).toContain("Not an official school site.");
  });
});
