"""
ETL script for ingesting fixtures from football-data.org API.
This is the primary source for live and upcoming fixtures.
"""

import os
import sys
import requests
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from utils.db_connection import get_db_connection
from utils.ingestion_logger import IngestionLogger

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Configuration
FOOTBALL_DATA_API_URL = "https://api.football-data.org/v4"
FOOTBALL_DATA_TOKEN = os.getenv("FOOTBALL_DATA_TOKEN", "73dfe925c415436a8b64e3640727deaa")


class FootballDataOrgFixturesIngester:
    """Ingests fixtures from football-data.org API."""
    
    def __init__(self):
        self.db = get_db_connection()
        self.logger = IngestionLogger(self.db, "football-data.org", "fixtures")
        self.session = requests.Session()
        self.session.headers.update({
            "X-Auth-Token": FOOTBALL_DATA_TOKEN,
            "Accept": "application/json"
        })
    
    def fetch_matches(self, date_from: str, date_to: str) -> Optional[Dict]:
        """Fetch matches from the API for a date range."""
        url = f"{FOOTBALL_DATA_API_URL}/matches"
        params = {
            "dateFrom": date_from,
            "dateTo": date_to
        }
        
        try:
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Error fetching matches: {e}")
            return None
    
    def normalize_match_data(self, match: Dict) -> Dict:
        """Normalize match data from football-data.org to our schema."""
        return {
            "externalId": match.get("id"),
            "date": match.get("utcDate"),
            "timestamp": int(datetime.fromisoformat(match.get("utcDate").replace("Z", "+00:00")).timestamp()),
            "statusLong": match.get("status"),
            "statusShort": self._map_status_short(match.get("status")),
            "statusElapsed": match.get("minute"),
            "homeTeamName": match.get("homeTeam", {}).get("name"),
            "awayTeamName": match.get("awayTeam", {}).get("name"),
            "goalsHome": match.get("score", {}).get("fullTime", {}).get("home"),
            "goalsAway": match.get("score", {}).get("fullTime", {}).get("away"),
            "scoreHalftimeHome": match.get("score", {}).get("halfTime", {}).get("home"),
            "scoreHalftimeAway": match.get("score", {}).get("halfTime", {}).get("away"),
            "leagueName": match.get("competition", {}).get("name"),
            "leagueCode": match.get("competition", {}).get("code"),
            "season": match.get("season", {}).get("startDate", "")[:4] if match.get("season") else None,
            "round": match.get("matchday"),
            "referee": match.get("referees", [{}])[0].get("name") if match.get("referees") else None,
        }
    
    def _map_status_short(self, status_long: str) -> str:
        """Map long status to short status code."""
        status_map = {
            "SCHEDULED": "NS",
            "TIMED": "NS",
            "IN_PLAY": "LIVE",
            "PAUSED": "HT",
            "FINISHED": "FT",
            "POSTPONED": "PST",
            "SUSPENDED": "SUSP",
            "CANCELLED": "CANC"
        }
        return status_map.get(status_long, "TBD")
    
    def get_or_create_league(self, league_name: str, league_code: str) -> Optional[int]:
        """Get existing league ID or create a new league."""
        # First try to find by code
        query = "SELECT id FROM leagues WHERE name = %s LIMIT 1"
        result = self.db.execute_query(query, (league_name,))
        
        if result and len(result) > 0:
            return result[0]["id"]
        
        # Create new league
        insert_query = """
            INSERT INTO leagues (name, type, createdAt, updatedAt)
            VALUES (%s, %s, %s, %s)
        """
        league_id = self.db.execute_insert(
            insert_query,
            (league_name, "League", datetime.now(), datetime.now())
        )
        return league_id
    
    def get_or_create_team(self, team_name: str) -> Optional[int]:
        """Get existing team ID or create a new team."""
        query = "SELECT id FROM teams WHERE name = %s LIMIT 1"
        result = self.db.execute_query(query, (team_name,))
        
        if result and len(result) > 0:
            return result[0]["id"]
        
        # Create new team
        insert_query = """
            INSERT INTO teams (name, national, createdAt, updatedAt)
            VALUES (%s, %s, %s, %s)
        """
        team_id = self.db.execute_insert(
            insert_query,
            (team_name, False, datetime.now(), datetime.now())
        )
        return team_id
    
    def get_or_create_season(self, league_id: int, year: int) -> Optional[int]:
        """Get existing season ID or create a new season."""
        query = "SELECT id FROM seasons WHERE leagueId = %s AND year = %s LIMIT 1"
        result = self.db.execute_query(query, (league_id, year))
        
        if result and len(result) > 0:
            return result[0]["id"]
        
        # Create new season
        insert_query = """
            INSERT INTO seasons (leagueId, year, start, end, current, createdAt, updatedAt)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        season_start = datetime(year, 8, 1)
        season_end = datetime(year + 1, 5, 31)
        is_current = year == datetime.now().year or year == datetime.now().year - 1
        
        season_id = self.db.execute_insert(
            insert_query,
            (league_id, year, season_start, season_end, is_current, datetime.now(), datetime.now())
        )
        return season_id
    
    def upsert_fixture(self, match_data: Dict):
        """Insert or update a fixture in the database."""
        # Get or create related entities
        league_id = self.get_or_create_league(match_data["leagueName"], match_data.get("leagueCode"))
        home_team_id = self.get_or_create_team(match_data["homeTeamName"])
        away_team_id = self.get_or_create_team(match_data["awayTeamName"])
        
        if not league_id or not home_team_id or not away_team_id:
            logger.error(f"Failed to get/create entities for match {match_data['externalId']}")
            return
        
        season_year = int(match_data["season"]) if match_data["season"] else datetime.now().year
        season_id = self.get_or_create_season(league_id, season_year)
        
        if not season_id:
            logger.error(f"Failed to get/create season for match {match_data['externalId']}")
            return
        
        # Check if fixture exists
        check_query = "SELECT id FROM fixtures WHERE externalId = %s LIMIT 1"
        existing = self.db.execute_query(check_query, (match_data["externalId"],))
        
        if existing and len(existing) > 0:
            # Update existing fixture
            update_query = """
                UPDATE fixtures SET
                    date = %s, timestamp = %s, statusLong = %s, statusShort = %s,
                    statusElapsed = %s, goalsHome = %s, goalsAway = %s,
                    scoreHalftimeHome = %s, scoreHalftimeAway = %s,
                    scoreFulltimeHome = %s, scoreFulltimeAway = %s,
                    referee = %s, updatedAt = %s
                WHERE externalId = %s
            """
            self.db.execute_insert(update_query, (
                match_data["date"], match_data["timestamp"], match_data["statusLong"],
                match_data["statusShort"], match_data["statusElapsed"],
                match_data["goalsHome"], match_data["goalsAway"],
                match_data["scoreHalftimeHome"], match_data["scoreHalftimeAway"],
                match_data["goalsHome"], match_data["goalsAway"],
                match_data["referee"], datetime.now(),
                match_data["externalId"]
            ))
        else:
            # Insert new fixture
            insert_query = """
                INSERT INTO fixtures (
                    externalId, date, timestamp, timezone, statusLong, statusShort, statusElapsed,
                    leagueId, seasonId, round, homeTeamId, awayTeamId,
                    goalsHome, goalsAway, scoreHalftimeHome, scoreHalftimeAway,
                    scoreFulltimeHome, scoreFulltimeAway, referee, createdAt, updatedAt
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
            """
            self.db.execute_insert(insert_query, (
                match_data["externalId"], match_data["date"], match_data["timestamp"], "UTC",
                match_data["statusLong"], match_data["statusShort"], match_data["statusElapsed"],
                league_id, season_id, str(match_data["round"]) if match_data["round"] else None,
                home_team_id, away_team_id,
                match_data["goalsHome"], match_data["goalsAway"],
                match_data["scoreHalftimeHome"], match_data["scoreHalftimeAway"],
                match_data["goalsHome"], match_data["goalsAway"],
                match_data["referee"], datetime.now(), datetime.now()
            ))
    
    def ingest(self, days_back: int = 7, days_forward: int = 14):
        """Main ingestion method."""
        self.logger.start()
        
        try:
            # Calculate date range
            today = datetime.now()
            date_from = (today - timedelta(days=days_back)).strftime("%Y-%m-%d")
            date_to = (today + timedelta(days=days_forward)).strftime("%Y-%m-%d")
            
            logger.info(f"Fetching matches from {date_from} to {date_to}")
            
            # Fetch matches
            data = self.fetch_matches(date_from, date_to)
            
            if not data or "matches" not in data:
                logger.error("No matches data received from API")
                self.logger.complete("failure", "No matches data received from API")
                return
            
            matches = data["matches"]
            logger.info(f"Received {len(matches)} matches from API")
            
            # Process each match
            processed = 0
            for match in matches:
                try:
                    normalized_match = self.normalize_match_data(match)
                    self.upsert_fixture(normalized_match)
                    processed += 1
                    
                    if processed % 10 == 0:
                        self.logger.update_progress(processed)
                        logger.info(f"Processed {processed}/{len(matches)} matches")
                except Exception as e:
                    logger.error(f"Error processing match {match.get('id')}: {e}")
            
            self.logger.update_progress(processed)
            self.logger.complete("success")
            logger.info(f"Ingestion complete: {processed} matches processed")
            
        except Exception as e:
            logger.error(f"Ingestion failed: {e}")
            self.logger.complete("failure", str(e))
        finally:
            self.db.close()


if __name__ == "__main__":
    ingester = FootballDataOrgFixturesIngester()
    ingester.ingest()
