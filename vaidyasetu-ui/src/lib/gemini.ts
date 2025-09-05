// src/lib/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) console.warn("VITE_GEMINI_API_KEY is missing. Set it in .env");

const genAI = new GoogleGenerativeAI(apiKey);

// Text model
const textModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

// JSON model (same model, but we ask for JSON output)
const jsonModel = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
  generationConfig: { responseMimeType: "application/json" },
});

export async function geminiText(prompt: string): Promise<string> {
  // 👇 Pass a plain string (simplest + correct)
  const r = await textModel.generateContent(prompt);
  return r.response.text();
}

export async function geminiJSON(system: string, user: string): Promise<any> {
  // OPTION 1 (simplest): pass a single string
  const prompt = `${system}\n\n${user}`;
  const r = await jsonModel.generateContent(prompt);

  // OPTION 2 (equally valid): pass a full object with `contents`
  // const r = await jsonModel.generateContent({
  //   contents: [
  //     { role: "user", parts: [{ text: `${system}\n\n${user}` }] },
  //   ],
  // });

  const raw = r.response.text();
  try {
    return JSON.parse(raw);
  } catch {
    // try to salvage JSON from a text blob
    const m = raw.match(/\{[\s\S]*\}$/);
    return m ? JSON.parse(m[0]) : {};
  }
}
