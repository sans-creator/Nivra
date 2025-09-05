import React from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import BackgroundFX from "@/components/BackgroundFX";

// shared class builder for all nav links
const linkClass = ({ isActive }) =>
  `nav-pill ${isActive ? "nav-pill--active" : "nav-pill--idle"}`;

export default function AppShell() {
  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Background */}
      <BackgroundFX />

      {/* Glass Header */}
      <header className="sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-3 mt-3">
          <div className="glass rounded-xl h-14 px-4 sm:px-6 flex items-center justify-between">
            {/* Logo (click -> landing) */}
            <Link to="/" className="flex items-center gap-3">
              {/* Use your logo; no green box */}
              <img src="/logo.png" alt="Nivra" className="h-20 w-auto" />
              <span className="sr-only">Nivra Home</span>
            </Link>

            {/* Nav */}
            <nav className="flex items-center gap-1">
              <NavLink to="/app/dashboard" className={linkClass}>
                Dashboard
              </NavLink>
              <NavLink to="/app/codes" className={linkClass}>
                Namaste Codes
              </NavLink>
              <NavLink to="/app/mapping" className={linkClass}>
                Mapping
              </NavLink>
              <NavLink to="/app/fhir" className={linkClass}>
                FHIR Builder
              </NavLink>
              <NavLink to="/app/bundle-draft" className={linkClass}>
  Bundle Draft
</NavLink>
              <NavLink to="/app/support" className={linkClass}>
                Support
              </NavLink>

            </nav>
          </div>
        </div>
      </header>

      {/* Page body */}
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
