import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI features will be disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export const generateDescriptionWithGemini = async (title: string, category: string): Promise<string> => {
  if (!ai) {
    return "AI service is unavailable. Please configure the Gemini API key.";
  }

  try {
    const prompt = `Generate a compelling and concise course description for an online course titled "${title}" in the "${category}" category. The description should be around 2-3 sentences, highlighting the key learning outcomes and benefits for students.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Error generating description with Gemini:", error);
    return "Failed to generate AI description. Please try again.";
  }
};