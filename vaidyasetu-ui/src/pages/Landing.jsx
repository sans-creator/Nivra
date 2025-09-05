// src/pages/Landing.jsx
import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { SignedIn, SignedOut } from "@clerk/clerk-react";

// HERO photo you provided
import heroClinic from "@/assets/clinic-hero.jpg";

// marquee images (m1 -> m10)
import m1 from "@/assets/m1.jpeg";
import m2 from "@/assets/m2.jpeg";
import m3 from "@/assets/m3.jpeg";
import m4 from "@/assets/m4.jpeg";
import m5 from "@/assets/m5.jpeg";
import m6 from "@/assets/m6.jpeg";
import m7 from "@/assets/m7.jpeg";
import m8 from "@/assets/m8.jpeg";
import m9 from "@/assets/m9.jpeg";
import m10 from "@/assets/m10.png";

const logos = [m1, m2, m3, m4, m5, m6, m7, m8, m9, m10];

export default function Landing() {
  return (
    <>
      {/* local keyframes for the marquee */}
      <style>{`
        @keyframes marqueeX { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .marquee-track { animation: marqueeX 28s linear infinite; }
      `}</style>

      {/* HERO (Aurora + Glass) */}
      <section
        className="relative rounded-[28px] md:rounded-[40px] px-6 md:px-10 py-14 md:py-20 overflow-hidden mb-16 md:mb-20"
        style={{
          background:
            "radial-gradient(60% 40% at 14% 8%, rgba(143,211,201,.45) 0%, rgba(143,211,201,0) 60%)," +
            "radial-gradient(52% 38% at 86% 24%, rgba(74,155,142,.35) 0%, rgba(74,155,142,0) 60%)," +
            "radial-gradient(46% 32% at 62% 86%, rgba(47,127,115,.22) 0%, rgba(47,127,115,0) 60%)," +
            "linear-gradient(180deg, #f7faf9 0%, #f2f7f6 100%)",
        }}
      >
        {/* soft blobs */}
        <div
          className="pointer-events-none absolute -top-10 -left-10 w-64 h-64 rounded-full blur-2xl opacity-30"
          style={{ background: "radial-gradient(circle at 30% 30%, #8fd3c9, transparent 60%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-14 right-0 w-72 h-72 rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle at 70% 50%, #4a9b8e, transparent 65%)" }}
        />

        <div className="grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-16 items-center relative">
          {/* LEFT: headline + CTAs */}
          <div>
            <motion.h1
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-semibold leading-tight text-[#1f2937]"
            >
              Speaking the Same Language of Health —{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(135deg, var(--primary), #2f7f73)" }}
              >
                Locally and Globally
              </span>
            </motion.h1>

            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="mt-3 text-[16px] text-[#4b5563] max-w-[640px]"
            >
              A multilingual, AI-assisted layer with <b>NAMASTE</b> & <b>ICD-11</b>, an opinionated
              <b> FHIR Condition Builder</b>, and a clean mapping workflow for everyday clinicians.
            </motion.p>

            <motion.div
              className="flex flex-wrap gap-3 mt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <SignedIn>
                <Link
                  to="/app/dashboard"
                  className="px-5 py-2.5 rounded-md text-sm font-semibold shadow-md"
                  style={{ color: "#fff", backgroundImage: "linear-gradient(135deg, var(--primary), #2f7f73)" }}
                >
                  View Dashboard
                </Link>
              </SignedIn>

              <SignedOut>
                <Link
                  to="/sign-in"
                  className="px-5 py-2.5 rounded-md text-sm font-semibold shadow-md"
                  style={{ color: "#fff", backgroundImage: "linear-gradient(135deg, var(--primary), #2f7f73)" }}
                >
                  Get Started
                </Link>
              </SignedOut>

              <a href="#features" className="btn btn-outline btn-lg">Learn more</a>
            </motion.div>
          </div>

          {/* RIGHT: Your photo in a circular frame with elegant arcs + floating pills */}
          <motion.div
            className="relative mx-auto w-[88vw] max-w-[560px] aspect-square"
            initial={{ scale: 0.97, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {/* circular image */}
            <div className="absolute inset-[18px] rounded-full overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,.12)]">
              <img
                src={heroClinic}
                alt="Clinic handover with EHR"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>

            {/* elegant orange arcs via SVG (two strokes) */}
            <svg className="absolute inset-0" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
              {/* outer arc */}
              <circle
                cx="50" cy="50" r="48"
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="1.6"
                strokeDasharray="110 455" // (arc length, gap) tweak for taste
                transform="rotate(-18 50 50)"
                opacity="0.9"
              />
              {/* inner subtle arc */}
              <circle
                cx="50" cy="50" r="42"
                fill="transparent"
                stroke="#fde68a"
                strokeWidth="1.2"
                strokeDasharray="85 420"
                transform="rotate(32 50 50)"
                opacity="0.9"
              />
            </svg>

            {/* floating feature pills */}
            <FeaturePill top="6%" left="26%" icon="shield" label="ABHA" sub="Integration" />
            <FeaturePill top="21%" right="4%" icon="translate" label="Multilingual" sub="Interface" />
            <FeaturePill bottom="18%" left="2%" icon="stethoscope" label="Consult Doctor" sub="Remotely" />
            <FeaturePill bottom="6%" right="6%" icon="medication" label="Allopathic & AYUSH" sub="Health Services" />
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="features" className="mb-12 md:mb-16">
        <h2 className="text-center text-2xl md:text-[28px] font-semibold text-[#111827]">How it works</h2>
        <p className="max-w-[760px] mx-auto text-[15px] text-[#6b7280] mt-2 text-center">
          Import local datasets → map <b>NAMASTE ⇄ ICD-11</b> with AI assist → prefill the{" "}
          <b>FHIR Condition</b> builder → export a clean bundle. All in your browser.
        </p>

        <div className="grid md:grid-cols-3 gap-6 mt-8">
          {[
            ["AI-assisted Mapping", "Side-by-side candidates for NAMASTE ⇄ ICD-11 (TM2/Biomed) with confidence and Approve/Reject."],
            ["FHIR Condition Builder", "One-click prefill from a mapping; set clinical & verification statuses; copy JSON to your system."],
            ["Multilingual UX", "Clinician-friendly terms and patient-facing translations for major Indian languages."],
          ].map(([title, desc], i) => (
            <motion.article
              key={title}
              initial={{ y: 16, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: i * 0.05 }}
              className="p-6 rounded-2xl border border-gray-200/70 bg-white/70 backdrop-blur shadow-[0_6px_24px_rgba(0,0,0,.06)] hover:-translate-y-0.5 hover:shadow-lg transition"
            >
              <h3 className="text-[16px] font-semibold text-[#111827] mb-1">{title}</h3>
              <p className="text-[14px] text-[#6b7280] leading-relaxed">{desc}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* METRICS / VALUE */}
      <section className="mb-16 md:mb-20">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            ["< 10 min", "to first usable mapping"],
            ["3+ vocabularies", "NAMASTE, ICD-11 TM2, ICD-11 Biomed"],
            ["Local-first", "no PHI leaves your browser"],
          ].map(([big, small]) => (
            <div key={small} className="rounded-2xl bg-white/70 backdrop-blur border border-white/70 p-6 text-center shadow-[0_6px_24px_rgba(0,0,0,.05)]">
              <div className="text-2xl font-semibold" style={{ color: "var(--primary)" }}>{big}</div>
              <div className="text-sm text-[#6b7280] mt-1">{small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST (refined, professional) */}
      <section className="relative mt-16 md:mt-20">
        <div
          className="absolute left-1/2 top-0 h-px w-[64%] -translate-x-1/2"
          style={{ background: "linear-gradient(90deg, transparent, rgba(74,155,142,.35), transparent)" }}
        />
        <div className="text-center mb-10">
          <span
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs tracking-wide"
            style={{ borderColor: "rgba(0,0,0,.05)", color: "var(--primary)", background: "rgba(74,155,142,.08)" }}
          >
            <span className="material-symbols-outlined text-[16px]">verified_user</span>
            Trust
          </span>
          <h2 className="mt-3 text-[26px] md:text-[30px] font-semibold tracking-tight text-[#111827]">
            Security & Governance built-in
          </h2>
          <p className="mt-2 text-[13.5px] md:text-[14px] text-[#6b7280]">
            Local-first architecture, auditable actions, and standards-compliant outputs for clinical workloads.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <TrustCard
            icon="shield_lock"
            title="Local-first processing"
            desc="Mapping, AI prompts and FHIR JSON execute in the browser. No PHI leaves your device."
          />
          <TrustCard
            icon="admin_panel_settings"
            title="Role-based access"
            desc="Clerk auth, audit stream, and explicit mapping approvals deliver user-level traceability."
          />
          <TrustCard
            icon="rule_settings"
            title="Standards by design"
            desc="NAMASTE & ICD-11 (TM2/Biomed) vocabularies with HL7 FHIR R4 Condition export."
          />
        </div>
      </section>

      {/* gradient divider */}
      <div
        className="mt-16 h-[2px] rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, rgba(74,155,142,.4), transparent)" }}
      />

      {/* LOGO MARQUEE (footer strip) */}
      <section className="mt-10 mb-6">
        <div className="text-center text-sm text-[#6b7280] mb-3">
          Trusted by teams piloting NAMASTE ⇄ ICD-11 mapping
        </div>
        <div className="relative overflow-hidden rounded-xl border border-white/70 bg-white/70 backdrop-blur">
          <div className="flex marquee-track" style={{ width: "200%", willChange: "transform" }}>
            {[0, 1].map((dup) => (
              <div key={dup} className="flex items-center gap-10 px-8 py-4" style={{ width: "50%" }}>
                {logos.map((src, i) => (
                  <img
                    key={`${dup}-${i}`}
                    src={src}
                    alt={`partner-${i + 1}`}
                    className="h-12 w-auto rounded-md object-cover shadow-sm border border-white/70"
                    loading="lazy"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="mt-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-[#6b7280]">
          <div>© {new Date().getFullYear()} Nivra • Terminology & FHIR tooling</div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/app/support" className="hover:text-[#111827]">Support</Link>
            <Link to="/app/mapping" className="hover:text-[#111827]">Mapping</Link>
            <Link to="/app/fhir" className="hover:text-[#111827]">FHIR Builder</Link>
            <a href="#features" className="hover:text-[#111827]">Features</a>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ---------- small atoms ---------- */

function FeaturePill({ top, right, bottom, left, icon = "info", label, sub }) {
  return (
    <div
      className="absolute"
      style={{ top, right, bottom, left }}
    >
      <div className="rounded-[18px] border border-white/70 bg-white/90 backdrop-blur px-4 py-2 shadow-[0_10px_30px_rgba(0,0,0,.08)]">
        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-full"
            style={{ background: "rgba(74,155,142,.10)", color: "var(--primary)" }}
          >
            <span className="material-symbols-outlined text-[18px]">
              {icon === "shield" ? "shield" : icon === "translate" ? "translate" : icon === "stethoscope" ? "clinical_notes" : icon === "medication" ? "medication" : "info"}
            </span>
          </span>
          <div className="text-[13.5px] text-[#111827] font-medium leading-tight">
            {label}
            {sub ? <div className="text-[12px] text-[#6b7280] -mt-0.5">{sub}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrustCard({ icon, title, desc }) {
  return (
    <article className="group rounded-2xl border border-gray-200/80 bg-white/70 backdrop-blur-sm p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start gap-4">
        <div className="shrink-0">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl border shadow-inner"
            style={{
              background: "linear-gradient(135deg, rgba(74,155,142,.10), rgba(143,211,201,.12))",
              borderColor: "rgba(255,255,255,.8)",
            }}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: "var(--primary)" }}>
              {icon}
            </span>
          </div>
        </div>
        <div>
          <h3 className="text-[15px] font-semibold text-[#111827]">{title}</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[#6b7280]">{desc}</p>
        </div>
      </div>
    </article>
  );
}
