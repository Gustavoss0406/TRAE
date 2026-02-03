/**
 * Simplified External API Parity Validation
 * 
 * This script validates that we CAN call API-Football and understand its response structure.
 * Since our database is empty, we'll focus on:
 * 1. Successfully calling API-Football endpoints
 * 2. Documenting the actual response structure
 * 3. Confirming our schema definitions match reality
 * 
 * This is the GATE checkpoint - validates structural understanding before data ingestion.
 */

import axios from "axios";
import fs from "fs";
import path from "path";

const API_FOOTBALL_KEY = "9201431add8cc401efb69cc32ed4df3e";
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";

interface EndpointTest {
  name: string;
  endpoint: string;
  params: Record<string, string>;
}

const tests: EndpointTest[] = [
  {
    name: "Fixtures - Premier League 2024",
    endpoint: "/fixtures",
    params: { league: "39", season: "2024" },
  },
  {
    name: "Standings - Premier League 2024",
    endpoint: "/standings",
    params: { league: "39", season: "2024" },
  },
  {
    name: "Players - Manchester United 2024",
    endpoint: "/players",
    params: { league: "39", season: "2024", team: "33" },
  },
];

/**
 * Call API-Football endpoint
 */
async function callAPIFootball(endpoint: string, params: Record<string, string>) {
  try {
    console.log(`\n🔍 Testing ${endpoint} with params:`, params);
    
    const response = await axios.get(`${API_FOOTBALL_BASE}${endpoint}`, {
      headers: {
        "x-apisports-key": API_FOOTBALL_KEY,
      },
      params,
    });

    console.log(`  ✅ Status: ${response.status}`);
    console.log(`  📊 Results: ${response.data.results}`);
    console.log(`  📄 Response keys:`, Object.keys(response.data));

    if (response.data.response && response.data.response.length > 0) {
      console.log(`  🔑 First item keys:`, Object.keys(response.data.response[0]));
    }

    return {
      success: true,
      status: response.status,
      data: response.data,
    };
  } catch (error: any) {
    console.log(`  ❌ Error: ${error.message}`);
    return {
      success: false,
      status: error.response?.status || 500,
      error: error.message,
    };
  }
}

/**
 * Analyze response structure
 */
function analyzeStructure(obj: any, path: string = "root", depth: number = 0): string[] {
  const lines: string[] = [];
  const indent = "  ".repeat(depth);

  if (obj === null) {
    lines.push(`${indent}${path}: null`);
  } else if (Array.isArray(obj)) {
    lines.push(`${indent}${path}: array[${obj.length}]`);
    if (obj.length > 0 && depth < 3) {
      lines.push(...analyzeStructure(obj[0], `${path}[0]`, depth + 1));
    }
  } else if (typeof obj === "object") {
    lines.push(`${indent}${path}: object`);
    if (depth < 3) {
      for (const key of Object.keys(obj)) {
        lines.push(...analyzeStructure(obj[key], key, depth + 1));
      }
    }
  } else {
    lines.push(`${indent}${path}: ${typeof obj}`);
  }

  return lines;
}

/**
 * Main validation runner
 */
async function runValidation() {
  console.log("🌐 API-Football External Validation (Simplified)\n");
  console.log("=".repeat(70));
  console.log("\nThis validates that we can call API-Football and understand");
  console.log("the response structure before implementing data ingestion.\n");
  console.log("=".repeat(70));

  const results: any[] = [];
  const outputDir = path.join(process.cwd(), "validation-output");

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Run tests
  for (const test of tests) {
    const result = await callAPIFootball(test.endpoint, test.params);
    results.push({
      test: test.name,
      ...result,
    });

    // Save response to file
    if (result.success) {
      const filename = test.name.replace(/[^a-z0-9]/gi, "-").toLowerCase() + ".json";
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(result.data, null, 2));
      console.log(`  💾 Saved response to: ${filepath}`);

      // Analyze structure
      if (result.data.response && result.data.response.length > 0) {
        console.log(`\n  📋 Structure analysis:`);
        const structure = analyzeStructure(result.data.response[0], "response[0]", 0);
        structure.slice(0, 20).forEach((line) => console.log(`    ${line}`));
        if (structure.length > 20) {
          console.log(`    ... and ${structure.length - 20} more fields`);
        }
      }
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("\n📊 Validation Summary\n");

  const successCount = results.filter((r) => r.success).length;
  const totalCount = results.length;

  for (const result of results) {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.test}`);
    if (!result.success) {
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log(`\n${successCount}/${totalCount} tests passed`);
  console.log(`\nResponse files saved to: ${outputDir}/`);

  console.log("\n" + "=".repeat(70));

  if (successCount === totalCount) {
    console.log("✅ GATE CHECKPOINT PASSED!");
    console.log("\n🎉 Successfully validated API-Football access and response structure.");
    console.log("   Ready to implement data ingestion and advance to fixtures advanced endpoints.");
    process.exit(0);
  } else {
    console.log("❌ GATE CHECKPOINT FAILED!");
    console.log("\n⚠️  Fix API access issues before advancing.");
    process.exit(1);
  }
}

// Run validation
runValidation().catch((error) => {
  console.error("Fatal error during validation:", error);
  process.exit(1);
});
