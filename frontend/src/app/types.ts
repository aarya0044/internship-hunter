export interface Job {
  id: number;
  job_hash: string;
  source: string;
  company: string;
  title: string;
  location?: string;
  url: string;
  description?: string;
  posted_at?: string;
  score: number;
  summary?: string;
  matched_skills?: string; // JSON string
  draft_message?: string;
  resume_tips?: string;
  vector_score?: number;
  notified: boolean;
  in_digest: boolean;
  applied: boolean;
  created_at: string;
}

export interface Profile {
  roles: string[];
  skills: string[];
  locations: string[];
  priority_companies: string[];
  exclude_keywords: string[];
  score_threshold: number;
  digest_min_score: number;
}
