/**
 * External API Parity Validation Script
 * 
 * Compares real payloads from our API implementation with API-Football official API.
 * This is the GATE checkpoint - must pass before advancing to fixtures advanced endpoints.
 * 
 * Validates:
 * - Structural parity (fields, types, nesting)
 * - Behavioral parity (filters, pagination, edge cases)
 * - Response consistency
 * 
 * Does NOT validate:
 * - Exact data values (our data sources differ)
 * - Response times
 * - Rate limiting
 */

import axios from "axios";

const API_FOOTBALL_KEY = "9201431add8cc401efb69cc32ed4df3e";
const API_FOOTBALL_BASE = "https://v3.football.api-sports.io";
const OUR_API_BASE = "http://localhost:3000/api/trpc";

interface ValidationResult {
  endpoint: string;
  query: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: {
    apiFootballStatus: number;
    ourApiStatus: number;
    apiFootballResults: number;
    ourApiResults: number;
    structuralMatch: boolean;
  };
}

/**
 * Compare two objects structurally (keys and types, not values)
 */
function compareStructure(
  path: string,
  apiFootballData: any,
  ourData: any,
  errors: string[],
  warnings: string[]
): boolean {
  // Handle null/undefined
  if (apiFootballData === null && ourData === null) return true;
  if (apiFootballData === null || ourData === null) {
    if (apiFootballData === null) {
      warnings.push(`${path}: API-Football has null, we have ${typeof ourData}`);
    } else {
      warnings.push(`${path}: We have null, API-Football has ${typeof apiFootballData}`);
    }
    return true; // Nullable fields are acceptable
  }

  // Get types
  const apiFootballType = Array.isArray(apiFootballData) ? "array" : typeof apiFootballData;
  const ourType = Array.isArray(ourData) ? "array" : typeof ourData;

  // Type mismatch
  if (apiFootballType !== ourType) {
    errors.push(
      `${path}: Type mismatch - API-Football: ${apiFootballType}, Ours: ${ourType}`
    );
    return false;
  }

  // Compare objects recursively
  if (apiFootballType === "object") {
    const apiFootballKeys = Object.keys(apiFootballData);
    const ourKeys = Object.keys(ourData);

    // Check for missing keys in our implementation
    for (const key of apiFootballKeys) {
      if (!ourKeys.includes(key)) {
        errors.push(`${path}.${key}: Missing in our implementation`);
      }
    }

    // Check for extra keys in our implementation (warnings only)
    for (const key of ourKeys) {
      if (!apiFootballKeys.includes(key)) {
        warnings.push(`${path}.${key}: Extra field in our implementation`);
      }
    }

    // Recursively compare common keys
    const commonKeys = apiFootballKeys.filter((k) => ourKeys.includes(k));
    let allMatch = true;
    for (const key of commonKeys) {
      const match = compareStructure(
        `${path}.${key}`,
        apiFootballData[key],
        ourData[key],
        errors,
        warnings
      );
      if (!match) allMatch = false;
    }

    return allMatch && errors.length === 0;
  }

  // Compare arrays
  if (apiFootballType === "array") {
    if (apiFootballData.length === 0 && ourData.length === 0) {
      return true;
    }

    if (apiFootballData.length > 0 && ourData.length > 0) {
      // Compare structure of first items
      return compareStructure(
        `${path}[0]`,
        apiFootballData[0],
        ourData[0],
        errors,
        warnings
      );
    }

    if (apiFootballData.length === 0 && ourData.length > 0) {
      warnings.push(`${path}: API-Football has empty array, we have ${ourData.length} items`);
    } else if (apiFootballData.length > 0 && ourData.length === 0) {
      warnings.push(`${path}: We have empty array, API-Football has ${apiFootballData.length} items`);
    }

    return true;
  }

  // Primitive types are fine
  return true;
}

/**
 * Call API-Football endpoint
 */
async function callAPIFootball(endpoint: string, params: Record<string, string>) {
  try {
    const response = await axios.get(`${API_FOOTBALL_BASE}${endpoint}`, {
      headers: {
        "x-apisports-key": API_FOOTBALL_KEY,
      },
      params,
    });
    return {
      status: response.status,
      data: response.data,
    };
  } catch (error: any) {
    return {
      status: error.response?.status || 500,
      data: error.response?.data || { error: error.message },
    };
  }
}

/**
 * Call our API endpoint (tRPC)
 */
