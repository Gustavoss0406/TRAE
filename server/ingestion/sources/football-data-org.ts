/**
 * Football-Data.org API Client
 * 
 * Provides typed interface to football-data.org free tier API.
 * Rate limit: 100 requests per day (tier free)
 */

import axios, { AxiosInstance } from "axios";

const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY || "9201431add8cc401efb69cc32ed4df3e";
const FOOTBALL_DATA_BASE_URL = "https://v3.football.api-sports.io";

export class FootballDataOrgClient {
  private client: AxiosInstance;
  private requestCount: number = 0;
  private lastRequestTime: Date | null = null;

  constructor(apiKey: string = FOOTBALL_DATA_API_KEY) {
    this.client = axios.create({
      baseURL: FOOTBALL_DATA_BASE_URL,
      headers: {
        "x-apisports-key": apiKey,
      },
      timeout: 10000, // 10 seconds
    });

    // Add request interceptor for rate limiting
    this.client.interceptors.request.use(async (config) => {
      // Implement rate limiting: max 10 requests per minute
      if (this.lastRequestTime) {
        const timeSinceLastRequest = Date.now() - this.lastRequestTime.getTime();
        if (timeSinceLastRequest < 6000) { // 6 seconds between requests
          await new Promise(resolve => setTimeout(resolve, 6000 - timeSinceLastRequest));
        }
      }
      
      this.lastRequestTime = new Date();
      this.requestCount++;
      
      console.log(`[FootballDataOrg] Request #${this.requestCount}: ${config.method?.toUpperCase()} ${config.url}`);
      
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          console.error(`[FootballDataOrg] Error ${error.response.status}: ${error.response.statusText}`);
          console.error(`[FootballDataOrg] Response:`, error.response.data);
        } else if (error.request) {
          console.error(`[FootballDataOrg] No response received:`, error.message);
        } else {
          console.error(`[FootballDataOrg] Request setup error:`, error.message);
        }
        throw error;
      }
    );
  }

  /**
   * Get fixtures for a specific date range
   */
  async getFixtures(params: {
    league?: number;
    season?: number;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    date?: string; // YYYY-MM-DD
    live?: string; // "all" or league IDs
    status?: string;
  }) {
    const response = await this.client.get("/fixtures", { params });
    return response.data;
  }

  /**
   * Get fixture details by ID
   */
  async getFixtureById(fixtureId: number) {
    const response = await this.client.get("/fixtures", {
      params: { id: fixtureId },
    });
    return response.data;
  }

  /**
   * Get fixture events (goals, cards, substitutions)
   */
  async getFixtureEvents(fixtureId: number) {
    const response = await this.client.get("/fixtures/events", {
      params: { fixture: fixtureId },
    });
    return response.data;
  }

  /**
   * Get fixture lineups
   */
  async getFixtureLineups(fixtureId: number) {
    const response = await this.client.get("/fixtures/lineups", {
      params: { fixture: fixtureId },
    });
    return response.data;
  }

  /**
   * Get fixture statistics
   */
  async getFixtureStatistics(fixtureId: number) {
    const response = await this.client.get("/fixtures/statistics", {
      params: { fixture: fixtureId },
    });
    return response.data;
  }

  /**
   * Get fixture player statistics
   */
  async getFixturePlayerStatistics(fixtureId: number) {
    const response = await this.client.get("/fixtures/players", {
      params: { fixture: fixtureId },
    });
    return response.data;
  }

  /**
   * Get standings for a league and season
   */
  async getStandings(league: number, season: number) {
    const response = await this.client.get("/standings", {
      params: { league, season },
    });
    return response.data;
  }

  /**
   * Get injuries
   */
  async getInjuries(params: {
    fixture?: number;
    league?: number;
    season?: number;
    team?: number;
    player?: number;
    date?: string;
  }) {
    const response = await this.client.get("/injuries", { params });
    return response.data;
  }

  /**
   * Get players for a team and season
   */
  async getPlayers(params: {
    team?: number;
    league?: number;
    season?: number;
    page?: number;
  }) {
    const response = await this.client.get("/players", { params });
    return response.data;
  }

  async getCountries() {
    const response = await this.client.get("/countries");
    return response.data;
  }

  async getTimezones() {
    const response = await this.client.get("/timezone");
    return response.data;
  }

  /**
   * Get coaches for a team
   */
  async getCoaches(params: {
    team?: number;
    id?: number;
    search?: string;
  }) {
    const response = await this.client.get("/coachs", { params });
    return response.data;
  }

  /**
   * Get transfers
   */
  async getTransfers(params: {
    player?: number;
    team?: number;
  }) {
    const response = await this.client.get("/transfers", { params });
    return response.data;
  }

  /**
   * Get trophies
   */
  async getTrophies(params: {
    player?: number;
    coach?: number;
  }) {
    const response = await this.client.get("/trophies", { params });
    return response.data;
  }

  /**
   * Get predictions for a fixture
   */
  async getPredictions(fixture: number) {
    const response = await this.client.get("/predictions", {
      params: { fixture },
    });
    return response.data;
  }

  /**
   * Get odds for a fixture
   */
  async getOdds(params: {
    fixture?: number;
    league?: number;
    season?: number;
    date?: string;
    bookmaker?: number;
    bet?: number;
    page?: number;
  }) {
    const response = await this.client.get("/odds", { params });
    return response.data;
  }

  /**
   * Get player statistics
   */
  async getPlayerStatistics(playerId: number, season: number) {
    const response = await this.client.get("/players", {
      params: { id: playerId, season },
    });
    return response.data;
  }

  /**
   * Get teams for a league and season
   */
  async getTeams(league: number, season: number) {
    const response = await this.client.get("/teams", {
      params: { league, season },
    });
    return response.data;
  }

  /**
   * Get leagues
   */
  async getLeagues(params?: {
    id?: number;
    name?: string;
    country?: string;
    season?: number;
    current?: boolean;
  }) {
    const response = await this.client.get("/leagues", { params });
    return response.data;
  }

  /**
   * Get request count (for monitoring)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request count (for testing)
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }
}

// Export singleton instance
export const footballDataClient = new FootballDataOrgClient();
