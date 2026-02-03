"""
Ingestion logger utility for tracking ETL operations.
Logs all ingestion activities to the data_ingestion_log table.
"""

import logging
from datetime import datetime
from typing import Optional
from .db_connection import DatabaseConnection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class IngestionLogger:
    """Logs ETL ingestion operations to the database."""
    
    def __init__(self, db: DatabaseConnection, source: str, entity_type: str):
        self.db = db
        self.source = source
        self.entity_type = entity_type
        self.log_id: Optional[int] = None
        self.started_at = datetime.now()
        self.records_processed = 0
    
    def start(self):
        """Log the start of an ingestion operation."""
        query = """
            INSERT INTO data_ingestion_log 
            (source, entityType, status, recordsProcessed, startedAt, createdAt)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        params = (
            self.source,
            self.entity_type,
            'success',  # Will be updated on completion
            0,
            self.started_at,
            datetime.now()
        )
        
        self.log_id = self.db.execute_insert(query, params)
        logger.info(f"Started ingestion: {self.source} - {self.entity_type} (log_id: {self.log_id})")
    
    def update_progress(self, records_processed: int):
        """Update the number of records processed."""
        self.records_processed = records_processed
        
        if self.log_id:
            query = """
                UPDATE data_ingestion_log 
                SET recordsProcessed = %s
                WHERE id = %s
            """
            self.db.execute_insert(query, (records_processed, self.log_id))
    
    def complete(self, status: str = 'success', error_message: Optional[str] = None):
        """Mark the ingestion operation as complete."""
        if not self.log_id:
            logger.warning("Cannot complete ingestion: log_id not set")
            return
        
        completed_at = datetime.now()
        duration = (completed_at - self.started_at).total_seconds()
        
        query = """
            UPDATE data_ingestion_log 
            SET status = %s, recordsProcessed = %s, errorMessage = %s, completedAt = %s
            WHERE id = %s
        """
        params = (status, self.records_processed, error_message, completed_at, self.log_id)
        
        self.db.execute_insert(query, params)
        
        logger.info(
            f"Completed ingestion: {self.source} - {self.entity_type} "
            f"(status: {status}, records: {self.records_processed}, duration: {duration:.2f}s)"
        )
