import { Router } from "express";
import multer from "multer";
import { ingestPdf } from "../services/document.service.js";
import { answerFromPdf } from "../services/rag.service.js";

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
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Choose a PDF file to upload." });
    }

    const document = await ingestPdf(
      req.file.buffer,
      req.file.originalname
    );
    res.status(201).json({
      message: "PDF processed and indexed successfully.",
      document
    });
  } catch (error) {
    next(error);
  }
});

router.post("/chat", async (req, res, next) => {
  try {
    const { question, documentId } = req.body || {};
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "question is required." });
    }
    if (typeof documentId !== "string" || !documentId.trim()) {
      return res.status(400).json({ error: "documentId is required. Upload a PDF first." });
    }

    const result = await answerFromPdf({ question, documentId });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
