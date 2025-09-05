import React, { useEffect, useMemo, useRef, useState } from "react";
import { appendAudit } from "@/lib/audit"; // keep your existing audit

/** Brand palette */
const COLORS = {
  primary: "#4a9b8e",
  text: "#333",
  sub: "#666",
  mint50: "#f0fdfa",
  mint100: "#ccfbf1",
  mint600: "#0d9488",
  mint700: "#115e59",
  mint800: "#0f766e",
};

const FHIR_PREFILL_KEY = "vs_fhir_prefill_v1";

function Badge({ tone = "green", children }) {
  const tones = {
    green: "bg-green-50 text-green-700 ring-green-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    yellow: "bg-amber-50 text-amber-800 ring-amber-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-700/10",
    mint: "bg-[var(--mint50)] text-[var(--mint800)] ring-[var(--mint600)]/20",
    gray: "bg-gray-100 text-gray-800 ring-gray-300/50",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${tones[tone] || tones.gray}`}
      style={{ ["--mint50"]: COLORS.mint50, ["--mint600"]: COLORS.mint600, ["--mint800"]: COLORS.mint800 }}
    >
      {children}
    </span>
  );
}
function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
function SoftCard({ title, right, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_4px_6px_-1px_rgb(0_0_0/0.05),0_2px_4px_-2px_rgb(0_0_0/0.05)] ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

const CLINICAL_STATUS = [
  { label: "Active", code: "active" },
  { label: "Recurrence", code: "recurrence" },
  { label: "Relapse", code: "relapse" },
  { label: "Inactive", code: "inactive" },
  { label: "Remission", code: "remission" },
  { label: "Resolved", code: "resolved" },
];
const VERIFICATION_STATUS = [
  { label: "Confirmed", code: "confirmed" },
  { label: "Unconfirmed", code: "unconfirmed" },
  { label: "Provisional", code: "provisional" },
  { label: "Differential", code: "differential" },
  { label: "Refuted", code: "refuted" },
  { label: "Entered in Error", code: "entered-in-error" },
];

export default function FhirBuilder() {
  const [patientRef, setPatientRef] = useState("Patient/123");
  const [clinical, setClinical] = useState(CLINICAL_STATUS[0].code);
  const [verification, setVerification] = useState(VERIFICATION_STATUS[0].code);
  const [namaste, setNamaste] = useState("");
  const [tm2, setTm2] = useState("");
  const [biomed, setBiomed] = useState("");

  const [editorText, setEditorText] = useState("");
  const editorRef = useRef(null);

  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [importMsg, setImportMsg] = useState(""); // toast for imports/prefill
  const [fileBusy, setFileBusy] = useState(false);

  // ---------- One-shot prefill from Mapping page ----------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FHIR_PREFILL_KEY);
      if (!raw) return;
      const { namaste = "", tm2 = "", biomed = "" } = JSON.parse(raw) || {};
      if (namaste) setNamaste(namaste);
      if (tm2) setTm2(tm2);
      if (biomed) setBiomed(biomed);
      setImportMsg("Prefilled from Mapping");
      appendAudit?.({ action: "FHIR Prefill", details: raw });
    } catch {}
    localStorage.removeItem(FHIR_PREFILL_KEY);
    const t = setTimeout(() => setImportMsg(""), 1800);
    return () => clearTimeout(t);
  }, []);

  // ---------- Build Condition JSON ----------
  const conditionJSON = useMemo(() => {
    const codings = [];
    if (namaste)
      codings.push({ system: "urn:example:namaste", code: namaste, display: "NAMASTE code" });
    if (tm2)
      codings.push({ system: "urn:example:icd11-tm2", code: tm2, display: "ICD-11 TM2" });
    if (biomed)
      codings.push({ system: "urn:example:icd11-biomed", code: biomed, display: "ICD-11 Biomed" });

    return {
      resourceType: "Condition",
      subject: { reference: patientRef || "Patient/unknown" },
      clinicalStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: clinical }],
      },
      verificationStatus: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: verification }],
      },
      category: [{ coding: [{ system: "urn:example:category", code: "tm", display: "Traditional Medicine" }] }],
      code: codings.length ? { coding: codings } : undefined,
    };
  }, [patientRef, clinical, verification, namaste, tm2, biomed]);

  // ---------- Inline validations ----------
  const validations = useMemo(() => {
    const v = [];
    if (/^Patient\/[A-Za-z0-9._-]+$/.test(patientRef)) v.push({ field: "Patient Reference", status: "valid", msg: "Looks good." });
    else v.push({ field: "Patient Reference", status: "error", msg: "Expected format like ‘Patient/123’." });

    v.push({ field: "Clinical Status", status: clinical ? "valid" : "error", msg: clinical || "Required." });
    v.push({ field: "Verification Status", status: verification ? "valid" : "error", msg: verification || "Required." });

    if (!biomed) v.push({ field: "ICD-11 Biomed", status: "warn", msg: "Missing biomedical code may affect interoperability." });
    else v.push({ field: "ICD-11 Biomed", status: "valid", msg: biomed });

    if (!namaste && !tm2 && !biomed) v.push({ field: "Dual Coding", status: "warn", msg: "Add at least one coding (NAMASTE/TM2/Biomed)." });
    return v;
  }, [patientRef, clinical, verification, namaste, tm2, biomed]);

  // ---------- Copy / Save ----------
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(conditionJSON, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1300);
    } catch {}
  };

  const onSave = () => {
    const KEY = "vs_bundle_draft_v1";
    let arr = [];
    try {
      arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      if (!Array.isArray(arr)) arr = [];
    } catch { arr = []; }
    const withMeta = { ...conditionJSON, id: `cond-${Date.now()}` };
    arr.unshift({ resource: withMeta });
    localStorage.setItem(KEY, JSON.stringify(arr));

    appendAudit({ action: "Save Condition", details: `Saved Condition (${withMeta.id}) to local Bundle draft` });
    setSaved(true);
    setTimeout(() => setSaved(false), 1300);
  };

  // ---------- Drag & drop to editor ----------
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const prevent = (e) => { e.preventDefault(); e.stopPropagation(); };
    const onDrop = (e) => {
      prevent(e);
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      if (!file.type.includes("json") && !file.name.endsWith(".json")) return;
      file.text().then((t) => {
        setEditorText(t);
        tryPrefillFromJSON(t, { toast: true, note: `Drag & drop: ${file.name}` });
      });
    };
    ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => el.addEventListener(evt, prevent));
    el.addEventListener("drop", onDrop);
    return () => {
      ["dragenter", "dragover", "dragleave", "drop"].forEach((evt) => el.removeEventListener(evt, prevent));
      el.removeEventListener("drop", onDrop);
    };
  }, []);

  // ---------- Parse editor JSON (for banner result) ----------
  const editorValidation = useMemo(() => {
    if (!editorText.trim()) return null;
    try {
      const j = JSON.parse(editorText);
      const rt = j.resourceType || j.type;
      if (rt === "Bundle") return { type: "Bundle", ok: true, msg: `Bundle with ${Array.isArray(j.entry) ? j.entry.length : 0} entries` };
      if (rt === "Condition") return { type: "Condition", ok: true, msg: "Condition JSON looks parseable" };
      return { type: rt || "Unknown", ok: true, msg: "Parsed JSON" };
    } catch (e) {
      return { type: "Invalid JSON", ok: false, msg: String(e?.message || "Parse error") };
    }
  }, [editorText]);

  // ---------- Helpers: import & export ----------
  function downloadJSON(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function extractConditionFromBundle(bundle) {
    if (!bundle || !Array.isArray(bundle.entry)) return null;
    const entry = bundle.entry.find(e => e?.resource?.resourceType === "Condition");
    return entry?.resource || null;
  }

  function prefillFromCondition(cond) {
    // subject
    const maybeRef = cond?.subject?.reference;
    if (typeof maybeRef === "string") setPatientRef(maybeRef);

    // statuses
    const cs = cond?.clinicalStatus?.coding?.[0]?.code;
    if (cs) setClinical(cs);
    const vs = cond?.verificationStatus?.coding?.[0]?.code;
    if (vs) setVerification(vs);

    // codes
    let n="", t="", b="";
    const codings = cond?.code?.coding || [];
    codings.forEach((c) => {
      const sys = String(c.system || "").toLowerCase();
      const code = c.code || "";
      if (!code) return;
      if (sys.includes("namaste")) n ||= code;
      else if (sys.includes("tm2") || sys.includes("traditional")) t ||= code;
      else if (sys.includes("biomed") || sys.includes("icd")) b ||= code; // broad catch for icd
    });
    if (n) setNamaste(n);
    if (t) setTm2(t);
    if (b) setBiomed(b);
  }

  function tryPrefillFromJSON(text, opts = {}) {
    try {
      const json = JSON.parse(text);
      if (json.resourceType === "Condition") {
        prefillFromCondition(json);
        setImportMsg(opts.toast ? "Prefilled from Condition" : "");
        appendAudit?.({ action: "FHIR Import", details: opts.note || "From editor/JSON: Condition" });
        return true;
      }
      if (json.resourceType === "Bundle") {
        const cond = extractConditionFromBundle(json);
        if (cond) {
          prefillFromCondition(cond);
          setImportMsg(opts.toast ? "Prefilled from Bundle → Condition" : "");
          appendAudit?.({ action: "FHIR Import", details: opts.note || "From editor/JSON: Bundle→Condition" });
          return true;
        }
      }
      setImportMsg(opts.toast ? "JSON parsed (no Condition found)" : "");
      return false;
    } catch (e) {
      setImportMsg(opts.toast ? "Invalid JSON" : "");
      return false;
    } finally {
      if (opts.toast) {
        const t = setTimeout(() => setImportMsg(""), 1800);
        return () => clearTimeout(t);
      }
    }
  }

  async function handleFileChoose(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileBusy(true);
    try {
      const text = await f.text();
      setEditorText(text);
      tryPrefillFromJSON(text, { toast: true, note: `Upload: ${f.name}` });
    } finally {
      setFileBusy(false);
      e.target.value = "";
    }
  }

  function exportCondition() {
    const file = { ...conditionJSON, id: `cond-${Date.now()}` };
    downloadJSON("Condition.json", file);
    appendAudit?.({ action: "Export Condition", details: file.id });
  }

  function exportBundle() {
    const cond = { ...conditionJSON, id: `cond-${Date.now()}` };
    const bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [{ resource: cond }],
    };
    downloadJSON("Bundle.json", bundle);
    appendAudit?.({ action: "Export Bundle", details: `entries: ${bundle.entry.length}` });
  }

  return (
    <div className="w-full" style={{ color: COLORS.text }}>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">FHIR Condition / Problem List Builder</h1>
          <p className="text-sm" style={{ color: COLORS.sub }}>
            Dual-coding with NAMASTE / ICD-11 (TM2, Biomed) — live preview and validation.
          </p>
          {!!importMsg && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-800">
              <span className="material-symbols-outlined text-base">task_alt</span>
              {importMsg}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onCopy}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: COLORS.primary }}
          >
            <span className="material-symbols-outlined text-base">content_copy</span> Copy JSON
          </button>
          <button
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: COLORS.primary }}
          >
            Save to Bundle Draft
          </button>
          <button
            onClick={exportCondition}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: COLORS.primary }}
            title="Download Condition.json"
          >
            <span className="material-symbols-outlined text-base">download</span> Export Condition
          </button>
          <button
            onClick={exportBundle}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ backgroundColor: COLORS.primary }}
            title="Download Bundle.json"
          >
            <span className="material-symbols-outlined text-base">archive</span> Export Bundle
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-8">
          <SoftCard title="Condition Details">
            <div className="grid grid-cols-1 gap-6">
              <Field label="Patient Reference" hint="Format: Patient/{id}">
                <input
                  value={patientRef}
                  onChange={(e) => setPatientRef(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ ["--tw"]: COLORS.primary }}
                  placeholder="e.g., Patient/123"
                  type="text"
                />
              </Field>
              <Field label="Clinical Status">
                <select
                  value={clinical}
                  onChange={(e) => setClinical(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ ["--tw"]: COLORS.primary }}
                >
                  {CLINICAL_STATUS.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Verification Status">
                <select
                  value={verification}
                  onChange={(e) => setVerification(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ ["--tw"]: COLORS.primary }}
                >
                  {VERIFICATION_STATUS.map((o) => (
                    <option key={o.code} value={o.code}>{o.label}</option>
                  ))}
                </select>
              </Field>
              <div className="flex items-center gap-2">
                <Badge tone="mint">Traditional Medicine</Badge>
              </div>
            </div>
          </SoftCard>

          <SoftCard title="Dual Coding">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge tone="mint">NAMASTE</Badge>
                <input
                  value={namaste}
                  onChange={(e) => setNamaste(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ ["--tw"]: COLORS.primary }}
                  placeholder="Enter NAMASTE code"
                  type="text"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="blue">ICD-11 TM2</Badge>
                <input
                  value={tm2}
                  onChange={(e) => setTm2(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ ["--tw"]: COLORS.primary }}
                  placeholder="Enter ICD-11 TM2 code"
                  type="text"
                />
              </div>
              <div className="flex items-center gap-2">
                <Badge tone="gray">ICD-11 Biomed</Badge>
                <input
                  value={biomed}
                  onChange={(e) => setBiomed(e.target.value)}
                  className="block w-full rounded-xl border-gray-300 shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)] sm:text-sm"
                  style={{ ["--tw"]: COLORS.primary }}
                  placeholder="Optional biomed code"
                  type="text"
                />
              </div>
            </div>

            {!biomed && (
              <div className="mt-4 flex items-start rounded-lg bg-amber-50 p-3 text-amber-800">
                
              </div>
            )}
          </SoftCard>
        </div>

        <div className="space-y-8">
          <SoftCard
            title="Preview JSON"
            right={
              <div className="flex items-center gap-2">
                <button onClick={onCopy} className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800">
                  <span className="material-symbols-outlined text-[16px]">content_copy</span> Copy
                </button>
                <button onClick={exportCondition} className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800" title="Download Condition.json">
                  <span className="material-symbols-outlined text-[16px]">download</span> Condition
                </button>
                <button onClick={exportBundle} className="group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-800" title="Download Bundle.json">
                  <span className="material-symbols-outlined text-[16px]">archive</span> Bundle
                </button>
              </div>
            }
          >
            <div className="h-80 overflow-hidden rounded-xl bg-gray-900">
              <pre className="h-full overflow-auto p-4 text-sm text-gray-200">
                {JSON.stringify(conditionJSON, null, 2)}
              </pre>
            </div>
          </SoftCard>

          <SoftCard title="Bundle / Condition Import">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <Field label="JSON Editor" hint="Paste JSON or drag & drop a .json file">
                  <textarea
                    ref={editorRef}
                    className="block w-full rounded-xl border-gray-300 font-mono text-sm shadow-sm focus:border-[var(--tw)] focus:ring-[var(--tw)]"
                    style={{ ["--tw"] : COLORS.primary }}
                    rows={12}
                    value={editorText}
                    onChange={(e) => setEditorText(e.target.value)}
                    placeholder='{"resourceType":"Bundle","entry":[...] }  or  {"resourceType":"Condition", ...}'
                  />
                </Field>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => tryPrefillFromJSON(editorText, { toast: true, note: "Prefill from editor" })}
                    className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm transition"
                    style={{ backgroundColor: COLORS.primary }}
                    disabled={!editorText.trim()}
                    title="Parse editor JSON and prefill fields"
                  >
                    <span className="material-symbols-outlined text-base">auto_fix_high</span> Prefill from editor
                  </button>

                  <label className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium cursor-pointer hover:bg-gray-50">
                    <input type="file" accept="application/json,.json" className="hidden" onChange={handleFileChoose} />
                    <span className="material-symbols-outlined text-base">{fileBusy ? "hourglass_top" : "upload_file"}</span>
                    {fileBusy ? "Reading…" : "Upload JSON"}
                  </label>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-gray-900">Validation Results</h4>
                <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold text-gray-700 sm:pl-4">Field</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Status</th>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-700">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {validations.map((v, i) => (
                        <tr key={i}>
                          <td className="whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-4">{v.field}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                            {v.status === "valid" && <Badge tone="green">Valid</Badge>}
                            {v.status === "error" && <Badge tone="red">Error</Badge>}
                            {v.status === "warn" && <Badge tone="yellow">Warning</Badge>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">{v.msg}</td>
                        </tr>
                      ))}
                      {editorValidation && (
                        <tr>
                          <td className="whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-gray-900 sm:pl-4">Editor JSON</td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                            {editorValidation.ok ? <Badge tone="green">Parsed</Badge> : <Badge tone="red">Invalid</Badge>}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-600">
                            {editorValidation.type}: {editorValidation.msg}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {editorValidation?.ok && editorValidation?.type === "Bundle" && (
                  <div className="mt-4 rounded-xl border p-4" style={{ backgroundColor: COLORS.mint50, borderColor: COLORS.mint100, color: COLORS.mint700 }}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: COLORS.mint100, color: COLORS.mint600 }}>
                        <span className="material-symbols-outlined">task_alt</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold" style={{ color: COLORS.mint800 }}>Bundle looks good</h4>
                        <p className="text-sm">Parsed and ready for prefill or export.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={onSave}
                className="flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ backgroundColor: COLORS.primary }}
              >
                Save to Bundle Draft
              </button>
            </div>
          </SoftCard>
        </div>
      </div>

      {/* tiny toasts */}
      {copied && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800 shadow">
            <span className="material-symbols-outlined">check_circle</span> JSON copied
          </div>
        </div>
      )}
      {saved && (
        <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-3">
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800 shadow">
            <span className="material-symbols-outlined">task_alt</span> Saved Condition to draft
          </div>
        </div>
      )}
    </div>
  );
}
