"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Briefcase,
  User,
  Activity,
  Play,
  CheckCircle,
  RefreshCw,
  LogOut,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isCrawling, setIsCrawling] = useState(false);
  const [triggerStatus, setTriggerStatus] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check auth token
  useEffect(() => {
    const token = localStorage.getItem("token");
    setIsAuthenticated(!!token);
  }, [pathname]);

  // Poll server status every 5 seconds to update crawler indicators
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/api/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        if (res.ok) {
          const data = await res.json();
          setIsCrawling(data.is_crawling);
          // Broadcast status globally to update page overlay
          window.dispatchEvent(new CustomEvent("crawlerStatus", { detail: { isCrawling: data.is_crawling } }));
        }
      } catch (err) {
        console.error("Failed to connect to API status endpoint:", err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [router, pathname]);

  const handleRunCrawler = async () => {
    if (isCrawling) return;
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }

    setIsCrawling(true);
    window.dispatchEvent(new CustomEvent("crawlerStatus", { detail: { isCrawling: true } }));
    setTriggerStatus("Triggering...");
    try {
      const res = await fetch(`${API_URL}/api/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
      if (res.ok) {
        setTriggerStatus("Running!");
        setTimeout(() => setTriggerStatus(null), 3000);
      } else {
        setTriggerStatus("Failed");
        setTimeout(() => setTriggerStatus(null), 3000);
        setIsCrawling(false);
        window.dispatchEvent(new CustomEvent("crawlerStatus", { detail: { isCrawling: false } }));
      }
    } catch (err) {
      console.error("Error triggering run:", err);
      setTriggerStatus("Error");
      setTimeout(() => setTriggerStatus(null), 3000);
      setIsCrawling(false);
      window.dispatchEvent(new CustomEvent("crawlerStatus", { detail: { isCrawling: false } }));
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.push("/login");
  };

  // If on login page, hide sidebar
  if (pathname === "/login") return null;
  if (!isAuthenticated) return null;

  const navItems = [
    { name: "Matches & Jobs", href: "/", icon: Briefcase },
    { name: "Profile & Resume", href: "/profile", icon: User },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-950 flex flex-col justify-between text-zinc-300 font-sans shrink-0">
      <div>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center px-6 border-b border-zinc-800 gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500 flex items-center justify-center text-zinc-950 font-bold text-lg">
            H
          </div>
          <div>
            <h1 className="font-semibold text-white tracking-tight leading-none text-base">
              Hunter Agent
            </h1>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
              SaaS Portal
            </span>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium ${
                  isActive
                    ? "bg-zinc-900 text-white border-l-2 border-emerald-500"
                    : "hover:bg-zinc-900/60 hover:text-zinc-100 text-zinc-400"
                }`}
              >
                <Icon
                  size={18}
                  className={isActive ? "text-emerald-400" : "text-zinc-500"}
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Crawler Status & Action Box */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/20 space-y-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
              Crawler Status
            </span>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isCrawling ? "bg-emerald-500 animate-pulse" : "bg-zinc-700"
                }`}
              />
              <span className="text-xs text-zinc-300 font-semibold">
                {isCrawling ? "Active" : "Idle"}
              </span>
            </div>
          </div>

          {isCrawling && (
            <p className="text-[11px] text-zinc-500 leading-normal animate-pulse">
              Scraping career feeds and running AI match scoring...
            </p>
          )}

          <button
            onClick={handleRunCrawler}
            disabled={isCrawling}
            className={`w-full py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all duration-200 ${
              isCrawling
                ? "bg-zinc-900 text-zinc-500 border border-zinc-800 cursor-not-allowed"
                : "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-lg shadow-emerald-500/10 active:scale-[0.98]"
            }`}
          >
            {isCrawling ? (
              <RefreshCw size={14} className="animate-spin text-zinc-500" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            {triggerStatus || (isCrawling ? "Crawling..." : "Run Scraper")}
          </button>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-zinc-900 hover:text-red-400 transition-colors text-zinc-500 text-xs font-semibold"
        >
          <LogOut size={16} />
          Sign Out
        </button>

        {/* Footer Credit */}
        <div className="text-center pt-2">
          <p className="text-[10px] text-zinc-650 font-medium">
            Aarya Dharmadhikari • final year BE IT
          </p>
        </div>
      </div>
    </aside>
  );
}
