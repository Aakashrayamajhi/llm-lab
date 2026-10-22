# Gemini + Pinecone PDF-only RAG (JavaScript)

A complete starter project: upload a PDF, extract/chunk its text, embed chunks with Gemini, store vectors in Pinecone, then answer questions using retrieved chunks from **that selected PDF only**.

## Requirements
- Node.js 20+
- Google AI Studio API key with Gemini embedding and generation access
- Pinecone API key and a Pinecone index

## 1. Create the Pinecone index
In Pinecone Console, create a **serverless** index:
- Name: `pdf-rag-index` (or the value in `.env`)
- Dimension: `768`
- Metric: `cosine`
- Choose a cloud/region available to your account.

The index dimension must equal `EMBEDDING_DIMENSION` and the `outputDimensionality` in `src/services/embedding.service.js`.

## 2. Install and configure
```bash
npm install
cp .env.example .env
```
On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.
Edit `.env` and put in your API keys.

## 3. Run
```bash
npm run dev
```
Open http://localhost:5000

## How it works
1. Browser uploads one PDF.
2. Server extracts text and splits it into overlapping chunks.
3. Gemini creates an embedding for each chunk.
4. Pinecone stores each vector with its text, document ID, and chunk number.
5. On chat, the server embeds the question and queries Pinecone with a `documentId` filter.
6. Gemini receives only the retrieved chunks and is instructed to answer only from them. If evidence is missing, it must say it cannot find the answer in the PDF.

## Important limitations
- The document list is stored in server memory; restarting the server clears the UI's list. Vectors remain in Pinecone, but this starter doesn't provide document-list persistence or deletion.
- Uploading the same PDF again creates a new document ID and a separate searchable document.
- PDF extraction quality depends on the PDF. Scanned/image-only PDFs need OCR, which is not included.
- This is a learning starter, not production-hardened. Add authentication, rate limits, persistent document records, deletion, monitoring, and per-user access controls before deploying.
- Do not commit `.env` or expose API keys in frontend code.
