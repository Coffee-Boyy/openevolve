"""
Configuration management endpoints
"""

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openevolve.config import Config, load_config

logger = logging.getLogger(__name__)

router = APIRouter()

# Store current configuration
current_config: Optional[Config] = None

# Path to persistent config file
def get_user_config_path() -> Path:
    """Get path to user's persistent config file"""
    config_dir = Path.home() / ".openevolve"
    config_dir.mkdir(exist_ok=True)
    return config_dir / "ui_config.yaml"


class ConfigUpdate(BaseModel):
    config: Dict[str, Any]


def load_persistent_config() -> Optional[Config]:
    """Load configuration from persistent storage"""
    config_path = get_user_config_path()
    if config_path.exists():
        try:
            logger.info(f"Loading persistent config from {config_path}")
            return load_config(str(config_path))
        except Exception as e:
            logger.error(f"Failed to load persistent config: {e}")
            return None
    return None


@router.get("")
async def get_config():
    """Get current configuration"""
    global current_config
    
    if current_config is None:
        # Try to load from persistent storage first
        current_config = load_persistent_config()
        
        if current_config is None:
            logger.info("No persistent config found, using defaults")
            current_config = Config()
    
    return current_config.to_dict()


@router.put("")
async def update_config(update: ConfigUpdate):
    """Update configuration"""
    global current_config
    
    try:
        # Merge with existing config
        if current_config is None:
            current_config = load_persistent_config() or Config()
        
        # Update configuration
        config_dict = current_config.to_dict()
        config_dict.update(update.config)
        
        # Validate by creating a new Config object
        current_config = Config.from_dict(config_dict)
        
        # Save to persistent storage
        config_path = get_user_config_path()
        try:
            current_config.to_yaml(config_path)
            logger.info(f"Saved config to {config_path}")
        except Exception as save_error:
            logger.error(f"Failed to save config to persistent storage: {save_error}")
            # Don't fail the request if saving fails
        
        return {"status": "success", "config": current_config.to_dict()}
    
    except Exception as e:
        logger.error(f"Failed to update config: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load")
async def load_config_file(path: str):
    """Load configuration from a file"""
    global current_config
    
    try:
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Configuration file not found")
        
        current_config = load_config(path)
        
        return {"status": "success", "config": current_config.to_dict()}
    
    except Exception as e:
        logger.error(f"Failed to load config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save")
async def save_config_file(path: str):
    """Save current configuration to a file"""
    global current_config
    
    try:
        if current_config is None:
            raise HTTPException(status_code=400, detail="No configuration to save")
        
        current_config.to_yaml(path)
        
        return {"status": "success", "path": path}
    
    except Exception as e:
        logger.error(f"Failed to save config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/validate")
async def validate_config(config_dict: Dict[str, Any]):
    """Validate a configuration"""
    try:
        # Try to create a Config object
        Config.from_dict(config_dict)
        return {"status": "valid"}
    
    except Exception as e:
        return {"status": "invalid", "error": str(e)}
