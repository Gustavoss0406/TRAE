
import axios from "axios";
import * as cheerio from "cheerio";

async function debugLigue1() {
  const url = "https://en.wikipedia.org/wiki/2024%E2%80%9325_Ligue_1";
  console.log(`Scraping ${url}...`);

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    const $ = cheerio.load(data);

    let targetTable: cheerio.Cheerio<any> | null = null;
    
    $("table.wikitable.sortable").each((i, table) => {
        const headers = $(table).find("th").text().toLowerCase();
        if (headers.includes("manager") && headers.includes("team")) {
            targetTable = $(table);
            console.log(`Found target table at index ${i}`);
            return false;
        }
    });

    if (!targetTable) {
        console.log("No table found.");
        return;
    }

    const headers = targetTable.find("tr").first().find("th").toArray().map(th => $(th).text().trim());
    console.log("Headers:", headers);

    const rows = targetTable.find("tr").toArray();
    console.log(`Found ${rows.length} rows.`);

    for (let i = 0; i < Math.min(rows.length, 5); i++) {
        const row = rows[i];
        const tds = $(row).find("td");
        const ths = $(row).find("th");
        
        let allCells: any[] = [];
        if (ths.length > 0) {
             allCells.push(ths.eq(0));
             tds.each((j, el) => { allCells.push($(el)); });
        } else {
             tds.each((j, el) => { allCells.push($(el)); });
        }

        const cellTexts = allCells.map(c => $(c).text().trim());
        console.log(`Row ${i}:`, cellTexts);
    }

  } catch (error) {
    console.error(error);
  }
}

debugLigue1();
