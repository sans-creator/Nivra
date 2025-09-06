import React, { useEffect, useRef, useState } from "react";
import { appendAudit } from "@/lib/audit";
import { geminiText } from "@/lib/gemini"; // uses your existing helper

const COLORS = { primary: "#4a9b8e", text: "#333", sub: "#666" };

function StatusDot({ online = true }) {
  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${online ? "bg-emerald-500" : "bg-gray-300"}`}
      aria-label={online ? "online" : "offline"}
    />
  );
}

function HeaderAction({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-white/50 bg-white/50 px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-white/70 transition"
    >
      <span className="material-symbols-outlined text-[16px]">{icon}</span>
      {label}
    </button>
  );
}

function Bubble({ role, children, ts }) {
  const mine = role === "user";
  return (
    <div className={`mb-4 flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 shadow-soft ${mine ? "bg-[var(--primary)] text-white" : "bg-white/70 backdrop-blur border border-white/60 text-[var(--text)]"}`}>
        <div className="whitespace-pre-wrap text-[14px] leading-5">{children}</div>
        {ts && (
          <div className={`mt-1 text-[11px] ${mine ? "text-white/80" : "text-[var(--text)]/60"}`}>
            {new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="mb-4 flex justify-start">
      <div className="rounded-2xl bg-white/70 backdrop-blur border border-white/60 px-3 py-2 text-[var(--text)] shadow-soft">
        <span className="inline-flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:-.2s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500 [animation-delay:.2s]" />
        </span>
      </div>
    </div>
  );
}

function QuickChip({ text, onClick }) {
  return (
    <button
      onClick={() => onClick?.(text)}
      className="rounded-full border border-white/60 bg-white/60 backdrop-blur px-3 py-1 text-xs font-medium text-[var(--text)] hover:bg-white/80 transition"
    >
      {text}
    </button>
  );
}

const contextHeader = `
You are the in-app support bot for a health terminology tool.
Pages: Dashboard, Namaste Codes, Mapping (NAMASTE ⇄ ICD-11/TM2/BIO), FHIR Builder, Bundle Draft.
LocalStorage keys: vs_mappings_v1, vs_fhir_prefill_v1, vs_bundle_draft_v1.
Be short, actionable. Use bullets/steps. If JSON is pasted, detect resourceType and summarize key fields.
`.trim();

export default function Support() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I’m your support assistant. ",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const fileRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const quickPrompts = [
    "How do I prefill FHIR Builder from a mapping?",
    "Why did mapping coverage drop last week?",
    "Show steps to export Bundle draft.",
    "Explain this Condition JSON.",
    "Suggest NAMASTE & ICD-11 codes for Headache.",
  ];

  async function askGemini(userText) {
    const history = messages
      .slice(-8)
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const prompt = `${contextHeader}

Conversation so far:
${history}

USER QUESTION:
${userText}

Answer clearly in short bullet points or numbered steps. If the question mentions JSON, identify resourceType and highlight important fields.`;

    return await geminiText(prompt);
  }

  async function onSend(e) {
    e?.preventDefault();
    const q = input.trim();
    if (!q || busy) return;

    setError("");
    setMessages((xs) => [...xs, { role: "user", content: q, ts: Date.now() }]);
    setInput("");
    setBusy(true);

    try {
      const a = await askGemini(q);
      setMessages((xs) => [...xs, { role: "assistant", content: a, ts: Date.now() }]);
      appendAudit?.({ action: "Support Ask", details: q });
    } catch (err) {
      setError(err?.message || "AI request failed.");
    } finally {
      setBusy(false);
    }
  }

  function sendQuick(text) {
    setInput(text);
    setTimeout(() => onSend(), 0);
  }

  async function onUploadFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      let tag = "file";
      try {
        const j = JSON.parse(text);
        tag = j?.resourceType || j?.type || "json";
      } catch {}
      const q = `I uploaded a ${tag} file. Please analyze:\n\n${text.slice(0, 20000)}`;
      setMessages((xs) => [...xs, { role: "user", content: q, ts: Date.now() }]);
      setBusy(true);
      const a = await askGemini(q);
      setMessages((xs) => [...xs, { role: "assistant", content: a, ts: Date.now() }]);
      appendAudit?.({ action: "Support Upload", details: `${tag} (${file.name})` });
    } catch {
      setError("Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        role: "assistant",
        content:
          "Chat cleared. How can I help? You can also upload a FHIR Bundle/Condition JSON, and I’ll summarize it.",
        ts: Date.now(),
      },
    ]);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6">
      {/* Title row */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Support</h1>
          <p className="text-sm text-[var(--sub)]">
            Chat with the assistant, ask questions, or upload JSON for quick explanations.
          </p>
        </div>
      </div>

      {/* Chat box with gradient border */}
      <div className="relative mx-auto max-w-3xl">
        <div className="rounded-[22px] p-[1px] bg-gradient-to-br from-teal-300/70 via-emerald-300/60 to-cyan-300/70 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
          <div className="glass-soft rounded-[21px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/50 px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--primary)] text-white text-lg shadow">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[var(--text)]">Nivra Support</h2>
                    <StatusDot online />
                  </div>
                  <div className="text-xs text-[var(--sub)]">Ask me about Mapping, FHIR, or Bundles</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <HeaderAction icon="delete_sweep" label="Clear" onClick={clearChat} />
                <HeaderAction icon="upload_file" label="Upload JSON" onClick={() => fileRef.current?.click()} />
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => onUploadFile(e.target.files?.[0])}
                />
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="max-h-[60vh] overflow-auto px-5 py-4 bg-noise rounded-b-[21px]"
            >
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role} ts={m.ts}>
                  {m.content}
                </Bubble>
              ))}
              {busy && <TypingDots />}
            </div>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 px-5 pt-3">
              {quickPrompts.map((t) => (
                <QuickChip key={t} text={t} onClick={sendQuick} />
              ))}
            </div>

            {/* Composer */}
            <form
              onSubmit={onSend}
              className="mt-3 flex items-center gap-2 border-t border-white/50 px-3 py-3"
            >
              <div className="relative flex-1">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your question… (Shift+Enter = newline)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) onSend(e);
                  }}
                  className="w-full resize-none rounded-md border border-white/60 bg-white/60 backdrop-blur p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40"
                />
                {/* inline attach button (mobile-friendly) */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/60 bg-white/60 backdrop-blur p-1 hover:bg-white/80"
                  title="Upload JSON"
                >
                  <span className="material-symbols-outlined text-[18px] text-[var(--text)]">attach_file_add</span>
                </button>
              </div>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="btn btn-primary"
                style={{ backgroundColor: COLORS.primary }}
              >
                <span className="material-symbols-outlined">send</span>
                Send
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Error bar */}
      {error && (
        <div className="mx-auto mt-4 max-w-3xl rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
          {error}
        </div>
      )}
    </div>
  );
}
