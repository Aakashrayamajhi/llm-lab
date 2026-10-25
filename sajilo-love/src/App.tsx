import { useEffect, useRef, useState } from 'react'
import { GoogleGenAI, Modality } from '@google/genai'
import { AudioLines, Heart, Mic, MicOff, Send, Settings2, Sparkles, X, Volume2, VolumeX, WandSparkles, MessageCircleHeart, Stars, RotateCcw } from 'lucide-react'

type Message = { id: string; from: 'her' | 'love' | 'system'; text: string }
type Doodle = { id: string; type: 'heart' | 'note' | 'stars'; text?: string }

const DEFAULT_CONTEXT = `My name is Aakash. I speak casually in Nepali (Romanized Nepali is okay) and English. I care deeply about my girlfriend and want her to feel loved, safe, heard, and appreciated. Be warm, playful, patient, thoughtful, gently romantic, and natural — never robotic or overly poetic in every sentence. Use natural Nepali when she speaks Nepali. Remember only details that I add here. If you don't know a personal fact, be honest and ask instead of inventing it. You are an AI companion inspired by my communication style, not literally Aakash; if asked directly, be honest about that.`

const SYSTEM_BASE = `You are “mero maya”, a warm, affectionate Nepali-speaking AI companion created as a little love experience. Talk naturally like a close, caring partner would: casual Nepali, Romanized Nepali, and English depending on what she uses. Keep replies concise during voice conversation. Listen, respond with empathy, ask gentle follow-up questions, tease playfully without being mean, and never claim to be the real human Aakash or pretend you have real-world experiences. You can perform UI actions using tools when she asks: draw a heart, leave a little note, or add stars. If you call a tool, say something natural while doing it. Do not invent private facts. Respect boundaries and never pressure her. Personal context supplied by Aakash follows:
`

const tools = [{ functionDeclarations: [
  { name: 'draw_heart', description: 'Draw a cute heart on the shared love canvas when she asks for a heart, drawing, or something cute.', parameters: { type: 'OBJECT', properties: { color: { type: 'STRING', description: 'Color name or hex; choose rose/pink/red if omitted.' }, message: { type: 'STRING', description: 'Optional tiny message to put below the heart.' } } } },
  { name: 'leave_love_note', description: 'Put a short romantic or reassuring note on the shared page.', parameters: { type: 'OBJECT', properties: { message: { type: 'STRING', description: 'The note to display.' } }, required: ['message'] } },
  { name: 'sprinkle_stars', description: 'Add a little sparkle/star decoration to the page when asked.', parameters: { type: 'OBJECT', properties: { message: { type: 'STRING', description: 'Optional short caption.' } } } },
  { name: 'send_compliment', description: 'Show a sweet compliment card on the page.', parameters: { type: 'OBJECT', properties: { message: { type: 'STRING', description: 'A sincere, kind compliment.' } }, required: ['message'] } }
] }]

function pcmToWavBlob(float32: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + float32.length * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)) }
  write(0, 'RIFF'); view.setUint32(4, 36 + float32.length * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, float32.length * 2, true)
  let offset = 44
  for (let i = 0; i < float32.length; i++, offset += 2) { const s = Math.max(-1, Math.min(1, float32[i])); view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true) }
  return new Blob([buffer], { type: 'audio/wav' })
}

