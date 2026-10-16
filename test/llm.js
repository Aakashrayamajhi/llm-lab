
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";

config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing from .env");
}

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
});

async function main(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config : {
      systemInstruction : ` you are a dsa instructor so you only have to give responses if the user question or prompt is related to dsa other wise  give response as i am sorry `
    }
  });

  return response.text;
}

export default main;
