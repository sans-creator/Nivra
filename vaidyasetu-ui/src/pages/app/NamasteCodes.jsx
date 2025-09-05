import React, { useEffect, useMemo, useState } from "react";
import { appendAudit } from "@/lib/audit";
import { geminiText, geminiJSON } from "@/lib/gemini"; // <-- NEW

/** Brand palette */
const COLORS = {
  primary: "#4a9b8e",
  text: "#333",
  sub: "#666",
  rowBorder: "#e5e7eb",
};

/** ---------- Tiny utils ---------- */
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}
function Badge({ tone = "teal", children }) {
  const tones = {
    teal: { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-600/20" },
    blue: { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-700/10" },
    green: { bg: "bg-green-50", text: "text-green-700", ring: "ring-green-600/20" },
    amber: { bg: "bg-amber-50", text: "text-amber-800", ring: "ring-amber-600/20" },
  };
  const t = tones[tone] || tones.teal;
  return (
    <span className={classNames("inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset", t.bg, t.text, t.ring)}>
      {children}
    </span>
  );
}
function TagGhost({ children }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium"
      style={{ backgroundColor: "rgba(74,155,142,.08)", color: COLORS.primary }}
    >
      {children}
    </span>
  );
}
function Toast({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow">
        <span className="material-symbols-outlined">check_circle</span>
        <div className="text-sm">{children}</div>
        <button onClick={onClose} className="ml-2 text-emerald-700 hover:text-emerald-900">
          <span className="material-symbols-outlined text-base">close</span>
        </button>
      </div>
    </div>
  );
}

/** CSV helper */
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

/** translate dictionary */
const HI_DICT = {
  Fever: "बुखार",
  Headache: "सर दर्द",
  "Body Pain": "शरीर दर्द",
  Stomachache: "पेट दर्द",
  Cold: "जुकाम",
  Cough: "खांसी",
};

export default function NamasteCodes() {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // filters
  const [systemFilter, setSystemFilter] = useState("All");
  const [language, setLanguage] = useState("English"); // English | Hindi
  const [matchMode, setMatchMode] = useState("Exact");
  const [query, setQuery] = useState("");

  // selection (rows user “adds”)
  const [selected, setSelected] = useState([]);

  // translate panel
  const [txSystem, setTxSystem] = useState("NAMASTE");
  const [txCode, setTxCode] = useState("");

  // toast
  const [toastOpen, setToastOpen] = useState(false);

  // --- NEW: AI state
  const [aiInput, setAiInput] = useState(""); // term/code for AI
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResults, setAiResults] = useState(null); // { namaste:[], tm2:[], biomed:[] }

  // per-row Explain
  const [explainOpenId, setExplainOpenId] = useState(null); // `${system}:${code}`
  const [explainText, setExplainText] = useState("");
  const [explainBusy, setExplainBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        // 1) seed.json
        const res = await fetch("/datasets/seed.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!mounted) return;
          setCodes(Array.isArray(data.codes) ? data.codes : []);
          setLoading(false);
          return;
        }
        // 2) fallback: codes.csv
        const csv = await fetch("/datasets/codes.csv", { cache: "no-store" });
        const text = csv.ok ? await csv.text() : "";
        const rows = parseCSV(text);
        if (!mounted) return;
        setCodes(
          rows.map((r) => ({
            code: r.code,
            term: r.term,
            system: r.system,
            mapped: String(r.mapped || "").toLowerCase() === "true",
          }))
        );
        setLoading(false);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load codes");
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  /** derived: filtered + searched table rows */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return codes
      .filter((c) => (systemFilter === "All" ? true : (c.system || "").toLowerCase() === systemFilter.toLowerCase()))
      .filter((c) => {
        if (!q) return true;
        const hay = `${c.code} ${c.term} ${c.system}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 200);
  }, [codes, systemFilter, query]);

  function showTerm(term) {
    if (language === "Hindi") return HI_DICT[term] || term;
    return term;
  }

  /** row actions + audit */
  const handleAddRow = (row) => {
    const id = `${row.system}:${row.code}`;
    if (selected.find((s) => s.id === id)) return;
    setSelected((xs) => [...xs, { id, ...row }]);
    appendAudit({ action: "Add Code", details: `${row.system}:${row.code} — ${row.term}` });
  };
  const handleMapClick = (row) => {
    appendAudit({ action: "Open Map", details: `${row.system}:${row.code} — ${row.term}` });
  };
  const handleCodeClick = (row) => {
    appendAudit({ action: "Open Code Details", details: `${row.system}:${row.code} — ${row.term}` });
  };
  const removeRow = (id) => setSelected((xs) => xs.filter((r) => r.id !== id));

  /** suggestions (heuristic, existing) */
  const suggestions = useMemo(() => {
    const code = txCode.trim();
    const baseSet = codes.filter((c) => !code || (c.code || "").toLowerCase().includes(code.toLowerCase()));
    const pivotTerm =
      (codes.find((c) => c.code?.toLowerCase() === code.toLowerCase())?.term || query || "").toLowerCase();

    function matchScore(term) {
      if (!pivotTerm) return 0;
      const t = term.toLowerCase();
      if (t === pivotTerm) return 3;
      if (t.includes(pivotTerm)) return 2;
      if (pivotTerm.includes(t)) return 1;
      return 0;
    }
    function markMode(score) {
      if (score >= 3) return "Exact";
      if (score === 2) return "Narrow";
      if (score === 1) return "Broad";
      return "Related";
    }

    const tm2 = baseSet
      .filter((c) => c.system === "TM2")
      .map((c) => ({ ...c, score: matchScore(c.term) }))
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
      .slice(0, 4)
      .map((x) => ({ ...x, mode: markMode(x.score) }));

    const bio = baseSet
      .filter((c) => (c.system || "").toUpperCase().startsWith("BIO"))
      .map((c) => ({ ...c, score: matchScore(c.term) }))
      .sort((a, b) => b.score - a.score || a.term.localeCompare(b.term))
      .slice(0, 6)
      .map((x) => ({ ...x, mode: markMode(x.score) }));

    return { tm2, bio };
  }, [codes, txCode, query]);

  /** Insert both into Condition */
  const insertBoth = () => {
    if (selected.length < 2) return;
    const a = selected[0];
    const b = selected[1];
    appendAudit({ action: "Insert Codes", details: `${a.system}:${a.code} + ${b.system}:${b.code} → Condition` });
    setToastOpen(true);
    setTimeout(() => setToastOpen(false), 2500);
  };

  /** -------------------- AI: mapping suggestions -------------------- */
  async function runAIMapping() {
    if (!aiInput.trim() && !txCode.trim() && !query.trim()) return;
    try {
      setAiBusy(true);
      setAiError("");
      setAiResults(null);

      const input = aiInput.trim() || txCode.trim() || query.trim();

      // Ask for strict JSON
      const sys = `Return ONLY valid JSON with arrays. Schema: {"namaste": string[], "tm2": string[], "biomed": string[]}`;
      const usr = `Suggest the best code candidates for "${input}". Provide up to 3 codes per array when possible. Prefer actual code identifiers over descriptions.`;

      const out = await geminiJSON(sys, usr);
      // out = { namaste:[], tm2:[], biomed:[] }
      const pack = (arr, system) =>
        (Array.isArray(arr) ? arr : []).slice(0, 6).map((codeStr) => {
          const m = codes.find(
            (c) => (c.system || "").toUpperCase() === system.toUpperCase() && (c.code || "").toLowerCase() === String(codeStr).toLowerCase()
          );
          return (
            m || {
              code: String(codeStr),
              term: "(AI suggestion)",
              system,
              mapped: false,
            }
          );
        });

      const ai = {
        namaste: pack(out?.namaste, "NAMASTE"),
        tm2: pack(out?.tm2, "TM2"),
        biomed: pack(out?.biomed, "BIO"),
      };
      setAiResults(ai);

      appendAudit({ action: "AI Suggest", details: `Asked AI for "${input}"` });
    } catch (e) {
      setAiError(e?.message || "Gemini error");
    } finally {
      setAiBusy(false);
    }
  }

  /** -------------------- AI: explain a code -------------------- */
  async function explainRowAI(row) {
    const id = `${row.system}:${row.code}`;
    setExplainOpenId(id);
    setExplainText("");
    setExplainBusy(true);
    setAiError("");

    try {
      const prompt = `
Explain in 2–3 concise bullet points for a general clinician:
Code: ${row.code}
System: ${row.system}
Term: ${row.term}

Cover: meaning, typical use/indication, any quick mapping nuance (if relevant).
`.trim();
      const txt = await geminiText(prompt);
      setExplainText(txt);
      appendAudit({ action: "AI Explain", details: `${row.system}:${row.code}` });
    } catch (e) {
      setAiError(e?.message || "Gemini error");
    } finally {
      setExplainBusy(false);
    }
  }

  /** loading/error states */
  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-gray-500">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span> Loading Namaste Codes…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-12 gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      {err && (
        <div className="col-span-12 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800">
          Failed to load datasets: {err}
        </div>
      )}

      {/* Sidebar: Filters + AI Helper */}
      <aside className="col-span-12 mt-2 h-fit rounded-2xl bg-gray-50 p-6 shadow-sm lg:col-span-3">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <div className="mt-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="source">Source</label>
            <select
              id="source"
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[var(--tw)] focus:outline-none focus:ring-2"
              style={{ "--tw": COLORS.primary }}
            >
              <option>All</option>
              <option>ICD-11</option>
              <option>NAMASTE</option>
              <option>TM2</option>
              <option>BIO</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="language">Language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[var(--tw)] focus:outline-none focus:ring-2"
              style={{ "--tw": COLORS.primary }}
            >
              <option>English</option>
              <option>Hindi</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700" htmlFor="match-mode">Match Mode</label>
            <select
              id="match-mode"
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[var(--tw)] focus:outline-none focus:ring-2"
              style={{ "--tw": COLORS.primary }}
            >
              <option>Exact</option>
              <option>Broad</option>
              <option>Narrow</option>
            </select>
            <p className="mt-2 text-xs text-gray-500">Used to label suggestions; refine logic later to enforce filtering if needed.</p>
          </div>

          {/* Selection summary */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-800">Selected</h3>
            <div className="mt-3 space-y-2">
              {selected.length === 0 && <p className="text-sm text-gray-500">No rows added yet.</p>}
              {selected.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                  <div className="flex items-center gap-2">
                    <TagGhost>{s.system}</TagGhost>
                    <div className="text-sm text-gray-900 font-medium">{s.code}</div>
                  </div>
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => removeRow(s.id)}>
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* --- NEW: AI Helper --- */}
          <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[var(--primary)]">psychology</span>
              <h3 className="text-sm font-semibold text-gray-900">AI Helper</h3>
            </div>
            <input
              className="w-full rounded-md border border-gray-300 bg-white py-2 px-3 text-sm focus:border-[var(--tw)] focus:ring-[var(--tw)]"
              style={{ "--tw": COLORS.primary }}
              placeholder='Term or code (e.g. "Fever" or "R50.9")'
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
            />
            {aiError && <div className="mt-2 text-xs text-rose-700">Error: {aiError}</div>}
            <button
              className="mt-3 w-full rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
              style={{ backgroundColor: COLORS.primary }}
              onClick={runAIMapping}
              disabled={aiBusy || !(aiInput.trim() || txCode.trim() || query.trim())}
            >
              {aiBusy ? "Thinking…" : "AI Suggest"}
            </button>

            {/* AI results quick view */}
            {aiResults && (
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <div className="mb-1 font-semibold text-gray-800">NAMASTE</div>
                  {aiResults.namaste.length ? aiResults.namaste.map((r) => (
                    <RowMini key={`ai-nam:${r.code}`} r={r} onAdd={() => handleAddRow(r)} />
                  )) : <div className="text-gray-500">—</div>}
                </div>
                <div>
                  <div className="mb-1 font-semibold text-gray-800">TM2</div>
                  {aiResults.tm2.length ? aiResults.tm2.map((r) => (
                    <RowMini key={`ai-tm2:${r.code}`} r={r} onAdd={() => handleAddRow(r)} />
                  )) : <div className="text-gray-500">—</div>}
                </div>
                <div>
                  <div className="mb-1 font-semibold text-gray-800">Biomed</div>
                  {aiResults.biomed.length ? aiResults.biomed.map((r) => (
                    <RowMini key={`ai-bio:${r.code}`} r={r} onAdd={() => handleAddRow(r)} />
                  )) : <div className="text-gray-500">—</div>}
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="col-span-12 lg:col-span-9">
        {/* Search */}
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-3 text-gray-400">search</span>
          <input
            className="w-full rounded-md border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-gray-900 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)]"
            style={{ "--tw": COLORS.primary }}
            placeholder="Search for codes or terms (e.g., 'fever')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
          />
        </div>

        {/* Results table */}
        <div className="mt-6 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Primary Term</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Code</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">System</th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Mapped</th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filtered.map((row) => {
                      const id = `${row.system}:${row.code}`;
                      const isExplainOpen = explainOpenId === id;
                      return (
                        <tr key={id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                            {showTerm(row.term)}
                            {/* inline explain bubble */}
                            {isExplainOpen && (
                              <div className="mt-2 rounded-md border border-white/60 bg-emerald-50/50 p-2 text-[13px] text-emerald-900 whitespace-pre-wrap">
                                {explainBusy ? "Explaining…" : (explainText || "No explanation yet.")}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-600">{row.code}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {row.system === "NAMASTE" ? (
                              <Badge tone="teal">NAMASTE</Badge>
                            ) : row.system === "ICD-11" ? (
                              <Badge tone="blue">ICD-11</Badge>
                            ) : (row.system || "").toUpperCase().startsWith("BIO") ? (
                              <Badge tone="amber">BIO</Badge>
                            ) : (
                              <Badge tone="green">TM2</Badge>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {row.mapped ? <Badge tone="green">Yes</Badge> : <Badge tone="amber">No</Badge>}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <div className="flex items-center justify-end gap-4">
                              <button
                                className="text-[color:var(--tw)] hover:opacity-80 font-semibold"
                                style={{ "--tw": COLORS.primary }}
                                onClick={() => handleAddRow(row)}
                              >
                                Add
                              </button>
                              <button
                                className="text-gray-400 hover:text-gray-600"
                                title="Map"
                                onClick={() => handleMapClick(row)}
                              >
                                <span className="material-symbols-outlined text-base">map</span>
                              </button>
                              <button
                                className="text-gray-400 hover:text-gray-600"
                                title="Code"
                                onClick={() => handleCodeClick(row)}
                              >
                                <span className="material-symbols-outlined text-base">code</span>
                              </button>

                              {/* NEW: explain */}
                              <button
                                className="text-gray-400 hover:text-gray-600"
                                title="Explain (AI)"
                                onClick={() => {
                                  if (explainOpenId === id) {
                                    setExplainOpenId(null);
                                    return;
                                  }
                                  explainRowAI(row);
                                }}
                              >
                                <span className="material-symbols-outlined text-base">lightbulb</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!filtered.length && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                          No results — try adjusting filters or search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-gray-500">Showing {filtered.length} of {codes.length} total</div>
            </div>
          </div>
        </div>

        {/* Translate Code panel (kept) */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Translate Code</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="translate-system">System</label>
              <select
                id="translate-system"
                value={txSystem}
                onChange={(e) => setTxSystem(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-[var(--tw)] focus:outline-none focus:ring-2"
                style={{ "--tw": COLORS.primary }}
              >
                <option>NAMASTE</option>
                <option>ICD-11</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700" htmlFor="translate-code">Code</label>
              <div className="flex gap-2">
                <input
                  id="translate-code"
                  value={txCode}
                  onChange={(e) => setTxCode(e.target.value)}
                  placeholder="e.g. R50.9"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ "--tw": COLORS.primary }}
                  type="text"
                />
                {/* Quick AI from here too */}
                <button
                  className="mt-1 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm hover:opacity-95"
                  style={{ backgroundColor: COLORS.primary }}
                  onClick={runAIMapping}
                  title="AI Suggest for this code/term"
                >
                  AI
                </button>
              </div>
            </div>
          </div>

          {/* TM2 suggestions (heuristic) */}
          <div className="mt-8 flow-root">
            <h3 className="text-base font-semibold text-gray-800">TM2</h3>
            <div className="-mx-4 mt-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-200">
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {suggestions.tm2.map((r) => (
                      <tr key={`tm2:${r.code}`}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{r.term}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.code}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {r.mode === "Exact" && <Badge tone="green">Exact</Badge>}
                          {r.mode === "Narrow" && <Badge tone="amber">Narrow</Badge>}
                          {r.mode === "Broad" && <Badge tone="blue">Broad</Badge>}
                          {r.mode === "Related" && <TagGhost>Related</TagGhost>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-sm">
                          <button
                            className="text-[color:var(--tw)] hover:opacity-80 font-semibold"
                            style={{ "--tw": COLORS.primary }}
                            onClick={() => handleAddRow(r)}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!suggestions.tm2.length && (
                      <tr>
                        <td colSpan={4} className="px-6 py-6 text-center text-sm text-gray-500">No suggestions.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Biomed suggestions (heuristic) */}
          <div className="mt-6 flow-root">
            <h3 className="text-base font-semibold text-gray-800">Biomed</h3>
            <div className="-mx-4 mt-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
              <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                <table className="min-w-full divide-y divide-gray-200">
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {suggestions.bio.map((r) => (
                      <tr key={`bio:${r.code}`}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{r.term}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{r.code}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {r.mode === "Exact" && <Badge tone="green">Exact</Badge>}
                          {r.mode === "Narrow" && <Badge tone="amber">Narrow</Badge>}
                          {r.mode === "Broad" && <Badge tone="blue">Broad</Badge>}
                          {r.mode === "Related" && <TagGhost>Related</TagGhost>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-right text-sm">
                          <button
                            className="text-[color:var(--tw)] hover:opacity-80 font-semibold"
                            style={{ "--tw": COLORS.primary }}
                            onClick={() => handleAddRow(r)}
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!suggestions.bio.length && (
                      <tr>
                        <td colSpan={4} className="px-6 py-6 text-center text-sm text-gray-500">No suggestions.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Selected: <span className="font-medium text-gray-900">{selected.length}</span>
            </div>
            <button
              onClick={insertBoth}
              disabled={selected.length < 2}
              className={classNames(
                "rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                selected.length < 2 ? "bg-gray-300 cursor-not-allowed" : "hover:opacity-90"
              )}
              style={{ backgroundColor: selected.length < 2 ? undefined : COLORS.primary }}
              type="button"
              title={selected.length < 2 ? "Select at least 2 codes" : "Insert both codes into Condition"}
            >
              Insert both codes into Condition
            </button>
          </div>
        </div>
      </main>

      {/* Toast */}
      <Toast open={toastOpen} onClose={() => setToastOpen(false)}>
        Inserted <b>{selected.slice(0, 2).map((s) => `${s.system}:${s.code}`).join(" + ")}</b> into Condition.
      </Toast>
    </div>
  );
}

/* --- tiny subcomponent for AI result rows --- */
function RowMini({ r, onAdd }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 mb-1">
      <div className="min-w-0">
        <div className="text-[13px] text-gray-900 font-medium truncate">{r.term}</div>
        <div className="text-[12px] text-gray-600">{r.system} · {r.code}</div>
      </div>
      <button className="text-[color:var(--tw)] hover:opacity-80 text-sm font-semibold" style={{ "--tw": COLORS.primary }} onClick={onAdd}>
        Add
      </button>
    </div>
  );
}
