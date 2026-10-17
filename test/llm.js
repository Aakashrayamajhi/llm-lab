import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
import mongoose from "mongoose";

config();

await mongoose.connect("mongodb://127.0.0.1:27017/fakeUsersDB");

const ai = new GoogleGenAI({
  apiKey: process.env.GoogleGenAI,
});

async function getproblemsolved() {
  return 500;
}

async function getUserEmail(name) {
  const user = await mongoose.connection
    .collection("users")
    .findOne({ name });

  return user ? user.email : "User not found";
}

const functionDecleration = [
  {
    name: "getproblemsolved",
    description:
      "This tool returns the number of problems solved by the user.",
    parameters: {
      type: "OBJECT",
      properties: {},
    },
  },
  {
    name: "getUserEmail",
    description:
      "Returns the email address of a user based on their name.",
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
];

export async function llm(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
    systemInstruction: `
You are a DSA (Data Structures and Algorithms) instructor.

- Answer questions related to DSA, algorithms, problem-solving, and computer science concepts.
- If the user asks how many problems they have solved, call the getproblemsolved tool.
- If the user asks for a user's email address by name, call the getUserEmail tool.
- Whenever a user's request matches an available tool, call the relevant tool and use its result to answer accurately.
- For questions unrelated to DSA or the available tools, politely refuse and explain that you specialize in DSA instruction.
- Never invent tool results or user information.
`,
      tools: [
        {
          functionDeclarations: functionDecleration,
        },
      ],
    },
  });

  const functioncalls = response.functionCalls ?? [];

  for (const call of functioncalls) {
    if (call.name === "getproblemsolved") {
      const result = await getproblemsolved();

      const finalresponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `The user has solved ${result} problems. Answer the original question: ${prompt}`,
      });

      return finalresponse.text;
    }

    if (call.name === "getUserEmail") {
      const result = await getUserEmail(call.args.name);

      const finalresponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `The user's email lookup result is: ${result}. Answer the original question: ${prompt}`,
      });

      return finalresponse.text;
    }
  }

  return response.text;
}