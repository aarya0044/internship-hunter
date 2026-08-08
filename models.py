from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


class UserProfile(SQLModel, table=True):
    __tablename__ = "user_profiles"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, index=True)
    resume_text: str = Field(default="")
    roles: str = Field(default="[]")
    skills: str = Field(default="[]")
    locations: str = Field(default="[]")
    priority_companies: str = Field(default="[]")
    exclude_keywords: str = Field(default="[]")
    score_threshold: int = Field(default=70)
    digest_min_score: int = Field(default=40)
    
    # Custom Telegram configurations
    telegram_token: Optional[str] = Field(default=None)
    telegram_chat_id: Optional[str] = Field(default=None)
    
    # Alert crawl subscription settings
    subscription_expires_at: Optional[str] = Field(default=None)
    crawl_interval_hours: int = Field(default=4)


class Job(SQLModel, table=True):
    __tablename__ = "jobs"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    job_hash: str = Field(unique=True, index=True)
    source: str
    company: str
    title: str
    location: Optional[str] = None
    url: str
    description: Optional[str] = None
    posted_at: Optional[str] = None
    score: Optional[int] = Field(default=0, index=True)
    vector_score: Optional[float] = Field(default=0.0)
    summary: Optional[str] = None
    matched_skills: Optional[str] = None  # JSON list string
    draft_message: Optional[str] = None
    resume_tips: Optional[str] = None  # Custom AI advice on resume tailoring
    notified: bool = Field(default=False)
    in_digest: bool = Field(default=False)
    applied: bool = Field(default=False)
    created_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )


# --- Request Validation Schemas ---


class UserRegister(BaseModel):
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(BaseModel):
    roles: List[str]
    skills: List[str]
    locations: List[str]
    priority_companies: List[str]
    exclude_keywords: List[str]
    score_threshold: int
    digest_min_score: int
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    subscription_days: Optional[int] = None
    crawl_interval_hours: Optional[int] = 4


class DraftUpdate(BaseModel):
    draft_message: str
