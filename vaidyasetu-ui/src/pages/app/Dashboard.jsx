// src/pages/app/Dashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { loadAudit, subscribeAudit } from "@/lib/audit";
import { geminiText, geminiJSON } from "@/lib/gemini";

/** Brand palette */
const COLORS = { primary: "#4a9b8e", text: "#333", sub: "#666" };

/* ------------ storage keys ------------ */
const MAPPING_KEY = "vs_mappings_v1";
const FHIR_PREFILL_KEY = "vs_fhir_prefill_v1";
const BUNDLE_DRAFT_KEY = "vs_bundle_draft_v1";

/* ------------ utils ------------ */
const fmt = new Intl.DateTimeFormat("en-IN", {
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: true,
});
const formatDate = (d) => {
  const parts = fmt.formatToParts(d).reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
}
function loadMappingsSafe() {
  try { const v = JSON.parse(localStorage.getItem(MAPPING_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveMappingsSafe(arr) { localStorage.setItem(MAPPING_KEY, JSON.stringify(arr)); }
function loadBundleDraft() {
  try { const v = JSON.parse(localStorage.getItem(BUNDLE_DRAFT_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveBundleDraft(arr) { localStorage.setItem(BUNDLE_DRAFT_KEY, JSON.stringify(arr)); }

/* ------------ translation fallback dict ------------ */
const HI_FALLBACK = {
  Headache: "सर दर्द",
  "Body Pain": "शरीर दर्द",
  Stomachache: "पेट दर्द",
  Fever: "बुखार",
  Cold: "जुकाम",
  Cough: "खांसी",
};

/* ===================================== Page ===================================== */
export default function Dashboard() {
  const [codes, setCodes] = useState([]);
  const [activity, setActivity] = useState([]); // [timestamp, user, action, details]
  const [kpi, setKpi] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  // modals
  const [openSearch, setOpenSearch] = useState(false);
  const [openTranslate, setOpenTranslate] = useState(false);
  const [openCSV, setOpenCSV] = useState(false);
  const [openFHIR, setOpenFHIR] = useState(false);

  // AI modals
  const [openAIInsights, setOpenAIInsights] = useState(false);
  const [openAIAsk, setOpenAIAsk] = useState(false);
  const [openAICodes, setOpenAICodes] = useState(false);

  // AI state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [askPrompt, setAskPrompt] = useState("");
  const [askAnswer, setAskAnswer] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiCodes, setAiCodes] = useState(null);

  // translate
  const [srcText, setSrcText] = useState("");
  const [translation, setTranslation] = useState("");

  // ingest status
  const [ingestInfo, setIngestInfo] = useState(null);

  /* ------------ load data ------------ */
  useEffect(() => {
    let mounted = true;
    const rowsFromAudit = (list) => list.map((e) => [e.timestamp, e.user, e.action, e.details]);

    (async () => {
      try {
        const res = await fetch("/datasets/seed.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!mounted) return;
          setCodes(Array.isArray(data.codes) ? data.codes : []);
          setKpi(Array.isArray(data.kpi_daily) ? data.kpi_daily : []);

          const datasetActivity = Array.isArray(data.activity)
            ? data.activity.map((r) => (Array.isArray(r) ? r : [r.timestamp, r.user, r.action, r.details]))
            : [];
          setActivity([...rowsFromAudit(loadAudit()), ...datasetActivity]);
          setLoading(false);
          return;
        }

        const [codesCsv, actCsv, kpiCsv] = await Promise.allSettled([
          fetch("/datasets/codes.csv", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")),
          fetch("/datasets/activity.csv", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")),
          fetch("/datasets/kpi_daily.csv", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")),
        ]);

        if (!mounted) return;

        if (codesCsv.status === "fulfilled" && codesCsv.value) {
          const rows = parseCSV(codesCsv.value);
          setCodes(
            rows.map((r) => ({
              code: r.code,
              term: r.term,
              system: r.system,
              mapped: String(r.mapped || "").toLowerCase() === "true",
              created_at: r.created_at,
              updated_at: r.updated_at,
            }))
          );
        }

        const merged = [...rowsFromAudit(loadAudit())];
        if (actCsv.status === "fulfilled" && actCsv.value) {
          const rows = parseCSV(actCsv.value);
          merged.push(
            ...rows
              .map((r) => [r.timestamp, r.user, r.action, r.details])
              .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
          );
        }
        setActivity(merged);

        if (kpiCsv.status === "fulfilled" && kpiCsv.value) {
          const rows = parseCSV(kpiCsv.value);
          setKpi(
            rows.map((r) => ({
              date: r.date,
              total_codes: Number(r.total_codes || 0),
              mapped_codes: Number(r.mapped_codes || 0),
              mapping_coverage_pct: Number(r.mapping_coverage_pct || 0),
              tm2_cached: Number(r.tm2_cached || 0),
              biomed_cached: Number(r.biomed_cached || 0),
              icd11_release: r.icd11_release || "2025-08",
            }))
          );
        }

        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setLoadErr(e?.message || "Failed to load datasets");
        setActivity(rowsFromAudit(loadAudit()));
        setLoading(false);
      }
    })();

    const unsub = subscribeAudit((list) => {
      setActivity((current) => [...list.map((e) => [e.timestamp, e.user, e.action, e.details]), ...current]);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  /* ------------ derived KPIs ------------ */
  const latest = kpi.length ? kpi[kpi.length - 1] : null;
  const totalCodes = latest ? latest.total_codes : codes.length;
  const mapped = latest ? latest.mapped_codes : codes.filter((c) => c.mapped).length;
  const coverage = latest ? latest.mapping_coverage_pct : Math.round((mapped / Math.max(1, totalCodes)) * 100);
  const tm2Cached = latest ? latest.tm2_cached : codes.filter((c) => c.system === "TM2").length * 500;
  const biomedCached = latest ? latest.biomed_cached : codes.filter((c) => (c.system || "").startsWith("BIO")).length * 500;
  const icdRelease = latest ? latest.icd11_release : "2025-08";

  /* ------------ filters ------------ */
  const filteredActivity = useMemo(() => {
    if (!searchQuery.trim()) return activity;
    const q = searchQuery.toLowerCase();
    return activity.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
  }, [activity, searchQuery]);

  /* ------------ quick actions ------------ */
  const handleRunSearch = (term) => {
    const q = (term || searchQuery).trim();
    if (!q) return;
    const row = [formatDate(new Date()), "You", "Code Search", `Searched for '${q}'`];
    setActivity((a) => [row, ...a]);
    setOpenSearch(true);
  };

  /** TRANSLATE: Gemini first, else fallback dictionary */
  const handleTranslate = async () => {
    const input = srcText.trim();
    if (!input) return;

    const tryGemini = Boolean(import.meta?.env?.VITE_GEMINI_API_KEY);
    let out = "";
    if (tryGemini) {
      try {
        const prompt = `Translate the following medical term to Hindi (hi-IN). Return ONLY the translated term, no quotes, no extra text:\n\n${input}`;
        out = (await geminiText(prompt)).trim();
      } catch (e) {
        setAiError(e?.message || "Gemini translation error; using fallback.");
      }
    }
    if (!out) out = HI_FALLBACK[input] || `${input} (→ hi-IN)`;

    setTranslation(out);
    setActivity((a) => [[formatDate(new Date()), "You", "Translation", `Translated '${input}' → '${out}'`], ...a]);
  };

  /** CSV INGEST: codes.csv or mappings.csv with FHIR prefill */
  const handleIngestCSV = async (file) => {
    if (!file) return;
    const text = await file.text();
    const rows = parseCSV(text);
    if (!rows.length) {
      setActivity((a) => [[formatDate(new Date()), "System", "CSV Ingestion", `No rows in ${file.name}`], ...a]);
      setIngestInfo({ type: "empty", added: 0 });
      return;
    }

    const headersLower = Object.keys(rows[0] || {}).map((h) => (h || "").toLowerCase());
    const hasCodesHeaders =
      headersLower.includes("code") && headersLower.includes("term") && headersLower.includes("system");
    const hasMappingHeaders =
      (headersLower.includes("namaste") || headersLower.includes("namaste_code")) &&
      (headersLower.includes("tm2") || headersLower.includes("tm2_code") || headersLower.includes("icd11_tm2")) &&
      (headersLower.includes("biomed") || headersLower.includes("biomed_code") || headersLower.includes("icd11_biomed"));

    // A) codes.csv
    if (hasCodesHeaders && !hasMappingHeaders) {
      const toAdd = rows
        .map((r) => ({
          code: r.code || "",
          term: r.term || "",
          system: r.system || "NAMASTE",
          mapped: String(r.mapped || "").toLowerCase() === "true",
          created_at: r.created_at || undefined,
          updated_at: r.updated_at || undefined,
        }))
        .filter((r) => r.code && r.term);

      setCodes((prev) => [...toAdd, ...prev]);
      setActivity((a) => [[formatDate(new Date()), "System", "CSV Ingestion", `Added ${toAdd.length} codes from ${file.name}`], ...a]);
      setIngestInfo({ type: "codes", added: toAdd.length });
      return;
    }

    // B) mappings.csv
    if (hasMappingHeaders) {
      const namasteKey = headersLower.includes("namaste") ? "namaste" : "namaste_code";
      const tm2Key = headersLower.includes("tm2") ? "tm2" : headersLower.includes("tm2_code") ? "tm2_code" : "icd11_tm2";
      const biomedKey = headersLower.includes("biomed") ? "biomed" : headersLower.includes("biomed_code") ? "biomed_code" : "icd11_biomed";

      const now = new Date().toISOString();
      const existing = loadMappingsSafe();
      let added = 0;
      let firstPrefill = null;
      const next = [...existing];

      const makeId = (srcSys, src, dstSys, dst) => `${srcSys}:${src}__${dstSys}:${dst}`;
      const pushOnce = (rec) => {
        if (!next.find((x) => x.id === rec.id)) { next.unshift(rec); added++; }
      };

      rows.forEach((r) => {
        const namaste = (r[namasteKey] || "").trim();
        const tm2 = (r[tm2Key] || "").trim();
        const biomed = (r[biomedKey] || "").trim();
        if (!namaste && !tm2 && !biomed) return;

        if (namaste && tm2) {
          pushOnce({
            id: makeId("NAMASTE", namaste, "TM2", tm2),
            fromSystem: "NAMASTE",
            source: { system: "NAMASTE", code: namaste, term: "—" },
            dest: { system: "TM2", code: tm2, term: "—" },
            score: 1,
            createdAt: now,
          });
        }
        if (namaste && biomed) {
          pushOnce({
            id: makeId("NAMASTE", namaste, "BIO", biomed),
            fromSystem: "NAMASTE",
            source: { system: "NAMASTE", code: namaste, term: "—" },
            dest: { system: "BIO", code: biomed, term: "—" },
            score: 1,
            createdAt: now,
          });
        }
        if (!firstPrefill && (namaste || tm2 || biomed)) {
          firstPrefill = { namaste: namaste || "", tm2: tm2 || "", biomed: biomed || "" };
        }
      });

      saveMappingsSafe(next);
      setActivity((a) => [[formatDate(new Date()), "System", "CSV Ingestion", `Imported ${added} mapping rows from ${file.name}`], ...a]);
      if (firstPrefill) localStorage.setItem(FHIR_PREFILL_KEY, JSON.stringify(firstPrefill));
      setIngestInfo({ type: "mappings", added, prefill: firstPrefill || undefined });
      return;
    }

    setActivity((a) => [[formatDate(new Date()), "System", "CSV Ingestion", `Unrecognized columns in ${file.name}`], ...a]);
    setIngestInfo({ type: "unknown", added: 0 });
  };

  /** FHIR UPLOAD: accept Bundle or Condition; store into vs_bundle_draft_v1 */
  const handleUploadFHIR = async (file) => {
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      let message = "";
      let added = 0;
      let draft = loadBundleDraft();

      if (json?.resourceType === "Bundle") {
        const count = Array.isArray(json.entry) ? json.entry.length : 0;
        // Normalize: store entries (array of {resource})
        if (count > 0) {
          // flatten resources into our draft store as-is
          json.entry.forEach((e) => {
            if (e && e.resource) draft.unshift({ resource: e.resource });
          });
          added = count;
        }
        message = `Uploaded Bundle with ${count} ${count === 1 ? "entry" : "entries"}`;
      } else if (json?.resourceType === "Condition") {
        // Wrap single Condition as one draft entry
        draft.unshift({ resource: json });
        added = 1;
        message = "Uploaded single Condition (wrapped into draft)";
      } else {
        setActivity((a) => [[formatDate(new Date()), "System", "FHIR Upload", "Invalid resourceType"], ...a]);
        return;
      }

      saveBundleDraft(draft);
      setActivity((a) => [[formatDate(new Date()), "System", "FHIR Upload", message], ...a]);
      setOpenFHIR(false);
      // Tiny toast effect via CSV modal panel
      setIngestInfo({ type: "fhir", added, detail: message });
    } catch {
      setActivity((a) => [[formatDate(new Date()), "System", "FHIR Upload", "Invalid JSON"], ...a]);
    }
  };
async function runAIInsights() {
  try {
    setAiError("");
    setAiBusy(true);
    setOpenAIInsights(true);

    // recent 8 lines of activity for context
    const recent = filteredActivity
      .slice(0, 8)
      .map((r) => `- ${r[0]} · ${r[2]} · ${r[3]}`)
      .join("\n"); // <- make sure this line is complete

    const prompt = `
You are a health terminology assistant. Briefly summarize the current system health and any notable trends.
KPIs:
- Total codes: ${totalCodes}
- Mapped: ${mapped}
- Coverage: ${coverage}%
- TM2 cached: ${tm2Cached}
- Biomed cached: ${biomedCached}
- ICD-11 release: ${icdRelease}

Recent activity (most recent first):
${recent || "(no recent activity)"}

In 5-7 concise bullet points: call out risks, progress, anomalies, and next best actions. Keep it crisp.
`.trim();

    const out = await geminiText(prompt);
    setAiSummary(out);
  } catch (e) {
    setAiError(e?.message || "Gemini error");
  } finally {
    setAiBusy(false);
  }
}


  async function runAIAsk() {
    if (!askPrompt.trim()) return;
    try {
      setAiError(""); setAiBusy(true); setOpenAIAsk(true);
      const snapshot = JSON.stringify(
        { kpi: { totalCodes, mapped, coverage, tm2Cached, biomedCached, icdRelease }, sampleActivity: filteredActivity.slice(0, 16) },
        null, 2
      );
      const prompt = `
You help analyze a terminology mapping system. Question: ${askPrompt}

Context JSON (summarize and reason with it; do not reprint it):
${snapshot}

Answer clearly in short paragraphs or bullets. If math is used, show the steps briefly.
      `.trim();
      const out = await geminiText(prompt);
      setAskAnswer(out);
    } catch (e) {
      setAiError(e?.message || "Gemini error");
    } finally { setAiBusy(false); }
  }

  async function runAICodeSuggest() {
    if (!aiInput.trim()) return;
    try {
      setAiError(""); setAiBusy(true); setOpenAICodes(true);
      const sys = `Return ONLY valid JSON with arrays.
Schema: {"namaste": string[], "tm2": string[], "biomed": string[]}`;
      const usr = `Suggest code candidates for "${aiInput}". Include the best 3 per array when possible.`;
      const json = await geminiJSON(sys, usr);
      setAiCodes(json);
    } catch (e) {
      setAiError(e?.message || "Gemini error");
    } finally { setAiBusy(false); }
  }

  /* ------------ UI ------------ */
  if (loading) {
    return (
      <div className="grid place-items-center h-64 text-[#666]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading datasets…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {loadErr && (
        <div className="glass-soft rounded-xl px-4 py-3 text-amber-900 border-amber-200 bg-amber-50/80">
          Failed to load datasets: {loadErr}. Using whatever loaded successfully.
        </div>
      )}

      {/* Header */}
      <div className="glass rounded-xl px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: COLORS.text }}>Dashboard</h1>
          <p className="text-sm" style={{ color: COLORS.sub }}>Overview of your terminology system health and activity.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2" style={{ color: COLORS.sub }}>search</span>
            <input
              className="pl-10 pr-3 py-2 rounded-md border border-white/50 bg-white/60 backdrop-blur focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
              placeholder="Search activity…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRunSearch(e.currentTarget.value)}
            />
          </div>
          <button className="btn-glass" onClick={() => handleRunSearch(searchQuery)}>Search</button>
        </div>
      </div>

      {/* KPIs */}
      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: COLORS.text }}>Key Performance Indicators</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <GlassStatCard label="NAMASTE Version" value="v1.2.3" icon="verified" />
          <GlassStatCard label="Total Codes" value={totalCodes.toLocaleString()} icon="data_object" />
          <GlassStatCard label="ICD-11 Released" value={icdRelease} icon="event" />
          <GlassStatCard label="TM2 Cached" value={tm2Cached.toLocaleString()} icon="bolt" />
          <GlassStatCard label="Biomed Cached" value={biomedCached.toLocaleString()} icon="science" />
          <GlassStatCard label="Mapping Coverage" value={`${coverage}%`} icon="percent" />
          <GlassStatCard label="Sync Health" value="Good" icon="health_and_safety" positive />
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-lg font-semibold" style={{ color: COLORS.text }}>Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <GlassAction icon="auto_awesome" label={aiBusy ? "Working…" : "AI Insights"} onClick={runAIInsights} />
          <GlassAction icon="chat" label="Ask AI" onClick={() => { setOpenAIAsk(true); setAskAnswer(""); setAiError(""); }} />
          <GlassAction icon="psychology" label="AI Code Suggest" onClick={() => { setOpenAICodes(true); setAiCodes(null); setAiError(""); }} />
          <GlassAction icon="search" label="Search Codes" onClick={() => setOpenSearch(true)} />
          <GlassAction icon="translate" label="Translate" onClick={() => setOpenTranslate(true)} />
          <GlassAction icon="upload_file" label="Ingest CSV" onClick={() => setOpenCSV(true)} />
          <GlassAction icon="medical_services" label="Upload FHIR Bundle" onClick={() => setOpenFHIR(true)} />
        </div>
      </section>

      {/* Activity */}
      <section>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-lg font-semibold" style={{ color: COLORS.text }}>Activity / Audit Stream</h2>
          <Chip icon="schedule">{latest?.date?.slice(0, 7) || "Aug 2025"}</Chip>
        </div>
        <div className="overflow-hidden rounded-2xl glass-soft">
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-[1] bg-white/80 backdrop-blur border-b">
                <tr className="text-left text-[var(--text)]">
                  {["Timestamp", "User", "Action", "Details"].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-white/60">
                {filteredActivity.map((row, idx) => (
                  <tr key={idx} className="text-[#555]">
                    {row.map((cell, i) => (
                      <td key={i} className="px-5 py-3 whitespace-nowrap">{cell}</td>
                    ))}
                  </tr>
                ))}
                {!filteredActivity.length && (
                  <tr>
                    <td colSpan={4} className="px-5 py-5 text-center text-[#666]">No activity found for “{searchQuery}”.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Modals */}
      <Modal open={openSearch} onClose={() => setOpenSearch(false)} title="Search Codes">
        <CodeSearch codes={codes} onSearch={(term) => handleRunSearch(term)} />
      </Modal>

      <Modal
        open={openTranslate}
        onClose={() => setOpenTranslate(false)}
        title="Translate Term"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setOpenTranslate(false)}>Close</button>
            <button className="btn-glass" onClick={handleTranslate}>Translate</button>
          </div>
        }
      >
        <div className="grid gap-3">
          <input
            className="border rounded px-3 py-2 bg-white/70 backdrop-blur"
            placeholder="Enter medical term in English"
            value={srcText}
            onChange={(e) => setSrcText(e.target.value)}
          />
          <div className="text-sm text-[#666]">Target: <strong>Hindi (hi-IN)</strong></div>
          {translation && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
              <span className="font-medium">Result:</span> {translation}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={openCSV}
        onClose={() => { setOpenCSV(false); setIngestInfo(null); }}
        title="Ingest CSV"
      >
        <div className="grid gap-3">
          <p className="text-sm text-[#666]">
            Upload <b>codes.csv</b> (<code>code, term, system, mapped</code>)<br />
            or <b>mappings.csv</b> (<code>namaste, tm2, biomed</code>).
          </p>
          <input type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleIngestCSV(f); }} />

          {ingestInfo && (
            <div className="rounded-lg border border-white/60 bg-white/60 backdrop-blur p-3 text-sm">
              {ingestInfo.type === "codes" && (
                <>
                  <div className="font-medium text-[var(--text)]">Codes ingested</div>
                  <div className="text-[#666] mt-1">Added <b>{ingestInfo.added}</b> rows to the local codes dataset.</div>
                </>
              )}
              {ingestInfo.type === "mappings" && (
                <>
                  <div className="font-medium text-[var(--text)]">Mappings imported</div>
                  <div className="text-[#666] mt-1">Stored <b>{ingestInfo.added}</b> records in <code>vs_mappings_v1</code>.</div>
                  {ingestInfo.prefill && (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
                      <div className="font-medium mb-1">FHIR prefill ready</div>
                      <div className="text-xs">
                        NAMASTE: <b>{ingestInfo.prefill.namaste || "—"}</b>
                        &nbsp;·&nbsp; TM2: <b>{ingestInfo.prefill.tm2 || "—"}</b>
                        &nbsp;·&nbsp; Biomed: <b>{ingestInfo.prefill.biomed || "—"}</b>
                      </div>
                      <div className="mt-2">
                        <button className="btn btn-primary" style={{ backgroundColor: COLORS.primary }} onClick={() => window.location.assign("/app/fhir")}>
                          Open FHIR Builder
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {ingestInfo.type === "fhir" && (
                <>
                  <div className="font-medium text-[var(--text)]">FHIR uploaded</div>
                  <div className="text-[#666] mt-1">{ingestInfo.detail}</div>
                  <div className="mt-2">
                    <button className="btn btn-primary" style={{ backgroundColor: COLORS.primary }} onClick={() => window.location.assign("/app/bundle-draft")}>
                      Open Bundle Draft
                    </button>
                  </div>
                </>
              )}
              {ingestInfo.type === "unknown" && <div className="text-[#666]">Couldn’t recognize the CSV columns.</div>}
              {ingestInfo.type === "empty" && <div className="text-[#666]">No rows found in the file.</div>}
            </div>
          )}

          <div className="text-xs text-[#666]">
            Example rows:
            <div className="mt-1"><code>XA9Z1,Fever,NAMASTE,true</code></div>
            <div><code>namaste,tm2,biomed</code></div>
            <div><code>PR123,G44.2,BA20.0</code></div>
          </div>
        </div>
        <div className="mt-4 text-sm text-[#666]">
          Current total: <span className="font-medium">{totalCodes.toLocaleString()}</span>
        </div>
      </Modal>

      <Modal open={openFHIR} onClose={() => setOpenFHIR(false)} title="Upload FHIR (Bundle or Condition)">
        <div className="grid gap-3">
          <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadFHIR(f); }} />
          <p className="text-sm text-[#666]">
            Accepts a FHIR R4 <b>Bundle</b> (<code>{"{ resourceType:'Bundle', entry:[...] }"}</code>)
            or a single <b>Condition</b> resource (will be wrapped into draft).
          </p>
        </div>
      </Modal>

      {/* AI Insights */}
      <Modal
        open={openAIInsights}
        onClose={() => setOpenAIInsights(false)}
        title="AI Insights"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setOpenAIInsights(false)}>Close</button>
            <button className="btn-glass" onClick={runAIInsights} disabled={aiBusy}>{aiBusy ? "Thinking…" : "Refresh"}</button>
          </div>
        }
      >
        {aiError && <div className="text-rose-700 text-sm mb-2">Error: {aiError}</div>}
        {!aiSummary && !aiBusy && <div className="text-sm text-[#666]">Click “Refresh” to generate insights.</div>}
        <pre className="text-sm bg-white/60 backdrop-blur rounded-md p-3 whitespace-pre-wrap">{aiSummary}</pre>
      </Modal>

      {/* Ask AI */}
      <Modal
        open={openAIAsk}
        onClose={() => setOpenAIAsk(false)}
        title="Ask AI"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setOpenAIAsk(false)}>Close</button>
            <button className="btn-glass" onClick={runAIAsk} disabled={aiBusy || !askPrompt.trim()}>{aiBusy ? "Thinking…" : "Ask"}</button>
          </div>
        }
      >
        <div className="grid gap-3">
          <textarea
            rows={3}
            className="w-full rounded-md border border-white/60 bg-white/60 backdrop-blur p-2 text-sm"
            placeholder="e.g., Why did mapping coverage drop last week? What should we do next?"
            value={askPrompt}
            onChange={(e) => setAskPrompt(e.target.value)}
          />
          {aiError && <div className="text-rose-700 text-sm">Error: {aiError}</div>}
          {askAnswer && <div className="rounded-md border border-white/60 bg-white/60 backdrop-blur p-3 text-sm whitespace-pre-wrap">{askAnswer}</div>}
        </div>
      </Modal>

      {/* AI Code Suggest */}
      <Modal
        open={openAICodes}
        onClose={() => setOpenAICodes(false)}
        title="AI Code Suggest (NAMASTE / TM2 / Biomed)"
        footer={
          <div className="flex justify-between w-full">
            <div className="text-xs text-[#666]">Tip: Enter a symptom/dx term or a code; we’ll suggest matches.</div>
            <div className="flex gap-2">
              <button className="btn btn-outline" onClick={() => setOpenAICodes(false)}>Close</button>
              <button className="btn-glass" onClick={runAICodeSuggest} disabled={aiBusy || !aiInput.trim()}>{aiBusy ? "Thinking…" : "Suggest"}</button>
            </div>
          </div>
        }
      >
        <div className="grid gap-3">
          <input
            className="w-full rounded-md border border-white/60 bg-white/60 backdrop-blur p-2 text-sm"
            placeholder='Try: "Fever", "Headache", "G44.2"'
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
          />
          {aiError && <div className="text-rose-700 text-sm">Error: {aiError}</div>}
          {aiCodes && (
            <div className="grid gap-3">
              <CodeList title="NAMASTE" items={aiCodes.namaste} color="emerald" />
              <CodeList title="ICD-11 TM2" items={aiCodes.tm2} color="sky" />
              <CodeList title="ICD-11 Biomed" items={aiCodes.biomed} color="slate" />
            </div>
          )}
          {!aiCodes && !aiBusy && <div className="text-sm text-[#666]">Click “Suggest” to fetch candidates.</div>}
        </div>
      </Modal>
    </div>
  );
}

/* ============================== UI bits ============================== */
function Modal({ open, onClose, title, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/30 px-3" onClick={onClose}>
      <div className="w-full max-w-xl glass rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/40 px-5 py-3">
          <h3 className="text-lg font-semibold text-[var(--text)]">{title}</h3>
          <button className="text-[#666] hover:text-black" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/40 px-5 py-3 bg-white/40 backdrop-blur">{footer}</div>}
      </div>
    </div>
  );
}

function Chip({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/70 backdrop-blur px-2 py-1 text-xs font-medium border border-white/60" style={{ color: COLORS.primary }}>
      <span className="material-symbols-outlined text-[16px]" aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

function GlassStatCard({ label, value, icon, positive }) {
  return (
    <div className="glass-soft rounded-2xl p-5 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm" style={{ color: COLORS.sub }}>{label}</p>
          <p className={`mt-1 text-2xl font-semibold ${positive ? "text-emerald-700" : "text-[var(--text)]"}`}>{value}</p>
        </div>
        <div className="shrink-0 grid place-items-center w-10 h-10 rounded-lg" style={{ backgroundColor: "rgba(74,155,142,.12)", color: COLORS.primary }}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function GlassAction({ icon, label, onClick }) {
  return (
    <button onClick={onClick} className="glass-soft rounded-md px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-white/70 transition">
      <span className="material-symbols-outlined align-[-3px] mr-1 text-[var(--primary)]">{icon}</span>
      {label}
    </button>
  );
}

function CodeList({ title, items = [], color = "slate" }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-2 text-[var(--text)]">{title}</div>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((x, i) => (
            <span key={`${title}-${i}-${x}`} className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border bg-white/70 backdrop-blur border-white/60 text-${color}-800`}>
              {x}
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[#666]">No suggestions yet.</div>
      )}
    </div>
  );
}

function CodeSearch({ codes, onSearch }) {
  const [term, setTerm] = useState("");
  const results = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return codes.slice(0, 50);
    return codes.filter(
      (c) =>
        (c.code || "").toLowerCase().includes(q) ||
        (c.term || "").toLowerCase().includes(q) ||
        (c.system || "").toLowerCase().includes(q)
    );
  }, [codes, term]);

  return (
    <div className="grid gap-3">
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#666]">search</span>
        <input
          className="w-full pl-10 pr-3 py-2 rounded-md border border-white/60 bg-white/60 backdrop-blur focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
          placeholder="Search code / term / system…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch(term)}
        />
      </div>

      <div className="max-h-72 overflow-auto rounded-md border border-white/60 bg-white/50 backdrop-blur">
        <table className="min-w-full text-sm">
          <thead className="bg-white/80 backdrop-blur text-[var(--text)]">
            <tr className="text-left">
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2">Term</th>
              <th className="px-3 py-2">System</th>
              <th className="px-3 py-2">Mapped</th>
            </tr>
          </thead>
          <tbody className="[&>tr:nth-child(even)]:bg-white/60">
            {results.map((c, i) => (
              <tr key={`${c.code}-${i}`} className="text-[#555]">
                <td className="px-3 py-2 whitespace-nowrap">{c.code}</td>
                <td className="px-3 py-2">{c.term}</td>
                <td className="px-3 py-2 whitespace-nowrap">{c.system}</td>
                <td className="px-3 py-2">
                  {String(c.mapped) === "true" || c.mapped === true ? (
                    <span className="text-green-700">Yes</span>
                  ) : (
                    <span className="text-amber-700">No</span>
                  )}
                </td>
              </tr>
            ))}
            {!results.length && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[#666]">No results.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
