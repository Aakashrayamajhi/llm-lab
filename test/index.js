
import express from "express";
import { config } from "dotenv";
import { llm } from "./llm.js";

config();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

 const apikey = 123

app.get("/generate-apikey" , (req , res)=>{

  res.send(apikey)
})

async function verifytoken(req , res , next){
  const key = req.get("x-api-key")
  console.log("api-key :" , key)
 
  if(!key){
     return res.status(401).json({
        error: "API key required",
      });
  }
  if(key !== apikey){
    return res.status(401).json({
      error : "hasais pagal"
    })
  }

  next()
}


app.get("/health", verifytoken ,(req, res) => {
  return res.status(200).json({
    message: "Everything is okay",
    status: 200,
  });
});

app.get("/ask-ai", async (req, res) => {
  const prompt = req.query.prompt;

  console.log('prompt:' , prompt)

  if (typeof prompt !== "string" || !prompt.trim()) {
    return res.status(400).json({
      message: "Please send us a valid prompt",
      status: 400,
    });
  }

  try {
    const response = await llm(prompt);
    console.log("response:" , response)
    return res.status(200).json({
      answer: response,
      status: 200,
    });
  } catch (err) {
    console.error("AI request failed:", err.message);

    return res.status(500).json({
      message: "Failed to generate AI response",
      status: 500,
    });
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
