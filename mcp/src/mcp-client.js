import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const mcpServerPath = path.join(currentDir, "mcp-server.js");

export async function createMcpClient() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [mcpServerPath],
    stderr: "inherit"
  });

  const client = new Client({
    name: "gemini-mcp-client",
    version: "1.0.0"
  });

  await client.connect(transport);
  return { client, transport };
}
