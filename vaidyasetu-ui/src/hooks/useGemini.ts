import { useCallback, useEffect, useRef, useState } from "react";
import { geminiText } from "@/lib/gemini";

export function useGemini(debounceMs = 350) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<string>("");
  const [error, setError] = useState<string>("");

  const timer = useRef<number | null>(null);
  const lastReq = useRef(0);

  const ask = useCallback((prompt: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const reqId = Date.now();
      lastReq.current = reqId;
      setLoading(true);
      setError("");
      try {
        const out = await geminiText(prompt);
        // ignore stale responses
        if (lastReq.current === reqId) setData(out);
      } catch (e: any) {
        if (lastReq.current === reqId) setError(e?.message || "Gemini error");
      } finally {
        if (lastReq.current === reqId) setLoading(false);
      }
    }, debounceMs) as unknown as number;
  }, [debounceMs]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  return { ask, loading, data, error, setData };
}
