
import { GoogleGenAI, Type } from "@google/genai";
import { EnglishLessonPlanData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const englishSectionDefinitions: Record<keyof EnglishLessonPlanData, { description: string, type: any, items?: any }> = {
    objectives: {
        description: 'A numbered list of learning outcomes for the student (e.g., "Read and match to complete the conversation."). Should be between 3 and 6 objectives.',
        type: Type.ARRAY,
        items: { type: Type.STRING }
    },
    procedures: {
        description: 'A step-by-step guide for the teacher, outlining the activities and interactions during the lesson.',
        type: Type.ARRAY,
        items: { type: Type.STRING }
    },
    materials: {
        description: 'A list of resources required for the lesson (e.g., "Student Book (SB), Activity Book (AB), audio track 1").',
        type: Type.ARRAY,
        items: { type: Type.STRING }
    },
    language: {
        description: 'The grammatical structures or language functions to be taught or reinforced (e.g., "Past simple tense questions and short answers").',
        type: Type.STRING
    },
    vocabulary: {
        description: 'A list of key words and terms for the lesson.',
        type: Type.ARRAY,
        items: { type: Type.STRING }
    },
    evaluation: {
        description: 'A method for checking students\' understanding of the lesson (e.g., "Checking by an oral test").',
        type: Type.STRING
    },
    homework: {
        description: 'An assignment for students to complete at home related to the lesson.',
        type: Type.STRING
    },
};


export const generateEnglishPlan = async (
  source: { text: string; images: string[] },
  sectionsToGenerate: Array<keyof EnglishLessonPlanData>
): Promise<Partial<EnglishLessonPlanData>> => {

  const systemInstruction = `You are an expert in preparing daily lesson plans for teaching English to non-native speakers. Your task is to analyze the provided content (text and/or images from a textbook) and generate the requested sections of the lesson plan in English. The output must be strictly in JSON format, conforming to the provided schema.`;
  
  let sourcePrompt = "Analyze the following content:\n";
  if (source.text) {
    sourcePrompt += `---TEXT---\n${source.text}\n`;
  }
  if (source.images.length > 0) {
    sourcePrompt += "---IMAGES---\n(Please analyze the text from the attached images)\n";
  }

  const instructions = sectionsToGenerate.map(key => {
    const def = englishSectionDefinitions[key];
    return `- **${key}**: ${def.description}`;
  }).join('\n');

  const userPrompt = `
    ${sourcePrompt}
    ---
    Based on the content above, create the following sections for a lesson plan:
    ${instructions}

    Remember, the entire output must be in JSON format only, without any extra text or markdown, and must contain only the requested fields.
  `;

  const properties: Record<string, any> = {};
  sectionsToGenerate.forEach(key => {
      const def = englishSectionDefinitions[key];
      properties[key] = { type: def.type, description: def.description };
      if (def.items) {
          properties[key].items = def.items;
      }
  });
  const lessonPlanSchema = {
    type: Type.OBJECT,
    properties,
    required: sectionsToGenerate
  };

  const contentParts: any[] = [{ text: userPrompt }];
  source.images.forEach(imgBase64 => {
    contentParts.push({
      inlineData: { mimeType: 'image/jpeg', data: imgBase64 }
    });
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: contentParts },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: lessonPlanSchema,
        temperature: 0.5,
      },
    });

    const text = response.text.trim();
    const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
    const data = JSON.parse(cleanedText);
    return data as Partial<EnglishLessonPlanData>;
  } catch (error) {
    console.error("Error generating English lesson plan from Gemini:", error);
    throw new Error("Failed to communicate with the AI service. Please try again.");
  }
};
