
import "dotenv/config";
import { syncTimezones } from "../server/workers/timezones-sync";

syncTimezones().then(() => console.log("Done"));
