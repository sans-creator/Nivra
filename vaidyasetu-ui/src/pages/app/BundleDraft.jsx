import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appendAudit } from "@/lib/audit";

const DRAFT_KEY = "vs_bundle_draft_v1";
const FHIR_PREFILL_KEY = "vs_fhir_prefill_v1";

function loadDraft() {
  try {
    const arr = JSON.parse(localStorage.getItem(DRAFT_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
function saveDraft(arr) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(arr));
}

/** Try to extract NAMASTE/TM2/Biomed codings from a Condition */
function pickCodesFromCondition(res = {}) {
  const out = { namaste: "", tm2: "", biomed: "" };
  const codings = res?.code?.coding || [];
  for (const c of codings) {
    const sys = String(c.system || "").toLowerCase();
    if (!out.namaste && sys.includes("namaste")) out.namaste = c.code || "";
    if (!out.tm2 && (sys.includes("tm2") || sys.includes("icd11-tm2"))) out.tm2 = c.code || "";
    if (!out.biomed && (sys.includes("biomed") || sys.includes("icd11"))) out.biomed = c.code || "";
  }
  return out;
}

export default function BundleDraft() {
  const [items, setItems] = useState(loadDraft()); // [{resource:{...}}]
  const [openIdx, setOpenIdx] = useState(-1);      // show JSON panel for one row
  const [jsonPretty, setJsonPretty] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setItems(loadDraft());
  }, []);

  const total = items.length;

  function removeAt(i) {
    const next = items.slice();
    next.splice(i, 1);
    setItems(next);
    saveDraft(next);
    appendAudit?.({ action: "Delete Draft Entry", details: `Removed index ${i}` });
  }

  function clearAll() {
    setItems([]);
    saveDraft([]);
    appendAudit?.({ action: "Clear Bundle Draft", details: "Deleted all items" });
  }

  function downloadJSON(i) {
    const blob = new Blob([JSON.stringify(items[i], null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `draft-item-${i + 1}.json` });
    a.click(); URL.revokeObjectURL(url);
  }

  function exportAsBundle() {
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: items.map((e) => ({ resource: e.resource })),
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "bundle-draft-export.json" });
    a.click(); URL.revokeObjectURL(url);
    appendAudit?.({ action: "Export Bundle", details: `Exported ${items.length} entries` });
  }

  function openJSON(i) {
    setOpenIdx(i);
    setJsonPretty(JSON.stringify(items[i], null, 2));
  }

  function prefillFHIR(i) {
    const res = items[i]?.resource || {};
    if (res?.resourceType !== "Condition") {
      alert("Only Condition resources can be prefilling the FHIR Builder.");
      return;
    }
    const { namaste, tm2, biomed } = pickCodesFromCondition(res);
    localStorage.setItem(FHIR_PREFILL_KEY, JSON.stringify({ namaste, tm2, biomed }));
    appendAudit?.({ action: "Prefill FHIR", details: `namaste=${namaste} tm2=${tm2} biomed=${biomed}` });
    navigate("/app/fhir");
  }

  /** Small row summary */
  function summarize(res = {}) {
    const rt = res.resourceType || "Unknown";
    if (rt === "Condition") {
      const subject = res?.subject?.reference || "—";
      const codings = res?.code?.coding?.length || 0;
      return `Condition · ${subject} · ${codings} coding(s)`;
    }
    return rt;
  }

  const empty = useMemo(() => total === 0, [total]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Bundle Draft</h1>
          <p className="text-sm text-[var(--sub)]">Local workspace for resources saved from the FHIR Builder.</p>
        </div>

        <div className="flex items-center gap-2">
          <button className="btn btn-outline" onClick={exportAsBundle} disabled={empty}>
            <span className="material-symbols-outlined text-base">file_download</span> Export as Bundle
          </button>
          <button className="btn btn-outline" onClick={clearAll} disabled={empty}>
            <span className="material-symbols-outlined text-base">delete</span> Clear All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-soft">
        <div className="max-h-[560px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-gray-50 text-[var(--text)]">
              <tr className="text-left">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Summary</th>
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-gray-50/60">
              {items.map((it, i) => {
                const res = it?.resource || {};
                return (
                  <tr key={i} className="text-[#555]">
                    <td className="px-5 py-3 whitespace-nowrap">{i + 1}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{res.resourceType || "—"}</td>
                    <td className="px-5 py-3">{summarize(res)}</td>
                    <td className="px-5 py-3 whitespace-nowrap">{res.id || "—"}</td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 justify-end">
                        <button className="btn btn-outline" onClick={() => openJSON(i)}>
                          <span className="material-symbols-outlined text-base">visibility</span> View JSON
                        </button>
                        <button className="btn btn-outline" onClick={() => downloadJSON(i)}>
                          <span className="material-symbols-outlined text-base">download</span> Download
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => prefillFHIR(i)}
                          disabled={(it?.resource?.resourceType || "") !== "Condition"}
                          title="Prefill codes into FHIR Builder"
                        >
                          <span className="material-symbols-outlined text-base">open_in_new</span> Open in FHIR
                        </button>
                        <button className="btn btn-outline text-red-600 border-red-300" onClick={() => removeAt(i)}>
                          <span className="material-symbols-outlined text-base">delete</span> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!items.length && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-[#666]">
                    No items yet. Use <b>“Save to Bundle Draft”</b> in FHIR Builder, then come back here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON drawer (simple) */}
      {openIdx >= 0 && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setOpenIdx(-1)}>
          <div
            className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-lg font-semibold text-[var(--text)]">Draft Item #{openIdx + 1}</h3>
              <button onClick={() => setOpenIdx(-1)} className="text-[#666] hover:text-black">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <pre className="h-[calc(100%-56px)] overflow-auto p-4 text-xs whitespace-pre-wrap">
              {jsonPretty}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
