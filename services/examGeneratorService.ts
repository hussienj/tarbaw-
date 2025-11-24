
import { GoogleGenAI, Type } from "@google/genai";
import { ExamPaper, ExamSettings, QuestionType, ExamQuestion, ExamBranch, ExamSubQuestion, ExamAnswer } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// A map of available exam templates. In a real app, this might come from a DB.
const EXAM_TEMPLATES: Record<string, Record<string, Record<string, string[]>>> = {
  'الاجتماعيات': {
    'الثالث متوسط': {
      'شهري_separate_sheet': ['https://i.imgur.com/HqKB6Zu.jpeg', 'https://i.imgur.com/ImKFper.jpeg'],
      'شهري_on_paper': ['https://i.imgur.com/4flglw8.png'],
      'وزاري_separate_sheet': ['https://i.imgur.com/UY260YB.jpeg'],
    }
  },
  'اللغة الانكليزية': {
    'الاول متوسط': {
        'شهري_separate_sheet': ['https://i.imgur.com/Rk2Y7wG.jpeg']
    }
  }
};

export function getAvailableTemplates(subject: string, grade: string): string[] {
    const templates = EXAM_TEMPLATES[subject]?.[grade];
    if (!templates) {
        return [];
    }
    // Flatten all URLs from different types (monthly, final, etc.) into one array.
    return Object.values(templates).flat();
}

const examPaperSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: "Unique ID for the question (e.g., q-123)." },
            title: { type: Type.STRING, description: "The question title (e.g., 'س1' or 'Q1')." },
            totalPoints: { type: Type.INTEGER },
            instruction: { type: Type.STRING, description: "Instruction for the whole question (e.g., 'Answer two branches only' or 'أجب عن فرعين فقط')." },
            branchesToAnswer: { type: Type.INTEGER },
            branches: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING, description: "Unique ID for the branch (e.g., b-456)." },
                        points: { type: Type.INTEGER },
                        type: { type: Type.STRING, description: "Type of question (e.g., 'تعاريف', 'تعاليل', 'Definitions', 'Fill in the blanks')." },
                        instruction: { type: Type.STRING, description: "Instruction for the branch (e.g., 'Define five of the following' or 'عرف خمسة مما يأتي')." },
                        itemsToAnswer: { type: Type.INTEGER },
                        subQuestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING, description: "Unique ID for the sub-question (e.g., sq-789)." },
                                    text: { type: Type.STRING, description: "The text of the sub-question (e.g., 'Halkurd' or 'هلكرد')." }
                                },
                                required: ["id", "text"]
                            }
                        }
                    },
                    required: ["id", "points", "type", "instruction", "itemsToAnswer", "subQuestions"]
                }
            }
        },
        required: ["id", "title", "totalPoints", "instruction", "branchesToAnswer", "branches"]
    }
};

const examAnswersSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            questionId: { type: Type.STRING },
            branchId: { type: Type.STRING },
            answerText: { type: Type.STRING, description: "The detailed, correct answer for the entire branch." }
        },
        required: ["questionId", "branchId", "answerText"]
    }
}


