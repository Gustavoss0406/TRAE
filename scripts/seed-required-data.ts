
import "dotenv/config";
import { getDb } from "../server/db";
import { players, teams, leagues, seasons, playerStatistics } from "../drizzle/schema";
import { eq, and, like } from "drizzle-orm";

const REQUIRED_PLAYERS = [
    { name: "J. Timber", team: "Arsenal", position: "Defender" },
    { name: "V. van Dijk", team: "Liverpool", position: "Defender" },
    { name: "B. Chilwell", team: "Chelsea", position: "Defender" },
    { name: "Alisson Becker", team: "Liverpool", position: "Goalkeeper" },
    { name: "Thiago Silva", team: "Chelsea", position: "Defender" },
    { name: "E. Smith Rowe", team: "Arsenal", position: "Midfielder" },
    { name: "J. Gomez", team: "Liverpool", position: "Defender" },
    { name: "N. Madueke", team: "Chelsea", position: "Attacker" },
    { name: "Jadon Sancho", team: "Manchester United", position: "Attacker" }, 
    { name: "Raheem Sterling", team: "Chelsea", position: "Attacker" },
    { name: "Aaron Ramsdale", team: "Arsenal", position: "Goalkeeper" },
    { name: "Eddie Nketiah", team: "Arsenal", position: "Attacker" },
    { name: "Kevin De Bruyne", team: "Manchester City", position: "Midfielder" },
    { name: "Erling Haaland", team: "Manchester City", position: "Attacker" },
    { name: "Mohamed Salah", team: "Liverpool", position: "Attacker" },
    { name: "Bukayo Saka", team: "Arsenal", position: "Attacker" },
    { name: "Cole Palmer", team: "Chelsea", position: "Midfielder" },
    
    // International
    { name: "Vinicius Junior", team: "Real Madrid", position: "Attacker", league: "La Liga" },
    { name: "Gavi", team: "Barcelona", position: "Midfielder", league: "La Liga" },
    { name: "David Alaba", team: "Real Madrid", position: "Defender", league: "La Liga" },
    { name: "Frenkie de Jong", team: "Barcelona", position: "Midfielder", league: "La Liga" },
    { name: "Isco", team: "Betis", position: "Midfielder", league: "La Liga" },
    
    { name: "Harry Kane", team: "Bayern Munich", position: "Attacker", league: "Bundesliga" },
    { name: "Hiroki Ito", team: "Bayern Munich", position: "Defender", league: "Bundesliga" },
    { name: "Xavi Simons", team: "Leipzig", position: "Midfielder", league: "Bundesliga" },
    
    { name: "Paulo Dybala", team: "Roma", position: "Attacker", league: "Serie A" },
    { name: "Giorgio Scalvini", team: "Atalanta", position: "Defender", league: "Serie A" },
    { name: "Lewis Ferguson", team: "Bologna", position: "Midfielder", league: "Serie A" },
    
    { name: "Kylian Mbappe", team: "Paris Saint-Germain", position: "Attacker", league: "Ligue 1" },
    { name: "Goncalo Ramos", team: "Paris Saint-Germain", position: "Attacker", league: "Ligue 1" },
    { name: "Presnel Kimpembe", team: "Paris Saint-Germain", position: "Defender", league: "Ligue 1" }
];

async function seedRequiredData() {
    console.log("Seeding required data...");
    const db = await getDb();
    if (!db) return;

    // Cache League/Season IDs
    const leagueCache = new Map();
    const seasonCache = new Map();

    const getLeagueId = async (name: string) => {
        if (leagueCache.has(name)) return leagueCache.get(name);
        const l = await db.query.leagues.findFirst({ where: eq(leagues.name, name) });
        if (l) leagueCache.set(name, l.id);
        return l?.id;
    };

    const getSeasonId = async (leagueId: number) => {
        if (seasonCache.has(leagueId)) return seasonCache.get(leagueId);
        const s = await db.query.seasons.findFirst({
            where: and(eq(seasons.leagueId, leagueId), eq(seasons.year, 2024))
        });
        if (s) seasonCache.set(leagueId, s.id);
        return s?.id;
    };

    // 2. Process Players
    for (const p of REQUIRED_PLAYERS) {
        const leagueName = p.league || "Premier League";
        const leagueId = await getLeagueId(leagueName);
        
        if (!leagueId) {
            console.warn(`League not found: ${leagueName}`);
            continue;
        }

        const seasonId = await getSeasonId(leagueId);
        if (!seasonId) {
            console.warn(`Season 2024 not found for ${leagueName}`);
            continue;
        }

        // Find Team
        const team = await db.query.teams.findFirst({
            where: like(teams.name, `%${p.team}%`)
        });

        if (!team) {
            console.warn(`Team not found for ${p.team}`);
            continue;
        }

        // Check/Insert Player
        let player = await db.query.players.findFirst({
            where: like(players.name, `%${p.name}%`)
        });

        if (!player) {
            console.log(`Creating player: ${p.name}`);
            const result = await db.insert(players).values({
                name: p.name,
                firstname: p.name.split(" ")[0],
                lastname: p.name.split(" ").slice(1).join(" "),
                age: 25, // Dummy
                nationality: "Unknown",
                height: "180 cm",
                weight: "75 kg",
                photo: "https://placehold.co/100"
            }).returning();
            player = result[0];
        } else {
            console.log(`Player exists: ${p.name}`);
        }

        // Check/Insert Statistics (Link to Team)
        const stats = await db.query.playerStatistics.findFirst({
            where: and(
                eq(playerStatistics.playerId, player.id),
                eq(playerStatistics.seasonId, seasonId),
                eq(playerStatistics.leagueId, leagueId)
            )
        });

        if (!stats) {
            console.log(`Linking ${p.name} to ${team.name} in ${leagueName}`);
            await db.insert(playerStatistics).values({
                playerId: player.id,
                teamId: team.id,
                leagueId: leagueId,
                seasonId: seasonId,
                position: p.position,
                rating: "7.0",
                goalsTotal: 0,
                goalsAssists: 0,
                cardsYellow: 0,
                cardsRed: 0,
                minutes: 0,
                appearences: 0,
                lineups: 0
            });
        }
    }

    console.log("Seeding complete.");
    process.exit(0);
}

seedRequiredData();
