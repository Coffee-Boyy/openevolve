"""
WebSocket connection manager for real-time updates
"""

import asyncio
import json
import logging
from typing import Dict, List, Set, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.run_subscribers: Dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket):
        """Accept a new WebSocket connection"""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        # Remove from all subscriptions
        for run_id, subscribers in self.run_subscribers.items():
            if websocket in subscribers:
                subscribers.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific WebSocket"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending message: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: dict):
        """Broadcast a message to all connected WebSockets"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

    async def broadcast_to_run(self, run_id: str, message: dict):
        """Broadcast a message to all WebSockets subscribed to a specific run"""
        if run_id not in self.run_subscribers:
            return

        disconnected = []
        for connection in self.run_subscribers[run_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to run {run_id}: {e}")
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.run_subscribers[run_id].remove(connection)

    def subscribe_to_run(self, run_id: str, websocket: WebSocket):
        """Subscribe a WebSocket to updates for a specific run"""
        if run_id not in self.run_subscribers:
            self.run_subscribers[run_id] = set()
        self.run_subscribers[run_id].add(websocket)

    def unsubscribe_from_run(self, run_id: str, websocket: WebSocket):
        """Unsubscribe a WebSocket from updates for a specific run"""
        if run_id in self.run_subscribers and websocket in self.run_subscribers[run_id]:
            self.run_subscribers[run_id].remove(websocket)


class WebSocketLogHandler(logging.Handler):
    """Custom logging handler that broadcasts log messages via WebSocket"""
    
    def __init__(self, manager: ConnectionManager, run_id: Optional[str] = None):
        super().__init__()
        self.manager = manager
        self.run_id = run_id
        self.loop = None
        
    def emit(self, record: logging.LogRecord):
        """Emit a log record via WebSocket"""
        try:
            # Get or create event loop
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                # No event loop in current thread
                return
                
            if loop.is_closed():
                return
                
            # Format the log message
            message = {
                "type": "log",
                "level": record.levelname.lower(),
                "message": self.format(record),
                "source": record.name,
                "timestamp": record.created,
            }
            
            if self.run_id:
                message["run_id"] = self.run_id
            
            # Create task to broadcast the message
            if self.run_id:
                asyncio.create_task(self.manager.broadcast_to_run(self.run_id, message))
            else:
                asyncio.create_task(self.manager.broadcast(message))
        except Exception as e:
            # Don't let logging errors break the application
            print(f"Error broadcasting log message: {e}")


# Global connection manager instance
manager = ConnectionManager()
