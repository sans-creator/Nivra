import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn } from "@clerk/clerk-react";

export default function AppLayout() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>

      <SignedIn>
        {/* App navbar */}
        <div className="bg-white border-b border-gray-200">
          <div className="wrap py-3 flex items-center gap-6">
            <NavLink to="/app/dashboard" className={({isActive}) => `text-sm font-medium ${isActive?"text-primary":"text-[#333] hover:text-primary"}`}>Dashboard</NavLink>
            <NavLink to="/app/namaste-codes" className={({isActive}) => `text-sm font-medium ${isActive?"text-primary":"text-[#333] hover:text-primary"}`}>Namaste Codes</NavLink>
            <NavLink to="/app/support" className={({isActive}) => `text-sm font-medium ${isActive?"text-primary":"text-[#333] hover:text-primary"}`}>Support</NavLink>
          </div>
        </div>

        <main className="wrap py-10 md:py-16">
          <Outlet />
        </main>
      </SignedIn>
    </>
  );
}