async function callOurAPI(procedure: string, input: Record<string, any>) {
  try {
    const response = await axios.get(`${OUR_API_BASE}/football.${procedure}`, {
      params: {
        input: JSON.stringify(input),
      },
    });
    return {
      status: response.status,
      data: response.data.result.data,
    };
  } catch (error: any) {
    return {
      status: error.response?.status || 500,
      data: error.response?.data || { error: error.message },
    };
  }
}

/**
 * Validate fixtures endpoint
 */
async function validateFixtures(): Promise<ValidationResult> {
  const result: ValidationResult = {
    endpoint: "GET /fixtures",
    query: "league=39&season=2024",
    passed: false,
    errors: [],
    warnings: [],
    details: {
      apiFootballStatus: 0,
      ourApiStatus: 0,
      apiFootballResults: 0,
      ourApiResults: 0,
      structuralMatch: false,
    },
  };

  console.log("\n🔍 Validating /fixtures endpoint...");

  // Call API-Football
  const apiFootballResponse = await callAPIFootball("/fixtures", {
    league: "39",
    season: "2024",
  });

  result.details.apiFootballStatus = apiFootballResponse.status;
  result.details.apiFootballResults = apiFootballResponse.data.results || 0;

  console.log(`  API-Football: ${apiFootballResponse.status} - ${result.details.apiFootballResults} results`);

  // Call our API
  const ourResponse = await callOurAPI("getFixtures", {
    league: 39,
    season: 2024,
  });

  result.details.ourApiStatus = ourResponse.status;
  result.details.ourApiResults = ourResponse.data?.results || 0;

  console.log(`  Our API: ${ourResponse.status} - ${result.details.ourApiResults} results`);

  // Check if both succeeded
  if (apiFootballResponse.status !== 200) {
    result.errors.push(`API-Football returned status ${apiFootballResponse.status}`);
    return result;
  }

  if (ourResponse.status !== 200) {
    result.errors.push(`Our API returned status ${ourResponse.status}`);
    return result;
  }

  // Compare structure
  if (apiFootballResponse.data.response && apiFootballResponse.data.response.length > 0) {
    if (ourResponse.data.response && ourResponse.data.response.length > 0) {
      result.details.structuralMatch = compareStructure(
        "response[0]",
        apiFootballResponse.data.response[0],
        ourResponse.data.response[0],
        result.errors,
        result.warnings
      );
    } else {
      result.errors.push("Our API returned empty response while API-Football has data");
    }
  } else {
    result.warnings.push("API-Football returned empty response");
  }

  result.passed = result.errors.length === 0;
  return result;
}

/**
 * Validate standings endpoint
 */
async function validateStandings(): Promise<ValidationResult> {
  const result: ValidationResult = {
    endpoint: "GET /standings",
    query: "league=39&season=2024",
    passed: false,
    errors: [],
    warnings: [],
    details: {
      apiFootballStatus: 0,
      ourApiStatus: 0,
      apiFootballResults: 0,
      ourApiResults: 0,
      structuralMatch: false,
    },
  };

  console.log("\n🔍 Validating /standings endpoint...");

  // Call API-Football
  const apiFootballResponse = await callAPIFootball("/standings", {
    league: "39",
    season: "2024",
  });

  result.details.apiFootballStatus = apiFootballResponse.status;
  result.details.apiFootballResults = apiFootballResponse.data.results || 0;

  console.log(`  API-Football: ${apiFootballResponse.status} - ${result.details.apiFootballResults} results`);

  // Call our API
  const ourResponse = await callOurAPI("getStandings", {
    league: 39,
    season: 2024,
  });

  result.details.ourApiStatus = ourResponse.status;
  result.details.ourApiResults = ourResponse.data?.results || 0;

  console.log(`  Our API: ${ourResponse.status} - ${result.details.ourApiResults} results`);

  // Check if both succeeded
  if (apiFootballResponse.status !== 200) {
    result.errors.push(`API-Football returned status ${apiFootballResponse.status}`);
    return result;
  }

  if (ourResponse.status !== 200) {
    result.errors.push(`Our API returned status ${ourResponse.status}`);
    return result;
  }

  // Compare structure
  if (apiFootballResponse.data.response && apiFootballResponse.data.response.length > 0) {
    if (ourResponse.data.response && ourResponse.data.response.length > 0) {
      result.details.structuralMatch = compareStructure(
        "response[0]",
        apiFootballResponse.data.response[0],
        ourResponse.data.response[0],
        result.errors,
        result.warnings
      );
    } else {
      result.errors.push("Our API returned empty response while API-Football has data");
    }
  } else {
    result.warnings.push("API-Football returned empty response");
  }

  result.passed = result.errors.length === 0;
  return result;
}

