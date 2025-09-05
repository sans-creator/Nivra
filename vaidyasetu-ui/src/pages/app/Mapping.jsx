import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appendAudit } from "@/lib/audit";
import { geminiText, geminiJSON } from "@/lib/gemini"; // <-- NEW

/** Brand palette (kept consistent) */
const COLORS = {
  primary: "#4a9b8e",
  text: "#333",
  sub: "#666",
};

const MAPPING_KEY = "vs_mappings_v1";
const FHIR_PREFILL_KEY = "vs_fhir_prefill_v1";

/* -------------------- tiny utils -------------------- */
function classNames(...xs) { return xs.filter(Boolean).join(" "); }
function loadMappings() {
  try { const v = JSON.parse(localStorage.getItem(MAPPING_KEY) || "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveMappings(arr) { localStorage.setItem(MAPPING_KEY, JSON.stringify(arr)); }

/** normalize & similarity helpers (simple, fast) */
function norm(s = "") {
  return String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s) {
  const stop = new Set(["of","and","the","a","an","to","in","on","for"]);
  return norm(s).split(" ").filter(Boolean).filter((t) => !stop.has(t));
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  let inter = 0; A.forEach((x) => B.has(x) && inter++);
  const uni = A.size + B.size - inter;
  return uni ? inter / uni : 0;
}
/** score between two rows */
function scorePair(src, dst) {
  let score = 0;
  const codeA = String(src.code || "").toLowerCase();
  const codeB = String(dst.code || "").toLowerCase();
  const termA = String(src.term || "");
  const termB = String(dst.term || "");
  if (codeA && codeA === codeB) score += 0.65;
  else if (codeA && codeB && (codeA.startsWith(codeB) || codeB.startsWith(codeA))) score += 0.25;
  const sim = jaccard(tokens(termA), tokens(termB)); score += 0.6 * sim;
  const long = new Set(tokens(termA).filter((t) => t.length >= 6));
  let bump = 0; tokens(termB).forEach((t) => (long.has(t) ? (bump = Math.max(bump, 0.05)) : null));
  score += bump; return Math.min(1, score);
}

/* -------------------- Page -------------------- */
export default function Mapping() {
  const [codes, setCodes] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  // direction & inputs
  const [fromSystem, setFromSystem] = useState("NAMASTE");
  const [toSystem, setToSystem] = useState("ICD-11+TM2+BIO");
  const [query, setQuery] = useState(""); // code or term
  const [mappings, setMappings] = useState(loadMappings());

  // --- NEW: AI state
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiFor, setAiFor] = useState("");          // what we asked AI about
  const [aiResults, setAiResults] = useState(null); // normalized: { namaste:[], tm2:[], biomed:[], icd11:[] }

  // per-row explain
  const [explainBusyId, setExplainBusyId] = useState(null);
  const [explainText, setExplainText] = useState({}); // key: `${sys}:${code}` -> text

  const navigate = useNavigate();

  // load dataset
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/datasets/seed.json", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          if (!mounted) return;
          setCodes(Array.isArray(j.codes) ? j.codes : []);
          setLoading(false);
          return;
        }
        // CSV fallback
        const csv = await fetch("/datasets/codes.csv", { cache: "no-store" });
        const text = csv.ok ? await csv.text() : "";
        const rows = parseCSV(text);
        if (!mounted) return;
        setCodes(
          rows.map((r) => ({
            code: r.code, term: r.term, system: r.system,
            mapped: String(r.mapped || "").toLowerCase() === "true",
          }))
        );
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load code datasets");
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // dataset splits
  const namaste = useMemo(() => codes.filter((c) => (c.system || "").toUpperCase() === "NAMASTE"), [codes]);
  const icdAll = useMemo(
    () => codes.filter((c) => {
      const sys = (c.system || "").toUpperCase();
      return sys === "ICD-11" || sys === "TM2" || sys.startsWith("BIO");
    }),
    [codes]
  );

  // choose pools based on direction
  const srcPool = useMemo(() => (fromSystem === "NAMASTE" ? namaste : icdAll), [fromSystem, namaste, icdAll]);
  const dstPool = useMemo(() => (fromSystem === "NAMASTE" ? icdAll : namaste), [fromSystem, namaste, icdAll]);

  // compute results (local heuristic)
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const srcMatches = srcPool.filter(
      (r) => String(r.code || "").toLowerCase().includes(q) || String(r.term || "").toLowerCase().includes(q)
    );
    return srcMatches.slice(0, 20).map((s) => {
      const scored = dstPool
        .map((d) => ({ s, d, score: scorePair(s, d) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);
      return { source: s, candidates: scored };
    });
  }, [query, srcPool, dstPool]);

  function approveMap(source, dest, score) {
    const rec = {
      id: `${source.system}:${source.code}__${dest.system}:${dest.code}`,
      fromSystem, source, dest, score: Number(score.toFixed(3)),
      createdAt: new Date().toISOString(),
    };
    setMappings((xs) => {
      const without = xs.filter((x) => x.id !== rec.id);
      const next = [rec, ...without];
      saveMappings(next);
      return next;
    });
    try { appendAudit?.({ action: "Approve Mapping", details: `${source.system}:${source.code} → ${dest.system}:${dest.code} (${rec.score})` }); } catch {}
  }

  function removeMap(id) {
    setMappings((xs) => {
      const next = xs.filter((x) => x.id !== id);
      saveMappings(next);
      return next;
    });
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(mappings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "mappings.json"; a.click(); URL.revokeObjectURL(url);
  }

  function applyToFHIR(rec) {
    const payload = {
      // always try to set these three; blank strings are okay
      namaste:
        fromSystem === "NAMASTE" ? rec.source.code :
        rec.source.system?.toUpperCase() === "NAMASTE" ? rec.source.code :
        rec.dest.system?.toUpperCase() === "NAMASTE" ? rec.dest.code : "",
      tm2:
        (["TM2"].includes(rec.dest.system) ? rec.dest.code :
         ["TM2"].includes(rec.source.system) ? rec.source.code : "") || "",
      biomed:
        ((rec.dest.system || "").toUpperCase().startsWith("BIO") ? rec.dest.code :
         (rec.source.system || "").toUpperCase().startsWith("BIO") ? rec.source.code : "") || "",
    };
    localStorage.setItem(FHIR_PREFILL_KEY, JSON.stringify(payload));
    try { appendAudit?.({ action: "Apply Mapping", details: `Prefilled FHIR with ${JSON.stringify(payload)}` }); } catch {}
    navigate("/app/fhir");
  }

  function swapDirection() {
    if (fromSystem === "NAMASTE") { setFromSystem("ICD-11/TM2/BIO"); setToSystem("NAMASTE"); }
    else { setFromSystem("NAMASTE"); setToSystem("ICD-11+TM2+BIO"); }
  }

  /* -------------------- AI: mapping suggestions -------------------- */
  async function runAISuggest(input) {
    const q = (input || query).trim();
    if (!q) return;
    setAiBusy(true); setAiError(""); setAiResults(null); setAiFor(q);
    try {
      // Ask different schema per direction
      let sysPrompt, userPrompt;
      if (fromSystem === "NAMASTE") {
        sysPrompt = `Return ONLY valid JSON. Schema exactly as: {"tm2": string[], "biomed": string[], "icd11": string[]}`;
        userPrompt = `Given NAMASTE term or code "${q}", suggest up to 3 likely codes for TM2, Biomed (ICD-11 traditional medicine related), and ICD-11 biomedical. Use only code identifiers (no descriptions).`;
      } else {
        sysPrompt = `Return ONLY valid JSON. Schema exactly as: {"namaste": string[]}`;
        userPrompt = `Given ICD-11/TM2/Biomed term or code "${q}", suggest up to 3 likely NAMASTE codes. Use only code identifiers (no descriptions).`;
      }
      const raw = await geminiJSON(sysPrompt, userPrompt);

      // Normalize into one object
      const normalized = {
        namaste: Array.isArray(raw?.namaste) ? raw.namaste : [],
        tm2: Array.isArray(raw?.tm2) ? raw.tm2 : [],
        biomed: Array.isArray(raw?.biomed) ? raw.biomed : [],
        icd11: Array.isArray(raw?.icd11) ? raw.icd11 : [],
      };

      // Convert to dataset rows if present; otherwise stub rows
      const asRows = (arr, system) =>
        (arr || []).slice(0, 6).map((codeStr) => {
          const found = codes.find(
            (c) =>
              (c.system || "").toUpperCase() === system.toUpperCase() &&
              (c.code || "").toLowerCase() === String(codeStr).toLowerCase()
          );
          return (
            found || {
              code: String(codeStr),
              term: "(AI suggestion)",
              system,
              mapped: false,
            }
          );
        });

      setAiResults({
        namaste: asRows(normalized.namaste, "NAMASTE"),
        tm2: asRows(normalized.tm2, "TM2"),
        biomed: asRows(normalized.biomed, "BIO"),
        icd11: asRows(normalized.icd11, "ICD-11"),
      });

      try { appendAudit?.({ action: "AI Suggest (Mapping)", details: `Asked AI for "${q}" from ${fromSystem}` }); } catch {}
    } catch (e) {
      setAiError(e?.message || "Gemini error");
    } finally {
      setAiBusy(false);
    }
  }

  /* -------------------- AI: explain a code -------------------- */
  async function explainCode(row) {
    const id = `${row.system}:${row.code}`;
    setExplainBusyId(id);
    try {
      const prompt = `
Explain in 2–3 tight bullets for a clinician:
System: ${row.system}
Code: ${row.code}
Term: ${row.term}
Include: meaning, typical use/indication, any mapping nuance (if relevant).
`.trim();
      const txt = await geminiText(prompt);
      setExplainText((m) => ({ ...m, [id]: txt }));
      try { appendAudit?.({ action: "AI Explain Code", details: id }); } catch {}
    } catch (e) {
      setExplainText((m) => ({ ...m, [id]: "AI error: " + (e?.message || "Unknown") }));
    } finally {
      setExplainBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="grid place-items-center h-64 text-gray-500">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading mapping datasets…
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {err && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          Failed to load: {err}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ color: COLORS.text }}>
            Mapping (NAMASTE ⇄ ICD-11)
          </h1>
          <p className="text-sm" style={{ color: COLORS.sub }}>
            Type a <b>code</b> or <b>term</b> from the source system. Approve a candidate to save the mapping.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportJSON} className="btn btn-outline">
            <span className="material-symbols-outlined text-base">download</span> Export JSON
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-soft">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">From</label>
            <select
              value={fromSystem}
              onChange={(e) => setFromSystem(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[var(--tw)] focus:outline-none focus:ring-[var(--tw)] sm:text-sm"
              style={{ ["--tw"]: COLORS.primary }}
            >
              <option value="NAMASTE">NAMASTE</option>
              <option value="ICD-11/TM2/BIO">ICD-11 / TM2 / Biomed</option>
            </select>
          </div>

          <div className="flex justify-center">
            <button
              onClick={swapDirection}
              className="mt-6 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: COLORS.primary }}
              title="Swap direction"
            >
              <span className="material-symbols-outlined">swap_horiz</span>
              Swap
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">To</label>
            <input
              className="mt-1 block w-full rounded-md border-gray-200 bg-gray-50 py-2 pl-3 pr-10 text-base sm:text-sm"
              value={toSystem}
              readOnly
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-sm font-medium text-gray-700">Code or Term</label>
            <div className="relative mt-1 flex gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search in ${fromSystem}…`}
                  className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)]"
                  style={{ ["--tw"]: COLORS.primary }}
                />
              </div>
              <button
                className="rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm"
                style={{ backgroundColor: COLORS.primary }}
                onClick={() => runAISuggest(query)}
                disabled={aiBusy || !query.trim()}
                title="AI Boost suggestions for this query"
              >
                {aiBusy ? "AI…" : "AI Boost"}
              </button>
            </div>
            {aiError && <div className="mt-2 text-sm text-rose-700">AI error: {aiError}</div>}
            {aiResults && (
              <div className="mt-3 grid gap-2 text-sm">
                <div className="text-gray-600">AI suggestions for <b>{aiFor}</b>:</div>
                <div className="grid gap-2 md:grid-cols-3">
                  <AIPillList title="TM2" items={aiResults.tm2} onAdd={(r)=>approveMap({system:fromSystem, code:aiFor, term:"(src)"}, r, 0.8)} />
                  <AIPillList title="Biomed" items={aiResults.biomed} onAdd={(r)=>approveMap({system:fromSystem, code:aiFor, term:"(src)"}, r, 0.8)} />
                  <AIPillList title="ICD-11" items={aiResults.icd11} onAdd={(r)=>approveMap({system:fromSystem, code:aiFor, term:"(src)"}, r, 0.8)} />
                </div>
                {fromSystem !== "NAMASTE" && (
                  <AIPillList title="NAMASTE" items={aiResults.namaste} onAdd={(r)=>approveMap({system:fromSystem, code:aiFor, term:"(src)"}, r, 0.8)} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <section className="space-y-6">
        {!query.trim() && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-500">
            Start typing a code/term to see candidate mappings — or hit <b>AI Boost</b> for suggestions.
          </div>
        )}

        {results.map(({ source, candidates }) => (
          <div
            key={`${source.system}:${source.code}`}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-soft"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Tag tone="teal">{source.system}</Tag>
                <div className="text-sm text-gray-900 font-semibold">{source.code}</div>
                <div className="text-sm text-gray-600">— {source.term}</div>

                {/* inline explain bubble */}
                <button
                  className="ml-2 text-gray-400 hover:text-gray-700"
                  title="Explain (AI)"
                  onClick={() => explainCode(source)}
                >
                  <span className="material-symbols-outlined text-base">
                    {explainBusyId === `${source.system}:${source.code}` ? "progress_activity" : "lightbulb"}
                  </span>
                </button>
              </div>
              <div className="text-xs text-gray-500">Top candidates</div>
            </div>

            {explainText[`${source.system}:${source.code}`] && (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50/70 p-2 text-[13px] text-emerald-900 whitespace-pre-wrap">
                {explainText[`${source.system}:${source.code}`]}
              </div>
            )}

            <div className="overflow-hidden rounded-xl border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 text-gray-700">
                  <tr className="text-left">
                    <th className="px-4 py-2 text-sm font-semibold">System</th>
                    <th className="px-4 py-2 text-sm font-semibold">Code</th>
                    <th className="px-4 py-2 text-sm font-semibold">Term</th>
                    <th className="px-4 py-2 text-sm font-semibold">Score</th>
                    <th className="px-4 py-2 text-sm font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {candidates.map(({ d, score }) => (
                    <tr key={`${d.system}:${d.code}`} className="text-sm text-gray-700">
                      <td className="px-4 py-3 whitespace-nowrap">{d.system}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{d.code}</td>
                      <td className="px-4 py-3">{d.term}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><ScorePill score={score} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="rounded-md px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: COLORS.primary }}
                            onClick={() => approveMap(source, d, score)}
                          >
                            Approve
                          </button>
                          <button
                            className="rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            onClick={() => applyToFHIR({ source, dest: d })}
                          >
                            Apply to FHIR
                          </button>
                          <button
                            className="rounded-md border px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            title="Explain candidate (AI)"
                            onClick={() => explainCode(d)}
                          >
                            <span className="material-symbols-outlined text-base">
                              {explainBusyId === `${d.system}:${d.code}` ? "progress_activity" : "lightbulb"}
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!candidates.length && (
                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No close candidates.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </section>

      {/* Saved mappings */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ color: COLORS.text }}>Approved Mappings</h2>
          <div className="text-sm text-gray-500">Total: {mappings.length}</div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-soft">
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-gray-700 z-[1]">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold">Source</th>
                  <th className="px-4 py-2 font-semibold">→</th>
                  <th className="px-4 py-2 font-semibold">Target</th>
                  <th className="px-4 py-2 font-semibold">Score</th>
                  <th className="px-4 py-2 font-semibold">Saved</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-gray-50/60">
                {mappings.map((m) => (
                  <tr key={m.id} className="text-gray-700">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Tag tone="teal">{m.source.system}</Tag> <b>{m.source.code}</b> — {m.source.term}
                    </td>
                    <td className="px-4 py-3">→</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Tag tone="blue">{m.dest.system}</Tag> <b>{m.dest.code}</b> — {m.dest.term}
                    </td>
                    <td className="px-4 py-3"><ScorePill score={m.score} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        className="rounded-md border px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                        onClick={() => removeMap(m.id)}
                      >Remove</button>
                    </td>
                  </tr>
                ))}
                {!mappings.length && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No mappings saved yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

/* -------------------- small UI atoms -------------------- */
function Tag({ tone = "teal", children }) {
  const tones = {
    teal: "bg-teal-50 text-teal-700 ring-teal-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-700/10",
    gray: "bg-gray-100 text-gray-800 ring-gray-300/50",
  };
  const t = tones[tone] || tones.gray;
  return (
    <span className={classNames("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", t)}>
      {children}
    </span>
  );
}
function ScorePill({ score }) {
  const pct = Math.round(score * 100);
  const tone =
    pct >= 80 ? "bg-green-50 text-green-700 ring-green-600/20" :
    pct >= 60 ? "bg-amber-50 text-amber-800 ring-amber-600/20" :
                "bg-gray-100 text-gray-800 ring-gray-300/50";
  return (
    <span className={classNames("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", tone)}>
      {pct}% match
    </span>
  );
}
function AIPillList({ title, items, onAdd }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <div className="text-xs font-semibold text-gray-700 mb-1">{title}</div>
      {Array.isArray(items) && items.length ? items.map((r) => (
        <div key={`${title}:${r.code}`} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50">
          <div className="min-w-0">
            <div className="text-[13px] text-gray-900 font-medium truncate">{r.term}</div>
            <div className="text-[12px] text-gray-600">{title} · {r.code}</div>
          </div>
          <button className="text-[color:var(--tw)] text-sm font-semibold hover:opacity-80" style={{ ["--tw"]: COLORS.primary }} onClick={() => onAdd(r)}>
            Add
          </button>
        </div>
      )) : <div className="text-xs text-gray-500">—</div>}
    </div>
  );
}

/* -------------------- tiny CSV fallback -------------------- */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const row = {}; headers.forEach((h, i) => (row[h] = cols[i]));
    return row;
  });
}
