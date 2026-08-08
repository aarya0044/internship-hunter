"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Mail, ArrowRight, ShieldCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      router.push("/");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      // Save token to local storage
      localStorage.setItem("token", data.access_token);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-zinc-950 font-sans p-6">
      <div className="w-full max-w-md border border-zinc-800 bg-zinc-900/20 backdrop-blur-xl p-8 rounded-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-zinc-950 shadow-lg shadow-emerald-500/10">
            <ShieldCheck size={26} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isLogin ? "Welcome back" : "Create candidate portal"}
          </h2>
          <p className="text-xs text-zinc-500">
            {isLogin
              ? "Sign in to manage your automated job hunt"
              : "Register to isolate your resume matching"}
          </p>
        </div>

        {error && (
          <div className="border border-red-500/20 rounded-xl bg-red-500/5 p-3.5 text-xs text-red-400 text-center font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                size={16}
              />
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"
                size={16}
              />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 text-xs border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 mt-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Processing..." : isLogin ? "Sign In" : "Sign Up"}
            {!loading && <ArrowRight size={14} />}
          </button>
        </form>

        <div className="text-center border-t border-zinc-850 pt-4 text-xs">
          <p className="text-zinc-500 font-medium">
            {isLogin ? "New to Hunter Agent?" : "Already have an account?"}{" "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold underline transition ml-1"
            >
              {isLogin ? "Register here" : "Login here"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
