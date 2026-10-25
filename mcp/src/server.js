

import "dotenv/config";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { createMcpClient } from "./mcp-client.js";
import { config } from "dotenv";

config()

const app = express();
const port = Number(process.env.PORT || 3000);
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

app.use(express.json());

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is missing. Add it to .env before calling /ask.");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

function getTextFromMcpResult(result) {
  if (result?.isError) {
    throw new Error(result.content?.map((item) => item.text || "").join("\n") || "MCP tool failed");
  }
  return (result?.content || [])
    .map((item) => item.type === "text" ? item.text : JSON.stringify(item))
    .join("\n");
}

function mcpToolsToGeminiDeclarations(mcpTools) {
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description || `MCP tool: ${tool.name}`,
    parameters: tool.inputSchema || {
      type: "OBJECT",
      properties: {},
      required: []
    }
  }));
}

app.get("/ask", async (req, res) => {
  const prompt = typeof req.query.prompt === "string" ? req.query.prompt.trim() : "";
  console.log("prompt:" , prompt)
  if (!prompt) {
    return res.status(400).json({
      error: "Missing required query parameter: prompt",
      example: "/ask?prompt=What%20is%20the%20weather%20in%20Kathmandu"
    });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is not configured. Copy .env.example to .env and add your API key."
    });
  }

  let mcp;
  try {
    // Start a real custom MCP server and connect this API's MCP client to it.
    mcp = await createMcpClient();

    // Discover tools from the MCP server at runtime, rather than hardcoding tool definitions here.
    const { tools: discoveredTools } = await mcp.client.listTools();
    const declarations = mcpToolsToGeminiDeclarations(discoveredTools);

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const functionResponses = [];
    const maxToolRounds = 5;
    let finalText = "";

    for (let round = 0; round < maxToolRounds; round++) {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction:
            "You are a helpful assistant. Use the provided tools when the user asks for a simple problem result, weather, or mood. " +
            "The tools are demo tools with hardcoded outputs, not real weather or real mood detection. " +
            "Do not claim these results are live or real-world measurements.",
          tools: [{ functionDeclarations: declarations }]
        }
      });

      const candidate = response.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const functionCalls = parts.filter((part) => part.functionCall?.name);

      if (functionCalls.length === 0) {
        finalText = response.text || parts.map((part) => part.text || "").join("\n");
        break;
      }

      // Add the model's function-call turn to the conversation before tool results.
      contents.push({ role: "model", parts });

      const resultParts = [];
      for (const part of functionCalls) {
        const call = part.functionCall;
        const toolResult = await mcp.client.callTool({
          name: call.name,
          arguments: call.args || {}
        });
        const toolText = getTextFromMcpResult(toolResult);
        functionResponses.push({
          tool: call.name,
          arguments: call.args || {},
          result: toolText
        });
        resultParts.push({
          functionResponse: {
            name: call.name,
            response: { result: toolText }
          }
        });
      }
      contents.push({ role: "user", parts: resultParts });
    }

    if (!finalText) {
      finalText = "I called the available tool(s), but could not produce a final response within the tool-call limit.";
    }

    return res.json({
      prompt,
      model,
      answer: finalText,
      toolCalls: functionResponses
    });
  } catch (error) {
    console.error("GET /ask failed:", error);
    return res.status(500).json({
      error: "The request failed.",
      details: error?.message || String(error),
      hint: "Check GEMINI_API_KEY, GEMINI_MODEL availability, network access, and installed package versions."
    });
  } finally {
    if (mcp) {
      try {
        await mcp.client.close();
      } catch {
        // Ignore cleanup errors after the request has completed.
      }
    }
  }
});

app.get("/", (_req, res) => {
  res.type("text").send(
    "Gemini + MCP demo is running. Try /ask?prompt=What%20is%20the%20weather%20in%20Kathmandu"
  );
});

app.listen(port, () => {
  console.log(`API running at http://localhost:${port}`);
  console.log(`Gemini model configured as: ${model}`);
});