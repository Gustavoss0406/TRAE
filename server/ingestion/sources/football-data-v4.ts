
import axios, { AxiosInstance } from "axios";
import "dotenv/config";

const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_ORG_TOKEN;
const BASE_URL = "https://api.football-data.org/v4";

// Mapping from API-Football ID (our DB) to Football-Data.org ID
export const LEAGUE_MAPPING: Record<number, number> = {
    39: 2021, // Premier League
    78: 2002, // Bundesliga
    61: 2015, // Ligue 1
    88: 2003, // Eredivisie
    140: 2014, // Primera Division
    135: 2019, // Serie A (Italy)
    2: 2001,  // UEFA Champions League
    1: 2000,  // World Cup
    4: 2018,  // Euro Championship
    40: 2016, // Championship
    94: 2017, // Primeira Liga
    71: 2013, // Serie A (Brazil)
    // 15: FIFA Club World Cup (Not available in free tier of football-data.org usually)
};

export class FootballDataV4Client {
    private client: AxiosInstance;

    constructor() {
        this.client = axios.create({
            baseURL: BASE_URL,
            headers: {
                "X-Auth-Token": FOOTBALL_DATA_TOKEN
            }
        });

        // Rate limit handling (simple delay)
        this.client.interceptors.request.use(async (config) => {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay just to be safe
            return config;
        });
    }

    async getTeams(leagueId: number, season: number = 2023) {
        const fdId = LEAGUE_MAPPING[leagueId];
        if (!fdId) {
            console.warn(`No Football-Data.org ID for league ${leagueId}`);
            return null;
        }
        try {
            const response = await this.client.get(`/competitions/${fdId}/teams`, {
                params: { season }
            });
            return response.data;
        } catch (error: any) {
            if (error.response && error.response.status === 403) {
                console.warn(`Access denied for league ${fdId} (Season ${season})`);
            } else {
                console.error(`Error fetching teams for league ${fdId}:`, error.message);
            }
            return null;
        }
    }

    async getStandings(leagueId: number, season: number = 2023) {
        const fdId = LEAGUE_MAPPING[leagueId];
        if (!fdId) {
            console.warn(`No Football-Data.org ID for league ${leagueId}`);
            return null;
        }
        try {
            const response = await this.client.get(`/competitions/${fdId}/standings`, {
                params: { season }
            });
            return response.data;
        } catch (error: any) {
            if (error.response && error.response.status === 403) {
                 console.warn(`Access denied for league ${fdId} (Season ${season})`);
            } else {
                 console.error(`Error fetching standings for league ${fdId}:`, error.message);
            }
            return null;
        }
    }
}

export const footballDataV4Client = new FootballDataV4Client();
