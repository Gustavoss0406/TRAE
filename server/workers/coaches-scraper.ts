
import axios from "axios";
import * as cheerio from "cheerio";
import { getDb } from "../db";
import { teams, coaches, leagues } from "../../drizzle/schema";
import { eq, like, sql } from "drizzle-orm";

const WIKI_URLS: Record<string, string> = {
  "Premier League": "https://en.wikipedia.org/wiki/2024%E2%80%9325_Premier_League",
  "La Liga": "https://en.wikipedia.org/wiki/2024%E2%80%9325_La_Liga",
  "Serie A": "https://en.wikipedia.org/wiki/2024%E2%80%9325_Serie_A",
  "Bundesliga": "https://en.wikipedia.org/wiki/2024%E2%80%9325_Bundesliga",
  "Ligue 1": "https://en.wikipedia.org/wiki/2024%E2%80%9325_Ligue_1"
};

function normalizeName(name: string): string {
  return name.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]/g, "") // Remove non-alphanumeric (spaces, hyphens, dots)
    .replace("fc", "").replace("cf", "").replace("sc", "") // Remove common suffixes
    .replace("1fs", "").replace("1fc", "").replace("sv", "").replace("vfl", "") // Remove German prefixes
    .trim();
}

export async function scrapeCoaches(leagueName: string) {
  const url = WIKI_URLS[leagueName];
  if (!url) {
    console.log(`No Wikipedia URL configured for ${leagueName}`);
    return;
  }

  console.log(`Scraping coaches for ${leagueName} from ${url}`);
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const $ = cheerio.load(data);
    const db = await getDb();
    if (!db) return;

    // Get League ID to filter teams
    const league = await db.query.leagues.findFirst({
        where: eq(leagues.name, leagueName)
    });
    
    if (!league) {
        console.log(`League ${leagueName} not found in DB`);
        return;
    }

    // Fetch all teams (not just by country, to include Monaco, etc.)
    const leagueTeams = await db.query.teams.findMany();

    const teamMap = new Map<string, typeof leagueTeams[0]>();
    for (const t of leagueTeams) {
        teamMap.set(normalizeName(t.name), t);
    }
    
    // Find the table that contains "Manager" in headers
    let targetTable: cheerio.Cheerio<any> | null = null;
    
    $("table.wikitable.sortable").each((i, table) => {
        const headers = $(table).find("th").text().toLowerCase();
        if (headers.includes("manager") && headers.includes("team")) {
            targetTable = $(table);
            return false; // break
        }
    });

    if (!targetTable) {
        targetTable = $("table.wikitable.sortable").eq(1);
    }
    
    if (!targetTable) {
        console.log("Could not find managers table");
        return;
    }

    // Determine Manager column index dynamically
    let managerColIndex = 1; // Default
    const headerRow = targetTable.find("tr").filter((i, el) => {
        return $(el).find("th").length > 0 && $(el).text().toLowerCase().includes("manager");
    }).first();

    if (headerRow.length > 0) {
        const headerCells = headerRow.find("th").toArray();
        headerCells.forEach((th, index) => {
            const text = $(th).text().trim().toLowerCase();
            if (text.includes("manager") || text.includes("head coach") || text.includes("coach")) {
                managerColIndex = index;
            }
        });
        console.log(`Identified Manager column at index ${managerColIndex} for ${leagueName}`);
    } else {
        const headerCells = targetTable.find("th").toArray();
        headerCells.forEach((th, index) => {
            const text = $(th).text().trim().toLowerCase();
            if (text.includes("manager") || text.includes("head coach") || text.includes("coach")) {
                managerColIndex = index;
            }
        });
        console.log(`Identified Manager column at index ${managerColIndex} for ${leagueName} (fallback)`);
    }

    const rows = targetTable.find("tr").toArray();
    let count = 0;

    for (const row of rows) {
      let teamName = "";
      let coachName = "";
      
      const tds = $(row).find("td");
      const ths = $(row).find("th");
      
      let allCells: any[] = [];
      if (ths.length > 0) {
          allCells.push(ths.eq(0));
          tds.each((i, el) => { allCells.push($(el)); });
      } else {
          tds.each((i, el) => { allCells.push($(el)); });
      }
      
      if (allCells.length <= managerColIndex) continue;

      teamName = $(allCells[0]).text().trim();
      coachName = $(allCells[managerColIndex]).text().trim();
      
      teamName = teamName.replace(/\[.*?\]/g, "").trim();
      coachName = coachName.replace(/\[.*?\]/g, "").trim();
      
      if (!teamName || !coachName) continue;

      // Matching Logic
      const normalizedScraped = normalizeName(teamName);
      let team = teamMap.get(normalizedScraped);

      // Fallback: Check for partial matches
      if (!team) {
          // Manual Overrides
          if (normalizedScraped.includes("mancity")) team = teamMap.get(normalizeName("Manchester City FC"));
          if (normalizedScraped.includes("manutd")) team = teamMap.get(normalizeName("Manchester United FC"));
          if (normalizedScraped.includes("spurs")) team = teamMap.get(normalizeName("Tottenham Hotspur FC"));
          if (normalizedScraped.includes("wolves")) team = teamMap.get(normalizeName("Wolverhampton Wanderers FC"));
          if (normalizedScraped.includes("nottmforest")) team = teamMap.get(normalizeName("Nottingham Forest FC"));
          if (normalizedScraped.includes("sheffutd")) team = teamMap.get(normalizeName("Sheffield United FC"));
          if (normalizedScraped.includes("newcastle")) team = teamMap.get(normalizeName("Newcastle United FC"));
          if (normalizedScraped.includes("brighton")) team = teamMap.get(normalizeName("Brighton & Hove Albion FC"));
          if (normalizedScraped.includes("psg") || normalizedScraped.includes("parissaintgermain")) team = teamMap.get(normalizeName("Paris Saint-Germain FC"));
          if (normalizedScraped.includes("saintetienne")) team = teamMap.get(normalizeName("St Etienne"));
          if (normalizedScraped.includes("athleticclub")) team = teamMap.get(normalizeName("Athletic Club"));
          if (normalizedScraped.includes("atleticomadrid")) team = teamMap.get(normalizeName("Atletico Madrid"));
          if (normalizedScraped.includes("betis")) team = teamMap.get(normalizeName("Real Betis"));
          if (normalizedScraped.includes("sociedad")) team = teamMap.get(normalizeName("Real Sociedad"));
          if (normalizedScraped.includes("alaves")) team = teamMap.get(normalizeName("Deportivo Alaves"));
          if (normalizedScraped.includes("rayovallecano")) team = teamMap.get(normalizeName("Rayo Vallecano"));
          if (normalizedScraped.includes("celta")) team = teamMap.get(normalizeName("RC Celta"));
          if (normalizedScraped.includes("leganes")) team = teamMap.get(normalizeName("CD Leganes"));
          if (normalizedScraped.includes("espanyol")) team = teamMap.get(normalizeName("RCD Espanyol"));
          if (normalizedScraped.includes("mallorca")) team = teamMap.get(normalizeName("RCD Mallorca"));
          if (normalizedScraped.includes("osasuna")) team = teamMap.get(normalizeName("CA Osasuna"));
          if (normalizedScraped.includes("valladolid")) team = teamMap.get(normalizeName("Real Valladolid CF"));
          if (normalizedScraped.includes("getafe")) team = teamMap.get(normalizeName("Getafe CF"));
          if (normalizedScraped.includes("girona")) team = teamMap.get(normalizeName("Girona FC"));
          if (normalizedScraped.includes("laspalmas")) team = teamMap.get(normalizeName("UD Las Palmas"));
          if (normalizedScraped.includes("sevilla")) team = teamMap.get(normalizeName("Sevilla FC"));
          if (normalizedScraped.includes("valencia")) team = teamMap.get(normalizeName("Valencia CF"));
          if (normalizedScraped.includes("villarreal")) team = teamMap.get(normalizeName("Villarreal CF"));
          
          if (normalizedScraped.includes("bayern") && !normalizedScraped.includes("leverkusen")) team = teamMap.get(normalizeName("FC Bayern Munchen"));
          if (normalizedScraped.includes("dortmund")) team = teamMap.get(normalizeName("Borussia Dortmund"));
          if (normalizedScraped.includes("leverkusen")) team = teamMap.get(normalizeName("Bayer 04 Leverkusen"));
          if (normalizedScraped.includes("leipzig")) team = teamMap.get(normalizeName("RB Leipzig"));
          if (normalizedScraped.includes("stuttgart")) team = teamMap.get(normalizeName("VfB Stuttgart"));
          if (normalizedScraped.includes("frankfurt")) team = teamMap.get(normalizeName("Eintracht Frankfurt"));
          if (normalizedScraped.includes("hoffenheim")) team = teamMap.get(normalizeName("TSG 1899 Hoffenheim"));
          if (normalizedScraped.includes("heidenheim")) team = teamMap.get(normalizeName("1. FC Heidenheim 1846"));
          if (normalizedScraped.includes("werder")) team = teamMap.get(normalizeName("SV Werder Bremen"));
          if (normalizedScraped.includes("freiburg")) team = teamMap.get(normalizeName("SC Freiburg"));
          if (normalizedScraped.includes("augsburg")) team = teamMap.get(normalizeName("FC Augsburg"));
          if (normalizedScraped.includes("wolfsburg")) team = teamMap.get(normalizeName("VfL Wolfsburg"));
          if (normalizedScraped.includes("mainz")) team = teamMap.get(normalizeName("1. FSV Mainz 05"));
          if (normalizedScraped.includes("gladbach")) team = teamMap.get(normalizeName("Borussia Monchengladbach"));
          if (normalizedScraped.includes("unionberlin")) team = teamMap.get(normalizeName("1. FC Union Berlin"));
          if (normalizedScraped.includes("bochum")) team = teamMap.get(normalizeName("VfL Bochum 1848"));
          if (normalizedScraped.includes("pauli")) team = teamMap.get(normalizeName("St Pauli"));
          if (normalizedScraped.includes("kiel")) team = teamMap.get(normalizeName("Holstein Kiel"));
          
          if (normalizedScraped.includes("inter") && !normalizedScraped.includes("international")) team = teamMap.get(normalizeName("Inter Milan"));
          if (normalizedScraped.includes("milan") && !normalizedScraped.includes("inter")) team = teamMap.get(normalizeName("AC Milan"));
          if (normalizedScraped.includes("juventus")) team = teamMap.get(normalizeName("Juventus FC"));
          if (normalizedScraped.includes("atalanta")) team = teamMap.get(normalizeName("Atalanta BC"));
          if (normalizedScraped.includes("bologna")) team = teamMap.get(normalizeName("Bologna FC 1909"));
          if (normalizedScraped.includes("roma")) team = teamMap.get(normalizeName("AS Roma"));
          if (normalizedScraped.includes("lazio")) team = teamMap.get(normalizeName("SS Lazio"));
          if (normalizedScraped.includes("fiorentina")) team = teamMap.get(normalizeName("ACF Fiorentina"));
          if (normalizedScraped.includes("torino")) team = teamMap.get(normalizeName("Torino FC"));
          if (normalizedScraped.includes("napoli")) team = teamMap.get(normalizeName("SSC Napoli"));
          if (normalizedScraped.includes("genoa")) team = teamMap.get(normalizeName("Genoa CFC"));
          if (normalizedScraped.includes("monza")) team = teamMap.get(normalizeName("AC Monza"));
          if (normalizedScraped.includes("verona")) team = teamMap.get(normalizeName("Hellas Verona FC"));
          if (normalizedScraped.includes("lecce")) team = teamMap.get(normalizeName("US Lecce"));
          if (normalizedScraped.includes("udinese")) team = teamMap.get(normalizeName("Udinese Calcio"));
          if (normalizedScraped.includes("cagliari")) team = teamMap.get(normalizeName("Cagliari Calcio"));
          if (normalizedScraped.includes("empoli")) team = teamMap.get(normalizeName("Empoli FC"));
          if (normalizedScraped.includes("parma")) team = teamMap.get(normalizeName("Parma Calcio 1913"));
          if (normalizedScraped.includes("como")) team = teamMap.get(normalizeName("Como 1907"));
          if (normalizedScraped.includes("venezia")) team = teamMap.get(normalizeName("Venezia FC"));

          if (normalizedScraped.includes("brest")) team = teamMap.get(normalizeName("Stade Brestois 29"));
          if (normalizedScraped.includes("reims")) team = teamMap.get(normalizeName("Stade de Reims"));
          if (normalizedScraped.includes("rennes")) team = teamMap.get(normalizeName("Stade Rennais FC 1901"));
          if (normalizedScraped.includes("havre")) team = teamMap.get(normalizeName("Le Havre AC"));
          if (normalizedScraped.includes("nice")) team = teamMap.get(normalizeName("OGC Nice"));
          if (normalizedScraped.includes("lille")) team = teamMap.get(normalizeName("Lille OSC"));
          if (normalizedScraped.includes("lens")) team = teamMap.get(normalizeName("Racing Club de Lens"));
          if (normalizedScraped.includes("marseille")) team = teamMap.get(normalizeName("Olympique de Marseille"));
          if (normalizedScraped.includes("lyon")) team = teamMap.get(normalizeName("Olympique Lyonnais"));
          if (normalizedScraped.includes("monaco")) team = teamMap.get(normalizeName("AS Monaco FC"));
          if (normalizedScraped.includes("nantes")) team = teamMap.get(normalizeName("FC Nantes"));
          if (normalizedScraped.includes("strasbourg")) team = teamMap.get(normalizeName("RC Strasbourg Alsace"));
          if (normalizedScraped.includes("montpellier")) team = teamMap.get(normalizeName("Montpellier HSC"));
          if (normalizedScraped.includes("toulouse")) team = teamMap.get(normalizeName("Toulouse FC"));
          if (normalizedScraped.includes("angers")) team = teamMap.get(normalizeName("Angers"));
          if (normalizedScraped.includes("auxerre")) team = teamMap.get(normalizeName("Auxerre"));
      }

      // Fuzzy Match Loop
      if (!team) {
          for (const [key, t] of Array.from(teamMap.entries())) {
              if (key.includes(normalizedScraped) || normalizedScraped.includes(key)) {
                  team = t;
                  break;
              }
          }
      }

      if (!team) {
        console.log(`Team not found for: ${teamName} (normalized: ${normalizedScraped})`);
        continue;
      }

      // Upsert coach
      const existing = await db.query.coaches.findFirst({
        where: and(eq(coaches.teamId, team.id), eq(coaches.name, coachName))
      });

      if (!existing) {
        await db.insert(coaches).values({
            name: coachName,
            teamId: team.id,
            source: "scraped",
            isOfficial: false,
        });
        count++;
        console.log(`Added coach ${coachName} for ${team.name}`);
      }
    }

  } catch (error) {
    console.error(`Failed to scrape coaches: ${(error as Error).message}`);
  }
}

// Helper for 'and' import
import { and } from "drizzle-orm";
