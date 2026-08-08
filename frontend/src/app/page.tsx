"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Filter,
  CheckCircle,
  ExternalLink,
  ChevronRight,
  Clipboard,
  Check,
  Briefcase,
  Layers,
  MapPin,
  Clock,
  Sparkles,
  Award,
  BookOpen,
  TrendingUp,
} from "lucide-react";
import { Job } from "./types";

interface Insight {
  title: string;
  content: string;
  category: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCrawling, setIsCrawling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [minScore, setMinScore] = useState(40);
  const [appliedFilter, setAppliedFilter] = useState<"all" | "applied" | "unapplied">("all");

  // Selected Job (for Modal)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [draftText, setDraftText] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Loading Screen Cycling States
  const [loadingStep, setLoadingStep] = useState(0);
  const [activeTipIdx, setActiveTipIdx] = useState(0);

  const fetchJobsAndInsights = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const [jobsRes, insightsRes] = await Promise.all([
        fetch(`${API_URL}/api/jobs?limit=100`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (jobsRes.status === 401 || insightsRes.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!jobsRes.ok) throw new Error("Failed to load jobs");
      const jobsData = await jobsRes.json();
      setJobs(jobsData);

      if (insightsRes.ok) {
        const insightsData = await insightsRes.json();
        setInsights(insightsData);
      }
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError("Failed to connect to backend server. Make sure FastAPI is running on port 8000.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      fetchJobsAndInsights();
    }
  }, [router]);

  // Sync crawling status overlay instantly via Sidebar custom event
  useEffect(() => {
    const handleStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.isCrawling === "boolean") {
        setIsCrawling(customEvent.detail.isCrawling);
      }
    };
    window.addEventListener("crawlerStatus", handleStatusChange);
    return () => window.removeEventListener("crawlerStatus", handleStatusChange);
  }, []);

  // Poll Crawler status to sync loading overlay
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const wasCrawling = isCrawling;
          setIsCrawling(data.is_crawling);
          
          // If crawl just finished, refresh the feeds
          if (wasCrawling && !data.is_crawling) {
            fetchJobsAndInsights();
          }
        }
      } catch (err) {
        console.error(err);
      }
    };

    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [isCrawling]);

  // Loading Steps Loop
  useEffect(() => {
    if (!isCrawling) return;
    const steps = [
      "Connecting to Greenhouse and Lever ATS gateways...",
      "Scraping the Pitt CSC/Simplify Summer 2026 feeds...",
      "Running Python heuristic keyword checks to filter senior roles...",
      "Matching candidate resume embeddings via cosine calculations...",
      "Initializing Groq Llama-3.3-70b-versatile LLM model...",
      "Scoring active listings and writing resume customization tips...",
      "Generating custom cold outreach cold drafts...",
      "Transmitting real-time HTML alert notifications to your Telegram Bot...",
    ];
    
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev + 1) % steps.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [isCrawling]);

  // Tech Fact Carousel Loop
  useEffect(() => {
    if (!isCrawling || insights.length === 0) return;
    const interval = setInterval(() => {
      setActiveTipIdx((prev) => (prev + 1) % insights.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [isCrawling, insights]);

  const handleOpenJob = (job: Job) => {
    setSelectedJob(job);
    setDraftText(job.draft_message || "");
    setSaveStatus(null);
    setCopied(false);
  };

  const handleToggleApplied = async (job: Job) => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const updatedStatus = !job.applied;
    try {
      const res = await fetch(`${API_URL}/api/jobs/${job.id}/apply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ applied: updatedStatus }),
      });
      if (res.ok) {
        setJobs(jobs.map((j) => (j.id === job.id ? { ...j, applied: updatedStatus } : j)));
        if (selectedJob && selectedJob.id === job.id) {
          setSelectedJob({ ...selectedJob, applied: updatedStatus });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedJob) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    setSaveStatus("Saving...");
    try {
      const res = await fetch(`${API_URL}/api/jobs/${selectedJob.id}/draft`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ draft_message: draftText }),
      });
      if (res.ok) {
        setJobs(jobs.map((j) => (j.id === selectedJob.id ? { ...j, draft_message: draftText } : j)));
        setSaveStatus("Saved successfully!");
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        setSaveStatus("Failed to save.");
      }
    } catch (err) {
      console.error(err);
      setSaveStatus("Error occurred.");
    }
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesScore = job.score >= minScore;
    const matchesApplied =
      appliedFilter === "all" ||
      (appliedFilter === "applied" && job.applied) ||
      (appliedFilter === "unapplied" && !job.applied);

    return matchesSearch && matchesScore && matchesApplied;
  });

  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    if (score >= 70) return "bg-amber-500/10 text-amber-400 border border-amber-500/20";
    return "bg-zinc-800 text-zinc-400 border border-zinc-700/50";
  };

  const stats = {
    total: jobs.length,
    highMatches: jobs.filter((j) => j.score >= 70).length,
    applied: jobs.filter((j) => j.applied).length,
  };

  const loadingPhrases = [
    "Connecting to Greenhouse and Lever ATS gateways...",
    "Scraping the Pitt CSC/Simplify Summer 2026 feeds...",
    "Running Python heuristic keyword checks to filter senior roles...",
    "Matching candidate resume embeddings via cosine calculations...",
    "Initializing Groq Llama-3.3-70b-versatile LLM model...",
    "Scoring active listings and writing resume customization tips...",
    "Generating custom cold outreach cold drafts...",
    "Transmitting real-time HTML alert notifications to your Telegram Bot...",
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans relative">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 px-8 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md shrink-0 z-10">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight">Discovery Feed</h2>
          <p className="text-xs text-zinc-500">Analyze, score, and track matching internship postings</p>
        </div>
        <button
          onClick={fetchJobsAndInsights}
          className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 transition hover:bg-zinc-800"
        >
          Refresh Feed
        </button>
      </header>

      {/* Main Body Grid */}
      <div className="flex-1 flex overflow-hidden">
        {/* Jobs List Section */}
        <section className="flex-1 flex flex-col min-w-0 bg-zinc-950/10 p-6 overflow-hidden">
          {/* Market Insights dynamic strip */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
              {insights.map((insight, idx) => (
                <div
                  key={idx}
                  className="border border-zinc-800/80 rounded-2xl bg-zinc-900/10 p-4 space-y-2 hover:bg-zinc-900/30 transition duration-300 relative overflow-hidden group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                      {insight.category}
                    </span>
                    <TrendingUp size={12} className="text-zinc-600 group-hover:text-emerald-400 transition" />
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-emerald-400 transition">
                    {insight.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 leading-normal font-medium">{insight.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 mb-6 shrink-0">
            <div className="border border-zinc-800/80 rounded-2xl bg-zinc-900/30 p-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Total Scored</span>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
            </div>
            <div className="border border-zinc-800/80 rounded-2xl bg-zinc-900/30 p-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Strong Matches (≥70)</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.highMatches}</p>
            </div>
            <div className="border border-zinc-800/80 rounded-2xl bg-zinc-900/30 p-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Applied</span>
              <p className="text-2xl font-bold text-sky-400 mt-1">{stats.applied}</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border border-zinc-800/80 rounded-2xl bg-zinc-950/40 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
              <input
                type="text"
                placeholder="Search roles or companies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-900 text-sm border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>

            {/* Score Slider */}
            <div className="flex items-center gap-3 border border-zinc-800 bg-zinc-900/40 rounded-xl px-4 py-2">
              <span className="text-xs text-zinc-500 font-medium whitespace-nowrap">Min Score:</span>
              <input
                type="range"
                min="0"
                max="90"
                step="10"
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="w-24 accent-emerald-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-emerald-400 w-6 text-right">{minScore}</span>
            </div>

            {/* Applied Filter */}
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-1">
              {(["all", "unapplied", "applied"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setAppliedFilter(filter)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium capitalize transition-all duration-200 ${
                    appliedFilter === filter
                      ? "bg-zinc-800 text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Job Postings Grid */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-8 w-8 border-2 border-t-emerald-500 border-zinc-800 rounded-full animate-spin" />
                  <p className="text-xs text-zinc-500">Loading scored jobs...</p>
                </div>
              </div>
            ) : error ? (
              <div className="h-full flex items-center justify-center border border-dashed border-red-500/20 rounded-2xl bg-red-500/5 p-8 text-center">
                <div>
                  <p className="text-sm font-semibold text-red-400 mb-2">{error}</p>
                  <button
                    onClick={fetchJobsAndInsights}
                    className="mt-2 text-xs font-semibold text-white bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 hover:bg-zinc-800 transition"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="h-full flex items-center justify-center border border-dashed border-zinc-800 rounded-2xl bg-zinc-900/10 p-8 text-center">
                <p className="text-sm text-zinc-500">No jobs match your search parameters.</p>
              </div>
            ) : (
              filteredJobs.map((job) => {
                let skills: string[] = [];
                if (job.matched_skills) {
                  try {
                    skills = JSON.parse(job.matched_skills);
                  } catch (e) {
                    skills = [];
                  }
                }

                return (
                  <div
                    key={job.id}
                    onClick={() => handleOpenJob(job)}
                    className={`border rounded-2xl p-5 flex items-center justify-between cursor-pointer transition-all duration-200 bg-zinc-900/30 hover:bg-zinc-900/60 hover:border-zinc-700/50 ${
                      selectedJob?.id === job.id ? "border-emerald-500/40 bg-zinc-900/70" : "border-zinc-850"
                    }`}
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      {/* Match Score Circle */}
                      <div
                        className={`h-12 w-12 rounded-2xl shrink-0 flex flex-col items-center justify-center font-bold text-sm ${getScoreColor(
                          job.score
                        )}`}
                      >
                        <span className="text-[10px] leading-none text-zinc-500 font-semibold mb-0.5">FIT</span>
                        <span className="leading-none text-base">{job.score}</span>
                      </div>

                      {/* Job Metadata */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-white truncate text-sm leading-tight hover:text-emerald-400 transition">
                            {job.title}
                          </h3>
                          {job.applied && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <CheckCircle size={10} /> Applied
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span className="font-medium text-zinc-300">{job.company}</span>
                          <span className="flex items-center gap-1">
                            <MapPin size={12} /> {job.location || "Remote"}
                          </span>
                          <span className="flex items-center gap-1 border-l border-zinc-800 pl-3">
                            <Layers size={12} /> {job.source}
                          </span>
                          {job.vector_score !== undefined && job.vector_score > 0 && (
                            <span className="flex items-center gap-1 border-l border-zinc-800 pl-3 text-emerald-500/80 font-semibold">
                              <Sparkles size={11} /> Vector: {job.vector_score}%
                            </span>
                          )}
                        </div>
                        {skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {skills.slice(0, 4).map((skill) => (
                              <span
                                key={skill}
                                className="text-[9px] font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700/30 px-2 py-0.5 rounded-lg"
                              >
                                {skill}
                              </span>
                            ))}
                            {skills.length > 4 && (
                              <span className="text-[9px] font-semibold text-zinc-600 px-1.5 py-0.5">
                                +{skills.length - 4} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Chevron action */}
                    <div className="shrink-0 text-zinc-600 pl-4">
                      <ChevronRight size={18} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Job Detail Modal Overlay / Right Sidebar Drawer */}
        {selectedJob && (
          <aside className="w-[500px] border-l border-zinc-800 bg-zinc-950/60 backdrop-blur-xl p-6 flex flex-col justify-between overflow-hidden shrink-0">
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-zinc-800/80 pb-5 shrink-0">
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`inline-flex items-center justify-center font-bold text-xs px-2.5 py-1 rounded-xl ${getScoreColor(
                        selectedJob.score
                      )}`}
                    >
                      {selectedJob.score}/100 Match
                    </span>
                    <button
                      onClick={() => handleToggleApplied(selectedJob)}
                      className={`text-[10px] font-bold border rounded-xl px-2.5 py-1 transition ${
                        selectedJob.applied
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/25"
                          : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                      }`}
                    >
                      {selectedJob.applied ? "✓ Applied" : "Mark Applied"}
                    </button>
                  </div>
                  <h2 className="text-base font-bold text-white leading-tight truncate">
                    {selectedJob.title}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 font-medium">{selectedJob.company}</p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-900 bg-zinc-900/30 p-1.5 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable details contents */}
              <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-2 scrollbar-thin">
                {/* Details Pills */}
                <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-900/20 p-3 rounded-2xl border border-zinc-900">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} className="text-zinc-500" />
                    <div>
                      <p className="text-[9px] text-zinc-650 uppercase font-semibold leading-none mb-0.5">Location</p>
                      <p className="font-semibold text-zinc-300 truncate">{selectedJob.location || "Remote"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-zinc-500" />
                    <div>
                      <p className="text-[9px] text-zinc-650 uppercase font-semibold leading-none mb-0.5">Discovered</p>
                      <p className="font-semibold text-zinc-300">
                        {new Date(selectedJob.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Semantic Vector Match */}
                {selectedJob.vector_score !== undefined && selectedJob.vector_score > 0 && (
                  <div className="flex items-center justify-between text-xs border border-zinc-800/80 bg-zinc-900/10 px-4 py-3 rounded-2xl">
                    <span className="text-zinc-500 font-semibold flex items-center gap-1.5">
                      <Sparkles size={12} className="text-emerald-500" /> TF-IDF Vector Similarity
                    </span>
                    <span className="text-emerald-400 font-bold">{selectedJob.vector_score}% Match</span>
                  </div>
                )}

                {/* AI Summary / Match Reason */}
                {selectedJob.summary && (
                  <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                      <Sparkles size={14} />
                      <h3>AI Fit Analysis</h3>
                    </div>
                    <p className="text-xs text-zinc-300 leading-normal font-medium">{selectedJob.summary}</p>
                  </div>
                )}

                {/* AI Resume Tailoring Tips */}
                {selectedJob.resume_tips && (
                  <div className="rounded-2xl border border-blue-500/15 bg-blue-500/[0.02] p-4 space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
                      <Award size={14} />
                      <h3>Resume Customization Tip</h3>
                    </div>
                    <p className="text-xs text-zinc-300 leading-normal font-medium">{selectedJob.resume_tips}</p>
                  </div>
                )}

                {/* Job Description */}
                <div>
                  <h3 className="text-xs uppercase text-zinc-500 font-bold tracking-wider mb-2">Job Description</h3>
                  <div className="text-xs text-zinc-400 leading-relaxed font-medium bg-zinc-900/25 border border-zinc-900 rounded-2xl p-4 max-h-60 overflow-y-auto">
                    {selectedJob.description ? (
                      <div dangerouslySetInnerHTML={{ __html: selectedJob.description }} />
                    ) : (
                      <p className="italic text-zinc-650">No full description scraped.</p>
                    )}
                  </div>
                </div>

                {/* Cold Outreach Generator Container */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase text-zinc-500 font-bold tracking-wider">Outreach Draft</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyToClipboard}
                        disabled={!draftText}
                        className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                          copied
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : "border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-white"
                        }`}
                      >
                        {copied ? <Check size={10} /> : <Clipboard size={10} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="relative rounded-2xl border border-zinc-850 bg-zinc-900/30 overflow-hidden">
                    <textarea
                      value={draftText}
                      onChange={(e) => setDraftText(e.target.value)}
                      placeholder="Outreach drafts are generated automatically for jobs scoring >= 70 threshold."
                      className="w-full h-36 bg-transparent text-xs text-zinc-300 p-4 focus:outline-none resize-none font-medium leading-relaxed"
                    />
                    <div className="border-t border-zinc-850 px-4 py-2.5 bg-zinc-950/40 flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-medium">
                        {draftText ? `${draftText.split(/\s+/).filter(Boolean).length} words` : "0 words"}
                      </span>
                      <div className="flex items-center gap-2">
                        {saveStatus && <span className="text-[10px] text-emerald-400 font-semibold">{saveStatus}</span>}
                        <button
                          onClick={handleSaveDraft}
                          className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-[10px] px-3 py-1.5 rounded-lg border border-zinc-700/50 transition"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply link action bar */}
              <div className="border-t border-zinc-800/80 pt-4 shrink-0 flex gap-2">
                <a
                  href={selectedJob.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition"
                >
                  Apply on Career Page <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Dynamic Crawling Overlay Modal */}
      {isCrawling && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-50 p-6 animate-fadeIn">
          <div className="max-w-md w-full border border-zinc-850 bg-zinc-900/60 p-8 rounded-3xl text-center space-y-6 shadow-2xl relative overflow-hidden">
            {/* Spinning glowing status */}
            <div className="relative h-20 w-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-500/20 animate-spin duration-[10s]" />
              <div className="absolute inset-2 rounded-full border border-double border-t-emerald-500 border-zinc-800 animate-spin" />
              <div className="absolute inset-4 rounded-full bg-zinc-950 flex items-center justify-center text-emerald-400 shadow-inner">
                <Sparkles size={20} className="animate-pulse" />
              </div>
            </div>

            {/* Tech quote / Loading step status */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white tracking-tight uppercase tracking-wider text-emerald-400 animate-pulse">
                Active Job Pipeline Crawl
              </h3>
              <p className="text-xs text-zinc-300 font-semibold leading-relaxed min-h-[40px] px-4 transition duration-300">
                {loadingPhrases[loadingStep]}
              </p>
            </div>

            {/* Dynamic Market Tidbit or Fact to entertain users */}
            {insights.length > 0 && (
              <div className="border border-zinc-800/80 bg-zinc-950/50 p-4 rounded-2xl space-y-1.5 transition-all duration-500">
                <div className="flex items-center gap-1.5 justify-center text-[9px] font-bold uppercase tracking-widest text-zinc-500">
                  <BookOpen size={10} className="text-zinc-650" />
                  <span>Market Insight Factoid</span>
                </div>
                <h4 className="text-[11px] font-bold text-zinc-300">
                  {insights[activeTipIdx].title}
                </h4>
                <p className="text-[10px] text-zinc-400 leading-normal font-medium italic">
                  "{insights[activeTipIdx].content}"
                </p>
              </div>
            )}

            <div className="text-[10px] text-zinc-600 font-medium">
              Scanning career feeds and executing Llama AI algorithms. Usually finishes in 20-30s.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
