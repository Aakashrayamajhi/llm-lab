import { pineconeIndex } from "../config/pinecone.js";
import { logError, logInfo } from "../utils/logger.js";

const TOP_K = Math.min(Math.max(Number(process.env.TOP_K || 5), 1), 10);

export async function retrieveRelevantChunks(question, documentId, requestId) {
  const searchOptions = {
    topK: TOP_K,
    filter: {
      documentId: { $eq: documentId }
    },
    includeFields: ["chunk_text", "fileName", "chunkIndex"]
  };

  logInfo("pinecone.search.semantic.start", {
    requestId,
    documentId,
    topK: TOP_K,
    queryLength: question.length
  });
  const semanticStartedAt = Date.now();
  let semanticResult;
  try {
    semanticResult = await pineconeIndex.documents.search({
      ...searchOptions,
      scoreBy: [
        {
          type: "embed",
          fields: ["chunk_text"],
          query: question
        }
      ]
    });
  } catch (error) {
    logError("pinecone.search.semantic.failed", error, { requestId, documentId });
    throw error;
  }
  logInfo("pinecone.search.semantic.complete", {
    requestId,
    documentId,
    matchCount: semanticResult.matches?.length || 0,
    firstMatchFields: semanticResult.matches?.[0]
      ? Object.keys(semanticResult.matches[0].fields ?? semanticResult.matches[0])
      : [],
    durationMs: Date.now() - semanticStartedAt
  });

  let result = semanticResult;
  let searchMethod = "semantic";
  if (!semanticResult.matches?.length) {
    searchMethod = "fulltext";
    logInfo("pinecone.search.fulltext.start", {
      requestId,
      documentId,
      queryLength: question.length
    });
    const fullTextStartedAt = Date.now();
    try {
      result = await pineconeIndex.documents.search({
        ...searchOptions,
        scoreBy: [
          {
            type: "text",
            fields: ["chunk_text"],
            query: question
          }
        ]
      });
      logInfo("pinecone.search.fulltext.complete", {
        requestId,
        documentId,
        matchCount: result.matches?.length || 0,
        firstMatchFields: result.matches?.[0]
          ? Object.keys(result.matches[0].fields ?? result.matches[0])
          : [],
        durationMs: Date.now() - fullTextStartedAt
      });
    } catch (error) {
      logError("pinecone.search.fulltext.failed", error, { requestId, documentId });
      throw error;
    }
  }

  const chunks = (result.matches || [])
    .map((match) => {
      const fields = match.fields ?? match;
      if (typeof fields.chunk_text !== "string") return null;

      return {
        text: fields.chunk_text,
        fileName: fields.fileName,
        chunkIndex: fields.chunkIndex,
        score: match._score ?? 0
      };
    })
    .filter(Boolean);
  logInfo("retrieval.complete", {
    requestId,
    documentId,
    searchMethod,
    returnedMatchCount: result.matches?.length || 0,
    usableChunkCount: chunks.length,
    chunkIndexes: chunks.map((chunk) => chunk.chunkIndex),
    scores: chunks.map((chunk) => chunk.score)
  });
  return chunks;
}
