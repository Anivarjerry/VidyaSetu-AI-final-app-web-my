
import Groq from "groq-sdk";
import { ProjectFile, AIAnalysis } from "../types";

/**
 * Analyzes the project structure using Groq's high-performance Llama 3.3 model.
 */
export const analyzeProject = async (files: ProjectFile[]): Promise<AIAnalysis> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.error("Project Analysis: Missing API Key");
    return {
      summary: "Error: Groq API Key is missing.",
      technologies: [],
      structure: "N/A",
      recommendations: ["Ensure GROQ_API_KEY is set in environment variables."]
    };
  }

  const structure = files.map(f => f.path).join('\n');
  
  const keyFiles = files.filter(f => 
    f.name === 'package.json' || 
    f.name === 'README.md' || 
    f.path.includes('App.tsx') || 
    f.path.includes('main.ts') ||
    f.path.includes('index.html')
  ).slice(0, 5);

  const keyFileContents = keyFiles.map(f => `FILE: ${f.path}\nCONTENT:\n${typeof f.content === 'string' ? f.content.substring(0, 2000) : '[Binary Data]'}`).join('\n\n');

  const prompt = `
    Analyze this project structure and provide a detailed analysis in JSON format with fields:
    "summary", "technologies" (array), "structure", "recommendations" (array).
    
    PROJECT STRUCTURE:
    ${structure}

    KEY FILE CONTENTS:
    ${keyFileContents}
  `;

  try {
    const groq = new Groq({ 
      apiKey: apiKey,
      dangerouslyAllowBrowser: true 
    });
    
    const response = await groq.chat.completions.create({
      messages: [
        { role: "system", content: "You are a software architect. Output valid JSON only." },
        { role: "user", content: prompt }
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || "";
    
    if (!content) throw new Error("Empty response from AI");
    
    return JSON.parse(content) as AIAnalysis;
  } catch (error: any) {
    console.error("Groq Project Analysis Error:", error);
    const msg = error?.status === 401 ? "Invalid API Key" : (error.message || "Unknown error");
    return {
      summary: "Error during project analysis.",
      technologies: [],
      structure: "Unknown",
      recommendations: [`API Connectivity Issue: ${msg}`]
    };
  }
};
