"""Entrypoint. Runs the pipeline once immediately, then on a schedule:
  - every POLL_INTERVAL_MINUTES: fetch new postings, score them, notify on strong matches
  - once a day at DAILY_DIGEST_HOUR_UTC: send the digest of medium matches
"""
import sys
import io

# Reconfigure stdout/stderr to use UTF-8 on Windows to prevent UnicodeEncodeError crashes
if sys.platform.startswith("win"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

from typing import Optional

from apscheduler.schedulers.blocking import BlockingScheduler

import config
import database
import sources
from ai.scorer import score_job
from ai.draft_generator import generate_draft
from ai.vector_search import match_score
from notifications.telegram import send_message, format_job_alert
from notifications.digest import run_daily_digest


def run_pipeline(user_id: Optional[int] = None, profile: Optional[dict] = None, resume_text: Optional[str] = None):
    print(f"\n=== Running internship pipeline (User: {user_id}) ===")
    raw_jobs = sources.fetch_all()
    print(f"Total raw postings collected: {len(raw_jobs)}")

    new_count, notified_count = 0, 0
    scored_this_run = 0

    active_profile = profile if profile is not None else config.PROFILE
    active_resume = resume_text if resume_text else None
    threshold = active_profile.get("score_threshold", 70) if active_profile else config.SCORE_THRESHOLD

    roles_list = active_profile.get("roles", []) if active_profile else []

    for job in raw_jobs:
        h = database.job_hash(job["company"], job["title"], job["url"])
        if database.job_exists(h, user_id=user_id):
            continue  # duplicate detection - already seen this posting for this user

        # Heuristics Pre-filtering: skip completely irrelevant jobs immediately
        if roles_list:
            title_lower = job["title"].lower()
            matches_role = any(role.lower() in title_lower for role in roles_list)
            is_internship = any(k in title_lower for k in ["intern", "co-op", "placement", "graduate", "junior", "trainee", "entry"])
            
            if not (matches_role or is_internship):
                # Insert directly to DB as score 0 so it's marked "seen" and skipped next time
                job["score"] = 0
                job["summary"] = "Skipped: Pre-filtered (does not match target roles or internship criteria)."
                job["matched_skills"] = "[]"
                job["draft_message"] = ""
                job["resume_tips"] = ""
                database.insert_job(job, user_id=user_id)
                continue

        if scored_this_run >= config.MAX_SCORING_PER_RUN:
            print(f"Reached MAX_SCORING_PER_RUN ({config.MAX_SCORING_PER_RUN}). Skipping remaining new jobs for this run.")
            break

        result = score_job(job, profile=active_profile, resume_text=active_resume)
        scored_this_run += 1
        job["score"] = result["score"]
        job["summary"] = result["summary"]
        job["matched_skills"] = result["matched_skills"]
        job["resume_tips"] = result.get("resume_tips", "")
        
        # Calculate semantic cosine similarity score using Vector Space Model
        desc_text = (job.get("description") or "") + " " + job.get("title", "")
        job["vector_score"] = match_score(active_resume, desc_text)

        draft = ""
        if result["score"] >= threshold:
            draft = generate_draft(job, resume_text=active_resume)  # only draft-generate for strong matches, saves API cost
        job["draft_message"] = draft

        job_id = database.insert_job(job, user_id=user_id)
        new_count += 1

        if result["score"] >= threshold:
            msg = format_job_alert(
                job, result["score"], result["summary"], result["reason"],
                result["matched_skills"], draft,
            )
            
            # Fetch custom Telegram credentials for this specific user
            custom_token, custom_chat_id = None, None
            if user_id is not None:
                user_prof = database.get_user_profile(user_id)
                custom_token = user_prof.telegram_token
                custom_chat_id = user_prof.telegram_chat_id
                
            send_message(msg, custom_token=custom_token, custom_chat_id=custom_chat_id)
            database.mark_notified(job_id)
            notified_count += 1

    print(f"New postings stored: {new_count} | Instant alerts sent: {notified_count}")
    print("=== Pipeline run complete ===\n")


def main():
    config.validate()
    database.init_db()

    if "--once" in sys.argv:
        run_pipeline()
        return

    if "--digest-now" in sys.argv:
        run_daily_digest()
        return

    # Run once immediately on startup, then hand off to the scheduler
    run_pipeline()

    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(run_pipeline, "interval", minutes=config.POLL_INTERVAL_MINUTES,
                       id="poll_sources", max_instances=1)
    scheduler.add_job(run_daily_digest, "cron", hour=config.DAILY_DIGEST_HOUR_UTC,
                       id="daily_digest", max_instances=1)

    print(f"Scheduler started. Polling every {config.POLL_INTERVAL_MINUTES} min, "
          f"digest daily at {config.DAILY_DIGEST_HOUR_UTC}:00 UTC. Ctrl+C to stop.")
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("Shutting down.")


if __name__ == "__main__":
    main()
