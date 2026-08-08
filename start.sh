#!/bin/bash
# Start Celery worker in the background with solo pool to save memory
celery -A celery_worker.celery_app worker --loglevel=info -P solo &

# Start the FastAPI uvicorn server in the foreground
uvicorn server:app --host 0.0.0.0 --port $PORT
