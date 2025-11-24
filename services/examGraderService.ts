import { GoogleGenAI, Type } from "@google/genai";
import { Question, AnswerKey, GradingResult } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const questionGenerationSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            question: { type: Type.STRING, description: 'نص السؤال نفسه.' },
            options: {
                type: Type.OBJECT,
                properties: {
                    A: { type: Type.STRING, description: 'نص الخيار A.' },
                    B: { type: Type.STRING, description: 'نص الخيار B.' },
                    C: { type: Type.STRING, description: 'نص الخيار C.' },
                    D: { type: Type.STRING, description: 'نص الخيار D.' },
                },
                required: ["A", "B", "C", "D"]
            },
            correctAnswer: { type: Type.STRING, description: "الحرف الذي يمثل الإجابة الصحيحة (A, B, C, or D).", enum: ["A", "B", "C", "D"] }
        },
        required: ["question", "options", "correctAnswer"]
    }
};

export const generateQuestionsFromContent = async (
    source: { text: string; images: { base64: string, mimeType: string }[] },
    numQuestions: number
): Promise<Omit<Question, 'id'>[]> => {
    const systemInstruction = `أنت مساعد ذكي للمعلمين متخصص في إنشاء أسئلة امتحانات. مهمتك هي قراءة النص التعليمي المقدم وإنشاء أسئلة اختيار من متعدد بناءً عليه. يجب أن يكون لكل سؤال أربعة خيارات (A, B, C, D) مع تحديد الإجابة الصحيحة. يجب أن يكون الناتج بصيغة JSON حصرًا ومتوافقًا مع المخطط (schema) المحدد.`;
    
    let sourcePrompt = `بناءً على المحتوى التالي، قم بإنشاء ${numQuestions} سؤال اختيار من متعدد.\n`;
    if (source.text) {
        sourcePrompt += `\n--- النص ---\n${source.text}\n---`;
    }
    if (source.images.length > 0) {
        sourcePrompt += "\n\n(يرجى تحليل النص من الصور المرفقة)";
    }
    sourcePrompt += "\n\nتأكد من أن الأسئلة متنوعة وتغطي جوانب مختلفة من المحتوى.";

    const contentParts: any[] = [{ text: sourcePrompt }];
    source.images.forEach(img => {
        contentParts.push({
            inlineData: { mimeType: img.mimeType, data: img.base64 }
        });
    });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: contentParts },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: questionGenerationSchema,
                temperature: 0.7,
            },
        });

        const text = response.text.trim();
        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
        const data = JSON.parse(cleanedText);
        return data as Omit<Question, 'id'>[];
    } catch (error) {
        console.error("Error generating questions from Gemini:", error);
        throw new Error("فشل في توليد الأسئلة من الذكاء الاصطناعي. يرجى المحاولة مرة أخرى.");
    }
};

const singleGradingResultSchema = {
    type: Type.OBJECT,
    properties: {
        studentName: { type: Type.STRING, description: "اسم الطالب المستخرج من خط اليد في الورقة. إذا لم يوجد، ضع 'طالب غير محدد'." },
        studentSection: { type: Type.STRING, description: "شعبة الطالب المستخرجة من الورقة، إن وجدت." },
        fileName: { type: Type.STRING, description: "اسم ملف الصورة الأصلية المقدمة." },
        summary: {
            type: Type.OBJECT,
            properties: {
                totalQuestions: { type: Type.INTEGER },
                correctAnswers: { type: Type.INTEGER },
                wrongAnswers: { type: Type.INTEGER },
                scorePercentage: { type: Type.NUMBER, description: "النسبة المئوية للنجاح (مثال: 80.0)." }
            },
            required: ["totalQuestions", "correctAnswers", "wrongAnswers", "scorePercentage"]
        },
        details: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    questionNumber: { type: Type.INTEGER, description: "رقم السؤال كما هو في مفتاح الإجابة." },
                    studentAnswer: { type: Type.STRING, description: "الحرف الذي كتبه الطالب كإجابة (A, B, C, D). إذا لم يتمكن من قراءته، يضع 'غير واضح'." },
                    correctAnswer: { type: Type.STRING, description: "الإجابة الصحيحة من مفتاح الإجابة." },
                    status: { type: Type.STRING, enum: ["صحيحة", "خاطئة"] }
                },
                required: ["questionNumber", "studentAnswer", "correctAnswer", "status"]
            }
        }
    },
    required: ["studentName", "fileName", "summary", "details"]
};

