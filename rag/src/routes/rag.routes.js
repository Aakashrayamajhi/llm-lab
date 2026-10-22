import { Router } from "express";
import multer from "multer";
import { ingestPdf } from "../services/document.service.js";
import { answerFromPdf } from "../services/rag.service.js";
import { logError, logInfo } from "../utils/logger.js";

const router = Router();
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 20);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxFileSizeMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, callback) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfName = file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdfMime && !isPdfName) {
      return callback(new Error("Only PDF files are allowed."));
    }
    callback(null, true);
  }
});

router.post("/upload", upload.single("pdf"), async (req, res, next) => {
  const requestId = req.requestId;
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Choose a PDF file to upload." });
    }

    logInfo("upload.received", {
      requestId,
      fileName: req.file.originalname,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype
    });
    const document = await ingestPdf(
      req.file.buffer,
      req.file.originalname,
      requestId
    );
    logInfo("upload.complete", {
      requestId,
      documentId: document.documentId,
      pageCount: document.pageCount,
      chunkCount: document.chunkCount,
      characterCount: document.characterCount
    });
    res.status(201).json({
      message: "PDF processed and indexed successfully.",
      document
    });
  } catch (error) {
    logError("upload.failed", error, { requestId });
    next(error);
  }
});

router.post("/chat", async (req, res, next) => {
  const requestId = req.requestId;
  try {
    const { question, documentId } = req.body || {};
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "question is required." });
    }
    if (typeof documentId !== "string" || !documentId.trim()) {
      return res.status(400).json({ error: "documentId is required. Upload a PDF first." });
    }

    logInfo("chat.received", {
      requestId,
      documentId,
      questionLength: question.trim().length
    });
    const result = await answerFromPdf({ question, documentId, requestId });
    logInfo("chat.complete", {
      requestId,
      documentId,
      answerLength: result.answer.length,
      sourceCount: result.sources.length
    });
    res.json(result);
  } catch (error) {
    logError("chat.failed", error, { requestId });
    next(error);
  }
});

export default router;
