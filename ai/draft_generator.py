"""Generates a short, personalized outreach message (email or DM style) for
high-scoring matches, using the resume + job description as context. This
is a *draft* - always read it before sending; the agent doesn't send
anything on your behalf."""
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


SYSTEM_PROMPT = """You write short, specific, non-cringe outreach messages
for internship applications. Rules:
- Max 120 words.
- No generic filler ("I am writing to express my interest...").
- Reference 1-2 concrete things from the resume that map directly to the role.
- Reference something specific about the company/role from the job description.
- Plain, confident, human tone. Not a cover letter - a short DM/email a
  founder or recruiter would actually read and reply to.
- End with a clear, low-friction ask (e.g. "happy to send my resume/portfolio").
Return plain text only, no subject line, no markdown.
"""


def generate_draft(job: dict, resume_text: str = None) -> str:
    if resume_text is None:
        resume_text = load_resume_text()
    if not resume_text:
        return ""

    user_prompt = f"""RESUME:
{resume_text[:4000]}

JOB:
Company: {job.get('company')}
Title: {job.get('title')}
Description: {(job.get('description') or '')[:2000]}
"""
    client, model = _get_client_and_model()
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.6,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"[draft_generator] error: {e}")
        return ""
