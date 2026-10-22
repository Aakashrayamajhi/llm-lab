import crypto from "node:crypto";
import pdf from "pdf-parse";
import { chunkText } from "../utils/chunkText.js";
import { embedTexts } from "./embedding.service.js";
import { pineconeIndex } from "../config/pinecone.js";

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
  const vectors = [];

  // Embed each chunk. Keep a stable ID so chunks can be traced in Pinecone.
  const embeddings = await embedTexts(chunks, "RETRIEVAL_DOCUMENT");

  for (let i = 0; i < chunks.length; i++) {
    vectors.push({
      id: `${documentId}-chunk-${i}`,
      values: embeddings[i],
      metadata: {
        documentId,
        fileName: safeName,
        chunkIndex: i,
        text: chunks[i]
      }
    });
  }

  for (let i = 0; i < vectors.length; i += UPSERT_BATCH_SIZE) {
    await pineconeIndex.upsert({
      records: vectors.slice(i, i + UPSERT_BATCH_SIZE)
    });
  }

  return {
    documentId,
    fileName: safeName,
    pageCount: parsed.numpages,
    chunkCount: chunks.length,
    characterCount: extractedText.length
  };
}
