"""WeWorkRemotely publishes official RSS feeds per category - no scraping
involved, this is the same feed format they've offered publicly for years.
"""
import feedparser
from utils.filters import is_internship

FEEDS = [
    "https://weworkremotely.com/categories/remote-programming-jobs.rss",
    "https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss",
]


def fetch() -> list:
    jobs = []
    for feed_url in FEEDS:
        try:
            parsed = feedparser.parse(feed_url)
        except Exception as e:
            print(f"[weworkremotely] error fetching {feed_url}: {e}")
            continue

        for entry in parsed.entries:
            title = entry.get("title", "")
            if not is_internship(title):
                continue
            # WWR titles are usually "Company: Role"
            company = title.split(":")[0].strip() if ":" in title else "Unknown"
            jobs.append({
                "source": "weworkremotely",
                "company": company,
                "title": title,
                "location": "Remote",
                "url": entry.get("link", ""),
                "description": entry.get("summary", ""),
                "posted_at": entry.get("published", ""),
            })
    return jobs
