"""The actual 'AI agent' step: takes a raw job posting + the user's profile
+ resume, and returns a score/summary/reasoning, exactly like the filtering
agent described in the design doc."""
import json
from openai import OpenAI

import config
from ai.resume_matcher import load_resume_text

_client = None
_model = None


def _get_client_and_model():
    global _client, _model
    if _client is None:
        if config.LLM_PROVIDER == "groq":
            _client = OpenAI(
                api_key=config.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1"
            )
            _model = config.GROQ_MODEL
        else:
            _client = OpenAI(api_key=config.OPENAI_API_KEY)
            _model = config.OPENAI_MODEL
    return _client, _model


SYSTEM_PROMPT = """You are an internship-matching assistant. You are given:
1. A candidate profile (roles wanted, skills, locations, priority companies, exclude keywords)
2. The candidate's resume text
3. One job posting

Score how well the posting matches the candidate from 0-100, where:
- 90-100: near-perfect match on role + skills + location, no exclusions triggered
- 70-89: strong match, worth an instant notification
- 40-69: partial match, fine for a daily digest but not urgent
- 0-39: weak or irrelevant match, or an exclude_keyword was triggered

Rules:
- If the posting is not actually an internship, score it 0.
- If any exclude_keyword appears in the title or description, cap the score at 20.
- Priority companies get a modest boost (+5 to +10) if the role otherwise matches.
- Be honest and specific in "reason" - name the actual overlapping skills/keywords,
  don't just say "good match".

Respond with ONLY a JSON object, no markdown fences, no preamble:
{
  "score": <int 0-100>,
  "summary": "<one sentence on the role>",
  "reason": "<why this score - specific skills/keywords that matched or didn't>",
  "matched_skills": ["<skill1>", "<skill2>", ...],
  "resume_tips": "<a short, actionable tip on how the candidate can customize their resume bullet points or projects list for this job, max 40 words>"
}
"""


def score_job(job: dict, profile: dict = None, resume_text: str = None) -> dict:
    if resume_text is None:
        resume_text = load_resume_text()
    if profile is None:
        profile = config.PROFILE

    user_prompt = f"""CANDIDATE PROFILE:
Roles wanted: {profile.get('roles')}
Skills: {profile.get('skills')}
Preferred locations: {profile.get('locations')}
Priority companies: {profile.get('priority_companies')}
Exclude keywords: {profile.get('exclude_keywords')}

CANDIDATE RESUME:
{resume_text[:4000] if resume_text else "(no resume provided)"}

JOB POSTING:
Company: {job.get('company')}
Title: {job.get('title')}
Location: {job.get('location')}
Description: {(job.get('description') or '')[:2500]}
"""

    client, model = _get_client_and_model()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
        )
        raw = resp.choices[0].message.content
        result = json.loads(raw)
        return {
            "score": int(result.get("score", 0)),
            "summary": result.get("summary", ""),
            "reason": result.get("reason", ""),
            "matched_skills": result.get("matched_skills", []),
            "resume_tips": result.get("resume_tips", ""),
        }
    except Exception as e:
        print(f"[scorer] error scoring '{job.get('title')}' at {job.get('company')}: {e}")
        return {
            "score": 0,
            "summary": "",
            "reason": f"scoring failed: {e}",
            "matched_skills": [],
            "resume_tips": "",
        }
