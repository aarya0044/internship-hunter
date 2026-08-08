"""Loads and caches resume text so it isn't re-read from disk on every job."""
import os
import config

_resume_text_cache = None


def load_resume_text() -> str:
    global _resume_text_cache
    if _resume_text_cache is not None:
        return _resume_text_cache

    path = config.RESUME_PATH
    if not os.path.exists(path):
        print(f"[resume_matcher] WARNING: resume not found at {path}. "
              f"Scoring will run without resume context.")
        _resume_text_cache = ""
        return _resume_text_cache

    if path.lower().endswith(".pdf"):
        import pdfplumber
        text_parts = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                text_parts.append(page.extract_text() or "")
        _resume_text_cache = "\n".join(text_parts)
    else:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            _resume_text_cache = f.read()

    return _resume_text_cache