/**
 * Validate players endpoint
 */
async function validatePlayers(): Promise<ValidationResult> {
  const result: ValidationResult = {
    endpoint: "GET /players",
    query: "league=39&season=2024&team=33",
    passed: false,
    errors: [],
    warnings: [],
    details: {
      apiFootballStatus: 0,
      ourApiStatus: 0,
      apiFootballResults: 0,
      ourApiResults: 0,
      structuralMatch: false,
    },
  };

  console.log("\n🔍 Validating /players endpoint...");

  // Call API-Football
  const apiFootballResponse = await callAPIFootball("/players", {
    league: "39",
    season: "2024",
    team: "33",
  });

  result.details.apiFootballStatus = apiFootballResponse.status;
  result.details.apiFootballResults = apiFootballResponse.data.results || 0;

  console.log(`  API-Football: ${apiFootballResponse.status} - ${result.details.apiFootballResults} results`);

  // Call our API
  const ourResponse = await callOurAPI("getPlayers", {
    league: 39,
    season: 2024,
    team: 33,
  });

  result.details.ourApiStatus = ourResponse.status;
  result.details.ourApiResults = ourResponse.data?.results || 0;

  console.log(`  Our API: ${ourResponse.status} - ${result.details.ourApiResults} results`);

  // Check if both succeeded
  if (apiFootballResponse.status !== 200) {
    result.errors.push(`API-Football returned status ${apiFootballResponse.status}`);
    return result;
  }

  if (ourResponse.status !== 200) {
    result.errors.push(`Our API returned status ${ourResponse.status}`);
    return result;
  }

  // Compare structure
  if (apiFootballResponse.data.response && apiFootballResponse.data.response.length > 0) {
    if (ourResponse.data.response && ourResponse.data.response.length > 0) {
      result.details.structuralMatch = compareStructure(
        "response[0]",
        apiFootballResponse.data.response[0],
        ourResponse.data.response[0],
        result.errors,
        result.warnings
      );
    } else {
      result.errors.push("Our API returned empty response while API-Football has data");
    }
  } else {
    result.warnings.push("API-Football returned empty response");
  }

  result.passed = result.errors.length === 0;
  return result;
}

/**
 * Main validation runner
 */
async function runExternalValidation() {
  console.log("🌐 API-Football External Parity Validation\n");
  console.log("=".repeat(70));
  console.log("\nThis is the GATE checkpoint - must pass to advance.");
  console.log("Comparing real payloads from both APIs.\n");
  console.log("=".repeat(70));

  const results: ValidationResult[] = [];

  // Run validations
  results.push(await validateFixtures());
  results.push(await validateStandings());
  results.push(await validatePlayers());

  // Print summary
  console.log("\n" + "=".repeat(70));
  console.log("\n📊 Validation Summary\n");

  let allPassed = true;

  for (const result of results) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.endpoint}`);
    console.log(`  Query: ${result.query}`);
    console.log(`  API-Football: ${result.details.apiFootballStatus} (${result.details.apiFootballResults} results)`);
    console.log(`  Our API: ${result.details.ourApiStatus} (${result.details.ourApiResults} results)`);
    console.log(`  Structural Match: ${result.details.structuralMatch ? "✓" : "✗"}`);

    if (result.warnings.length > 0) {
      console.log(`  ⚠️  Warnings (${result.warnings.length}):`);
      result.warnings.slice(0, 5).forEach((w) => console.log(`    - ${w}`));
      if (result.warnings.length > 5) {
        console.log(`    ... and ${result.warnings.length - 5} more`);
      }
    }

    if (!result.passed) {
      allPassed = false;
      console.log(`  ❌ Errors (${result.errors.length}):`);
      result.errors.forEach((e) => console.log(`    - ${e}`));
    }

    console.log();
  }

  console.log("=".repeat(70));

  if (allPassed) {
    console.log("✅ GATE CHECKPOINT PASSED!");
    console.log("\n🎉 External validation successful.");
    console.log("   Ready to advance to fixtures advanced endpoints.");
    process.exit(0);
  } else {
    console.log("❌ GATE CHECKPOINT FAILED!");
    console.log("\n⚠️  Fix divergences before advancing.");
    process.exit(1);
  }
}

// Run validation
runExternalValidation().catch((error) => {
  console.error("Fatal error during validation:", error);
  process.exit(1);
});
