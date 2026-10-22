import { Pinecone } from "@pinecone-database/pinecone";

if (!process.env.PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY in .env");
}

const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const indexName = process.env.PINECONE_INDEX || "pdf-rag-index";

export const pineconeIndex = client.index(indexName);
