import React, { useEffect, useState } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

export default function Shell() {
  const { pathname } = useLocation();
  const isAuth = pathname === "/sign-in" || pathname === "/sign-up";
  const container = "mx-auto max-w-6xl px-4";

  /* ---------- Font size controls (A- / A / A+) ---------- */
  const LS_KEY = "nivra:rootFontPx";
  const [rootPx, setRootPx] = useState(() => {
    const saved = Number(localStorage.getItem(LS_KEY));
    return saved && saved >= 14 && saved <= 20 ? saved : 16; // default 16px
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${rootPx}px`;
    localStorage.setItem(LS_KEY, String(rootPx));
  }, [rootPx]);

  const decFont = () => setRootPx(v => Math.max(14, v - 1));
  const resetFont = () => setRootPx(16);
  const incFont = () => setRootPx(v => Math.min(20, v + 1));

  const FontSizeGroup = () => (
    <div className="hidden sm:flex items-center gap-1 opacity-90" role="group" aria-label="Font size">
      <button
        type="button"
        onClick={decFont}
        className="px-1 hover:underline underline-offset-2 focus:outline-none focus:underline"
        aria-label="Decrease text size"
      >
        A-
      </button>
      <button
        type="button"
        onClick={resetFont}
        className="px-1 hover:underline underline-offset-2 focus:outline-none focus:underline"
        aria-label="Reset text size"
      >
        A
      </button>
      <button
        type="button"
        onClick={incFont}
        className="px-1 hover:underline underline-offset-2 focus:outline-none focus:underline"
        aria-label="Increase text size"
      >
        A+
      </button>
    </div>
  );

  // ---------- AUTH LAYOUT (centered, minimal nav) ----------
  if (isAuth) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* slim gov bar */}
        <header className="bg-primary text-white text-[12px]">
          <div className={`${container} flex items-center justify-between py-2`}>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-4 border border-white/40"
                style={{
                  background:
                    "linear-gradient(to bottom, #FF9933 33.33%, white 33.33% 66.66%, #138808 66.66%)",
                }}
                aria-hidden
              />
              <span className="tracking-tight">Government of India</span>
            </div>
            <div className="flex items-center gap-5">
              <a href="#main" className="hover:underline underline-offset-2">
                Skip to Main Content
              </a>
              <FontSizeGroup />
            </div>
          </div>
        </header>

        {/* tiny top bar with Home only (hide Login/Signup to avoid duplication) */}
        <nav className="bg-white border-b border-gray-200">
          <div className={`${container} flex items-center justify-between py-3`}>
            <Link to="/" className="flex items-center gap-3" aria-label="NIVRA Home">
              <img
                src="/logo.png"
                alt="NIVRA"
                className="w-8 h-8 rounded"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
              <span className="font-semibold">NIVRA</span>
            </Link>
            <Link to="/" className="text-sm text-[#333] hover:text-primary">Home</Link>
          </div>
        </nav>

        {/* center the Clerk card */}
        <main id="main" className={`${container}`}>
          <div className="min-h-[calc(100vh-120px)] grid place-items-center py-10">
            <div className="w-full max-w-md">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ---------- PUBLIC / APP LAYOUT ----------
  return (
    <>
      {/* Top header */}
      <header className="bg-primary text-white text-[12px]">
        <div className={`${container} flex items-center justify-between py-2`}>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-4 border border-white/40"
              style={{
                background:
                  "linear-gradient(to bottom, #FF9933 33.33%, white 33.33% 66.66%, #138808 66.66%)",
              }}
              aria-hidden
            />
            <span className="tracking-tight">Government of India</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#main" className="hover:underline underline-offset-2">Skip to Main Content</a>
            <FontSizeGroup />
            <span aria-hidden>🔊</span><span className="hidden sm:inline">More</span>
          </div>
        </div>
      </header>

      {/* Primary nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className={`${container} flex items-center justify-between py-3`}>
          <Link to="/" className="flex items-center gap-3" aria-label="NIVRA Home">
            <img
              src="/logo.png"
              alt="NIVRA"
              className="w-20 h-20 rounded"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
            <span className="sr-only">NIVRA</span>
          </Link>

          <ul className="hidden md:flex items-center gap-8">
            <li>
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? "text-primary" : "text-[#333] hover:text-primary"
                  }`
                }
              >
                Home
              </NavLink>
            </li>
          </ul>

          <div className="flex items-center gap-3">
            <SignedOut>
              <Link to="/sign-in" state={{ from: pathname }} className="btn btn-outline">Login</Link>
              <Link to="/sign-up" className="btn btn-primary">Signup</Link>
            </SignedOut>

            <SignedIn>
              <Link to="/app/dashboard" className="btn btn-outline">Open App</Link>
              <UserButton appearance={{ elements: { userButtonAvatarBox: "ring-2 ring-primary rounded-full" } }} />
            </SignedIn>
          </div>
        </div>
      </nav>

      <main id="main" className={`${container} py-10 md:py-16`}>
        <Outlet />
      </main>
    </>
  );
}
