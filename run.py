import os
import subprocess
import sys

port = os.environ.get("PORT", "8080")
subprocess.run([
    sys.executable, "-m", "uvicorn",
    "backend.main:app",
    "--host", "0.0.0.0",
    "--port", port
])