async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    // Using images.weserv.nl proxy which is specialized for images and highly reliable.
    // It requires the URL without the protocol scheme (http:// or https://).
    const cleanUrl = url.replace(/^https?:\/\//, '');
    const proxyUrl = `https://images.weserv.nl/?url=${cleanUrl}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) {
            throw new Error(`Image proxy request failed for ${url} with status ${response.status}`);
        }
        
        // Fix: Explicitly type `blob` as `Blob` to ensure correct type inference.
        const blob: Blob = await response.blob();
        const mimeType = blob.type;
        
        if (!mimeType.startsWith('image/')) {
            const errorText = await blob.text();
            console.error("Proxy returned non-image content:", errorText);
            throw new Error(`Expected an image from proxy, but received type: ${mimeType}.`);
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = (reader.result as string)?.split(',')[1];
                if (base64String) {
                    resolve({ base64: base64String, mimeType: mimeType });
                } else {
                    reject(new Error('Failed to convert image blob to base64.'));
                }
            };
            reader.onerror = (error) => {
                console.error('FileReader error:', error);
                reject(new Error('FileReader error while processing the image blob.'));
            };
            reader.readAsDataURL(blob);
        });

    } catch (error) {
        console.error(`Error fetching and processing image from ${url} via proxy:`, error);
        throw error;
    }
}

export const generateExam = async (
    source: { text: string, images: { base64: string, mimeType: string }[] }, 
    settings: ExamSettings,
    selectedTemplateUrls: string[]
): Promise<ExamPaper> => {

    const isEnglishExam = settings.subject === "اللغة الانكليزية";

    const systemInstruction = isEnglishExam
      ? `You are an expert in creating English language exams for non-native speakers, specifically for the Iraqi curriculum. Your task is to create a full exam paper based on the provided source material and user settings. You must strictly adhere to the structure, format, and style of the user-selected template images. All questions and text on the exam paper must be in English. The final output must be exclusively in JSON format, conforming to the provided schema.`
      : `أنت خبير في تصميم أوراق الامتحانات للمناهج العراقية. مهمتك هي إنشاء ورقة امتحان بناءً على المحتوى الدراسي المقدم. يجب عليك الالتزام الصارم بالهيكل والتنسيق والأسلوب الموجود في صورة (أو صور) المثال المختارة من المستخدم. يجب أن تكون الأسئلة من المحتوى الدراسي. يجب أن يكون الناتج بصيغة JSON حصرًا، ومتوافقًا مع المخطط (schema) المحدد.`;
    
    const userPrompt = isEnglishExam 
      ? `
        Source material to create questions from:
        --- Text ---
        ${source.text}
        --- Images ---
        ${source.images.length > 0 ? '(Source material images are attached)' : '(No source material images provided)'}
        ---
        Exam Information:
        - Subject: ${settings.subject}
        - Grade: ${settings.grade}
        - Exam Type: ${settings.examType}
        - Top Note: ${settings.topNote}
        - Total Score: ${settings.totalScore}
        - Required number of main questions: ${settings.numberOfQuestions}
        ---
        Instructions:
        1. Analyze the user-selected template image(s) attached to understand the required structure (question distribution, branches, question types, points).
        2. Create a complete exam paper from the source material that matches the template's structure. It must contain exactly ${settings.numberOfQuestions} main questions.
        3. Ensure the total points for the questions roughly add up to the specified total score.
        4. The output must be a single JSON object only.
    ` : `
        المحتوى الدراسي الذي يجب إنشاء الأسئلة منه:
        --- نص ---
        ${source.text}
        --- صور ---
        ${source.images.length > 0 ? '(تم إرفاق صور المحتوى)' : '(لا توجد صور للمحتوى)'}
        ---
        معلومات الاختبار:
        - المادة: ${settings.subject}
        - الصف: ${settings.grade}
        - نوع الاختبار: ${settings.examType}
        - ملاحظة أعلى الورقة: ${settings.topNote}
        - الدرجة الكلية: ${settings.totalScore}
        - عدد الأسئلة الرئيسية المطلوب: ${settings.numberOfQuestions}
        ---
        التعليمات:
        1. قم بتحليل صور المثال المرفقة والمختارة من قبل المستخدم لفهم الهيكل المطلوب بدقة (توزيع الأسئلة، الفروع، أنواع الأسئلة، الدرجات).
        2. قم بإنشاء ورقة أسئلة كاملة من المحتوى الدراسي متطابقة مع هيكل المثال. يجب أن تحتوي على ${settings.numberOfQuestions} أسئلة رئيسية بالضبط.
        3. تأكد من أن مجموع درجات الأسئلة يساوي تقريبًا الدرجة الكلية المحددة.
        4. يجب أن يكون الإخراج كائن JSON فقط.
    `;

    const contentParts: any[] = [{ text: userPrompt }];

    // Add source material images
    source.images.forEach(img => {
        contentParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    });

    // Add selected template images
    if (selectedTemplateUrls.length > 0) {
        const templateText = isEnglishExam ? "\n--- User-selected Template Images ---\n" : "\n--- صور المثال (القالب) المختارة من قبل المستخدم ---\n";
        contentParts.push({ text: templateText });
        try {
            for(const url of selectedTemplateUrls) {
                const { base64, mimeType } = await fetchImageAsBase64(url);
                contentParts.push({ inlineData: { mimeType: mimeType, data: base64 } });
            }
        } catch (e) {
             throw new Error("فشل في تحميل صورة القالب. قد يكون الرابط غير صحيح أو هناك مشكلة في الشبكة.");
        }
    } else {
         const noTemplateText = isEnglishExam ? "\n--- No Template Selected ---\nCreate a standard exam for the specified subject and grade." : "\n--- لا يوجد قالب محدد --- \nقم بإنشاء امتحان بأسلوب عام ومنطقي للمادة والصف المحددين.";
        contentParts.push({ text: noTemplateText });
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: contentParts },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: examPaperSchema,
                temperature: 0.6,
            },
        });

        const text = response.text.trim();
        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
        const data = JSON.parse(cleanedText);
        return data as ExamPaper;

    } catch (error: any) {
        console.error("Error generating exam from Gemini:", error);
        if (error.message && error.message.toLowerCase().includes('json')) {
            throw new Error("فشل الذكاء الاصطناعي في إرجاع بيانات بتنسيق صحيح. قد تكون جودة الصور رديئة أو المحتوى غير كافٍ.");
        }
        if (error.error && error.error.message) {
            throw new Error(`Error generating exam from Gemini:\n${error.error.message}`);
        }
        throw new Error("فشل في التواصل مع خدمة الذكاء الاصطناعي لتوليد الامتحان.");
    }
};

export const generateAnswersForExam = async (paper: ExamPaper, isEnglishExam: boolean): Promise<ExamAnswer[]> => {
    const systemInstruction = isEnglishExam 
        ? "You are an expert teaching assistant for English language learners. Your task is to provide accurate, clear, and concise model answers for the provided exam questions. The answers must be in English."
        : `أنت مساعد خبير للمعلمين. مهمتك هي توفير إجابات نموذجية ودقيقة للأسئلة المقدمة لك من ورقة امتحان. يجب أن تكون الإجابات واضحة ومختصرة ومباشرة.`;

    const userPrompt = isEnglishExam
        ? `
        Please provide the model answers for the following English exam questions. Return the answers in JSON format according to the specified schema.

        --- Exam Paper ---
        ${JSON.stringify(paper, null, 2)}
        ---
        `
        : `
        يرجى تقديم الإجابات النموذجية لأسئلة الامتحان التالية. قم بإرجاع الإجابات بصيغة JSON مطابقة للمخطط المحدد.

        --- ورقة الأسئلة ---
        ${JSON.stringify(paper, null, 2)}
        ---
        `;
     
     try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ text: userPrompt }],
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: examAnswersSchema
            },
        });

        const text = response.text.trim();
        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
        const data = JSON.parse(cleanedText);
        return data as ExamAnswer[];

     } catch(error) {
        console.error("Error generating answers from Gemini:", error);
        throw new Error("فشل في توليد الإجابات من خدمة الذكاء الاصطناعي.");
     }
};
