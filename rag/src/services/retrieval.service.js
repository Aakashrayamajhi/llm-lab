import { embedText } from "./embedding.service.js";
import { pineconeIndex } from "../config/pinecone.js";

const TOP_K = Math.min(Math.max(Number(process.env.TOP_K || 5), 1), 10);

export async function retrieveRelevantChunks(question, documentId) {
  const queryVector = await embedText(question, "RETRIEVAL_QUERY");

  const result = await pineconeIndex.query({
    vector: queryVector,
    topK: TOP_K,
    includeMetadata: true,
    filter: {
      documentId: { $eq: documentId }
    }
  });

  return (result.matches || [])
    .filter((match) => match.metadata?.text)
    .map((match) => ({
      text: match.metadata.text,
      fileName: match.metadata.fileName,
      chunkIndex: match.metadata.chunkIndex,
      score: match.score ?? 0
    }));
}
