import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ragRoutes from "./routes/rag.routes.js";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(projectRoot, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", ragRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON body." });
  }

  if (error.name === "MulterError") {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? `PDF exceeds the ${process.env.MAX_FILE_SIZE_MB || 20} MB limit.`
      : error.message;
    return res.status(400).json({ error: message });
  }

  const message = error.message || "Unexpected server error.";
  const status = /Only PDF|No selectable text|Question cannot|Upload\/select|Missing .* in \.env|Chunk overlap/i.test(message)
    ? 400
    : 500;

  res.status(status).json({ error: message });
});

export default app;
