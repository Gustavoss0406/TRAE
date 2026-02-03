# Football Data Platform

This project is a comprehensive football data API providing fixtures, standings, teams, odds, and predictions. It is designed to operate independently of paid APIs while maintaining compatibility with industry-standard schemas (API-Football).

## 🏗 Architecture & Data Sources

The platform uses a hybrid data strategy to ensure full functionality without recurring costs:

### 1. Historical Data (Official)
- **Source**: `football-data.org` (Free Tier)
- **Content**: Past seasons (2023, 2024), historical results, team details, venues, and players.
- **Sync**: Automated via background workers (`server/workers/`).

### 2. Future Data (Generated)
- **Source**: Internal Generation Engine (`generated`)
- **Content**: Future fixtures for 2026 season.
- **Mechanism**: Deterministic **Round-Robin** algorithm ensures fair home/away distribution for all leagues.
- **Identification**:
  - `fixture.source = "generated"`
  - `fixture.isOfficial = false`
- **Purpose**: Allows the system to simulate future seasons and test prediction models without waiting for official schedule release or paying for premium feeds.

## ⚠️ Data Limitations (Free Tier)

Due to the constraints of free data sources, the following data points are simulated or limited:

- **Injuries**: Not available (Paid endpoint).
- **Transfers**: Not available (Paid endpoint).
- **Coaches**: Limited availability.
- **Odds**: Generated on-the-fly using **Poisson Regression** based on team stats. Real bookmaker odds are not imported.
- **Predictions**: Generated on-the-fly using **ELO Ratings** derived from historical performance.

## 🔮 Odds & Predictions Models

The `/odds` and `/predictions` endpoints are fully functional for both historical and generated fixtures:

- **Odds (Poisson)**: Calculates fair odds by analyzing goals scored/conceded. For 2026 fixtures, it uses historical performance from previous seasons (e.g., 2024/2025) to project probabilities.
- **Predictions (ELO)**: Uses a custom ELO implementation. Ratings are carried over from previous seasons to provide realistic match probabilities for generated 2026 fixtures.

## 🚀 Operation & Monitoring

### Start Server
```bash
npm run dev
```

### Sync Tasks
Data synchronization is handled by scripts in `scripts/`:
- `npm run tsx scripts/sync-fixtures-2024.ts` (Sync historical data)
- `npm run tsx scripts/generate-2026-fixtures.ts` (Generate future data)

### Validation
To verify data integrity:
```bash
npm run tsx scripts/verify-2026.ts
```
