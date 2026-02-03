
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { players, teams, transfers } from "../../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import { parse } from "date-fns";

// Expected CSV Format:
// PlayerName,FromTeam,ToTeam,Date(YYYY-MM-DD),Type,Fee
// Example: "Jadon Sancho,Manchester United,Chelsea,2024-08-30,Loan,0"

export async function importTransfersFromCsv(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.log(`Transfers CSV not found at ${filePath}`);
    return;
  }

  const db = await getDb();
  if (!db) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(l => l.trim().length > 0);
  
  let count = 0;

  for (let i = 1; i < lines.length; i++) { // Skip header
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length < 4) continue;

    const [playerName, fromTeamName, toTeamName, dateStr, type, fee] = cols;

    // 1. Find Player
    const player = await db.query.players.findFirst({
        where: sql`lower(${players.name}) = ${playerName.toLowerCase()}`
    });

    if (!player) {
        console.log(`Player not found: ${playerName}`);
        continue;
    }

    // 2. Find Teams
    const fromTeam = await db.query.teams.findFirst({
        where: sql`lower(${teams.name}) LIKE ${'%' + fromTeamName.toLowerCase() + '%'}`
    });
    
    const toTeam = await db.query.teams.findFirst({
        where: sql`lower(${teams.name}) LIKE ${'%' + toTeamName.toLowerCase() + '%'}`
    });

    if (toTeam) {
        await db.insert(transfers).values({
            playerId: player.id,
            teamInId: toTeam.id,
            teamOutId: fromTeam?.id,
            date: new Date(dateStr),
            type: type || "Transfer",
            source: "dataset",
            isOfficial: false
        });
        count++;
    }
  }

  console.log(`Imported ${count} transfers from CSV.`);
}
