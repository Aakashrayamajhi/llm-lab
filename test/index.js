
import express from "express";
import cors from "cors";
import llm from "./llm.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/send-ai", async (req, res) => {
  try {
    const prompt = req.query.prompt;

    console.log(prompt)
    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Please provide a prompt",
      });
    }

    const answer = await llm(prompt);

    res.json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Failed to generate AI response",
    });
  }
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
