import crypto from "node:crypto";
import { createRequire } from "node:module";
import { chunkText } from "../utils/chunkText.js";
import { logError, logInfo } from "../utils/logger.js";
import { pineconeIndex } from "../config/pinecone.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const UPSERT_BATCH_SIZE = 50;

export async function ingestPdf(buffer, originalName, requestId) {
  const parseStartedAt = Date.now();
  logInfo("upload.pdf.parse.start", { requestId, sizeBytes: buffer.length });
  let parsed;
  try {
    parsed = await pdf(buffer);
  } catch (error) {
    logError("upload.pdf.parse.failed", error, { requestId });
    throw error;
  }
  const extractedText = parsed.text?.trim();
  logInfo("upload.pdf.parse.complete", {
    requestId,
    durationMs: Date.now() - parseStartedAt,
    pageCount: parsed.numpages,
    characterCount: extractedText?.length || 0
  });

  if (!extractedText) {
    throw new Error(
      "No selectable text was found. This may be a scanned PDF; OCR is not included."
    );
  }

  const chunks = chunkText(extractedText);
  if (!chunks.length) throw new Error("Could not create text chunks from this PDF.");
  logInfo("upload.chunk.complete", {
    requestId,
    chunkCount: chunks.length,
    chunkLengths: chunks.map((chunk) => chunk.length)
  });

  const documentId = crypto.randomUUID();
  const safeName = originalName.replace(/[^\w.\- ()]/g, "_").slice(0, 180);
  const documents = chunks.map((chunk, i) => ({
    _id: `${documentId}-chunk-${i}`,
    title: safeName,
    chunk_text: chunk,
    documentId,
    fileName: safeName,
    chunkIndex: i
  }));

  for (let i = 0; i < documents.length; i += UPSERT_BATCH_SIZE) {
    const batch = documents.slice(i, i + UPSERT_BATCH_SIZE);
    const batchNumber = Math.floor(i / UPSERT_BATCH_SIZE) + 1;
    const batchStartedAt = Date.now();
    logInfo("pinecone.documents.upsert.start", {
      requestId,
      documentId,
      batchNumber,
      batchSize: batch.length
    });
    try {
      const result = await pineconeIndex.documents.upsert({ documents: batch });
      logInfo("pinecone.documents.upsert.complete", {
        requestId,
        documentId,
        batchNumber,
        upsertedCount: result.upsertedCount,
        durationMs: Date.now() - batchStartedAt
      });
    } catch (error) {
      logError("pinecone.documents.upsert.failed", error, {
        requestId,
        documentId,
        batchNumber,
        batchSize: batch.length
      });
      throw error;
    }
  }

  return {
    documentId,
    fileName: safeName,
    pageCount: parsed.numpages,
    chunkCount: chunks.length,
    characterCount: extractedText.length
  };
}
