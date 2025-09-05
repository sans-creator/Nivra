import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import NivraSplash from "./components/NivraSplash.jsx";
import Shell from "./layout/Shell.jsx";             // ⬅ public layout (header + nav)
import Landing from "./pages/Landing.jsx";          // ⬅ your landing component
import Mapping from "./pages/app/Mapping.jsx";
import AppShell from "./pages/app/AppShell.jsx";
import Dashboard from "./pages/app/Dashboard.jsx";
import NamasteCodes from "./pages/app/NamasteCodes.jsx";
import FhirBuilder from "./pages/app/FhirBuilder.jsx";
import BundleDraft from "@/pages/app/BundleDraft";
import Support from "@/pages/app/Support";

import { SignIn, SignUp } from "@clerk/clerk-react";

const SPLASH_KEY = "nivra:splashShown";

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const already = window.sessionStorage.getItem(SPLASH_KEY);
    if (!already) {
      setShowSplash(true);
      const t = setTimeout(() => {
        setShowSplash(false);
        window.sessionStorage.setItem(SPLASH_KEY, "1");
      }, 2400);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <>
      {/* Splash only once per session */}
      <AnimatePresence mode="wait">
        {showSplash && <NivraSplash onDone={() => setShowSplash(false)} />}
      </AnimatePresence>

      <Routes location={location} key={location.pathname}>
        {/* PUBLIC SITE */}
        <Route element={<Shell />}>
          <Route path="/" element={<Landing />} />             {/* ⬅ now landing shows at root */}
          <Route path="/sign-in" element={<SignIn routing="path" path="/sign-in" />} />
          <Route path="/sign-up" element={<SignUp routing="path" path="/sign-up" />} />
        </Route>

        {/* APP (after login) */}
        <Route path="/app" element={<AppShell />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="codes" element={<NamasteCodes />} />
          <Route path="mapping" element={<Mapping />} />
          <Route path="fhir" element={<FhirBuilder />} />
          <Route path="bundle-draft" element={<BundleDraft />} />
          <Route path="support" element={<Support />} /> 
        </Route>

        {/* 404 */}
        <Route path="*" element={<div className="p-8 text-center text-gray-600">Not Found</div>} />
      </Routes>
    </>
  );
}
