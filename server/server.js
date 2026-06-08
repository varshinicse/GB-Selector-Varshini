import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support larger text sizes

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment variables. The Requirement Analyzer will fail on API calls.");
}
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

app.post('/api/analyze-requirement', async (req, res) => {
  const { text, fileData, mimeType } = req.body;

  if (!text && !fileData) {
    return res.status(400).json({ error: "Missing requirement 'text' or 'fileData' parameter." });
  }

  if (!genAI) {
    return res.status(500).json({ 
      error: "Gemini API client not initialized. Please configure GEMINI_API_KEY on the server." 
    });
  }

  try {
    // We use gemini-2.5-flash as the standard fast text model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
You are an industrial gearbox engineering assistant.
Extract gearbox selection parameters from the provided document (which may contain text, tables, design diagrams, drawings, or blueprints) and/or the text description.
Carefully examine any visual details, tabular data, text values, and motor details in the attached document.
Return ONLY valid JSON matching this schema:
{
  "projectName": string or null,
  "powerKW": number or null,
  "inputRPM": number or null,
  "outputRPM": number or null,
  "targetRatio": number or null,
  "applicationType": string or null,
  "serviceFactor": number or null,
  "numberOfStages": number or null
}

Rules:
1. If targetRatio is missing but inputRPM and outputRPM exist:
   targetRatio = inputRPM / outputRPM
2. If serviceFactor is missing:
   Suggest based on application type.
   Conveyor = 1.5
   Mixer = 1.75
   Crusher = 2.0
   Fan = 1.25
   Pump = 1.25
3. If a field is unknown, return null.
4. Return JSON only. Do not wrap in markdown blocks.

${text ? `Text Description/Extracted Text:\n---\n${text}\n---` : ''}
`;

    // Construct the parts array for multimodal/visual Gemini analysis
    const parts = [];
    if (fileData && mimeType) {
      parts.push({
        inlineData: {
          data: fileData,
          mimeType: mimeType
        }
      });
    }
    parts.push({ text: prompt });

    let result;
    let attempts = 0;
    const maxAttempts = 3;
    let delay = 1000;

    while (attempts < maxAttempts) {
      try {
        attempts++;
        result = await model.generateContent({
          contents: [{ role: 'user', parts: parts }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        });
        break; // Success
      } catch (err) {
        console.warn(`Gemini API attempt ${attempts} failed:`, err.message);
        const errMsg = err.message || "";
        if (attempts >= maxAttempts || errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid") || err.status === 400 || err.status === 403) {
          throw err;
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5;
      }
    }

    const responseText = result.response.text();
    const extractedData = JSON.parse(responseText.trim());

    res.json(extractedData);
  } catch (error) {
    console.error("Gemini API call failed:", error);
    
    // Provide user-friendly instructions for transient API errors
    let userMessage = "Failed to extract parameters from specifications.";
    const errText = error.message || "";
    
    if (error.status === 503 || errText.includes("503") || errText.includes("Service Unavailable") || errText.includes("high demand")) {
      userMessage = "The Gemini API is temporarily experiencing high demand (503 Service Unavailable). Please click 'Analyze Requirement' again to retry.";
    } else if (error.status === 429 || errText.includes("429") || errText.includes("quota") || errText.includes("Too Many Requests")) {
      userMessage = "AI rate limit reached (429 Too Many Requests). Please wait a moment and try again.";
    } else {
      userMessage += ` (Details: ${errText})`;
    }
    
    res.status(500).json({ 
      error: userMessage,
      details: errText
    });
  }
});

app.listen(port, () => {
  console.log(`MAGTORQ API Backend running at http://localhost:${port}`);
});
