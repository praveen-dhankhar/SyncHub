import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_FLASH_MODEL = "gemini-2.0-flash";
export const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIMENSIONS = 768;

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "YOUR_GEMINI_API_KEY_HERE");
}
