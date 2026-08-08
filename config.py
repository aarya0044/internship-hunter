"""Loads .env, profile.yaml and companies.yaml into one place."""
import os
import yaml
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _load_yaml(filename):
    path = os.path.join(BASE_DIR, filename)
    with open(path, "r") as f:
        return yaml.safe_load(f)


PROFILE = _load_yaml("profile.yaml")
COMPANIES = _load_yaml("companies.yaml")

# --- LLM Provider Selection ---
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq").lower()

# --- Groq ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# --- OpenAI ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# --- Telegram ---
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")

# --- Resume ---
RESUME_PATH = os.getenv("RESUME_PATH", "./resume.pdf")

# --- Scoring (env overrides profile.yaml if both are set) ---
SCORE_THRESHOLD = int(os.getenv("SCORE_THRESHOLD", PROFILE.get("score_threshold", 70)))
DIGEST_MIN_SCORE = int(PROFILE.get("digest_min_score", 40))
MAX_SCORING_PER_RUN = int(os.getenv("MAX_SCORING_PER_RUN", 15))

# --- Scheduling ---
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", 10))
DAILY_DIGEST_HOUR_UTC = int(os.getenv("DAILY_DIGEST_HOUR_UTC", 14))

# --- Database ---
DATABASE_PATH = os.path.join(BASE_DIR, "internship_hunter.db")

# --- Redis Message Broker ---
REDIS_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")


def validate():
    """Fail loudly and early if required secrets are missing."""
    missing = []
    if LLM_PROVIDER == "groq" and not GROQ_API_KEY:
        missing.append("GROQ_API_KEY")
    elif LLM_PROVIDER == "openai" and not OPENAI_API_KEY:
        missing.append("OPENAI_API_KEY")

    if not TELEGRAM_BOT_TOKEN:
        missing.append("TELEGRAM_BOT_TOKEN")
    if not TELEGRAM_CHAT_ID:
        missing.append("TELEGRAM_CHAT_ID")
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}. "
            f"Copy .env.example to .env and fill them in."
        )
