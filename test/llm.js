
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import mongoose from "mongoose";
import * as fs from "fs";

config();

await mongoose.connect("mongodb://127.0.0.1:27017/fakeUsersDB");

const ai = new GoogleGenAI({
  apiKey: process.env.GoogleGenAI,
});

const MODEL = "gemini-3.5-flash";
const IMAGE_MODEL = "gemini-3-pro-image-preview";

// Tool 1: Get solved DSA problems
async function getproblemsolved() {
  return 500;
}

// Tool 2: Get a user's email from MongoDB
async function getUserEmail(name) {
  const user = await mongoose.connection
    .collection("users")
    .findOne({ name });

  return user ? user.email : "User not found";
}

// Tool 3: Generate and save an image
async function generateImage(prompt) {
  const interaction = await ai.interactions.create({
    model: IMAGE_MODEL,
    input: prompt,
    response_modalities: ["image"],
  });

  const outputs = interaction.outputs ?? [];

  for (const output of outputs) {
    if (output.type === "image" && output.data) {
      const mimeType = output.mime_type || "image/png";

      const extension =
        mimeType === "image/jpeg" ? "jpg" :
        mimeType === "image/webp" ? "webp" : "png";

      const filename = `generated_image.${extension}`;

      fs.writeFileSync(
        filename,
        Buffer.from(output.data, "base64")
      );

      console.log(`Generated image MIME type: ${mimeType}`);
      console.log(`Image saved to: ${filename}`);

      return {
        success: true,
        filename,
        message: "Image generated and saved successfully.",
      };
    }
  }

  return {
    success: false,
    message: "No image was returned by the model.",
  };
}

// All available tool declarations
const functionDeclarations = [
  {
    name: "getproblemsolved",
    description: "Returns the number of DSA problems solved by the user.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "getUserEmail",
    description: "Returns the email address of a user based on their name.",
    parameters: {
      type: "OBJECT",
      properties: {
        name: {
          type: "STRING",
          description: "The name of the user whose email is requested.",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "generateImage",
    description:
      "Generates an image from a text prompt and saves it as a local file. Use when the user explicitly requests image creation.",
    parameters: {
      type: "OBJECT",
      properties: {
        prompt: {
          type: "STRING",
          description: "Detailed description of the image to generate.",
        },
      },
      required: ["prompt"],
    },
  },
];

const systemInstruction = `
You are a DSA instructor with access to tools.

- Answer questions about DSA, algorithms, problem-solving, and computer science.
- If the user asks how many problems they have solved, call getproblemsolved.
- If the user asks for a user's email by name, call getUserEmail.
- If the user requests an image, call generateImage.
- Use tool results to answer accurately.
- For unrelated requests that do not involve an available tool,
  politely explain that you specialize in DSA instruction.
- Never invent tool results.
`;

export async function llm(prompt) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      tools: [
        {
          functionDeclarations,
        },
      ],
    },
  });

  const functionCalls = response.functionCalls ?? [];

  // No tool call: return the normal model response.
  if (functionCalls.length === 0) {
    return response.text ?? "I couldn't generate a response.";
  }

  // Execute the requested tools.
  const toolResults = [];

  for (const call of functionCalls) {
    let result;

    if (call.name === "getproblemsolved") {
      result = await getproblemsolved();
    } else if (call.name === "getUserEmail") {
      result = await getUserEmail(call.args.name);
    } else if (call.name === "generateImage") {
      result = await generateImage(call.args.prompt);
    } else {
      result = { error: "Unknown tool." };
    }

    toolResults.push({
      name: call.name,
      result,
    });
  }

  // Ask Gemini to produce a user-friendly response
  // based on the actual tool results.
  const finalResponse = await ai.models.generateContent({
    model: MODEL,
    contents: `
Original user request:
${prompt}

Tool execution results:
${JSON.stringify(toolResults)}

Answer the original request using these results.
For image generation, clearly state the filename where the image was saved.
Never claim a tool succeeded if its result indicates failure.
`,
    config: {
      systemInstruction,
    },
  });

  return finalResponse.text ?? JSON.stringify(toolResults);
}
