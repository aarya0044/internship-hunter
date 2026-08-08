"""Cheap keyword pre-filter so we don't burn OpenAI calls scoring
obviously-irrelevant postings (e.g. 'VP of Sales' from a company's
general jobs feed)."""

INTERN_WORDS = ("intern", "internship", "co-op", "coop")


def is_internship(title: str) -> bool:
    if not title:
        return False
    t = title.lower()
    return any(w in t for w in INTERN_WORDS)
