import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY in .env");
}

export const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export const CHAT_MODEL =
  process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
