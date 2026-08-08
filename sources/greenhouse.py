"""Greenhouse exposes a public, unauthenticated JSON API for every company's
job board - this is the same endpoint their careers page fetches in the
browser, so it's not a scrape and carries no ToS risk.
Docs: https://developers.greenhouse.io/job-board.html
"""
import requests
import config
from utils.filters import is_internship

API = "https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true"


def fetch() -> list:
    jobs = []
    for slug in config.COMPANIES.get("greenhouse", []):
        try:
            resp = requests.get(API.format(slug=slug), timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[greenhouse:{slug}] error: {e}")
            continue

        for posting in data.get("jobs", []):
            title = posting.get("title", "")
            if not is_internship(title):
                continue
            location = (posting.get("location") or {}).get("name", "")
            jobs.append({
                "source": "greenhouse",
                "company": slug.replace("-", " ").title(),
                "title": title,
                "location": location,
                "url": posting.get("absolute_url", ""),
                "description": posting.get("content", ""),
                "posted_at": posting.get("updated_at", ""),
            })
    return jobs
