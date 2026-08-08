"""SQLModel SQLite wrapper. Supports multi-user profiles, security integration, and isolated queries."""
import hashlib
import json
from datetime import datetime, timezone
from typing import Optional, List
from contextlib import contextmanager
from sqlmodel import SQLModel, create_engine, Session, select
import config
from models import Job, User, UserProfile

# Create engine using SQLite connection string
engine = create_engine(f"sqlite:///{config.DATABASE_PATH}", echo=False)


@contextmanager
def get_session():
    """Context manager for database sessions that disables attribute expiration on commit."""
    with Session(engine, expire_on_commit=False) as session:
        yield session


def job_hash(company: str, title: str, url: str) -> str:
    """Dedup key. Uses company+title (normalized) first, falls back to URL,
    so the *same* internship posted on two different sources still collapses
    into one entry."""
    key = f"{company.strip().lower()}|{title.strip().lower()}"
    return hashlib.sha256(key.encode()).hexdigest()


def init_db():
    """Initializes tables using SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


# --- User & Auth Operations ---


def create_user(email: str, hashed_password: str) -> User:
    """Creates a new user and sets up their default profile."""
    with get_session() as session:
        # Create User
        user = User(email=email.strip().lower(), hashed_password=hashed_password)
        session.add(user)
        session.commit()
        session.refresh(user)

        # Create empty associated UserProfile
        profile = UserProfile(user_id=user.id)
        session.add(profile)
        session.commit()

        return user


def get_user_by_email(email: str) -> Optional[User]:
    """Look up a user account by email address."""
    with get_session() as session:
        statement = select(User).where(User.email == email.strip().lower())
        return session.exec(statement).first()


def get_user_profile(user_id: int) -> UserProfile:
    """Retrieves the candidate search profile and resume context for a user."""
    with get_session() as session:
        statement = select(UserProfile).where(UserProfile.user_id == user_id)
        profile = session.exec(statement).first()
        if not profile:
            # Fallback safe creation if somehow missing
            profile = UserProfile(user_id=user_id)
            session.add(profile)
            session.commit()
            session.refresh(profile)
        return profile


def update_user_profile(user_id: int, profile_data: dict) -> UserProfile:
    """Updates candidate preferences filters for a specific user."""
    with get_session() as session:
        statement = select(UserProfile).where(UserProfile.user_id == user_id)
        profile = session.exec(statement).first()
        if not profile:
            profile = UserProfile(user_id=user_id)

        profile.roles = json.dumps(profile_data.get("roles", []))
        profile.skills = json.dumps(profile_data.get("skills", []))
        profile.locations = json.dumps(profile_data.get("locations", []))
        profile.priority_companies = json.dumps(
            profile_data.get("priority_companies", [])
        )
        profile.exclude_keywords = json.dumps(profile_data.get("exclude_keywords", []))
        profile.score_threshold = profile_data.get("score_threshold", 70)
        profile.digest_min_score = profile_data.get("digest_min_score", 40)

        # Map custom credentials & alert subscriptions
        if "telegram_token" in profile_data:
            profile.telegram_token = profile_data["telegram_token"]
        if "telegram_chat_id" in profile_data:
            profile.telegram_chat_id = profile_data["telegram_chat_id"]
        if "subscription_expires_at" in profile_data:
            profile.subscription_expires_at = profile_data["subscription_expires_at"]
        if "crawl_interval_hours" in profile_data:
            profile.crawl_interval_hours = profile_data["crawl_interval_hours"] or 4

        session.add(profile)
        session.commit()
        session.refresh(profile)
        return profile


def update_user_resume(user_id: int, resume_text: str) -> UserProfile:
    """Updates the candidate resume plain text context for a user."""
    with get_session() as session:
        statement = select(UserProfile).where(UserProfile.user_id == user_id)
        profile = session.exec(statement).first()
        if not profile:
            profile = UserProfile(user_id=user_id)

        profile.resume_text = resume_text
        session.add(profile)
        session.commit()
        session.refresh(profile)
        return profile


# --- Job Operations (With User Isolation) ---


def job_exists(h: str, user_id: Optional[int] = None) -> bool:
    """Returns True if the job hash already exists for this user (or globally if user_id is None)."""
    with get_session() as session:
        statement = select(Job).where(Job.job_hash == h)
        if user_id is not None:
            statement = statement.where(Job.user_id == user_id)
        row = session.exec(statement).first()
        return row is not None


def insert_job(job: dict, user_id: Optional[int] = None) -> int:
    """job must have: source, company, title, location, url, description, posted_at
    plus scoring fields: score, summary, matched_skills, draft_message"""
    h = job_hash(job["company"], job["title"], job["url"])

    # Format matched skills into a JSON string if it's a list
    skills = job.get("matched_skills", [])
    skills_json = json.dumps(skills) if isinstance(skills, list) else str(skills)

    db_job = Job(
        user_id=user_id,
        job_hash=h,
        source=job["source"],
        company=job["company"],
        title=job["title"],
        location=job.get("location", ""),
        url=job["url"],
        description=job.get("description", "")[:5000],
        posted_at=job.get("posted_at", ""),
        score=job.get("score", 0),
        vector_score=job.get("vector_score", 0.0),
        summary=job.get("summary", ""),
        matched_skills=skills_json,
        draft_message=job.get("draft_message", ""),
        resume_tips=job.get("resume_tips", ""),
    )
    with get_session() as session:
        session.add(db_job)
        session.commit()
        session.refresh(db_job)
        return db_job.id


def mark_notified(job_id: int):
    """Marks a job as notified so it isn't messaged again."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job:
            job.notified = True
            session.add(job)
            session.commit()


def mark_in_digest(job_id: int):
    """Marks a job as in_digest to exclude it from future daily digests."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job:
            job.in_digest = True
            session.add(job)
            session.commit()


def mark_applied(job_id: int):
    """Marks a job as applied in the DB."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job:
            job.applied = True
            session.add(job)
            session.commit()


def get_jobs_for_digest(user_id: Optional[int] = None):
    """Jobs scored between digest_min_score and score_threshold that
    haven't been included in a digest yet, filtered by user."""
    with get_session() as session:
        statement = (
            select(Job)
            .where(Job.score >= config.DIGEST_MIN_SCORE)
            .where(Job.score < config.SCORE_THRESHOLD)
            .where(Job.in_digest == False)
        )
        if user_id is not None:
            statement = statement.where(Job.user_id == user_id)

        statement = statement.order_by(Job.score.desc())
        results = session.exec(statement).all()
        return [job.model_dump() for job in results]


def get_all_jobs(applied_only=False, user_id: Optional[int] = None):
    """Returns all jobs from the database, newest first, filtered by user."""
    with get_session() as session:
        statement = select(Job)
        if applied_only:
            statement = statement.where(Job.applied == True)
        if user_id is not None:
            statement = statement.where(Job.user_id == user_id)

        statement = statement.order_by(Job.created_at.desc())
        results = session.exec(statement).all()
        return [job.model_dump() for job in results]
