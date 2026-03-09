import "server-only";
import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

if (!API_KEY) {
  throw new Error("Missing GEMINI_API_KEY or GOOGLE_API_KEY.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const MODELS = Object.freeze({
  chat: "gemini-2.5-flash",
  code: "gemini-2.5-flash",
  prompt: "gemini-2.5-flash-lite",
});

const SAFETY_SETTINGS = Object.freeze([
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_ONLY_HIGH",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_ONLY_HIGH",
  },
]);

const CHAT_CONFIG = Object.freeze({
  temperature: 0.7,
  topP: 0.9,
  topK: 32,
  maxOutputTokens: 4096,
  responseMimeType: "text/plain",
  safetySettings: SAFETY_SETTINGS,
});

const JSON_CONFIG = Object.freeze({
  temperature: 0.2,
  topP: 0.9,
  topK: 32,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
  safetySettings: SAFETY_SETTINGS,
});

const ENHANCE_CONFIG = Object.freeze({
  temperature: 0.4,
  topP: 0.8,
  topK: 32,
  maxOutputTokens: 1200,
  responseMimeType: "application/json",
  safetySettings: SAFETY_SETTINGS,
});

const CODE_PROJECT_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    projectTitle: { type: "string" },
    explanation: { type: "string" },
    files: {
      type: "object",
      additionalProperties: {
        type: "object",
        properties: {
          code: { type: "string" },
        },
        required: ["code"],
      },
    },
    generatedFiles: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["projectTitle", "explanation", "files", "generatedFiles"],
});

const CODE_SYSTEM_INSTRUCTION = [
  "You generate React projects using Vite.",
  "Rewrite /App.js instead of creating /App.jsx.",
  "Use Tailwind CSS for styling.",
  "Organize files into a clean folder structure.",
  "Return valid JSON only.",
  "Do not wrap JSON in markdown code fences.",
  "Use emoji where it improves UX.",
  "Use lucide-react only when it adds clear value.",
  "For placeholder images, use https://archive.org/download/.",
].join(" ");

function sanitizeText(value, maxLength = 20000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function sanitizeHistory(history = []) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-20)
    .filter(
      (item) =>
        item &&
        (item.role === "user" || item.role === "model") &&
        Array.isArray(item.parts)
    )
    .map((item) => ({
      role: item.role,
      parts: item.parts
        .filter((part) => typeof part?.text === "string" && part.text.trim())
        .map((part) => ({
          text: sanitizeText(part.text),
        })),
    }))
    .filter((item) => item.parts.length > 0);
}

function stripJsonFences(text) {
  return String(text ?? "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export function safeParseJson(text) {
  return JSON.parse(stripJsonFences(text));
}

export function createChatSession(history = []) {
  return ai.chats.create({
    model: MODELS.chat,
    history: sanitizeHistory(history),
    config: CHAT_CONFIG,
  });
}

export function createCodeGenSession(history = []) {
  return ai.chats.create({
    model: MODELS.code,
    history: sanitizeHistory(history),
    config: {
      ...JSON_CONFIG,
      systemInstruction: CODE_SYSTEM_INSTRUCTION,
      responseJsonSchema: CODE_PROJECT_SCHEMA,
    },
  });
}

export function createEnhancePromptSession({
  history = [],
  systemInstruction = "Improve the user's prompt while preserving intent. Return valid JSON only. Do not use markdown fences.",
  responseJsonSchema,
} = {}) {
  return ai.chats.create({
    model: MODELS.prompt,
    history: sanitizeHistory(history),
    config: {
      ...ENHANCE_CONFIG,
      systemInstruction,
      ...(responseJsonSchema ? { responseJsonSchema } : {}),
    },
  });
}

export async function generateCodeProject(prompt, history = []) {
  const chat = createCodeGenSession(history);

  const response = await chat.sendMessage({
    message: sanitizeText(prompt, 30000),
  });

  return safeParseJson(response.text);
}

export async function enhancePrompt(prompt, options = {}) {
  const chat = createEnhancePromptSession(options);

  const response = await chat.sendMessage({
    message: sanitizeText(prompt, 10000),
  });

  return options.responseJsonSchema
    ? safeParseJson(response.text)
    : response.text;
}
