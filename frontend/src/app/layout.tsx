import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/app/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Internship Hunter Dashboard",
  description: "Autonomous Internship Discovery and AI Match Assistant",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full flex bg-zinc-950 text-zinc-100 font-sans antialiased overflow-hidden">
        {/* Shared Dashboard Sidebar */}
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-hidden bg-zinc-900/20">
          {children}
        </main>
      </body>
    </html>
  );
}
