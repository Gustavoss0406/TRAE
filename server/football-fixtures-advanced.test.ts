/**
 * Tests for Fixtures Advanced Endpoints
 * 
 * Validates /fixtures/events, /fixtures/lineups, /fixtures/statistics
 * with edge cases (no data, partial data, etc.)
 */

import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Fixtures Advanced Endpoints", () => {
  describe("/fixtures/events", () => {
    it("returns empty array when fixture parameter is missing", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesEvents();

      expect(result).toHaveProperty("response");
      expect(result.response).toEqual([]);
    });

    it("returns empty array for fixture with no events (edge case)", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesEvents({ fixture: 999999 });

      expect(result).toHaveProperty("response");
      expect(result.response).toEqual([]);
    });

    it("returns API-Football compatible structure", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesEvents({ fixture: 1 });

      expect(result).toHaveProperty("get");
      expect(result).toHaveProperty("parameters");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("paging");
      expect(result).toHaveProperty("response");
      expect(Array.isArray(result.response)).toBe(true);
    });
  });

  describe("/fixtures/lineups", () => {
    it("returns empty array when fixture parameter is missing", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesLineups();

      expect(result).toHaveProperty("response");
      expect(result.response).toEqual([]);
    });

    it("returns empty array for fixture with no lineups (edge case)", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesLineups({ fixture: 999999 });

      expect(result).toHaveProperty("response");
      expect(result.response).toEqual([]);
    });

    it("returns API-Football compatible structure", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesLineups({ fixture: 1 });

      expect(result).toHaveProperty("get");
      expect(result).toHaveProperty("parameters");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("paging");
      expect(result).toHaveProperty("response");
      expect(Array.isArray(result.response)).toBe(true);
    });

    it("supports team filter parameter", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesLineups({ 
        fixture: 1,
        team: 33 
      });

      expect(result).toHaveProperty("response");
      expect(Array.isArray(result.response)).toBe(true);
    });
  });

  describe("/fixtures/statistics", () => {
    it("returns empty array when fixture parameter is missing", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesStatistics();

      expect(result).toHaveProperty("response");
      expect(result.response).toEqual([]);
    });

    it("returns empty array for fixture with no statistics (edge case)", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesStatistics({ fixture: 999999 });

      expect(result).toHaveProperty("response");
      expect(result.response).toEqual([]);
    });

    it("returns API-Football compatible structure", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesStatistics({ fixture: 1 });

      expect(result).toHaveProperty("get");
      expect(result).toHaveProperty("parameters");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("paging");
      expect(result).toHaveProperty("response");
      expect(Array.isArray(result.response)).toBe(true);
    });

    it("supports team filter parameter", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesStatistics({ 
        fixture: 1,
        team: 33 
      });

      expect(result).toHaveProperty("response");
      expect(Array.isArray(result.response)).toBe(true);
    });
  });

  describe("Edge Cases - Schema Validation", () => {
    it("events response matches API-Football schema when data exists", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesEvents({ fixture: 1 });

      if (result.response.length > 0) {
        const event = result.response[0];
        expect(event).toHaveProperty("time");
        expect(event.time).toHaveProperty("elapsed");
        expect(event).toHaveProperty("team");
        expect(event).toHaveProperty("player");
        expect(event).toHaveProperty("type");
        expect(event).toHaveProperty("detail");
      }
    });

    it("lineups response matches API-Football schema when data exists", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesLineups({ fixture: 1 });

      if (result.response.length > 0) {
        const lineup = result.response[0];
        expect(lineup).toHaveProperty("team");
        expect(lineup).toHaveProperty("formation");
        expect(lineup).toHaveProperty("startXI");
        expect(lineup).toHaveProperty("substitutes");
        expect(lineup).toHaveProperty("coach");
      }
    });

    it("statistics response matches API-Football schema when data exists", async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.football.fixturesStatistics({ fixture: 1 });

      if (result.response.length > 0) {
        const stat = result.response[0];
        expect(stat).toHaveProperty("team");
        expect(stat).toHaveProperty("statistics");
        expect(Array.isArray(stat.statistics) || typeof stat.statistics === "object").toBe(true);
      }
    });
  });
});
