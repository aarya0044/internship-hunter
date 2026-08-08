"""RemoteOK publishes its full listing feed as JSON with no auth needed.
Docs: https://remoteok.com/api
The first element of the response is always a legal/meta notice, not a job.
"""
import requests
from utils.filters import is_internship

API = "https://remoteok.com/api"
HEADERS = {"User-Agent": "internship-hunter-bot (personal use, low volume)"}


def fetch() -> list:
    jobs = []
    try:
        resp = requests.get(API, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        print(f"[remoteok] error: {e}")
        return jobs

    for posting in data:
        title = posting.get("position", "")
        if not isinstance(posting, dict) or not title:
            continue
        if not is_internship(title):
            continue
        jobs.append({
            "source": "remoteok",
            "company": posting.get("company", "Unknown"),
            "title": title,
            "location": posting.get("location", "Remote"),
            "url": posting.get("url", ""),
            "description": posting.get("description", ""),
            "posted_at": posting.get("date", ""),
        })
    return jobs
