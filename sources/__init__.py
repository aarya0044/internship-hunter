"""Each source module exposes a fetch() -> list[dict] function.
Every dict has: source, company, title, location, url, description, posted_at
"""
from . import greenhouse, lever, ashby, remoteok, weworkremotely, github_lists, reddit

ALL_SOURCES = [
    greenhouse,
    lever,
    ashby,
    remoteok,
    weworkremotely,
    github_lists,
    reddit,
]


def fetch_all() -> list:
    """Runs every source, swallows individual source failures so one
    flaky API doesn't take down the whole pipeline, and returns the
    combined raw job list (still un-deduped, un-scored)."""
    jobs = []
    for mod in ALL_SOURCES:
        try:
            found = mod.fetch()
            print(f"[{mod.__name__.split('.')[-1]}] found {len(found)} postings")
            jobs.extend(found)
        except Exception as e:
            print(f"[{mod.__name__.split('.')[-1]}] FAILED: {e}")
    return jobs
