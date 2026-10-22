# Gemini + Pinecone document-schema PDF RAG (JavaScript)

A starter project: upload a PDF, extract and chunk its text, let Pinecone embed and store the chunks, then answer questions using retrieved chunks from **that selected PDF only**.

## Requirements
- Node.js 22+
- Google AI Studio API key with Gemini generation access
- Pinecone API key and a document-schema index

## 1. Configure the Pinecone index
Create a Pinecone document-schema index named `pdf-rag-index` (or set `PINECONE_INDEX` in `.env`) with:
- `title`: string field with full-text search enabled.
- `chunk_text`: string field with dense embedding enabled, using the `llama-text-embed-v2` model.

The application sends `title` and `chunk_text` documents to Pinecone's Documents API. Pinecone generates the 1024-dimensional embeddings, so the app does not need to generate or configure embedding vectors itself. The Node.js Pinecone SDK v9 is required for this API version.

## 2. Install and configure
```bash
npm install
```
If you do not already have a local `.env`, copy `.env.example` to `.env` (PowerShell: `Copy-Item .env.example .env`) and add your API keys.

## 3. Run
```bash
npm run dev
```
Open the URL printed by the server.

## How it works
1. Browser uploads one PDF.
2. Server extracts text and splits it into overlapping chunks.
3. Pinecone creates an embedding for each chunk and stores the document fields.
4. On chat, Pinecone embeds the question and searches with a `documentId` filter. If semantic search has no matches, the app retries with full-text search over `chunk_text`.
5. Gemini receives only the retrieved chunks and is instructed to answer only from them. If evidence is missing, it must say it cannot find the answer in the PDF.

## Debug logs
The server prints `[RAG]` JSON logs for each API request and pipeline step, including PDF parsing/chunk counts, Pinecone upsert/search counts and timings, Gemini calls, and errors. Logs intentionally omit API keys and PDF/question/answer text; each request has an ID you can use to follow its full trace in the terminal.

## Important limitations
- The document list is stored in server memory; restarting the server clears the UI's list. Indexed documents remain in Pinecone, but this starter doesn't provide document-list persistence or deletion.
- Pinecone indexes document writes asynchronously; a newly uploaded PDF can take about a minute to appear in search.
- Uploading the same PDF again creates a new document ID and a separate searchable document.
- PDF extraction quality depends on the PDF. Scanned/image-only PDFs need OCR, which is not included.
- This is a learning starter, not production-hardened. Add authentication, rate limits, persistent document records, deletion, monitoring, and per-user access controls before deploying.
- Do not commit `.env` or expose API keys in frontend code.
