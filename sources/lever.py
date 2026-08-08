"""Lever's public postings API. No auth required.
Docs: https://github.com/lever/postings-api
"""
import requests
import config
from utils.filters import is_internship

API = "https://api.lever.co/v0/postings/{slug}?mode=json"


def fetch() -> list:
    jobs = []
    for slug in config.COMPANIES.get("lever", []):
        try:
            resp = requests.get(API.format(slug=slug), timeout=15)
            resp.raise_for_status()
            postings = resp.json()
        except Exception as e:
            print(f"[lever:{slug}] error: {e}")
            continue

        for posting in postings:
            title = posting.get("text", "")
            if not is_internship(title):
                continue
            location = (posting.get("categories") or {}).get("location", "")
            jobs.append({
                "source": "lever",
                "company": slug.replace("-", " ").title(),
                "title": title,
                "location": location,
                "url": posting.get("hostedUrl", ""),
                "description": posting.get("descriptionPlain", ""),
                "posted_at": str(posting.get("createdAt", "")),
            })
    return jobs
