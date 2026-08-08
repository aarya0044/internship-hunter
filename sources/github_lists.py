"""Parses the Pitt CSC / Simplify community-maintained internship list.
This is a public README on GitHub (fetched via raw.githubusercontent.com,
the same as any git pull) - not a scrape of a site that disallows it, and
it's arguably the single richest, most-current internship source there is:
it's updated multiple times a day and already aggregates hundreds of
companies' career pages for us.

Repo: https://github.com/SimplifyJobs/Summer2026-Internships
If a future summer's repo is renamed, just update RAW_URL below.
"""
import re
import requests
from bs4 import BeautifulSoup

RAW_URL = "https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/README.md"


def fetch() -> list:
    jobs = []
    try:
        resp = requests.get(RAW_URL, timeout=20)
        resp.raise_for_status()
        md = resp.text
    except Exception as e:
        print(f"[github_lists] error: {e}")
        return jobs

    soup = BeautifulSoup(md, "html.parser")
    last_company = None
    last_company_url = ""

    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 4:
            continue  # skip header rows / malformed rows

        company_cell, role_cell, location_cell, apply_cell = cells[0], cells[1], cells[2], cells[3]

        company_text = company_cell.get_text(strip=True)
        if company_text in ("↳", ""):
            company = last_company
        else:
            company = company_text
            last_company = company
            link_tag = company_cell.find("a")
            last_company_url = link_tag["href"] if link_tag else ""

        if not company:
            continue

        title = role_cell.get_text(strip=True)
        location = location_cell.get_text(strip=True)

        apply_link_tag = apply_cell.find("a")
        url = apply_link_tag["href"] if apply_link_tag else last_company_url
        # Strip Simplify tracking params so we store a clean apply URL
        url = re.sub(r"\?utm_source=.*$", "", url)

        if not title or not url:
            continue

        jobs.append({
            "source": "github_simplify_list",
            "company": company,
            "title": title,
            "location": location,
            "url": url,
            "description": f"{title} at {company} ({location}) - via Pitt CSC/Simplify internship list.",
            "posted_at": "",
        })
    return jobs
