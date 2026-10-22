export function logInfo(event, details = {}) {
  console.log(`[RAG] ${event}`, JSON.stringify(details));
}

export function logError(event, error, details = {}) {
  console.error(`[RAG] ${event}`, JSON.stringify({
    ...details,
    error: error?.message || String(error)
  }));
}
