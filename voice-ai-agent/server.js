import { config } from 'dotenv';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

config()

const app = express();
const PORT = Number(process.env.PORT) || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const apiKey = process.env.GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, apiKeyConfigured: Boolean(apiKey) });
});

app.post('/api/chat', async (req, res) => {
  try {
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing. Add it to your .env file.' });
    }

    const message = req.body?.message;
    console.log("message :" , message)
    if (typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Please send a non-empty message.' });
    }
    if (message.length > 4000) {
      return res.status(413).json({ error: 'Message is too long. Keep it under 4000 characters.' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: message.trim(),
      config: {
        systemInstruction: 'You are a friendly voice assistant. Give clear, conversational answers that sound natural when read aloud. Keep answers reasonably concise unless the user asks for detail.',
        maxOutputTokens: 500
      }
    });

    const answer = response.text?.trim();
    if (!answer) {
      return res.status(502).json({ error: 'The AI returned an empty response. Please try again.' });
    }
    console.log("ai-response :" , answer)
    res.json({ answer });
  } catch (error) {
    console.error('Gemini request failed:', error?.message || error);
    res.status(500).json({ error: 'AI request failed. Check your API key, quota, internet connection, and server logs.' });
  }
});

app.listen(PORT, () => {
  console.log(`Voice AI Agent running at http://localhost:${PORT}`);
  if (!apiKey) console.warn('GEMINI_API_KEY is missing. Add it to .env before chatting.');
});
