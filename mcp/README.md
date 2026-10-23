# Gemini + MCP Client + Custom MCP Server (Node.js)

A small learning project with:

- **Node.js + Express** API: `GET /ask?prompt=...`
- **Gemini** model with function/tool calling
- A **custom MCP server** using the official Model Context Protocol SDK
- An **MCP client** that connects to the custom server over stdio
- Three hardcoded tools:
  1. `solve_simple_problem` → returns `500`
  2. `get_weather` → returns `30 degree`
  3. `get_mood` → returns `fine`

> These are demo responses. Weather is not live, and mood is not a real assessment.

## 1. Requirements

- Node.js 20 or newer
- A Gemini API key from Google AI Studio
- Internet access for Gemini API calls

## 2. Install

Extract the ZIP, open a terminal in the project folder, then run:

```bash
npm install
```

Copy `.env.example` to `.env`.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

**macOS/Linux:**

```bash
cp .env.example .env
```

Open `.env` and set:

```env
GEMINI_API_KEY=your_real_api_key
GEMINI_MODEL=gemini-3.5-flash
PORT=3000
```

The code uses `gemini-3.5-flash` as requested. Model names and availability can vary by API account/version; if Google returns a model-not-found or unsupported-model error, replace `GEMINI_MODEL` with a Gemini Flash model currently available to your API key.

## 3. Start the API

```bash
npm start
```

Expected startup message:

```text
API running at http://localhost:3000
Gemini model configured as: gemini-3.5-flash
```

The MCP server is started automatically by the API for each `/ask` request. You do not need to start it separately.

## 4. Test the endpoint

Open a browser or use curl:

```text
http://localhost:3000/ask?prompt=What%20is%20the%20weather%20in%20Kathmandu
```

More examples:

```text
http://localhost:3000/ask?prompt=Solve%20this%20simple%20problem
http://localhost:3000/ask?prompt=Tell%20me%20the%20weather
http://localhost:3000/ask?prompt=How%20is%20my%20mood
```

PowerShell example:

```powershell
Invoke-RestMethod "http://localhost:3000/ask?prompt=Tell%20me%20the%20weather"
```

The JSON response includes `answer` and `toolCalls`, so you can inspect which MCP tool the model called and what it returned.

## 5. Actual request flow

```text
Browser / API client
       |
       | GET /ask?prompt=...
       v
Node.js Express API (src/server.js)
       |
       | 1. Create MCP client
       v
MCP Client (src/mcp-client.js)
       |
       | stdio transport
       v
Custom MCP Server (src/mcp-server.js)
       |
       | tools/list: returns tool names + schemas
       v
Express API gives discovered tools to Gemini
       |
       | Gemini chooses a function/tool
       v
MCP Client calls the selected MCP tool
       |
       v
Custom MCP Server returns hardcoded result
       |
       | tool result is sent back to Gemini
       v
Gemini creates final natural-language answer
       |
       v
JSON response returned to caller
```

## 6. Why this is a real MCP example

- The MCP client launches and connects to a separate MCP server process using `StdioClientTransport`.
- The API calls `client.listTools()` to discover tools from the MCP server.
- Gemini's function declarations are built from the discovered MCP tool definitions.
- When Gemini requests a function call, the API invokes `client.callTool()` on the MCP client.
- The tool result is sent back to Gemini so the model can produce the final answer.

This is not merely three JavaScript functions called directly by the API.

## Troubleshooting

- **Missing API key:** ensure `.env` exists and `GEMINI_API_KEY` is set.
- **Model not found / unsupported:** change `GEMINI_MODEL` to a Flash model available in your Google AI Studio account.
- **Tool not called:** prompt explicitly, e.g. `Use the get_weather tool and tell me the weather`.
- **Port busy:** change `PORT=3001` in `.env`.
- **MCP protocol logs:** the MCP server writes its startup log to stderr, not stdout, because stdout is reserved for MCP messages.
