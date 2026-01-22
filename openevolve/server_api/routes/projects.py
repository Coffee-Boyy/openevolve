"""
Project management endpoints
"""

import glob
import logging
import os
from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class Project(BaseModel):
    name: str
    path: str
    has_config: bool
    has_initial_program: bool
    has_evaluator: bool


@router.get("")
async def list_projects(base_dir: str = "examples/") -> List[Project]:
    """List available projects in a directory"""
    try:
        if not os.path.exists(base_dir):
            return []
        
        projects = []
        
        # Look for directories with config.yaml or initial_program files
        for item in os.listdir(base_dir):
            item_path = os.path.join(base_dir, item)
            if not os.path.isdir(item_path):
                continue
            
            # Check for project files
            has_config = os.path.exists(os.path.join(item_path, "config.yaml"))
            
            # Look for initial_program with various extensions
            initial_programs = glob.glob(os.path.join(item_path, "initial_program.*"))
            has_initial_program = len(initial_programs) > 0
            
            # Look for evaluator with various extensions
            evaluators = glob.glob(os.path.join(item_path, "evaluator.*"))
            has_evaluator = len(evaluators) > 0
            
            # If it has at least one of these, consider it a project
            if has_config or has_initial_program or has_evaluator:
                projects.append(Project(
                    name=item,
                    path=item_path,
                    has_config=has_config,
                    has_initial_program=has_initial_program,
                    has_evaluator=has_evaluator,
                ))
        
        return projects
    
    except Exception as e:
        logger.error(f"Failed to list projects: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_name}")
async def get_project(project_name: str, base_dir: str = "examples/"):
    """Get details about a specific project"""
    try:
        project_path = os.path.join(base_dir, project_name)
        
        if not os.path.exists(project_path) or not os.path.isdir(project_path):
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Find config file
        config_path = os.path.join(project_path, "config.yaml")
        
        # Find initial program
        initial_programs = glob.glob(os.path.join(project_path, "initial_program.*"))
        initial_program_path = initial_programs[0] if initial_programs else None
        
        # Find evaluator
        evaluators = glob.glob(os.path.join(project_path, "evaluator.*"))
        evaluator_path = evaluators[0] if evaluators else None
        
        return {
            "name": project_name,
            "path": project_path,
            "config_path": config_path if os.path.exists(config_path) else None,
            "initial_program_path": initial_program_path,
            "evaluator_path": evaluator_path,
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get project: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
