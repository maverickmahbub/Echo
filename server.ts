import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI securely on the server-side
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Chat Completion endpoint for Voice Call Assistant
app.post("/api/chat", async (req, res) => {
  try {
    const { message, language, voiceProfileName } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Message is required." });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured.",
      });
    }

    const sysInstruction = `You are an AI partner having an interactive real-time Voice Call conversation.
Current Language context: ${language || "English"}.
Instructions:
1. Always respond in the selected language: ${language || "English"}. If Bengali, respond entirely in beautiful, natural Bengali (বাংলা).
2. Keep your response extremely conversational, warm, friendly, and very short (maximum 1 to 2 simple sentences).
3. Do not use special formatting like asterisks (*), markdown, bullet points, or lists, because your response will be read aloud by Text-to-Speech.
4. Speak naturally as if you are on a real phone call.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: message,
      config: {
        systemInstruction: sysInstruction,
        temperature: 0.7,
      },
    });

    const aiText = response.text || "";
    res.json({ reply: aiText.trim() });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate conversational voice reply." });
  }
});

// AI Script Generator endpoint
app.post("/api/generate-script", async (req, res) => {
  try {
    const { topic, category, language } = req.body;

    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Topic is required." });
    }

    if (!ai) {
      return res.status(500).json({
        error: "Gemini API client is not initialized. Please ensure GEMINI_API_KEY is configured.",
      });
    }

    const sysInstruction = `You are a professional voiceover script writer.
Create a compelling, engaging voiceover script about the following topic: "${topic}".
Category: ${category || "General"}.
Language: ${language || "English"}.
Keep the script natural, well-paced, and optimized for text-to-speech rendering.
Do NOT output any markdown, title pages, or stage directions. Just return the spoken text itself.
Keep the script between 2 to 4 sentences (around 50-100 words).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Write a script on: ${topic}`,
      config: {
        systemInstruction: sysInstruction,
        temperature: 0.8,
      },
    });

    const script = response.text || "";
    res.json({ script: script.trim() });
  } catch (error: any) {
    console.error("Gemini API Script Generator Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate AI voice script." });
  }
});

// Vite middleware setup for development/production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
