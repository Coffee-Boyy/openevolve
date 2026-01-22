"""
Evolution control endpoints
"""

import asyncio
import logging
import os
import uuid
from typing import Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from openevolve.config import Config, load_config
from openevolve.controller import OpenEvolve
from openevolve.server_api.websocket import manager, WebSocketLogHandler

logger = logging.getLogger(__name__)

router = APIRouter()

# Store active evolution runs
active_runs: Dict[str, Dict] = {}


class StartEvolutionRequest(BaseModel):
    initial_program_path: str
    evaluator_path: str
    config_path: Optional[str] = None
    iterations: Optional[int] = None
    output_dir: Optional[str] = None


class EvolutionStatus(BaseModel):
    status: str
    iteration: int
    total_iterations: int
    best_score: Optional[float] = None
    start_time: Optional[float] = None
    error: Optional[str] = None


@router.post("/start")
async def start_evolution(request: StartEvolutionRequest):
    """Start a new evolution run"""
    try:
        # Validate paths
        if not os.path.exists(request.initial_program_path):
            raise HTTPException(status_code=400, detail="Initial program file not found")
        if not os.path.exists(request.evaluator_path):
            raise HTTPException(status_code=400, detail="Evaluator file not found")

        # Load configuration
        if request.config_path and os.path.exists(request.config_path):
            config = load_config(request.config_path)
        else:
            # Use the current config from the config router if available
            from openevolve.server_api.routes import config as config_module
            if config_module.current_config is not None:
                config = config_module.current_config
                logger.info("Using configuration from UI settings")
            else:
                config = Config()
                logger.info("Using default configuration")
            
            # Ensure API key from environment is applied if not set in config
            if not config.llm.api_key:
                api_key = os.environ.get("OPENAI_API_KEY")
                if api_key:
                    logger.info("Using OPENAI_API_KEY from environment")
                    config.llm.update_model_params({"api_key": api_key})
                else:
                    logger.warning("No API key found in config or environment variables")

        # Override iterations if specified
        if request.iterations:
            config.max_iterations = request.iterations
        
        # For UI runs, save checkpoints more frequently for better visualization
        # Use 10 iterations instead of default 100
        if config.checkpoint_interval > 10:
            logger.info(f"Adjusting checkpoint_interval from {config.checkpoint_interval} to 10 for UI visualization")
            config.checkpoint_interval = 10

        # Create run ID
        run_id = str(uuid.uuid4())

        # Create progress callback for WebSocket broadcasting
        async def progress_callback(event_type: str, data: dict):
            """Callback to broadcast evolution progress via WebSocket"""
            message = {
                "type": event_type,
                "run_id": run_id,
                **data,
            }
            await manager.broadcast_to_run(run_id, message)
            
        # Initialize OpenEvolve
        controller = OpenEvolve(
            initial_program_path=request.initial_program_path,
            evaluation_file=request.evaluator_path,
            config=config,
            output_dir=request.output_dir,
            progress_callback=progress_callback,
        )

        # Store run information
        active_runs[run_id] = {
            "controller": controller,
            "status": "running",
            "iteration": 0,
            "total_iterations": config.max_iterations,
            "best_score": None,
            "start_time": asyncio.get_event_loop().time(),
            "task": None,
            "output_dir": controller.output_dir,  # Store output directory for data retrieval
        }

        # Start evolution in background
        async def run_evolution():
            # Set up WebSocket log handler for this run
            ws_log_handler = WebSocketLogHandler(manager, run_id)
            ws_log_handler.setFormatter(logging.Formatter("%(levelname)s - %(name)s - %(message)s"))
            
            # Add handler to the root logger so all openevolve logs are captured
            root_logger = logging.getLogger("openevolve")
            root_logger.addHandler(ws_log_handler)
            
            try:
                await controller.run(iterations=config.max_iterations)
                active_runs[run_id]["status"] = "completed"
                
                # Broadcast completion
                await manager.broadcast_to_run(run_id, {
                    "type": "evolution_complete",
                    "run_id": run_id,
                })
            except Exception as e:
                logger.error(f"Evolution error: {e}", exc_info=True)
                active_runs[run_id]["status"] = "error"
                active_runs[run_id]["error"] = str(e)
                
                # Broadcast error
                await manager.broadcast_to_run(run_id, {
                    "type": "evolution_error",
                    "run_id": run_id,
                    "error": str(e),
                })
            finally:
                # Remove the log handler when evolution completes
                root_logger.removeHandler(ws_log_handler)

        task = asyncio.create_task(run_evolution())
        active_runs[run_id]["task"] = task

        # Broadcast start event
        await manager.broadcast({
            "type": "evolution_started",
            "run_id": run_id,
        })

        return {"run_id": run_id, "status": "started"}

    except Exception as e:
        logger.error(f"Failed to start evolution: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{run_id}/stop")