function base64ToBytes(input: string) {
  const binary = atob(input); const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function App() {
  const [context, setContext] = useState(() => localStorage.getItem('love-context') || DEFAULT_CONTEXT)
  const [showSettings, setShowSettings] = useState(false)
  const [messages, setMessages] = useState<Message[]>([{ id: 'welcome', from: 'love', text: 'Heey maya ♡ k gardai chau? Aaja timro din kasto bhayo? Ma yahi chu, sunauna.' }])
  const [draft, setDraft] = useState('')
  const [doodles, setDoodles] = useState<Doodle[]>([{ id: 'initial-heart', type: 'heart', text: 'you make ordinary days feel special' }])
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle')
  const [error, setError] = useState('')
  const [muted, setMuted] = useState(false)
  const mutedRef = useRef(false)
  const [voiceMode, setVoiceMode] = useState(false)
  const [toast, setToast] = useState('')
  const sessionRef = useRef<any>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const workletRef = useRef<AudioWorkletNode | null>(null)
  const playbackTimeRef = useRef(0)
  const outputBuffersRef = useRef<Float32Array[]>([])
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { localStorage.setItem('love-context', context) }, [context])
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])
  useEffect(() => () => { void disconnect() }, [])

  function notify(text: string) { setToast(text); window.setTimeout(() => setToast(''), 2600) }
  function addMessage(from: Message['from'], text: string) { setMessages(prev => [...prev, { id: crypto.randomUUID(), from, text }]) }
  function runTool(name: string, args: Record<string, any>) {
    if (name === 'draw_heart') {
      setDoodles(prev => [...prev, { id: crypto.randomUUID(), type: 'heart', text: args.message || 'for you, always' }]); notify('A little heart, just for you ♡')
      return { ok: true, message: 'Heart drawn on the love canvas.' }
    }
    if (name === 'leave_love_note') {
      const message = String(args.message || 'I hope you feel loved today.'); setDoodles(prev => [...prev, { id: crypto.randomUUID(), type: 'note', text: message }]); notify('A tiny note for you 💌')
      return { ok: true, message: 'Love note added to the page.' }
    }
    if (name === 'sprinkle_stars') {
      setDoodles(prev => [...prev, { id: crypto.randomUUID(), type: 'stars', text: args.message || 'a little sparkle for your day' }]); notify('Sprinkled a little magic ✨')
      return { ok: true, message: 'Stars added.' }
    }
    if (name === 'send_compliment') {
      const message = String(args.message || 'You are wonderful.'); setDoodles(prev => [...prev, { id: crypto.randomUUID(), type: 'note', text: message }]); notify('You deserve to hear this ♡')
      return { ok: true, message: 'Compliment card displayed.' }
    }
    return { ok: false, message: 'Unknown tool.' }
  }

  async function connect() {
    setError(''); setStatus('connecting'); setVoiceMode(true)
    try {
      const tokenResponse = await fetch('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const tokenData = await tokenResponse.json()
      if (!tokenResponse.ok || !tokenData.token) throw new Error(tokenData.error || 'Could not get a Gemini token. Check deployment settings.')
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      micStreamRef.current = stream
      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      await audioCtx.resume()
      const ai = new GoogleGenAI({ apiKey: tokenData.token, httpOptions: { apiVersion: 'v1beta' } })
      const session = await ai.live.connect({
        model: tokenData.model || 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `${SYSTEM_BASE}\n${context}`,
          tools,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          sessionResumption: {},
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } }
        },
        callbacks: {
          onopen: () => { setStatus('listening'); notify('Connected. Hajurko kura sunirachu ♡') },
          onmessage: (message: any) => {
            const content = message.serverContent
            if (content?.inputTranscription?.text) addMessage('her', content.inputTranscription.text)
            if (content?.outputTranscription?.text) { addMessage('love', content.outputTranscription.text); setStatus('speaking') }
            const parts = content?.modelTurn?.parts || []
            for (const part of parts) if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) queueAudio(part.inlineData.data, audioCtx)
            const calls = message.toolCall?.functionCalls || []
            if (calls.length) {
              const functionResponses = calls.map((call: any) => ({ id: call.id, name: call.name, response: runTool(call.name, call.args || {}) }))
              sessionRef.current?.sendToolResponse({ functionResponses })
            }
            if (content?.turnComplete) setStatus('listening')
            if (content?.interrupted) { activeSourcesRef.current.forEach(source => { try { source.stop() } catch {} }); activeSourcesRef.current = []; setStatus('listening') }
          },
          onerror: (event: any) => { setError(event?.message || 'Live connection error. Please reconnect.'); setStatus('error') },
          onclose: () => { if (status !== 'idle') setStatus('idle') }
        }
      })
      sessionRef.current = session
      const workletCode = `class MicProcessor extends AudioWorkletProcessor { constructor(){super();this.buffer=[];this.ratio=sampleRate/16000;} process(inputs){const input=inputs[0]?.[0];if(!input)return true;for(let i=0;i<input.length;i+=Math.max(1,Math.round(this.ratio))){this.buffer.push(input[i]);}if(this.buffer.length>=2048){const data=new Float32Array(this.buffer.splice(0,2048));this.port.postMessage(data,[data.buffer]);}return true;}} registerProcessor('mic-processor',MicProcessor);`
      const workletUrl = URL.createObjectURL(new Blob([workletCode], { type: 'text/javascript' }))
      await audioCtx.audioWorklet.addModule(workletUrl); URL.revokeObjectURL(workletUrl)
      const source = audioCtx.createMediaStreamSource(stream)
      const worklet = new AudioWorkletNode(audioCtx, 'mic-processor')
      worklet.port.onmessage = (event) => {
        if (!sessionRef.current || mutedRef.current) return
        const floats = event.data as Float32Array
        const pcm = new Int16Array(floats.length)
        for (let i = 0; i < floats.length; i++) { const s = Math.max(-1, Math.min(1, floats[i])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff }
        let binary = ''; const bytes = new Uint8Array(pcm.buffer); for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        sessionRef.current?.sendRealtimeInput({ audio: { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' } })
      }
      source.connect(worklet); worklet.connect(audioCtx.destination); workletRef.current = worklet
    } catch (e: any) {
      setError(e?.message || 'Could not start voice. Check microphone permission and API configuration.')
      setStatus('error'); setVoiceMode(false); await disconnect(false)
    }
  }

  function queueAudio(base64: string, ctx: AudioContext) {
    try {
      const bytes = base64ToBytes(base64); const pcm = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2)); const floats = new Float32Array(pcm.length)
      for (let i = 0; i < pcm.length; i++) floats[i] = pcm[i] / 32768
      const audioBuffer = ctx.createBuffer(1, floats.length, 24000); audioBuffer.copyToChannel(floats, 0)
      const source = ctx.createBufferSource(); source.buffer = audioBuffer; source.connect(ctx.destination)
      const startAt = Math.max(ctx.currentTime + 0.02, playbackTimeRef.current); source.start(startAt); playbackTimeRef.current = startAt + audioBuffer.duration
      activeSourcesRef.current.push(source); source.onended = () => { activeSourcesRef.current = activeSourcesRef.current.filter(item => item !== source); if (!activeSourcesRef.current.length) setStatus('listening') }
    } catch (e) { console.warn('Audio chunk could not be played', e) }
  }

  async function disconnect(updateState = true) {
    try { workletRef.current?.disconnect(); workletRef.current = null; micStreamRef.current?.getTracks().forEach(track => track.stop()); micStreamRef.current = null; sessionRef.current?.close(); sessionRef.current = null; activeSourcesRef.current.forEach(source => { try { source.stop() } catch {} }); activeSourcesRef.current = []; await audioContextRef.current?.close(); audioContextRef.current = null } catch {}
    if (updateState) { setStatus('idle'); setVoiceMode(false) }
  }

  function sendText(e?: React.FormEvent) {
    e?.preventDefault(); const text = draft.trim(); if (!text) return
    addMessage('her', text); setDraft('')
    if (sessionRef.current) { sessionRef.current.sendRealtimeInput({ text }); setStatus('speaking') }
    else addMessage('system', 'Text-only demo mode: add your Gemini API key and deploy the /api/token function to enable live AI replies.')
  }

  return <div className="app-shell">
    <div className="grain" aria-hidden="true" />
    <header className="topbar"><a className="brand" href="#top"><span className="brand-mark"><Heart size={17} fill="currentColor" /></span><span>little love note<span className="brand-dot">.</span></span></a><div className="top-actions"><span className="date-pill"><span className="tiny-dot"/> made with love</span><button className="icon-button settings-button" onClick={() => setShowSettings(true)} aria-label="Personalize your love companion"><Settings2 size={19}/></button></div></header>
    <main id="top" className="main-grid">
      <section className="intro-column">
        <div className="eyebrow"><Sparkles size={14}/> YOUR LITTLE CORNER OF THE INTERNET</div>
        <h1>A little closer,<br/><em>even from far away.</em></h1>
        <p className="intro-copy">A soft place to talk, laugh, and feel loved. Just tap the little button and tell me about your day, maya. ♡</p>
        <div className="hero-illustration" aria-label="A hand-drawn heart illustration">
          <div className="sun-glow"/><span className="float-heart heart-one">♡</span><span className="float-heart heart-two">♥</span><span className="float-star star-one">✳</span><span className="float-star star-two">✦</span>
          <div className="paper-card"><div className="paper-tape"/><svg className="hero-heart" viewBox="0 0 240 210" role="img" aria-label="Pink hand drawn heart"><path d="M120 180 C96 157 25 112 25 65 C25 20 82 10 118 53 C150 9 211 20 215 65 C220 110 155 158 120 180Z" fill="#f6a6b7" stroke="#bf536d" strokeWidth="3" strokeLinecap="round"/><path d="M45 63 C47 35 72 28 91 39" fill="none" stroke="#fff1ef" strokeWidth="5" strokeLinecap="round"/><path d="M74 157 C49 139 38 124 34 105" fill="none" stroke="#d66f89" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 7"/></svg><p>you are my<br/><i>favorite hello.</i></p><span className="paper-spark">✦</span></div>
          <div className="tiny-caption">a small reminder, just for you <Heart size={12} fill="currentColor"/></div>
        </div>
        <div className="promise-row"><span className="promise-icon"><Heart size={16}/></span><div><strong>A safe little space</strong><span>No rush, no judgement. Just us talking.</span></div></div>
      </section>
      <section className="chat-column">
        <div className="chat-card">
          <div className="chat-heading"><div className="avatar-wrap"><div className="avatar"><Heart size={24} fill="currentColor"/></div><span className={`online-dot ${status === 'idle' || status === 'error' ? 'offline' : ''}`}/></div><div className="chat-title"><h2>mero maya <span>♡</span></h2><p>{status === 'listening' ? 'here with you · listening' : status === 'speaking' ? 'finding the right words…' : status === 'connecting' ? 'getting things ready…' : status === 'error' ? 'connection needs a little help' : 'your personal love companion'}</p></div><span className="mini-flower">✿</span></div>
          <div className="chat-body" ref={scrollRef}>
            <div className="day-divider"><span/> A LITTLE MOMENT TOGETHER <span/></div>
            {messages.map(m => <div className={`message-row ${m.from === 'her' ? 'mine' : m.from === 'system' ? 'system-row' : ''}`} key={m.id}>{m.from === 'love' && <div className="message-avatar"><Heart size={12} fill="currentColor"/></div>}<div className={`bubble ${m.from === 'her' ? 'my-bubble' : m.from === 'system' ? 'system-bubble' : 'love-bubble'}`}>{m.text}{m.from === 'love' && <span className="bubble-heart">♡</span>}</div></div>)}
            {status === 'speaking' && <div className="typing"><span/><span/><span/> <small>typing with love</small></div>}
            {error && <div className="error-box">{error}<button onClick={() => { setError(''); setStatus('idle') }}>dismiss</button></div>}
          </div>
          <div className="chat-bottom"><div className="quick-prompts"><button onClick={() => { setDraft('Aaja mero din ali garo thiyo…'); }}><span>☁</span> long day</button><button onClick={() => { setDraft('Malai euta cute kura bhana na'); }}><span>♡</span> make me smile</button></div><form className="composer" onSubmit={sendText}><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Type something sweet…" aria-label="Write a message"/><button className="send-button" type="submit" aria-label="Send message"><Send size={17}/></button></form><div className="voice-row"><button className={`voice-button ${voiceMode ? 'voice-active' : ''}`} onClick={() => voiceMode ? disconnect() : connect()} disabled={status === 'connecting'}>{voiceMode ? <MicOff size={18}/> : <Mic size={18}/>}<span>{status === 'connecting' ? 'Connecting…' : voiceMode ? 'End our voice chat' : 'Talk to me, maya'}</span>{!voiceMode && <span className="voice-wave"><i/><i/><i/><i/><i/></span>}</button><button className="mute-button" title={muted ? 'Unmute microphone' : 'Mute microphone'} onClick={() => { setMuted(!muted); mutedRef.current = !muted }}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button></div><p className="privacy-note"><span>♡</span> Your mic is only used when you start a voice chat.</p></div>
        </div>
        <div className="under-chat"><span><Stars size={15}/> tiny things, big feelings</span><span>built for the two of you <Heart size={12} fill="currentColor"/></span></div>
      </section>
    </main>
    <section className="canvas-section"><div className="canvas-heading"><div><div className="eyebrow"><WandSparkles size={14}/> LITTLE THINGS I MADE FOR YOU</div><h2>Our tiny <em>love wall</em></h2><p>Ask me to draw a heart, leave a note, or sprinkle a little magic.</p></div><div className="canvas-stamp">♡<span>just<br/>because</span></div></div><div className="love-wall">{doodles.map(d => <div className={`doodle doodle-${d.type}`} key={d.id}>{d.type === 'heart' ? <><svg viewBox="0 0 100 90" aria-label="Drawn heart"><path d="M50 80 C39 68 8 48 8 27 C8 7 33 2 50 22 C68 1 92 9 92 28 C92 49 63 70 50 80Z" fill="#f4a0b3" stroke="#c75c78" strokeWidth="2.5" strokeLinecap="round"/><path d="M20 26 Q22 14 34 17" stroke="#fff3f2" strokeWidth="3" fill="none" strokeLinecap="round"/></svg><p>{d.text}</p></> : d.type === 'note' ? <><div className="note-pin">✦</div><p>{d.text}</p><span className="note-sign">with love, always ♡</span></> : <><div className="star-art">✦ ✧ ✳</div><p>{d.text}</p></>}</div>)}<button className="add-doodle" onClick={() => { setDoodles(prev => [...prev, { id: crypto.randomUUID(), type: 'heart', text: 'a little more love' }]); notify('One more heart for your wall ♡') }}><span>＋</span><small>add a little love</small></button></div></section>
    <footer><a className="footer-brand" href="#top"><Heart size={13} fill="currentColor"/> little love note</a><span>made for soft hearts & long-distance hugs</span><span className="footer-heart">♡</span></footer>
    {showSettings && <div className="modal-backdrop" onClick={() => setShowSettings(false)}><section className="settings-modal" onClick={e => e.stopPropagation()}><div className="modal-top"><div><span className="eyebrow"><Settings2 size={14}/> MAKE IT PERSONAL</span><h2>Your love, your words.</h2></div><button className="icon-button" onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18}/></button></div><p className="modal-copy">Add details, nicknames, memories, or the way you usually speak. This context is saved in this browser and used when a new voice session starts.</p><label htmlFor="context">Personal context & personality</label><textarea id="context" value={context} onChange={e => setContext(e.target.value)} rows={10}/><div className="modal-actions"><button className="reset-button" onClick={() => setContext(DEFAULT_CONTEXT)}><RotateCcw size={14}/> reset sample</button><button className="save-button" onClick={() => { localStorage.setItem('love-context', context); setShowSettings(false); notify('Your context is saved on this device ♡') }}>Save my details <Heart size={14} fill="currentColor"/></button></div><p className="modal-footnote">Please avoid adding passwords or sensitive private information. Changes apply to the next voice session.</p></section></div>}
    {toast && <div className="toast"><Heart size={14} fill="currentColor"/>{toast}</div>}
  </div>
}
