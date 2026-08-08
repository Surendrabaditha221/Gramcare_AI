"""
MongoDB Database Connection & Fallback Data Store Manager
"""
import os
import logging
from typing import Optional
from dotenv import load_dotenv
import certifi
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()
logger = logging.getLogger("gramcare.database")

mongo_client: Optional[AsyncIOMotorClient] = None
db: Optional[object] = None
is_mongo_connected: bool = False


async def init_db():
    global mongo_client, db, is_mongo_connected

    mongo_uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "gramcare")

    if not mongo_uri:
        logger.warning("MONGO_URI is missing. Falling back to in-memory store.")
        is_mongo_connected = False
        return

    # Mask password for safe logging
    safe_uri = mongo_uri
    if "@" in safe_uri:
        prefix, rest = safe_uri.split("@", 1)
        scheme = prefix.split("://")[0]
        safe_uri = f"{scheme}://***:***@{rest}"
    logger.info(f"Initializing AsyncIOMotorClient with URI: {safe_uri}")

    try:
        # Connect via AsyncIOMotorClient with resilient SSL & timeout settings
        mongo_client = AsyncIOMotorClient(
            mongo_uri,
            serverSelectionTimeoutMS=3000,
            tls=True,
            tlsAllowInvalidCertificates=True,
            tlsCAFile=certifi.where()
        )

        await mongo_client.admin.command("ping")

        db = mongo_client[db_name]
        is_mongo_connected = True

        logger.info(f"MongoDB connected successfully via Motor (database: {db_name})")

    except Exception as e:
        logger.warning(
            f"MongoDB Motor connection failed: {e}. "
            "Falling back to in-memory store."
        )

        is_mongo_connected = False
        mongo_client = None
        db = None


async def close_db():
    global mongo_client

    if mongo_client:
        mongo_client.close()
        logger.info("MongoDB client closed.")