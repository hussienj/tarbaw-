
import { GoogleGenAI, Type } from "@google/genai";
import { LessonPlanData } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const sectionDefinitions: Record<keyof LessonPlanData, { description: string, type: any, items?: any }> = {
    learningOutcomes: { 
        description: 'الأهداف التعليمية التي يجب أن يحققها الطالب (3 إلى 6 أهداف). يجب أن تبدأ كل جملة بفعل سلوكي.',
        type: Type.ARRAY, 
        items: { type: Type.STRING }
    },
    priorKnowledge: { 
        description: 'المعرفة أو المهارات السابقة التي يُفترض أن يمتلكها الطلاب.',
        type: Type.STRING 
    },
    materialsAndTools: {
        description: 'قائمة بالمواد والأدوات اللازمة للدرس (السبورة، الأقلام، إلخ).',
        type: Type.ARRAY,
        items: { type: Type.STRING }
    },
    vocabulary: {
        description: 'قائمة بالكلمات والمصطلحات الرئيسية والمهمة في الدرس.',
        type: Type.ARRAY,
        items: { type: Type.STRING }
    },
    teachingProcess: {
      description: 'عملية تدريس متكاملة.',
      type: Type.OBJECT,
      items: {
          type: Type.OBJECT,
          properties: {
            warmUp: { type: Type.STRING, description: 'سؤال أو نشاط قصير لافتتاح الدرس.' },
            activity: { type: Type.STRING, description: 'نشاط عملي أو تفاعلي للطلاب.' },
            explanation: { type: Type.STRING, description: 'ملخص لكيفية شرح المادة.' },
            assessment: { type: Type.STRING, description: 'سؤال لتقييم فهم الطلاب أثناء الشرح.' },
            expansion: { type: Type.STRING, description: 'نشاط إضافي للطلاب المتميزين.' },
          },
          required: ['warmUp', 'activity', 'explanation', 'assessment', 'expansion']
      }
    },
    finalAssessment: {
        description: 'سؤال أو مهمة ختامية لتقييم استيعاب الدرس.',
        type: Type.STRING
    },
    homework: {
        description: 'واجب منزلي يتعلق بموضوع الدرس.',
        type: Type.STRING
    },
};

export const generatePlan = async (
  source: { text: string; images: string[] },
  sectionsToGenerate: Array<keyof LessonPlanData>
): Promise<Partial<LessonPlanData>> => {

  const systemInstruction = `أنت خبير في إعداد الخطط الدراسية اليومية للمعلمين في المناهج العربية. مهمتك هي تحليل المحتوى المُقدم (نص و/أو صور) وإنشاء الأجزاء المطلوبة من خطة الدرس باللغة العربية. يجب أن يكون الناتج بصيغة JSON حصرًا، ومتوافقًا مع المخطط (schema) المحدد.`;
  
  let sourcePrompt = "المحتوى المقدم للتحليل:\n";
  if (source.text) {
    sourcePrompt += `---النص---\n${source.text}\n`;
  }
  if (source.images.length > 0) {
    sourcePrompt += "---الصور---\n(يرجى تحليل النص من الصور المرفقة)\n";
  }

  const instructions = sectionsToGenerate.map(key => {
    const def = sectionDefinitions[key];
    return `- **${key}**: ${def.description}`;
  }).join('\n');

  const userPrompt = `
    ${sourcePrompt}
    ---
    بناءً على المحتوى أعلاه، قم بإنشاء الأقسام التالية من خطة الدرس:
    ${instructions}

    تذكر، يجب أن يكون الناتج بأكمله بصيغة JSON فقط بدون أي نص إضافي أو علامات markdown، ويجب أن يحتوي فقط على الحقول المطلوبة.
  `;

  // Dynamically build schema
  const properties: Record<string, any> = {};
  sectionsToGenerate.forEach(key => {
      const def = sectionDefinitions[key];
      if (key === 'teachingProcess') {
          properties[key] = def.items;
      } else {
          properties[key] = { type: def.type, description: def.description };
          if (def.items) {
              properties[key].items = def.items;
          }
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
    return data as Partial<LessonPlanData>;
  } catch (error) {
    console.error("Error generating lesson plan from Gemini:", error);
    throw new Error("فشل في التواصل مع خدمة الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.");
  }
};
