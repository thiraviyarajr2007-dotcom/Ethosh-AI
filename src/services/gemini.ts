import { GoogleGenAI, Type } from "@google/genai";
import { Habit, DailyLog, UserAlert } from "../types/habit";
import { HabitAnalytics, PredictionResult } from "../types/analytics";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface HabitInsight {
  pattern: 'positive' | 'negative' | 'neutral';
  summary: string;
  suggestions: string[];
}

export async function analyzeHabits(
  uid: string, 
  habits: Habit[], 
  analytics: HabitAnalytics[], 
  predictions: PredictionResult[]
): Promise<HabitInsight> {
  const atRisk = predictions.filter(p => p.trendLabel !== 'good');
  
  const analyticsContext = analytics.map(a => 
    `- ${a.habitName}: ${Math.round(a.completionRate * 100)}% completion, trend: ${a.trend}, streak: ${a.streak}d`
  ).join('\n');

  const riskContext = atRisk.map(p => {
    const habit = habits.find(h => h.id === p.habitId);
    return `- ${habit?.name}: ${p.trendLabel} (Risk Score: ${p.riskScore})`;
  }).join('\n');

  const prompt = `
    You are the HabitAI Strategic Coach. Examine the user's behavioral analytics and ML-predicted risk scores.
    
    User Statistics:
    ${analyticsContext}
    
    ML Risk Predictions (Focus Areas):
    ${riskContext}
    
    Identify the most critical behavioral patterns. 
    If a negative habit is trending up or a positive one is declining, pinpoint the relationship.
    
    Provide:
    1. A pattern assessment (positive/negative/neutral).
    2. A 2-3 sentence strategic summary referencing actual risk scores.
    3. Exactly 3 actionable, highly specific suggestions.
    
    Format the response as JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pattern: {
              type: Type.STRING,
              enum: ["positive", "negative", "neutral"]
            },
            summary: {
              type: Type.STRING
            },
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["pattern", "summary", "suggestions"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as HabitInsight;
  } catch (error) {
    console.error("Gemini Deep Analysis Error:", error);
    return {
      pattern: 'neutral',
      summary: "I'm processing your behavior patterns. Connection to AI node is calibrating.",
      suggestions: ["Logged data detected. Analysis will refresh in your next behavior cycle."]
    };
  }
}
