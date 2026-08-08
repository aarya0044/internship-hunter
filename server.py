import os
import yaml
import json
from typing import Optional, List
from fastapi import FastAPI, HTTPException, BackgroundTasks, Query, Depends, Security
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlmodel import Session, select, desc
from apscheduler.schedulers.background import BackgroundScheduler
import config
from database import engine
import database
import models
from models import Job, User, UserProfile, UserRegister, UserLogin, TokenResponse, ProfileUpdate, DraftUpdate
from utils.security import hash_password, verify_password, create_access_token, decode_access_token
from main import run_pipeline
from ai.scorer import _get_client_and_model


app = FastAPI(title="Internship Hunter SaaS API", version="1.0.0")

# Initialize database and tables on startup
database.init_db()

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security_scheme = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> User:
    """Dependency validator that decodes JWT from request headers and returns the active User object."""
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token or token expired")
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token claims")
    user = database.get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- Authentication Routes ---


@app.post("/api/auth/register", response_model=TokenResponse)
def register(payload: UserRegister):
    """Register a new candidate account and auto-create an empty profile."""
    existing = database.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = hash_password(payload.password)
    user = database.create_user(payload.email, hashed)
    
    # Generate token
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: UserLogin):
    """Authenticate credentials and return a signed JWT token."""
    user = database.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    """Retrieve active user account metadata."""
    return {"email": user.email, "id": user.id}


# --- Scored Jobs API (With User Isolation) ---


class ApplyStatusUpdate(BaseModel):
    applied: bool


@app.get("/api/jobs", response_model=List[Job])
def get_jobs(
    applied: Optional[bool] = Query(None, description="Filter by applied status"),
    min_score: Optional[int] = Query(None, description="Filter by minimum match score"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user: User = Depends(get_current_user),
):
    """Retrieve matched job listings isolated for the authenticated user."""
    with Session(engine) as session:
        statement = select(Job).where(Job.user_id == user.id)
        if applied is not None:
            statement = statement.where(Job.applied == applied)
        if min_score is not None:
            statement = statement.where(Job.score >= min_score)

        statement = (
            statement.order_by(desc(Job.created_at)).offset(offset).limit(limit)
        )
        results = session.exec(statement).all()
        return results


@app.get("/api/jobs/{job_id}", response_model=Job)
def get_job(job_id: int, user: User = Depends(get_current_user)):
    """Fetch details of a single job owned by the user."""
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job or job.user_id != user.id:
            raise HTTPException(status_code=404, detail="Job not found")
        return job


@app.post("/api/jobs/{job_id}/apply")
def update_apply_status(job_id: int, payload: ApplyStatusUpdate, user: User = Depends(get_current_user)):
    """Mark a job as applied or toggle status, with user verification."""
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job or job.user_id != user.id:
            raise HTTPException(status_code=404, detail="Job not found")
        job.applied = payload.applied
        session.add(job)
        session.commit()
        return {"status": "success", "applied": job.applied}


@app.post("/api/jobs/{job_id}/draft")
def update_draft(job_id: int, payload: DraftUpdate, user: User = Depends(get_current_user)):
    """Manually update or override outreach draft text, with user verification."""
    with Session(engine) as session:
        job = session.get(Job, job_id)
        if not job or job.user_id != user.id:
            raise HTTPException(status_code=404, detail="Job not found")
        job.draft_message = payload.draft_message
        session.add(job)
        session.commit()
        return {"status": "success", "draft_message": job.draft_message}


# --- User Profile & Resume Management (Database Driven) ---


@app.get("/api/profile")
def get_profile(user: User = Depends(get_current_user)):
    """Read the active candidate profile configuration from DB."""
    profile = database.get_user_profile(user.id)
    try:
        roles = json.loads(profile.roles) if profile.roles else []
        skills = json.loads(profile.skills) if profile.skills else []
        locations = json.loads(profile.locations) if profile.locations else []
        priority_companies = json.loads(profile.priority_companies) if profile.priority_companies else []
        exclude_keywords = json.loads(profile.exclude_keywords) if profile.exclude_keywords else []
    except Exception:
        roles, skills, locations, priority_companies, exclude_keywords = [], [], [], [], []
        
    return {
        "roles": roles,
        "skills": skills,
        "locations": locations,
        "priority_companies": priority_companies,
        "exclude_keywords": exclude_keywords,
        "score_threshold": profile.score_threshold,
        "digest_min_score": profile.digest_min_score,
        "telegram_token": profile.telegram_token,
        "telegram_chat_id": profile.telegram_chat_id,
        "subscription_expires_at": profile.subscription_expires_at,
        "crawl_interval_hours": profile.crawl_interval_hours,
    }


@app.post("/api/profile")
def update_profile(profile: ProfileUpdate, user: User = Depends(get_current_user)):
    """Save/update search boundaries in database."""
    from datetime import timedelta
    profile_dict = profile.model_dump()
    
    # Calculate subscription expiration date if days specified
    if profile.subscription_days is not None:
        if profile.subscription_days > 0:
            expiry = datetime.now(timezone.utc) + timedelta(days=profile.subscription_days)
            profile_dict["subscription_expires_at"] = expiry.isoformat()
        else:
            profile_dict["subscription_expires_at"] = None
            
    database.update_user_profile(user.id, profile_dict)
    return {"status": "success"}


class ResumeUpdate(BaseModel):
    resume_text: str


@app.get("/api/resume")
def get_resume(user: User = Depends(get_current_user)):
    """Retrieve resume plain text content from DB."""
    profile = database.get_user_profile(user.id)
    return {"resume_text": profile.resume_text or ""}


@app.post("/api/resume")
def update_resume(payload: ResumeUpdate, user: User = Depends(get_current_user)):
    """Update resume plain text in DB."""
    database.update_user_resume(user.id, payload.resume_text)
    return {"status": "success"}


# --- Crawling Trigger (Celery Background Tasks) ---

active_tasks = {}  # user_id -> celery_task_id


@app.post("/api/run")
def trigger_run(user: User = Depends(get_current_user)):
    """Starts the scrapers + AI matching asynchronously in a Celery background worker."""
    from celery_worker import run_pipeline_task, celery_app
    from celery.result import AsyncResult
    
    # Check if there is already a running task for this user
    active_task_id = active_tasks.get(user.id)
    if active_task_id:
        res = AsyncResult(active_task_id, app=celery_app)
        if res.state in ("PENDING", "STARTED", "RETRY"):
            return {"status": "ignored", "message": "Pipeline run is already in progress for your account"}
            
    # Retrieve active profile configuration and resume text
    profile_dict = get_profile(user)
    profile = database.get_user_profile(user.id)
    resume_text = profile.resume_text or ""
    
    # Dispatch Celery Task
    task = run_pipeline_task.delay(user.id, profile_dict, resume_text)
    active_tasks[user.id] = task.id
    
    return {"status": "success", "message": "Pipeline run triggered in background", "task_id": task.id}


@app.get("/api/status")
def get_status(user: User = Depends(get_current_user)):
    """Get active pipeline run status for user using Celery AsyncResult."""
    from celery_worker import celery_app
    from celery.result import AsyncResult
    active_task_id = active_tasks.get(user.id)
    print(f"[status] active_task_id for user {user.id}: {active_task_id}")
    if not active_task_id:
        return {"is_crawling": False}
        
    res = AsyncResult(active_task_id, app=celery_app)
    print(f"[status] task state in db for {active_task_id}: {res.state}")
    is_crawling = res.state in ("PENDING", "STARTED", "RETRY")
    return {"is_crawling": is_crawling}


@app.get("/api/insights")
def get_tech_insights(user: User = Depends(get_current_user)):
    """Fetches dynamic tech career news, factoids, or market insights from Groq."""
    try:
        client, model = _get_client_and_model()
        prompt = """Generate exactly 3 interesting, short, and dynamic tech career facts, recent tech news events (e.g., mergers, AI releases), or job hunt tip factoids.
        Format the response as a JSON object with an "insights" key containing a list of objects, where each object has:
        {
          "title": "<short title, e.g., Meta WhatsApp Acquisition>",
          "content": "<short 1-2 sentence description>",
          "category": "<e.g., Market Insight, Career Tip, Tech News>"
        }
        Respond with ONLY the raw JSON object, no markdown formatting, no code fences, no backticks.
        """
        resp = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.7,
        )
        raw = resp.choices[0].message.content
        data = json.loads(raw)
        if isinstance(data, dict) and "insights" in data:
            return data["insights"]
        elif isinstance(data, list):
            return data
        return []
    except Exception as e:
        print(f"[insights] fetch error: {e}")
        # Fallback default insights if API fails
        return [
            {"title": "Meta's WhatsApp Acquisition", "content": "Meta acquired WhatsApp in 2014 for $19 Billion, making it one of the largest tech acquisitions in history.", "category": "Market Insight"},
            {"title": "Resume Formatting Tip", "content": "Keep your resume to exactly one page. AI parsers scan top-down and prioritize structured sections over complex graphics.", "category": "Career Tip"},
            {"title": "The Rise of FastAPI", "content": "FastAPI is now one of the most popular Python web frameworks due to its speed, typing validation, and auto-generated OpenAPI documentation.", "category": "Tech News"}
        ]


