"""Sends messages via the Telegram Bot API. Setup:
1. Message @BotFather on Telegram -> /newbot -> copy the token into .env
2. Message your new bot anything (so it's allowed to DM you)
3. Message @userinfobot to get your numeric chat id -> put it in .env
"""
import html
import requests
import config

API = "https://api.telegram.org/bot{token}/sendMessage"


def send_message(text: str):
    if not config.TELEGRAM_BOT_TOKEN or not config.TELEGRAM_CHAT_ID:
        print("[telegram] not configured, skipping send. Message was:\n", text)
        return

    url = API.format(token=config.TELEGRAM_BOT_TOKEN)
    try:
        resp = requests.post(url, data={
            "chat_id": config.TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
        }, timeout=15)
        resp.raise_for_status()
    except Exception as e:
        print(f"[telegram] failed to send message: {e}")
        # Also print the response text if available for easier debugging
        if 'resp' in locals() and hasattr(resp, 'text'):
            print(f"[telegram] response: {resp.text}")


def format_job_alert(job: dict, score: int, summary: str, reason: str,
                      matched_skills: list, draft: str = "") -> str:
    skills_line = ", ".join(matched_skills) if matched_skills else "-"
    
    # Escape dynamic values to prevent Telegram HTML parse errors (400 Bad Request)
    escaped_company = html.escape(job['company'])
    escaped_title = html.escape(job['title'])
    escaped_location = html.escape(job.get('location') or 'Not specified')
    escaped_source = html.escape(job['source'])
    escaped_reason = html.escape(reason)
    escaped_skills = html.escape(skills_line)
    
    msg = (
        f"🚀 <b>New Internship Match</b>\n\n"
        f"<b>Company:</b> {escaped_company}\n"
        f"<b>Role:</b> {escaped_title}\n"
        f"<b>Location:</b> {escaped_location}\n"
        f"<b>Source:</b> {escaped_source}\n\n"
        f"<b>Score:</b> {score}/100\n"
        f"<b>Why:</b> {escaped_reason}\n"
        f"<b>Matched skills:</b> {escaped_skills}\n\n"
        f"<a href=\"{job['url']}\">Apply here</a>"
    )
    if draft:
        escaped_draft = html.escape(draft)
        msg += f"\n\n<b>Draft outreach message:</b>\n{escaped_draft}"
    return msg


def format_digest(jobs: list) -> str:
    if not jobs:
        return ""
    lines = [f"📋 <b>Daily Digest - {len(jobs)} more matches</b>\n"]
    for j in jobs[:20]:
        lines.append(
            f"• <b>{j['company']}</b> - {j['title']} "
            f"({j.get('score', 0)}/100) - <a href=\"{j['url']}\">apply</a>"
        )
    if len(jobs) > 20:
        lines.append(f"\n...and {len(jobs) - 20} more in the database.")
    return "\n".join(lines)
