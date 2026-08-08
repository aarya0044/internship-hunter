"""Small CLI for application tracking - no dashboard needed.

Usage:
  python track.py list                 # show all stored jobs, newest first
  python track.py list --applied       # show only ones you've marked applied
  python track.py list --top 20        # show top 20 by score
  python track.py apply <job_id>       # mark a job as applied
  python track.py draft <job_id>       # print the saved AI outreach draft
"""
import sys
import io

# Reconfigure stdout/stderr to use UTF-8 on Windows to prevent UnicodeEncodeError crashes
if sys.platform.startswith("win"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import database


def cmd_list(args):
    applied_only = "--applied" in args
    jobs = database.get_all_jobs(applied_only=applied_only)

    if "--top" in args:
        n = int(args[args.index("--top") + 1])
        jobs = sorted(jobs, key=lambda j: j["score"] or 0, reverse=True)[:n]

    for j in jobs:
        applied_flag = "✅" if j["applied"] else "  "
        print(f"{applied_flag} [{j['id']:>4}] {j['score']:>3}/100  "
              f"{j['company']:<25} {j['title']:<45} {j['source']}")


def cmd_apply(args):
    if not args:
        print("Usage: python track.py apply <job_id>")
        return
    job_id = int(args[0])
    database.mark_applied(job_id)
    print(f"Marked job {job_id} as applied.")


def cmd_draft(args):
    if not args:
        print("Usage: python track.py draft <job_id>")
        return
    job_id = int(args[0])
    jobs = database.get_all_jobs()
    job = next((j for j in jobs if j["id"] == job_id), None)
    if not job:
        print("Job not found.")
        return
    print(f"\n{job['company']} - {job['title']}\n")
    print(job["draft_message"] or "(no draft was generated for this job - "
          "only strong matches get a draft)")


COMMANDS = {"list": cmd_list, "apply": cmd_apply, "draft": cmd_draft}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)
    COMMANDS[sys.argv[1]](sys.argv[2:])
