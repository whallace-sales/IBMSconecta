
import { GoogleGenAI } from "@google/genai";

// Keeping the instance just in case future AI features are added, 
// though currently unused as per user request to remove analysis.
// Correctly initializing GoogleGenAI using the process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// All AI analysis functions removed as requested.