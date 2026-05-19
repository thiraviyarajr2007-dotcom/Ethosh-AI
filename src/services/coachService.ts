import { GoogleGenAI } from "@google/genai";
import { HabitAnalytics, PredictionResult } from "../types/analytics";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function askHabitCoach(
  question: string,
  analytics: HabitAnalytics[],
  predictions: PredictionResult[]
): Promise<string> {
  const context = analytics.map(a => {
    const p = predictions.find(pred => pred.habitId === a.habitId);
    return `${a.habitName}: status ${a.trend}, completion ${Math.round(a.completionRate * 100)}%, ML Risk ${p?.trendLabel || 'unknown'}`;
  }).join('; ');

  const prompt = `
    You are the HabitAI supportive coach. 
    User Question: "${question}"
    
    Context of user's behavior nodes:
    ${context}
    
    Answer the user's question directly and supportively based on their data. 
    Keep it under 3 sentences. Be analytical but encouraging.
  `;

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    });
    return result.text || "I'm analyzing your nodes. Please re-state your query.";
  } catch (error) {
    console.error("Coach Error:", error);
    return "The behavior node is currently busy. I recommend maintaining your current streaks until I can process your query.";
  }
}
