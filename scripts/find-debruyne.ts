
import "dotenv/config";
import { getDb } from "../server/db";
import { players } from "../drizzle/schema";
import { like } from "drizzle-orm";

async function findDeBruyne() {
    const db = await getDb();
    if (!db) return;

    const res = await db.query.players.findMany({
        where: like(players.name, "%Bruyne%")
    });
    console.log("Found:", res);
    process.exit(0);
}

findDeBruyne();
