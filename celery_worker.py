import os
import sys
from celery import Celery
import config
from main import run_pipeline

# Initialize Celery app
celery_app = Celery(
    "tasks",
    broker=config.REDIS_URL,
    backend=config.REDIS_URL
)

# Celery Configuration
celery_app.conf.update(
    task_track_started=True,
    task_time_limit=300,  # 5 minutes max
)


@celery_app.task(bind=True)
def run_pipeline_task(self, user_id: int, profile_dict: dict, resume_text: str):
    """Celery background worker task to execute the scraper, filter, AI score, and notification alert flow."""
    print(f"[celery] Starting pipeline run for user {user_id} (Task ID: {self.request.id})")
    run_pipeline(user_id=user_id, profile=profile_dict, resume_text=resume_text)
    print(f"[celery] Completed pipeline run for user {user_id}")
    return {"status": "success", "user_id": user_id}
