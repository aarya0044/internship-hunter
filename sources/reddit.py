import requests

def fetch() -> list:
    """Scrapes the r/internships subreddit for new community-shared job roles."""
    jobs = []
    url = "https://www.reddit.com/r/internships/new.json?limit=25"
    
    # Reddit blocks default python User-Agents, so we provide a standard browser agent
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        resp = requests.get(url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        posts = data.get("data", {}).get("children", [])
        
        for post in posts:
            pdata = post.get("data", {})
            title = pdata.get("title", "")
            
            # Simple keyword matching to ensure we grab hiring/offer posts, not questions
            lower_title = title.lower()
            is_offering = any(k in lower_title for k in ["hiring", "hiring!", "apply", "opportunity", "job", "position", "opening"])
            is_intern = any(k in lower_title for k in ["intern", "co-op", "placement", "internship"])
            
            if not (is_intern and is_offering):
                continue
                
            body = pdata.get("selftext", "")
            url_to_use = pdata.get("url", "")
            if "reddit.com" in url_to_use and pdata.get("permalink"):
                url_to_use = "https://www.reddit.com" + pdata.get("permalink")
                
            author = pdata.get("author", "Reddit User")
            
            jobs.append({
                "source": "reddit_r_internships",
                "company": f"Reddit Referral (u/{author})",
                "title": title[:100],
                "location": "Remote / Mixed",
                "url": url_to_use,
                "description": body[:2000] if body else title,
                "posted_at": "",
            })
    except Exception as e:
        print(f"[reddit_source] fetch error: {e}")
        
    return jobs
