
import "dotenv/config";
import { syncLeagues } from "../server/workers/leagues-sync";
import { syncStandings } from "../server/workers/standings-sync";
import { syncPlayers } from "../server/workers/players-sync";
import { syncInjuries } from "../server/workers/injuries-sync";
import { syncCoaches } from "../server/workers/coaches-sync";
import { syncTransfers } from "../server/workers/transfers-sync";
import { syncTrophies } from "../server/workers/trophies-sync";
import { syncPredictions } from "../server/workers/predictions-sync";
import { syncOdds } from "../server/workers/odds-sync";
import { syncFixtures } from "../server/workers/fixtures-sync";

async function populate() {
    console.log("Starting full data population...");

    console.log("1. Syncing Leagues...");
    await syncLeagues();

    console.log("2. Syncing Fixtures (PL and others)...");
    await syncFixtures();

    console.log("3. Syncing Standings (Teams)...");
    await syncStandings();

    console.log("4. Syncing Players...");
    await syncPlayers();

    console.log("5. Syncing Injuries...");
    await syncInjuries();

    console.log("6. Syncing Coaches...");
    await syncCoaches();

    console.log("7. Syncing Transfers...");
    await syncTransfers();

    console.log("8. Syncing Trophies...");
    await syncTrophies();

    console.log("9. Syncing Predictions...");
    await syncPredictions();

    console.log("10. Syncing Odds...");
    await syncOdds();

    console.log("Population complete.");
}

populate().catch(console.error);
