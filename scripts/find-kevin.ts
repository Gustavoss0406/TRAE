
import "dotenv/config";
import { getDb } from "../server/db";
import { players } from "../drizzle/schema";
import { like } from "drizzle-orm";

async function findKevin() {
    const db = await getDb();
    if (!db) return;

    const res = await db.query.players.findMany({
        where: like(players.name, "%Kevin%")
    });
    console.log("Found Kevin:", res.map(p => p.name));
    process.exit(0);
}

findKevin();
