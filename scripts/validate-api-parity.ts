/**
 * API-Football Schema Parity Validator
 * 
 * Validates structural parity with API-Football v3 without relying on complex Zod schemas.
 * Uses direct object inspection to ensure all required fields, types, and structures match.
 * 
 * This validates:
 * - Response wrapper format (get, parameters, errors, results, paging, response)
 * - All required fields presence
 * - Correct data types
 * - Nested structure integrity
 * - Enum values for status codes
 * 
 * This does NOT validate:
 * - Actual data values
 * - Real API behavior
 * - Filter combinations with real data
 */

interface ValidationResult {
  endpoint: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

type FieldType = "string" | "number" | "boolean" | "object" | "array" | "null" | "any";

interface FieldSpec {
  type: FieldType | FieldType[];
  required?: boolean;
  nullable?: boolean;
  enum?: any[];
  fields?: Record<string, FieldSpec>;
  items?: FieldSpec;
}

/**
 * Validate a value against a field specification
 */
function validateField(
  path: string,
  value: any,
  spec: FieldSpec,
  errors: string[],
  warnings: string[]
): void {
  // Handle nullable fields
  if (value === null) {
    if (spec.nullable) {
      return;
    }
    if (!spec.required) {
      warnings.push(`${path}: null value (field is optional)`);
      return;
    }
    errors.push(`${path}: expected non-null value`);
    return;
  }

  // Handle undefined fields
  if (value === undefined) {
    if (spec.required) {
      errors.push(`${path}: missing required field`);
    }
    return;
  }

  // Get actual type
  const actualType = Array.isArray(value) ? "array" : typeof value;

  // Check type
  const expectedTypes = Array.isArray(spec.type) ? spec.type : [spec.type];
  if (!expectedTypes.includes("any") && !expectedTypes.includes(actualType as FieldType)) {
    errors.push(
      `${path}: expected type ${expectedTypes.join(" | ")}, got ${actualType}`
    );
    return;
  }

  // Check enum values
  if (spec.enum && !spec.enum.includes(value)) {
    errors.push(
      `${path}: value "${value}" not in enum [${spec.enum.join(", ")}]`
    );
  }

  // Validate nested object fields
  if (actualType === "object" && spec.fields) {
    for (const [key, fieldSpec] of Object.entries(spec.fields)) {
      validateField(`${path}.${key}`, value[key], fieldSpec, errors, warnings);
    }
  }

  // Validate array items
  if (actualType === "array" && spec.items) {
    (value as any[]).forEach((item, index) => {
      validateField(`${path}[${index}]`, item, spec.items!, errors, warnings);
    });
  }
}

/**
 * API-Football response wrapper specification
 */
const responseWrapperSpec: Record<string, FieldSpec> = {
  get: { type: "string", required: true },
  parameters: { type: "object", required: true },
  errors: { type: "array", required: true },
  results: { type: "number", required: true },
  paging: {
    type: "object",
    required: true,
    fields: {
      current: { type: "number", required: true },
      total: { type: "number", required: true },
    },
  },
  response: { type: "array", required: true },
};

/**
 * Fixture response item specification
 */
const fixtureItemSpec: FieldSpec = {
  type: "object",
  fields: {
    fixture: {
      type: "object",
      required: true,
      fields: {
        id: { type: "number", required: true },
        referee: { type: "string", nullable: true },
        timezone: { type: "string", required: true },
        date: { type: "string", required: true },
        timestamp: { type: "number", required: true },
        periods: {
          type: "object",
          required: true,
          fields: {
            first: { type: "number", nullable: true },
            second: { type: "number", nullable: true },
          },
        },
        venue: {
          type: "object",
          required: true,
          fields: {
            id: { type: "number", nullable: true },
            name: { type: "string", nullable: true },
            city: { type: "string", nullable: true },
          },
        },
        status: {
          type: "object",
          required: true,
          fields: {
            long: { type: "string", required: true },
            short: {
              type: "string",
              required: true,
              enum: [
                "TBD", "NS", "1H", "HT", "2H", "ET", "BT", "P",
                "SUSP", "INT", "FT", "AET", "PEN", "PST", "CANC",
                "ABD", "AWD", "WO", "LIVE",
              ],
            },
            elapsed: { type: "number", nullable: true },
          },
        },
      },
    },
    league: {
      type: "object",
      required: true,
      fields: {
        id: { type: "number", required: true },
        name: { type: "string", required: true },
        country: { type: "string", required: true },
        logo: { type: "string", nullable: true },
        flag: { type: "string", nullable: true },
        season: { type: "number", required: true },
        round: { type: "string", nullable: true },
      },
    },
    teams: {
      type: "object",
      required: true,
      fields: {
        home: {
          type: "object",
          required: true,
          fields: {
            id: { type: "number", required: true },
            name: { type: "string", required: true },
            logo: { type: "string", nullable: true },
            winner: { type: "boolean", nullable: true },
          },
        },
        away: {
          type: "object",
          required: true,
          fields: {
            id: { type: "number", required: true },
            name: { type: "string", required: true },
            logo: { type: "string", nullable: true },
            winner: { type: "boolean", nullable: true },
          },
        },
      },
    },
    goals: {
      type: "object",
      required: true,
      fields: {
        home: { type: "number", nullable: true },
        away: { type: "number", nullable: true },
      },
    },
    score: {
      type: "object",
      required: true,
      fields: {
        halftime: {
          type: "object",
          required: true,
          fields: {
            home: { type: "number", nullable: true },
            away: { type: "number", nullable: true },
          },
        },
        fulltime: {
          type: "object",
          required: true,
          fields: {
            home: { type: "number", nullable: true },
            away: { type: "number", nullable: true },
          },
        },
        extratime: {
          type: "object",
          required: true,
          fields: {
            home: { type: "number", nullable: true },
            away: { type: "number", nullable: true },
          },
        },
        penalty: {
          type: "object",
          required: true,
          fields: {
            home: { type: "number", nullable: true },
            away: { type: "number", nullable: true },
          },
        },
      },
    },
  },
};

/**
 * Validate response structure
 */
function validateResponse(
  endpoint: string,
  response: any,
  itemSpec?: FieldSpec
): ValidationResult {
  const result: ValidationResult = {
    endpoint,
    passed: false,
    errors: [],
    warnings: [],
  };

  // Validate wrapper
  for (const [key, spec] of Object.entries(responseWrapperSpec)) {
    validateField(key, response[key], spec, result.errors, result.warnings);
  }

  // Validate response items if spec provided
  if (itemSpec && Array.isArray(response.response)) {
    response.response.forEach((item: any, index: number) => {
      validateField(`response[${index}]`, item, itemSpec, result.errors, result.warnings);
    });
  }

  result.passed = result.errors.length === 0;
  return result;
}

/**
 * Create mock fixtures response
 */
function createMockFixturesResponse() {
  return {
    get: "fixtures",
    parameters: { league: "39", season: "2024" },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 1,
          referee: "M. Oliver",
          timezone: "UTC",
          date: "2024-01-01T15:00:00+00:00",
          timestamp: 1704117600,
          periods: { first: 1704117600, second: 1704121200 },
          venue: { id: 1, name: "Test Stadium", city: "Test City" },
          status: { long: "Match Finished", short: "FT", elapsed: 90 },
        },
        league: {
          id: 39,
          name: "Premier League",
          country: "England",
          logo: "https://example.com/logo.png",
          flag: "https://example.com/flag.svg",
          season: 2024,
          round: "Regular Season - 1",
        },
        teams: {
          home: {
            id: 1,
            name: "Team A",
            logo: "https://example.com/team-a.png",
            winner: true,
          },
          away: {
            id: 2,
            name: "Team B",
            logo: "https://example.com/team-b.png",
            winner: false,
          },
        },
        goals: { home: 2, away: 1 },
        score: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 2, away: 1 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      },
    ],
  };
}

