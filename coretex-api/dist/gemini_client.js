import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();
// CORRECT Model ID for 2026
const MODEL_ID = "gemini-2.5-flash";
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    throw new Error("API Key not found. Please check your .env file.");
}
export async function askGemini3(prompt) {
    // 1. New Endpoint Format (v1beta)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${API_KEY}`;
    // 2. New Body Format (contents -> parts -> text)
    const body = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ]
    };
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini 3 API Error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        // 3. New Response Parsing Logic
        const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textOutput) {
            console.log("Full Response:", JSON.stringify(data, null, 2));
            return "No response generated (possibly blocked by safety settings).";
        }
        return textOutput;
    }
    catch (err) {
        console.error("Connection failed:", err);
        return null;
    }
}
