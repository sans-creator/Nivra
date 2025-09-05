import React from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";

export default function Shell() {
  const { pathname } = useLocation();

  return (
    <>
      {/* Top header */}
      <header className="bg-primary text-white text-[12px]">
        <div className="wrap flex items-center justify-between py-2">
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
            <button className="hover:underline underline-offset-2">Skip to Main Content</button>
            <div className="hidden sm:flex items-center gap-1 opacity-90">
              <span>A-</span><span>A</span><span>A+</span>
            </div>
            <span aria-hidden>🔊</span><span className="hidden sm:inline">More</span>
          </div>
        </div>
      </header>

      {/* Primary nav */}
      <nav className="bg-white border-b border-gray-200">
        <div className="wrap flex items-center justify-between py-3">
          <Link to="/" className="flex items-center gap-3" aria-label="NIVRA Home">
            {/* If you have a real logo, place it at /public/logo.png; the colored block is a fallback */}
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
              <UserButton
                appearance={{
                  elements: { userButtonAvatarBox: "ring-2 ring-primary rounded-full" },
                }}
              />
            </SignedIn>
          </div>
        </div>
      </nav>

      <main id="main" className="wrap py-10 md:py-16">
        <Outlet />
      </main>
    </>
  );
}