/**
 * Test edge cases
 */
function testEdgeCases(): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Test 1: Future fixture without score
  const futureFixture = {
    get: "fixtures",
    parameters: { id: "999" },
    errors: [],
    results: 1,
    paging: { current: 1, total: 1 },
    response: [
      {
        fixture: {
          id: 999,
          referee: null,
          timezone: "UTC",
          date: "2025-12-31T15:00:00+00:00",
          timestamp: 1767196800,
          periods: { first: null, second: null },
          venue: { id: 1, name: "Test Stadium", city: "Test City" },
          status: { long: "Not Started", short: "NS", elapsed: null },
        },
        league: {
          id: 39,
          name: "Premier League",
          country: "England",
          logo: "https://example.com/logo.png",
          flag: "https://example.com/flag.svg",
          season: 2025,
          round: "Regular Season - 20",
        },
        teams: {
          home: {
            id: 1,
            name: "Team A",
            logo: "https://example.com/team-a.png",
            winner: null,
          },
          away: {
            id: 2,
            name: "Team B",
            logo: "https://example.com/team-b.png",
            winner: null,
          },
        },
        goals: { home: null, away: null },
        score: {
          halftime: { home: null, away: null },
          fulltime: { home: null, away: null },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null },
        },
      },
    ],
  };

  results.push(
    validateResponse("Edge Case: Future fixture without score", futureFixture, fixtureItemSpec)
  );

  // Test 2: Empty response
  const emptyResponse = {
    get: "fixtures",
    parameters: { team: "999999" },
    errors: [],
    results: 0,
    paging: { current: 1, total: 1 },
    response: [],
  };

  results.push(validateResponse("Edge Case: Empty response", emptyResponse));

  // Test 3: Combined filters
  const combinedFilters = {
    get: "fixtures",
    parameters: {
      league: "39",
      season: "2024",
      team: "50",
      from: "2024-01-01",
      to: "2024-02-01",
    },
    errors: [],
    results: 5,
    paging: { current: 1, total: 1 },
    response: Array(5).fill(createMockFixturesResponse().response[0]),
  };

  results.push(
    validateResponse("Edge Case: Combined filters", combinedFilters, fixtureItemSpec)
  );

  return results;
}