# --- Background Subscriptions Scheduler ---

def run_all_subscribed_crawlers():
    """Polls database for users with active subscriptions and dispatches crawl tasks to Celery."""
    from sqlmodel import Session
    from datetime import datetime, timezone
    from celery_worker import run_pipeline_task
    
    print("[scheduler] Scanning active user crawl subscriptions...")
    with Session(engine) as session:
        profiles = session.exec(select(UserProfile)).all()
        
    now = datetime.now(timezone.utc)
    for profile in profiles:
        if not profile.subscription_expires_at:
            continue
            
        try:
            # Parse ISO datetime
            expiry = datetime.fromisoformat(profile.subscription_expires_at.replace("Z", "+00:00"))
            if expiry < now:
                print(f"[scheduler] Subscription expired for user {profile.user_id}")
                continue
        except Exception as e:
            print(f"[scheduler] Error parsing subscription expiry for user {profile.user_id}: {e}")
            continue
            
        # Compile profile settings
        try:
            profile_dict = {
                "roles": json.loads(profile.roles) if profile.roles else [],
                "skills": json.loads(profile.skills) if profile.skills else [],
                "locations": json.loads(profile.locations) if profile.locations else [],
                "priority_companies": json.loads(profile.priority_companies) if profile.priority_companies else [],
                "exclude_keywords": json.loads(profile.exclude_keywords) if profile.exclude_keywords else [],
                "score_threshold": profile.score_threshold,
                "digest_min_score": profile.digest_min_score,
            }
        except Exception:
            continue
            
        print(f"[scheduler] Dispatching automatic crawl task for user {profile.user_id}")
        run_pipeline_task.delay(profile.user_id, profile_dict, profile.resume_text or "")


# Start Background Scheduler inside FastAPI process
scheduler = BackgroundScheduler(timezone="UTC")
scheduler.add_job(run_all_subscribed_crawlers, "interval", hours=4, id="auto_crawls", max_instances=1)
scheduler.start()
