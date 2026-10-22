import crypto from "node:crypto";
import { createRequire } from "node:module";
import { chunkText } from "../utils/chunkText.js";
import { pineconeIndex } from "../config/pinecone.js";

const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
const UPSERT_BATCH_SIZE = 50;

export async function ingestPdf(buffer, originalName) {
  const parsed = await pdf(buffer);
  const extractedText = parsed.text?.trim();

  if (!extractedText) {
    throw new Error(
      "No selectable text was found. This may be a scanned PDF; OCR is not included."
    );
  }

  const chunks = chunkText(extractedText);
  if (!chunks.length) throw new Error("Could not create text chunks from this PDF.");

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
    await pineconeIndex.documents.upsert({ documents: batch });
  }

  return {
    documentId,
    fileName: safeName,
    pageCount: parsed.numpages,
    chunkCount: chunks.length,
    characterCount: extractedText.length
  };
}
