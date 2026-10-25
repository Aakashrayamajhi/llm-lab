# little love note ♡

A responsive, mobile-first romantic companion UI with a Gemini Live voice session, editable personal context, and UI tools that can draw hearts, add notes, sprinkle stars, and show compliments.

## Tech
- React + TypeScript + Vite
- Gemini Live API via `@google/genai`
- Server-side ephemeral-token endpoint (`/api/token`) so the long-lived Gemini API key is not sent to the browser
- Browser microphone + AudioWorklet PCM streaming; Gemini Live native audio playback
- Vercel deployment

> **Transport note:** Gemini Live API currently uses WebSockets. This project uses the supported Live API WebSocket transport, not WebRTC. Do not advertise it as a WebRTC connection. Native WebRTC would require a different provider or an additional WebRTC-capable media layer.

## Run locally

Use Node.js 20+ (Node 22 recommended).

```bash
npm install
cp .env.example .env.local
# Put your key in .env.local as GEMINI_API_KEY=...
npm run dev
```

Vite only serves the frontend; it does not run Vercel's `/api/token` function. For a complete local test, use the Vercel CLI:

```bash
npm install -g vercel
vercel dev
```

Then open the local URL shown by Vercel. Microphone permission requires localhost or HTTPS.

## Deploy to Vercel

1. Upload this folder to a Git repository and import it into Vercel.
2. In **Project → Settings → Environment Variables**, add `GEMINI_API_KEY` with your Google AI Studio API key.
3. Optionally set `GEMINI_LIVE_MODEL` to a Live API model enabled for your account. Default: `gemini-3.1-flash-live-preview`.
4. Deploy. Open the deployed HTTPS URL and allow microphone access when starting a voice chat.

Get a key: https://aistudio.google.com/app/apikey

## Personal context

Open the settings icon in the UI to edit the companion context. The text is saved in that browser's `localStorage` and included in the next voice session's system instruction. This is convenient for a personal gift but is not encrypted storage; don't put secrets or sensitive private information there. The current starter does not sync context between devices.

## Notes / limitations

- Google API access, model availability, quotas, regional access, and free-tier limits depend on your account and Google's current offering. “Free” is not guaranteed for all usage.
- Live sessions have duration/context limits; reconnect when a session ends.
- The API key stays server-side, but ephemeral tokens are short-lived client credentials. The endpoint should be protected with real authentication/rate limits before making the app public.
- The AI should be transparent if asked: it is an AI companion inspired by the supplied context, not the actual human.
- Voice quality and Nepali fluency vary by model/voice and may require prompt tuning.
- The tool-driven drawings/notes are local UI actions, not external actions or saved cloud data.
