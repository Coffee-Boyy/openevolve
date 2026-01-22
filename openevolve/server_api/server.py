"""
FastAPI server for OpenEvolve Desktop application
"""

import argparse
import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from openevolve.server_api.routes import evolution, config, projects
from openevolve.server_api.websocket import ConnectionManager

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app"""
    logger.info("Starting OpenEvolve API server")
    
    # Load persistent config on startup
    try:
        from openevolve.server_api.routes.config import load_persistent_config
        loaded_config = load_persistent_config()
        if loaded_config:
            from openevolve.server_api.routes import config as config_module
            config_module.current_config = loaded_config
            logger.info("Loaded persistent configuration from user settings")
    except Exception as e:
        logger.warning(f"Failed to load persistent config on startup: {e}")
    
    yield
    logger.info("Shutting down OpenEvolve API server")


app = FastAPI(
    title="OpenEvolve API",
    description="Backend API for OpenEvolve Desktop Application",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# WebSocket connection manager
manager = ConnectionManager()

# Include routers
app.include_router(evolution.router, prefix="/api/evolution", tags=["evolution"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {"status": "ok", "message": "OpenEvolve API is running"}


@app.get("/api/data")
async def get_data(path: Optional[str] = None):
    """Get evolution data (compatible with existing visualizer)"""
    from openevolve.server_api.routes.evolution import get_evolution_data
    return await get_evolution_data(path)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and handle subscription requests
            data = await websocket.receive_text()
            
            try:
                import json
                message = json.loads(data) if isinstance(data, str) and data.startswith("{") else {"command": data}
                
                # Handle subscription commands
                if isinstance(message, dict):
                    if message.get("command") == "subscribe" and message.get("run_id"):
                        run_id = message["run_id"]
                        manager.subscribe_to_run(run_id, websocket)
                        await websocket.send_json({"type": "subscribed", "run_id": run_id})
                    elif message.get("command") == "unsubscribe" and message.get("run_id"):
                        run_id = message["run_id"]
                        manager.unsubscribe_from_run(run_id, websocket)
                        await websocket.send_json({"type": "unsubscribed", "run_id": run_id})
                    else:
                        # Echo back for unknown commands
                        await websocket.send_json({"type": "pong", "data": data})
                else:
                    # Echo back
                    await websocket.send_json({"type": "pong", "data": data})
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


def main():
    """Main entry point for the API server"""
    parser = argparse.ArgumentParser(description="OpenEvolve API Server")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8765, help="Port to bind to")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload")
    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging level",
    )
    args = parser.parse_args()

    # Set up logging
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Run the server
    uvicorn.run(
        "openevolve.server_api.server:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        log_level=args.log_level.lower(),
    )


if __name__ == "__main__":
    main()


# Allow running as module
def run_server():
    """Entry point for running as module"""
    main()
