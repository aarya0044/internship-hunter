import os
import sys
from celery import Celery
import config
from main import run_pipeline

import ssl
import re

# Configure secure Redis SSL parameter if using rediss://
redis_url = config.REDIS_URL
print(f"[celery] Normalized REDIS_URL to: {redis_url}")

# Initialize Celery app
celery_app = Celery(
    "tasks",
    broker=redis_url,
    backend=redis_url
)

# Celery Configuration
celery_opts = {
    "task_track_started": True,
    "task_time_limit": 300,  # 5 minutes max
}

if redis_url.startswith("rediss://"):
    celery_opts["broker_use_ssl"] = {"ssl_cert_reqs": "CERT_NONE"}
    celery_opts["redis_backend_use_ssl"] = {"ssl_cert_reqs": "CERT_NONE"}

celery_app.conf.update(**celery_opts)


@celery_app.task(bind=True)
def run_pipeline_task(self, user_id: int, profile_dict: dict, resume_text: str):
    """Celery background worker task to execute the scraper, filter, AI score, and notification alert flow."""
    print(f"[celery] Starting pipeline run for user {user_id} (Task ID: {self.request.id})")
    run_pipeline(user_id=user_id, profile=profile_dict, resume_text=resume_text)
    print(f"[celery] Completed pipeline run for user {user_id}")
    return {"status": "success", "user_id": user_id}
