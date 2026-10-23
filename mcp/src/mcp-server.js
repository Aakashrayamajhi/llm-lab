import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "simple-demo-tools",
  version: "1.0.0"
});

// Tool 1: returns a hardcoded simple problem solution.
server.tool(
  "solve_simple_problem",
  "Return a hardcoded result for a simple arithmetic/problem-solving request. Demo only.",
  {
    problem: z.string().optional().describe("The user's simple problem, if provided")
  },
  async () => ({
    content: [{ type: "text", text: "500" }]
  })
);

// Tool 2: returns a hardcoded weather response.
server.tool(
  "get_weather",
  "Return the demo weather result. This is hardcoded and is not live weather data.",
  {
    location: z.string().optional().describe("Location the user is asking about")
  },
  async () => ({
    content: [{ type: "text", text: "30 degree" }]
  })
);

// Tool 3: returns a hardcoded mood response.
server.tool(
  "get_mood",
  "Return the demo mood result. This is hardcoded and does not infer a real person's mood.",
  {
    context: z.string().optional().describe("Optional context from the user")
  },
  async () => ({
    content: [{ type: "text", text: "fine" }]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
// IMPORTANT: stdio MCP servers must not print logs to stdout; stdout is reserved for MCP messages.
console.error("Custom MCP server started over stdio.");
