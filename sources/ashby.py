"""Ashby's public job-board posting API. No auth required.
Docs: https://developers.ashbyhq.com/reference/jobpostingapi
"""
import requests
import config
from utils.filters import is_internship

API = "https://api.ashbyhq.com/posting-api/job-board/{slug}"


def fetch() -> list:
    jobs = []
    for slug in config.COMPANIES.get("ashby", []):
        try:
            resp = requests.get(API.format(slug=slug), timeout=15)
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[ashby:{slug}] error: {e}")
            continue

        for posting in data.get("jobs", []):
            title = posting.get("title", "")
            if not is_internship(title):
                continue
            jobs.append({
                "source": "ashby",
                "company": slug.replace("-", " ").title(),
                "title": title,
                "location": posting.get("location", ""),
                "url": posting.get("jobUrl", ""),
                "description": posting.get("descriptionPlain", "") or posting.get("descriptionHtml", ""),
                "posted_at": posting.get("publishedAt", ""),
            })
    return jobs
