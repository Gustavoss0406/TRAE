# Data Sources & Architecture

## Overview
This system provides a complete Football Data API compatible with standard schemas (API-Football), but operates independently using a hybrid approach of official data and internal generation.

## 1. Data Strategy (Hybrid Model)

### Historical Data (2024-2025)
- **Source**: Football-Data.org (Free Tier) & Other Open Sources.
- **Coverage**: Standings, Team Stats, Player Rosters, Historical Results.
- **Purpose**: Provides the statistical baseline for odds calculation and predictions.

### Future Data (2026 Season)
- **Source**: Internal Deterministic Generation (CAMINHO 3).
- **Reasoning**: No free API provides comprehensive 2026 fixtures yet.
- **Mechanism**:
  - **Round-Robin Algorithm**: Generates fair, balanced fixtures (Home/Away) for all teams.
  - **Schedule**: Realistic weekly scheduling (Weekends).
  - **Transparency**: All generated fixtures are marked with `source: "generated"` and `isOfficial: false`.

## 2. Supported Leagues (13 Core Leagues)
The system fully supports the following leagues for 2026:
- **WC** (World Cup)
- **CL** (Champions League)
- **BL1** (Bundesliga)
- **DED** (Eredivisie)
- **BSA** (Brasileirão Série A)
- **PD** (La Liga)
- **FL1** (Ligue 1)
- **ELC** (Championship)
- **PPL** (Primeira Liga)
- **EC** (Euros)
- **SA** (Serie A)
- **PL** (Premier League)
- **FCWC** (FIFA Club World Cup)

## 3. Endpoints & Logic

### `/odds`
- **Method**: On-demand Calculation.
- **Model**: Poisson Regression.
- **Input**: Historical team performance (Goals Scored/Conceded) from previous seasons (2024/2025).
- **Fallback**: If 2026 stats are empty (start of season), the system automatically falls back to the most recent completed season data to ensure valid odds are always returned.

### `/predictions`
- **Method**: ELO Rating System.
- **Input**: Team strength ratings updated after every match.
- **Logic**: Calculates win probabilities based on ELO difference + Home Advantage.

## 4. Maintenance & Operation
- **Sync Workers**: Located in `server/workers/`. Run periodically to fetch historical data.
- **Fixture Generation**: `scripts/generate-2026-fixtures.ts` (and league-specific fixes like `scripts/fix-pl-2026.ts`).
- **Database**: PostgreSQL with Drizzle ORM.

## 5. Limitations
- **Live Scores**: Not available for generated 2026 fixtures (as they are future).
- **Official Dates**: Dates are algorithmic approximations, not confirmed official kick-off times.
