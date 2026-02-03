"""
Database connection utility for ETL scripts.
Connects to the MySQL/TiDB database using environment variables.
"""

import os
import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv
from typing import Optional
import logging

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseConnection:
    """Manages database connections for ETL operations."""
    
    def __init__(self):
        self.connection: Optional[mysql.connector.MySQLConnection] = None
        self.cursor: Optional[mysql.connector.cursor.MySQLCursor] = None
        
    def connect(self):
        """Establish connection to the database."""
        try:
            database_url = os.getenv('DATABASE_URL')
            if not database_url:
                raise ValueError("DATABASE_URL environment variable not set")
            
            # Parse DATABASE_URL (format: mysql://user:password@host:port/database)
            # For simplicity, we'll use mysql-connector-python's built-in parsing
            self.connection = mysql.connector.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                port=int(os.getenv('DB_PORT', 3306)),
                user=os.getenv('DB_USER'),
                password=os.getenv('DB_PASSWORD'),
                database=os.getenv('DB_NAME'),
                ssl_disabled=False if os.getenv('DB_SSL', 'true').lower() == 'true' else True
            )
            
            if self.connection.is_connected():
                self.cursor = self.connection.cursor(dictionary=True)
                logger.info("Successfully connected to database")
                return True
                
        except Error as e:
            logger.error(f"Error connecting to database: {e}")
            return False
    
    def execute_query(self, query: str, params: tuple = None):
        """Execute a SELECT query and return results."""
        try:
            if not self.cursor:
                raise Exception("Database not connected")
            
            self.cursor.execute(query, params or ())
            return self.cursor.fetchall()
        except Error as e:
            logger.error(f"Error executing query: {e}")
            return None
    
    def execute_insert(self, query: str, params: tuple = None):
        """Execute an INSERT query and return the last inserted ID."""
        try:
            if not self.cursor or not self.connection:
                raise Exception("Database not connected")
            
            self.cursor.execute(query, params or ())
            self.connection.commit()
            return self.cursor.lastrowid
        except Error as e:
            logger.error(f"Error executing insert: {e}")
            self.connection.rollback()
            return None
    
    def execute_many(self, query: str, data: list):
        """Execute multiple INSERT queries in batch."""
        try:
            if not self.cursor or not self.connection:
                raise Exception("Database not connected")
            
            self.cursor.executemany(query, data)
            self.connection.commit()
            return self.cursor.rowcount
        except Error as e:
            logger.error(f"Error executing batch insert: {e}")
            self.connection.rollback()
            return 0
    
    def close(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.connection and self.connection.is_connected():
            self.connection.close()
            logger.info("Database connection closed")


def get_db_connection() -> DatabaseConnection:
    """Factory function to create and return a database connection."""
    db = DatabaseConnection()
    db.connect()
    return db
