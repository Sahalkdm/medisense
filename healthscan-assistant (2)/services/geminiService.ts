import { GoogleGenAI, Chat, Type, Schema } from "@google/genai";
import { MODEL_NAME, SYSTEM_INSTRUCTION, RESPONSE_SCHEMA } from "../constants";
import { HealthAssessment, MapSearchResult } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeHealthInput = async (
  mediaBase64: string,
  mimeType: string,
  textDescription: string
): Promise<HealthAssessment> => {
  try {
    if (!process.env.API_KEY) {
      throw new Error("API Key is missing. Please check your environment configuration.");
    }

    let inputTypeDescription = "Image";
    if (mimeType.startsWith("video/")) inputTypeDescription = "Video";
    if (mimeType === "application/pdf") inputTypeDescription = "Medical Report (PDF)";

    const userPrompt = textDescription 
      ? `INPUT DATA:\n1. ${inputTypeDescription}: Clinical presentation or Medical Report.\n2. User Description: "${textDescription}"\n\nTASK: Perform a deep multimodal analysis. Cross-reference visual patterns with symptoms. Generate the full structured JSON response including expert reasoning and simple summaries.` 
      : `INPUT DATA:\n1. ${inputTypeDescription}: Clinical presentation or Medical Report.\n\nTASK: Analyze the provided ${inputTypeDescription} for visual patterns/findings, assess safety risk, and generate the full structured JSON response.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        {
          role: 'user',
          parts: [
            { text: userPrompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: mediaBase64
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.3, 
      }
    });

    const responseText = response.text;
    
    if (!responseText) {
      throw new Error("No response received from the model.");
    }

    const data = JSON.parse(responseText) as HealthAssessment;
    return data;

  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Failed to analyze the input. Please try again.");
  }
};

export const createChatSession = (
  mediaBase64: string,
  mimeType: string,
  textDescription: string,
  previousResult: HealthAssessment
): Chat => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  // Reconstruct the initial prompt context for history
  let inputTypeDescription = "Image";
  if (mimeType.startsWith("video/")) inputTypeDescription = "Video";
  if (mimeType === "application/pdf") inputTypeDescription = "Medical Report (PDF)";

  const initialUserPrompt = textDescription 
      ? `INPUT DATA:\n1. ${inputTypeDescription}: Clinical presentation or Medical Report.\n2. User Description: "${textDescription}"\n\nTASK: Perform a deep multimodal analysis. Cross-reference visual patterns with symptoms. Generate the full structured JSON response including expert reasoning and simple summaries.` 
      : `INPUT DATA:\n1. ${inputTypeDescription}: Clinical presentation or Medical Report.\n\nTASK: Analyze the provided ${inputTypeDescription} for visual patterns/findings, assess safety risk, and generate the full structured JSON response.`;

  // Create a new Chat instance seeded with the initial interaction
  const chat = ai.chats.create({
    model: MODEL_NAME,
    history: [
      {
        role: "user",
        parts: [
          { text: initialUserPrompt },
          { inlineData: { mimeType: mimeType, data: mediaBase64 } }
        ]
      },
      {
        role: "model",
        parts: [{ text: JSON.stringify(previousResult) }]
      }
    ],
    config: {
      systemInstruction: `You are HealthScan Assistant v2. You have just provided a structured safety assessment (JSON) for the user's input. 
      Now you are in a **conversational mode** to answer follow-up questions.
      
      GUIDELINES:
      1. Answer the user's follow-up questions based on the visual evidence and your previous analysis.
      2. Keep answers educational, safe, and non-diagnostic.
      3. Do NOT use JSON format anymore. Use clear, helpful Markdown text.
      4. Support both simple explanations and technical depth if requested.
      `,
      temperature: 0.5, 
    }
  });

  return chat;
};

export const sendChatMessage = async (chat: Chat, message: string): Promise<string> => {
  try {
    const result = await chat.sendMessage({ message });
    return result.text || "I couldn't generate a response.";
  } catch (error: any) {
    console.error("Chat Error:", error);
    throw new Error("Failed to send message.");
  }
};

export const findNearbyPlaces = async (
  lat: number,
  lng: number,
  conditionContext: string,
  riskLevel: string
): Promise<MapSearchResult> => {
  try {
    const prompt = `
      The user has a health concern assessed as "${riskLevel}" risk.
      Context/Symptoms: "${conditionContext}".
      User Location: ${lat}, ${lng}.
      
      Find 10-15 suitable medical facilities or specialists nearby using Google Maps. 
      - If 'urgent', prioritize ER/Urgent Care.
      - If specific (e.g. skin), prioritize Specialists (Dermatologist, etc).
      - Else, General Practitioner.
      
      OUTPUT FORMAT:
      Return strictly a JSON object with a single key "places" containing an array of objects.
      Each object must have:
      - "name": string
      - "latitude": number
      - "longitude": number
      - "address": string
      - "rating": string (e.g., "4.5")
      - "reason": string (Why this matches the need)

      Ensure the JSON is valid and does not contain any markdown formatting like \`\`\`json.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        },
        // responseMimeType and responseSchema are NOT supported with Google Maps tool
      }
    });

    let text = response.text || '';
    // Clean markdown code blocks if present
    text = text.replace(/```json\n?|\n?```/g, '').trim();
    
    // Attempt to parse JSON
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn("JSON Parse failed, attempting fallback extraction", text);
      // Fallback: try to find the JSON array in the text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
         try { data = JSON.parse(match[0]); } catch (e2) { data = { places: [] }; }
      } else {
         data = { places: [] };
      }
    }
    
    return {
      places: data.places || [],
      searchCenter: { lat, lng }
    };

  } catch (error: any) {
    console.error("Map Search Error:", error);
    throw new Error("Failed to search for nearby places.");
  }
};