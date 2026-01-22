"""
Entry point for running OpenEvolve server as a module:
    python -m openevolve.server_api
    python -m openevolve.server_api.server
"""

from openevolve.server_api.server import main

if __name__ == "__main__":
    main()