export const gradeSingleStudentPaper = async (answerKey: AnswerKey, studentImage: {name: string, data: string}): Promise<GradingResult> => {
    const systemInstruction = `أنت نظام تصحيح امتحانات آلي فائق الدقة. مهمتك هي تحليل صورة ورقة إجابة طالب مكتوبة بخط اليد ومقارنتها بمفتاح الإجابة المقدم. يجب عليك التعرف على خط اليد العربي. استخرج اسم الطالب، ثم لكل سؤال، اقرأ إجابته وقارنها بالإجابة الصحيحة. قم بإرجاع النتيجة الكاملة بصيغة JSON مطابقة للمخطط المحدد بدقة.`;

    const keyWithQuestionText = answerKey.map((q, index) => ({
        questionNumber: index + 1,
        questionText: q.question,
        correctAnswer: q.correctAnswer
    }));
    
    const contents = [
        { text: `مفتاح الإجابة هو:\n${JSON.stringify(keyWithQuestionText)}\n\nالآن، قم بتحليل صورة إجابة الطالب التالية:` },
        { inlineData: { mimeType: 'image/jpeg', data: studentImage.data } },
        { text: `تذكر، أرجع نتيجة واحدة فقط بصيغة JSON. قم بتضمين اسم الملف الأصلي (${studentImage.name}) في حقل 'fileName'.` }
    ];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: contents },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: singleGradingResultSchema
            }
        });

        const text = response.text.trim();
        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
        const data = JSON.parse(cleanedText);
        
        const result = data as GradingResult;
        return {
            ...result,
            details: result.details.map(detail => ({
                ...detail,
                questionText: answerKey[detail.questionNumber - 1]?.question || 'غير متوفر'
            }))
        };

    } catch (error) {
        console.error("Error grading paper with Gemini:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
             throw new Error("فشل الذكاء الاصطناعي في إرجاع بيانات بتنسيق صحيح. قد تكون جودة الصورة رديئة.");
        }
        throw new Error("فشل في التواصل مع خدمة الذكاء الاصطناعي لتدقيق الإجابات.");
    }
};

export const gradeSingleStudentPaperWithImageKey = async (
    answerKeyImageBase64: string,
    studentImage: {name: string, data: string}
): Promise<GradingResult> => {
    const systemInstruction = `أنت نظام تصحيح امتحانات آلي فائق الدقة. مهمتك هي مقارنة صورة ورقة إجابة طالب بصورة مفتاح الإجابة. يجب عليك التعرف على خط اليد العربي. الصورة الأولى هي مفتاح الإجابة النموذجي. الصورة الثانية هي ورقة إجابة الطالب. استخرج اسم الطالب، ثم لكل سؤال، اقرأ إجابته وقارنها بالإجابة الصحيحة من مفتاح الإجابة. قم بإرجاع النتائج الكاملة بصيغة JSON مطابقة للمخطط المحدد بدقة.`;

    const contents = [
        { text: `ابدأ التحليل. الصورة الأولى هي مفتاح الإجابة النموذجي. الصورة الثانية هي ورقة إجابة الطالب.` },
        { inlineData: { mimeType: 'image/jpeg', data: answerKeyImageBase64 } },
        { inlineData: { mimeType: 'image/jpeg', data: studentImage.data } },
        { text: `تذكر، قم بإرجاع كائن نتيجة واحد فقط. قم بتضمين اسم الملف الأصلي للطالب (${studentImage.name}) في حقل 'fileName'. في حقل 'details', لا تضع نص السؤال بل فقط رقم السؤال, اجابة الطالب, الاجابة الصحيحة من المفتاح, والحالة.` }
    ];

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: { parts: contents },
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: singleGradingResultSchema
            }
        });

        const text = response.text.trim();
        const cleanedText = text.replace(/^```json\s*|```\s*$/g, '');
        const data = JSON.parse(cleanedText);
        return data as GradingResult;

    } catch (error) {
        console.error("Error grading papers with image key from Gemini:", error);
        if (error instanceof Error && error.message.includes('JSON')) {
             throw new Error("فشل الذكاء الاصطناعي في إرجاع بيانات بتنسيق صحيح. قد تكون جودة الصور رديئة أو غير واضحة.");
        }
        throw new Error("فشل في التواصل مع خدمة الذكاء الاصطناعي لتدقيق الإجابات باستخدام مفتاح الصورة.");
    }
};