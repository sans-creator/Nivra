// src/layout/AuthLayout.jsx
import { Link, Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* slimmer header for auth pages (optional) */}
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" className="h-7 w-7" alt="NIVRA" />
            <span className="font-semibold">NIVRA</span>
          </div>
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">Home</Link>
        </div>
      </header>

      {/* center the auth card */}
      <main className="mx-auto max-w-6xl px-4">
        <div className="min-h-[calc(100vh-56px)] grid place-items-center">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
