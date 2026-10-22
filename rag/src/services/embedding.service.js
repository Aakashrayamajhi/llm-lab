import {
  gemini,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSION
} from "../config/gemini.js";

/**
 * taskType tells Gemini these are document passages or user questions.
 * The configured output dimension must match the Pinecone index dimension.
 */
export async function embedText(text, taskType = "RETRIEVAL_DOCUMENT") {
  const result = await gemini.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType,
      outputDimensionality: EMBEDDING_DIMENSION
    }
  });

  const vector = result.embeddings?.[0]?.values;
  if (!vector || vector.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Unexpected embedding dimension. Expected ${EMBEDDING_DIMENSION}, got ${vector?.length ?? 0}`
    );
  }

  return vector;
}

/**
 * Sequential batches avoid firing hundreds of requests at once.
 * For a production system, use bounded concurrency and retry/backoff.
 */
export async function embedTexts(texts, taskType = "RETRIEVAL_DOCUMENT") {
  const vectors = [];
  for (const text of texts) {
    vectors.push(await embedText(text, taskType));
  }
  return vectors;
}
