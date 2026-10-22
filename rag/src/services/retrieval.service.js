import { pineconeIndex } from "../config/pinecone.js";

const TOP_K = Math.min(Math.max(Number(process.env.TOP_K || 5), 1), 10);

export async function retrieveRelevantChunks(question, documentId) {
  const searchOptions = {
    topK: TOP_K,
    filter: {
      documentId: { $eq: documentId }
    },
    includeFields: ["chunk_text", "fileName", "chunkIndex"]
  };

  const semanticResult = await pineconeIndex.documents.search({
    ...searchOptions,
    scoreBy: [
      {
        type: "embed",
        fields: ["chunk_text"],
        query: question
      }
    ]
  });

  let result = semanticResult;
  if (!semanticResult.matches?.length) {
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
  return chunks;
}
