"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  Plus,
  X,
  FileText,
  User,
  Sliders,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { Profile } from "../types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form Field Temp States (for adding tags)
  const [newRole, setNewRole] = useState("");
  const [newSkill, setNewSkill] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  // Submit Feedback
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchProfileAndResume = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const [profileRes, resumeRes] = await Promise.all([
        fetch(`${API_URL}/api/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/resume`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (profileRes.status === 401 || resumeRes.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (!profileRes.ok || !resumeRes.ok)
        throw new Error("Failed to load profile/resume data");

      const profileData = await profileRes.json();
      const resumeData = await resumeRes.json();

      setProfile(profileData);
      setResumeText(resumeData.resume_text || "");
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
      fetchProfileAndResume();
    }
  }, [router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setSaveStatus("Saving configurations...");
    setSuccess(false);

    try {
      const [profileSave, resumeSave] = await Promise.all([
        fetch(`${API_URL}/api/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(profile),
        }),
        fetch(`${API_URL}/api/resume`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ resume_text: resumeText }),
        }),
      ]);

      if (profileSave.status === 401 || resumeSave.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }

      if (profileSave.ok && resumeSave.ok) {
        setSaveStatus(null);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } else {
        setSaveStatus("Failed to save profile or resume.");
      }
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus("Network error occurred.");
    }
  };

  const handleAddTag = (
    field: keyof Omit<Profile, "score_threshold" | "digest_min_score">,
    value: string,
    clearValue: () => void
  ) => {
    if (!profile || !value.trim()) return;
    const array = profile[field] as string[];
    if (array.includes(value.trim())) return;
    
    setProfile({
      ...profile,
      [field]: [...array, value.trim()],
    });
    clearValue();
  };

  const handleRemoveTag = (
    field: keyof Omit<Profile, "score_threshold" | "digest_min_score">,
    indexToRemove: number
  ) => {
    if (!profile) return;
    const array = profile[field] as string[];
    setProfile({
      ...profile,
      [field]: array.filter((_, idx) => idx !== indexToRemove),
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-2 border-t-emerald-500 border-zinc-800 rounded-full animate-spin" />
          <p className="text-xs text-zinc-500">Loading candidate configuration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 p-8 font-sans">
        <div className="border border-dashed border-red-500/20 rounded-2xl bg-red-500/5 p-8 text-center max-w-md">
          <p className="text-sm font-semibold text-red-400 mb-2">{error}</p>
          <button
            onClick={fetchProfileAndResume}
            className="mt-4 text-xs font-semibold text-white bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2 hover:bg-zinc-800 transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-zinc-800 px-8 flex items-center justify-between bg-zinc-950/40 backdrop-blur-md shrink-0">
        <div>
          <h2 className="text-xl font-semibold text-white tracking-tight flex items-center gap-2">
            <User size={18} className="text-emerald-400" />
            Profile & Resume
          </h2>
          <p className="text-xs text-zinc-500">Configure technical search boundaries and resume text</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 transition hover:bg-zinc-800"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Main Form container */}
      <div className="flex-1 overflow-y-auto p-8 bg-zinc-950/20 scrollbar-thin">
        <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-8 pb-12">
          {/* Success Alerts */}
          {success && (
            <div className="border border-emerald-500/20 rounded-2xl bg-emerald-500/5 p-4 flex items-center gap-3 text-sm text-emerald-400 animate-fadeIn">
              <CheckCircle size={18} />
              <p className="font-semibold">Configurations and resume saved successfully! Hot-reloaded in database.</p>
            </div>
          )}
          {saveStatus && (
            <div className="border border-zinc-800 rounded-2xl bg-zinc-900/50 p-4 text-xs text-zinc-400 animate-pulse">
              {saveStatus}
            </div>
          )}

          {/* Grid Layout splits Profile and Resume */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Side: Profile Filters */}
            <div className="space-y-6">
              <h3 className="text-sm uppercase text-zinc-500 font-bold tracking-wider flex items-center gap-2 border-b border-zinc-900 pb-2">
                <Sliders size={14} /> Search Boundaries
              </h3>

              {/* Roles Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400">Target Roles</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. SDE Intern"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="flex-1 bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag("roles", newRole, () => setNewRole(""))}
                    className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-zinc-300 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {profile?.roles.map((role, idx) => (
                    <span
                      key={role}
                      className="text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag("roles", idx)}
                        className="text-zinc-500 hover:text-red-400 transition"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Skills Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400">Target Skills</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. FastAPI"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    className="flex-1 bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag("skills", newSkill, () => setNewSkill(""))}
                    className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-zinc-300 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {profile?.skills.map((skill, idx) => (
                    <span
                      key={skill}
                      className="text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag("skills", idx)}
                        className="text-zinc-500 hover:text-red-400 transition"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Locations Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400">Target Locations</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Remote"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="flex-1 bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag("locations", newLocation, () => setNewLocation(""))}
                    className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-zinc-300 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {profile?.locations.map((loc, idx) => (
                    <span
                      key={loc}
                      className="text-[10px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                    >
                      {loc}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag("locations", idx)}
                        className="text-zinc-500 hover:text-red-400 transition"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Exclude Keywords Section */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-400">Exclude Keywords (Capped Score)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. unpaid"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    className="flex-1 bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag("exclude_keywords", newKeyword, () => setNewKeyword(""))}
                    className="bg-zinc-800 hover:bg-zinc-700 p-2 rounded-xl text-zinc-300 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1.5">
                  {profile?.exclude_keywords.map((kw, idx) => (
                    <span
                      key={kw}
                      className="text-[10px] font-semibold bg-zinc-900 border border-red-500/10 text-red-400 px-2.5 py-1 rounded-xl flex items-center gap-1.5"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag("exclude_keywords", idx)}
                        className="text-zinc-500 hover:text-red-400 transition"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Score thresholds grid */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-900">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400">Ping Threshold (Instant Ping)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={profile?.score_threshold || 70}
                    onChange={(e) =>
                      setProfile({ ...profile!, score_threshold: parseInt(e.target.value) || 70 })
                    }
                    className="w-full bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-350 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-400">Digest Min (Daily Summary)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={profile?.digest_min_score || 40}
                    onChange={(e) =>
                      setProfile({ ...profile!, digest_min_score: parseInt(e.target.value) || 40 })
                    }
                    className="w-full bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-350 font-semibold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Custom Telegram Credentials (SaaS Alerts) */}
              <div className="space-y-4 pt-4 border-t border-zinc-900">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Custom Telegram Bot Alerts</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Custom Bot Token (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 123456:ABC..."
                      value={profile?.telegram_token || ""}
                      onChange={(e) =>
                        setProfile({ ...profile!, telegram_token: e.target.value })
                      }
                      className="w-full bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Custom Chat ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. 987654321"
                      value={profile?.telegram_chat_id || ""}
                      onChange={(e) =>
                        setProfile({ ...profile!, telegram_chat_id: e.target.value })
                      }
                      className="w-full bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-300 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-zinc-650 leading-normal font-medium">
                  Leave empty to use the system default bot. Setup your bot via @BotFather and retrieve chat ID via @userinfobot.
                </p>
              </div>

              {/* Crawl Scheduler Subscription */}
              <div className="space-y-4 pt-4 border-t border-zinc-900">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Crawl Subscription Scheduler</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Extend Alerts (Days)</label>
                    <select
                      value={profile?.subscription_days || 0}
                      onChange={(e) =>
                        setProfile({ ...profile!, subscription_days: parseInt(e.target.value) || 0 })
                      }
                      className="w-full bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-300 focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                      <option value="0">Keep Existing Duration</option>
                      <option value="7">Activate for 7 Days</option>
                      <option value="14">Activate for 14 Days</option>
                      <option value="30">Activate for 30 Days</option>
                      <option value="90">Activate for 90 Days</option>
                      <option value="-1">Cancel Active Subscription</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-400">Scan Interval</label>
                    <select
                      value={profile?.crawl_interval_hours || 4}
                      onChange={(e) =>
                        setProfile({ ...profile!, crawl_interval_hours: parseInt(e.target.value) || 4 })
                      }
                      className="w-full bg-zinc-900 text-xs border border-zinc-800 rounded-xl px-3 py-2.5 text-zinc-300 focus:outline-none focus:border-emerald-500 font-semibold"
                    >
                      <option value="2">Every 2 Hours</option>
                      <option value="4">Every 4 Hours</option>
                      <option value="8">Every 8 Hours</option>
                      <option value="12">Every 12 Hours</option>
                      <option value="24">Once a Day</option>
                    </select>
                  </div>
                </div>
                {profile?.subscription_expires_at ? (
                  <div className="border border-emerald-500/10 bg-emerald-500/[0.02] p-3 rounded-xl text-[10px] text-emerald-400 font-semibold flex items-center gap-2">
                    <Sparkles size={12} />
                    <span>Crawl alerts active until {new Date(profile.subscription_expires_at).toLocaleDateString()} at {new Date(profile.subscription_expires_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                ) : (
                  <div className="border border-zinc-850 bg-zinc-950/20 p-3 rounded-xl text-[10px] text-zinc-500 font-semibold">
                    No active automatic crawl subscription. Select a duration above to initiate recurring background scans.
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Resume text box */}
            <div className="space-y-6 flex flex-col h-full">
              <h3 className="text-sm uppercase text-zinc-500 font-bold tracking-wider flex items-center gap-2 border-b border-zinc-900 pb-2">
                <FileText size={14} /> Resume Context
              </h3>

              <div className="flex-1 flex flex-col space-y-2 min-h-[400px]">
                <label className="text-xs font-semibold text-zinc-400">Resume Plain Text Context (4,000 char max)</label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your plain text resume content here. The AI scorer reads this text directly to compare matches."
                  className="w-full flex-1 bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 font-medium leading-relaxed resize-none h-full"
                />
                <span className="text-[10px] text-zinc-650 text-right font-medium">
                  {resumeText.length} / 4000 characters
                </span>
              </div>
            </div>
          </div>

          {/* Form Actions footer */}
          <div className="flex items-center justify-end border-t border-zinc-800/80 pt-6">
            <button
              type="submit"
              className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/10"
            >
              <Save size={16} /> Save Configurations
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
