
import "dotenv/config";
import { getDb } from "../server/db";
import { teams, leagues, standings } from "../drizzle/schema";
import { eq, like, or } from "drizzle-orm";

async function listPLTeams() {
  const db = await getDb();
  if (!db) return;

  const teamsList = await db.select().from(teams);
  
  // Filter for potential PL teams (by name pattern or if they are in PL standings)
  // We saw duplicates like "Manchester United" and "Manchester United FC"
  
  const plNames = [
    "Manchester United", "Manchester City", "Liverpool", "Arsenal", "Chelsea", "Tottenham", 
    "Newcastle", "Aston Villa", "Brighton", "West Ham", "Crystal Palace", "Wolves", "Fulham", 
    "Bournemouth", "Brentford", "Everton", "Nottingham", "Leicester", "Ipswich", "Southampton",
    "Luton", "Burnley", "Sheffield"
  ];

  const candidates = teamsList.filter(t => 
    plNames.some(name => t.name.includes(name))
  );

  console.log("Candidate Teams:");
  candidates.forEach(t => console.log(`${t.id}: ${t.name} (${t.code}) [Source: ${t.logo ? 'Has Logo' : 'No Logo'}]`));
}

listPLTeams();