async def stop_evolution(run_id: str):
    """Stop a running evolution"""
    if run_id not in active_runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = active_runs[run_id]
    if run["status"] != "running":
        raise HTTPException(status_code=400, detail="Run is not running")

    # Cancel the task
    if run["task"]:
        run["task"].cancel()

    run["status"] = "stopped"

    # Broadcast stop event
    await manager.broadcast_to_run(run_id, {
        "type": "evolution_stopped",
        "run_id": run_id,
    })

    return {"status": "stopped"}


@router.post("/{run_id}/pause")
async def pause_evolution(run_id: str):
    """Pause a running evolution"""
    if run_id not in active_runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = active_runs[run_id]
    if run["status"] != "running":
        raise HTTPException(status_code=400, detail="Run is not running")

    run["status"] = "paused"

    # Broadcast pause event
    await manager.broadcast_to_run(run_id, {
        "type": "evolution_paused",
        "run_id": run_id,
    })

    return {"status": "paused"}


@router.get("/{run_id}/status")
async def get_status(run_id: str) -> EvolutionStatus:
    """Get the status of an evolution run"""
    if run_id not in active_runs:
        raise HTTPException(status_code=404, detail="Run not found")

    run = active_runs[run_id]
    
    # Get best score from controller if available
    best_score = None
    if run["controller"].database.best_program_id:
        best_program = run["controller"].database.get(run["controller"].database.best_program_id)
        if best_program and best_program.metrics:
            best_score = best_program.metrics.get("combined_score")

    return EvolutionStatus(
        status=run["status"],
        iteration=run["controller"].database.last_iteration,
        total_iterations=run["total_iterations"],
        best_score=best_score,
        start_time=run["start_time"],
        error=run.get("error"),
    )


async def get_evolution_data(path: Optional[str] = None):
    """Get evolution data from checkpoint (reuse from visualizer)"""
    import sys
    import importlib.util
    
    # Import visualizer module
    visualizer_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'scripts', 'visualizer.py')
    spec = importlib.util.spec_from_file_location("visualizer", visualizer_path)
    visualizer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(visualizer)
    
    base_folder = path or os.environ.get("EVOLVE_OUTPUT", "examples/")
    checkpoint_dir = visualizer.find_latest_checkpoint(base_folder)
    
    if not checkpoint_dir:
        return {
            "archive": [],
            "nodes": [],
            "edges": [],
            "checkpoint_dir": "",
        }
    
    data = visualizer.load_evolution_data(checkpoint_dir)
    return data


@router.get("/{run_id}/data")
async def get_run_data(run_id: str):
    """Get evolution data for a specific run"""
    if run_id not in active_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = active_runs[run_id]
    controller = run.get("controller")
    output_dir = run.get("output_dir")
    
    # Try to get data from checkpoint files first
    if output_dir:
        checkpoint_data = await get_evolution_data(output_dir)
        if checkpoint_data and checkpoint_data.get("nodes"):
            return checkpoint_data
    
    # If no checkpoint data available yet, generate from live database
    if controller and controller.database:
        try:
            logger.info(f"Generating live data from database for run {run_id}")
            return generate_live_evolution_data(controller)
        except Exception as e:
            logger.error(f"Error generating live data: {e}")
    
    # Return empty data if nothing available
    return {
        "archive": [],
        "nodes": [],
        "edges": [],
        "checkpoint_dir": "",
    }


