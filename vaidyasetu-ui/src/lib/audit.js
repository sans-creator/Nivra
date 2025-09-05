// src/lib/audit.js
const STORAGE_KEY = "vs_audit_stream_v1";

// Format: "YYYY-MM-DD HH:MM AM/PM" in en-IN
const fmt = new Intl.DateTimeFormat("en-IN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});
function formatDateIST(d) {
  const parts = fmt.formatToParts(d).reduce((acc, p) => ((acc[p.type] = p.value), acc), {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

export function loadAudit() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function appendAudit({ action, details, user = "You" }) {
  const ev = {
    timestamp: formatDateIST(new Date()),
    user,
    action,
    details,
  };
  const list = [ev, ...loadAudit()].slice(0, 1000); // keep last 1000
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  // Notify current tab
  window.dispatchEvent(new CustomEvent("vs:audit"));
  return ev;
}

export function clearAudit() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("vs:audit"));
}

export function subscribeAudit(handler) {
  // Fires when any tab updates (storage) and current tab updates (custom)
  const onStorage = (e) => {
    if (e.key === STORAGE_KEY) handler(loadAudit());
  };
  const onCustom = () => handler(loadAudit());
  window.addEventListener("storage", onStorage);
  window.addEventListener("vs:audit", onCustom);
  // initial push
  handler(loadAudit());
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("vs:audit", onCustom);
  };
}
