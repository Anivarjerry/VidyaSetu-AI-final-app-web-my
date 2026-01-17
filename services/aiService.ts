
import Groq from "groq-sdk";
import { Role } from '../types';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UserContext {
  userName: string;
  role: Role;
  className?: string;
  liveData?: string;
}

export interface AIResponse {
  messages: string[];
}

const getISTDate = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
};

/**
 * Generates a response using Groq's high-speed Llama 3.1 model.
 */
export const getGroqChatResponse = async (
  messages: ChatMessage[],
  language: 'en' | 'hi',
  context: UserContext
): Promise<AIResponse> => {
  const apiKey = process.env.API_KEY;

  // Validation: Check if API key exists
  if (!apiKey || apiKey.trim() === "") {
    return { 
      messages: [language === 'hi' 
        ? "त्रुटि: API Key नहीं मिली। कृपया सेटिंग्स में GROQ_API_KEY चेक करें।" 
        : "Error: API Key not found. Please check your GROQ_API_KEY in environment settings."] 
    };
  }

  try {
    const { userName, role, liveData } = context;
    const todayDate = getISTDate();

    const groq = new Groq({ 
      apiKey: apiKey,
      dangerouslyAllowBrowser: true 
    });

    const systemInstruction = `
    IDENTITY: You are "VidyaSetu AI", a helpful, human-like school assistant.
    USER: ${userName} (Role: ${role}).
    TODAY: ${todayDate} (IST).
    LANGUAGE: Strictly respond in ${language === 'hi' ? 'Hindi (Devanagari)' : 'English'}.

    BEHAVIOR:
    1. Respond naturally like a human assistant.
    2. Only answer questions related to "VidyaSetu AI" app, school management, study materials, or the provided live data.
    3. If asked about unrelated topics (movies, politics, etc.), decline politely.
    4. Provide clear, list-wise answers for complex info.
    5. Use the LIVE DATA below to answer specific questions about Homework, Attendance, and Notices.
    
    APP STRUCTURE KNOWLEDGE:
    - Home Tab: Shows dashboard cards based on role.
    - Action Tab: Admin management (Schools, Users, Transport).
    - Features: Attendance Tracking, Daily Homework/Tasks, Live Bus Tracking, Leave Management, Broadcast Notices, and Analytics.

    LIVE SCHOOL DATA:
    ${liveData || "No data updated for current session yet."}
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemInstruction },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      model: "llama-3.1-8b-instant",
      temperature: 0.6,
      max_tokens: 1024,
      top_p: 1,
    });

    const fullText = chatCompletion.choices[0]?.message?.content || "";

    const messageParts = fullText
      .split(/\n\n/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0);

    return { 
      messages: messageParts.length > 0 ? messageParts : [language === 'hi' ? "माफ़ कीजिये, मैं समझ नहीं पाया।" : "I'm sorry, I couldn't process that."]
    };

  } catch (error: any) {
    console.error("Groq Chat Service Error:", error);
    
    // Check specifically for 401 Unauthorized (Invalid Key)
    if (error?.status === 401 || (error?.message && error.message.includes('401'))) {
      return { 
        messages: [language === 'hi' 
          ? "त्रुटि 401: आपकी Groq API Key अमान्य (Invalid) है। कृपया अपनी की (key) चेक करें।" 
          : "Error 401: Your Groq API Key is invalid. Please verify it in your dashboard."] 
      };
    }

    return { 
      messages: [language === 'hi' 
        ? `त्रुटि: ${error.message || 'कनेक्शन विफल'}` 
        : `Error: ${error.message || 'Connection failed. Please check internet.'}`] 
    };
  }
};
