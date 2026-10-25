import { GoogleGenAI } from '@google/genai'
import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' })
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in Vercel Environment Variables.' })
  try {
    const ai = new GoogleGenAI({ apiKey })
    const now = Date.now()
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
          config: { responseModalities: ['AUDIO'], sessionResumption: {} }
        }
      }
    })
    return res.status(200).json({ token: token.name, model: process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview' })
  } catch (e) {
    console.error('Gemini ephemeral token error', e)
    return res.status(502).json({ error: 'Could not create a Gemini Live token. Check the API key and Live API model access.' })
  }
}
