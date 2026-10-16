import { useState, type FormEvent } from 'react'

function App() {
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setResponse('')
    setIsLoading(true)

    try {
      const result = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data: { text?: string; error?: string } = await result.json()

      if (!result.ok) {
        throw new Error(data.error ?? 'The request failed. Please try again.')
      }

      if (!data.text) {
        throw new Error('The backend returned an empty response.')
      }

      setResponse(data.text)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Could not reach the backend. Make sure the server is running.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:py-24">
      <section className="mx-auto w-full max-w-2xl">
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-400">
          LLM Lab
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Ask the model
        </h1>
        <p className="mt-3 leading-7 text-slate-300">
          Write a prompt and send it to the model.
        </p>

        <form
          className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-2xl sm:p-7"
          onSubmit={handleSubmit}
        >
          <label
            className="mb-3 block text-sm font-medium text-slate-200"
            htmlFor="prompt"
          >
            Your prompt
          </label>
          <textarea
            className="min-h-36 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            id="prompt"
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="What would you like to ask?"
            required
            value={prompt}
          />
          <button
            className="mt-4 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || !prompt.trim()}
            type="submit"
          >
            {isLoading ? 'Sending…' : 'Send prompt'}
          </button>
        </form>

        {isLoading && (
          <p className="mt-6 text-slate-300" role="status">
            Waiting for the model…
          </p>
        )}
        {error && (
          <p
            className="mt-6 rounded-xl border border-red-900 bg-red-950/50 p-4 text-red-200"
            role="alert"
          >
            {error}
          </p>
        )}
        {response && (
          <section
            aria-labelledby="response-heading"
            className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7"
          >
            <h2 className="text-lg font-semibold text-cyan-300" id="response-heading">
              Response
            </h2>
            <p className="mt-4 whitespace-pre-wrap leading-7 text-slate-200">
              {response}
            </p>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
