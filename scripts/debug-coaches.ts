
import axios from "axios";
import * as cheerio from "cheerio";

async function debugCoaches() {
  const url = "https://en.wikipedia.org/wiki/2024%E2%80%9325_Premier_League";
  console.log(`Fetching ${url}...`);
  
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const $ = cheerio.load(data);

    // Find all sortable tables
    const tables = $("table.wikitable.sortable");
    console.log(`Found ${tables.length} sortable tables.`);

    tables.each((i, table) => {
        console.log(`\n--- Table ${i} ---`);
        // Print headers
        const headers = $(table).find("th").map((_, th) => $(th).text().trim()).get();
        console.log("Headers:", headers.join(" | "));

        // Print first 3 rows
        const rows = $(table).find("tr").slice(1, 4); // Skip header row if it's tr
        rows.each((j, row) => {
            const cols = $(row).find("td").map((_, td) => $(td).text().trim()).get();
            console.log(`Row ${j}:`, cols.join(" | "));
        });
    });

  } catch (error) {
    console.error(error);
  }
}

debugCoaches();