def generate_live_evolution_data(controller):
    """Generate evolution data from the live database (when checkpoints aren't available yet)"""
    database = controller.database
    
    nodes = []
    edges = []
    archive = []
    
    # Get all programs from database
    for program_id, program in database.programs.items():
        # Create node
        node = {
            "id": program.id,
            "code": program.code,
            "metrics": program.metrics or {},
            "generation": program.generation,
            "parent_id": program.parent_id,
            "island": program.metadata.get("island", 0) if program.metadata else 0,
            "iteration": program.iteration_found,
            "method": program.metadata.get("method", "unknown") if program.metadata else "unknown",
        }
        nodes.append(node)
        
        # Create edge if has parent
        if program.parent_id and program.parent_id in database.programs:
            edges.append({
                "source": program.parent_id,
                "target": program.id,
            })
    
    # Get archive (best programs)
    if database.archive:
        archive = list(database.archive)
    
    return {
        "nodes": nodes,
        "edges": edges,
        "archive": archive,
        "checkpoint_dir": "live",
    }


@router.get("/{run_id}/logs")
async def get_run_logs(run_id: str):
    """Get logs for a specific run from log files"""
    if run_id not in active_runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run = active_runs[run_id]
    output_dir = run.get("output_dir")
    
    if not output_dir:
        return {"logs": []}
    
    # Find log files in the output directory
    log_dir = os.path.join(output_dir, "logs")
    
    if not os.path.exists(log_dir):
        return {"logs": []}
    
    # Get all log files sorted by modification time (newest first)
    log_files = []
    for filename in os.listdir(log_dir):
        if filename.endswith(".log"):
            filepath = os.path.join(log_dir, filename)
            log_files.append((filepath, os.path.getmtime(filepath)))
    
    log_files.sort(key=lambda x: x[1], reverse=True)
    
    # Read the most recent log file
    logs = []
    if log_files:
        latest_log_file = log_files[0][0]
        try:
            with open(latest_log_file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        # Parse log line format: timestamp - name - level - message
                        parts = line.split(" - ", 3)
                        if len(parts) >= 4:
                            timestamp_str, source, level, message = parts
                            # Parse timestamp
                            try:
                                from datetime import datetime
                                dt = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S,%f")
                                timestamp = dt.timestamp()
                            except:
                                timestamp = 0
                            
                            logs.append({
                                "timestamp": timestamp,
                                "level": level.lower(),
                                "message": message,
                                "source": source,
                            })
                        else:
                            # Fallback for lines that don't match format
                            logs.append({
                                "timestamp": 0,
                                "level": "info",
                                "message": line,
                                "source": "unknown",
                            })
        except Exception as e:
            logger.error(f"Error reading log file: {e}")
            return {"logs": [], "error": str(e)}
    
    return {"logs": logs}


@router.get("/program/{program_id}")
async def get_program_details(program_id: str, run_id: Optional[str] = None, path: Optional[str] = None):
    """Get detailed information about a specific program"""
    import sys
    import importlib.util
    import json
    
    # Import visualizer module
    visualizer_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '..', 'scripts', 'visualizer.py')
    spec = importlib.util.spec_from_file_location("visualizer", visualizer_path)
    visualizer = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(visualizer)
    
    # If run_id is provided, use that run's output directory
    if run_id and run_id in active_runs:
        base_folder = active_runs[run_id].get("output_dir", "examples/")
    else:
        base_folder = path or os.environ.get("EVOLVE_OUTPUT", "examples/")
    
    checkpoint_dir = visualizer.find_latest_checkpoint(base_folder)
    
    if not checkpoint_dir:
        raise HTTPException(status_code=404, detail="No checkpoint found")
    
    data = visualizer.load_evolution_data(checkpoint_dir)
    
    # Find the program in nodes
    program = None
    for node in data["nodes"]:
        if node["id"] == program_id:
            program = node
            break
    
    if not program:
        raise HTTPException(status_code=404, detail=f"Program {program_id} not found")
    
    return program