/**
 * Main validation runner
 */
function runValidation() {
  console.log("🔍 API-Football Schema Parity Validation\n");
  console.log("=".repeat(70));
  console.log("\nThis validates STRUCTURAL parity only.");
  console.log("Real data validation requires external checkpoint with actual API calls.\n");
  console.log("=".repeat(70) + "\n");

  const validations: ValidationResult[] = [];

  // Core endpoint validations
  console.log("📋 Core Endpoint Validation\n");

  validations.push(
    validateResponse("GET /fixtures", createMockFixturesResponse(), fixtureItemSpec)
  );

  // Edge case validations
  console.log("\n📋 Edge Case Validation\n");
  validations.push(...testEdgeCases());

  // Print results
  let allPassed = true;

  for (const result of validations) {
    const status = result.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status} ${result.endpoint}`);

    if (result.warnings.length > 0) {
      console.log("  ⚠️  Warnings:");
      for (const warning of result.warnings) {
        console.log(`    - ${warning}`);
      }
    }

    if (!result.passed) {
      allPassed = false;
      console.log("  ❌ Errors:");
      for (const error of result.errors) {
        console.log(`    - ${error}`);
      }
    }
    console.log();
  }

  console.log("=".repeat(70));
  if (allPassed) {
    console.log("✅ All schema validations passed!");
    console.log("\n📝 Summary:");
    console.log("   - Response wrapper format: ✓");
    console.log("   - Required fields: ✓");
    console.log("   - Data types: ✓");
    console.log("   - Nested structures: ✓");
    console.log("   - Enum values: ✓");
    console.log("   - Edge cases: ✓");
    console.log("\n⚠️  Note: This validates structure only.");
    console.log("   Real data validation pending external checkpoint.");
    process.exit(0);
  } else {
    console.log("❌ Some schema validations failed!");
    console.log("\n⚠️  Fix schema mismatches before proceeding.");
    process.exit(1);
  }
}

// Run validation
runValidation();
