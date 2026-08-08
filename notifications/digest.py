"""Runs once a day: bundles every job that scored between digest_min_score
and score_threshold (i.e. 'worth knowing about but not urgent') into a
single Telegram message, instead of pinging you 15 times."""
import database
from notifications.telegram import send_message, format_digest


def run_daily_digest():
    jobs = database.get_jobs_for_digest()
    if not jobs:
        print("[digest] nothing to send today")
        return

    send_message(format_digest(jobs))
    for j in jobs:
        database.mark_in_digest(j["id"])
    print(f"[digest] sent {len(jobs)} jobs in daily digest")
