




import React, { useState, useEffect, ChangeEvent } from 'react';
import Icon from './Icon';
import { ExamPaper, ExamSettings, ExamQuestion, ExamBranch, QuestionType, ExamSubQuestion, ExamAnswer, Teacher } from '../types';
import { generateExam, generateAnswersForExam, getAvailableTemplates } from '../services/examGeneratorService';
import { getUsageData, decrementUsage, USAGE_LIMITS, UsageData } from '../services/firebaseService';

const { jsPDF } = window.jspdf;

const examTypes = ["شهري", "نصف السنة", "نهاية السنة", "وزاري"];
const questionTypes: QuestionType[] = ['تعاريف', 'تعاليل', 'مقارنات', 'فراغات', 'اختر من متعدد', 'صح وخطأ', 'ارسم', 'أسئلة مقالية', 'انشاء', 'أحكام التلاوة', 'الحفظ', 'التفسير والمعاني', 'الحديث الشريف', 'نوع آخر'];

type Tab = 'image' | 'paste' | 'url';

const UsageCounter: React.FC<{
  label: string;
  remaining: number;
  limit: number;
  isLoading: boolean;
}> = ({ label, remaining, limit, isLoading }) => {
  // Clamp percentage between 0 and 100 to prevent visual overflow.
  const percentage = limit > 0 ? Math.max(0, Math.min(100, (remaining / limit) * 100)) : 0;
  let barColor = 'bg-green-500';
  if (percentage < 50) barColor = 'bg-yellow-500';
  if (percentage < 25) barColor = 'bg-red-500';

  return (
    <div className="bg-gray-800 text-white p-3 rounded-lg shadow-md w-full max-w-sm">
      <div className="flex justify-between items-center text-sm font-medium mb-1">
        <span className="text-gray-300">{label}</span>
        {isLoading ? (
          <span className="text-gray-400">...جاري التحميل</span>
        ) : (
          <span className="font-bold text-lg">{remaining}<span className="text-gray-400 text-base">/{limit}</span></span>
        )}
      </div>
      <div className="w-full bg-gray-600 rounded-full h-2.5 overflow-hidden">
        <div 
          className={`h-2.5 rounded-full transition-all duration-500 ${isLoading ? 'bg-gray-400 animate-pulse' : barColor}`}
          style={{ width: `${isLoading ? 100 : percentage}%` }}
        ></div>
      </div>
      <p className="text-xs text-center text-gray-400 mt-2">
        {isLoading ? '' : `المتبقي من استخدامك لهذا الشهر. يتجدد تلقائيًا.`}
      </p>
    </div>
  );
};

const Section: React.FC<{ title: string, icon: string, children: React.ReactNode, description?: string }> = ({ title, icon, children, description }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <Icon name={icon} className="w-7 h-7 text-teal-600" />
            <div>
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
                {description && <p className="text-sm text-gray-500">{description}</p>}
            </div>
        </div>
        <div className="p-5">{children}</div>
    </div>
);


interface EditQuestionModalProps {
    question: ExamQuestion;
    onClose: () => void;
    onSave: (question: ExamQuestion) => void;
}

function EditQuestionModal({ question: initialQuestion, onClose, onSave }: EditQuestionModalProps) {
    const [question, setQuestion] = useState<ExamQuestion>(() => JSON.parse(JSON.stringify(initialQuestion)));

    const handleUpdateField = (field: keyof ExamQuestion, value: string | number) => {
        setQuestion(p => ({ ...p, [field]: value }));
    };

    const handleUpdateBranch = (bId: string, field: keyof ExamBranch, value: any) => {
        setQuestion(p => ({ ...p, branches: p.branches.map(b => b.id === bId ? { ...b, [field]: value } : b) }));
    };

    const handleUpdateSubQuestion = (bId: string, sqId: string, text: string) => {
        setQuestion(p => ({
            ...p,
            branches: p.branches.map(b =>
                b.id === bId ? { ...b, subQuestions: b.subQuestions.map(sq => sq.id === sqId ? { ...sq, text } : sq) } : b
            )
        }));
    };

    const deleteSubQuestion = (bId: string, sqId: string) => {
        setQuestion(p => ({
            ...p,
            branches: p.branches.map(b =>
                b.id === bId ? { ...b, subQuestions: b.subQuestions.filter(sq => sq.id !== sqId) } : b
            )
        }));
    };

    const addSubQuestion = (bId: string) => {
        const newSubQ = { id: `sq-${Date.now()}`, text: '' };
        setQuestion(p => ({
            ...p,
            branches: p.branches.map(b =>
                b.id === bId ? { ...b, subQuestions: [...b.subQuestions, newSubQ] } : b
            )
        }));
    };

    const addBranch = () => {
        const newBranch: ExamBranch = {
            id: `b-${Date.now()}`,
            points: 10,
            type: 'أسئلة مقالية',
            instruction: '',
            itemsToAnswer: 1,
            subQuestions: [{ id: `sq-${Date.now()}`, text: '' }]
        };
        setQuestion(p => ({ ...p, branches: [...p.branches, newBranch] }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-50 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-white rounded-t-lg">
                    <h3 className="text-xl font-bold text-gray-800">تعديل السؤال: {question.title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
                </div>
                <div className="p-4 overflow-y-auto space-y-4 flex-grow">
                    <div className="p-3 bg-white border rounded-lg shadow-sm">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الدرجة الكلية للسؤال</label>
                                <input type="number" value={question.totalPoints} onChange={e => handleUpdateField('totalPoints', parseInt(e.target.value) || 0)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظة للسؤال (اختياري)</label>
                                <input type="text" value={question.instruction} onChange={e => handleUpdateField('instruction', e.target.value)} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500" placeholder="مثال: أجب عن فرعين فقط" />
                            </div>
                        </div>
                    </div>

                    {question.branches.map((branch, index) => (
                        <div key={branch.id} className="p-3 bg-white border rounded-lg shadow-sm">
                            <h4 className="font-bold text-lg mb-2 text-teal-700 border-b pb-2">الفرع {String.fromCharCode(1575 + index)}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                                <div>
                                    <label className="text-xs font-medium">درجة الفرع</label>
                                    <input type="number" value={branch.points} onChange={e => handleUpdateBranch(branch.id, 'points', parseInt(e.target.value) || 0)} className="w-full p-1 border rounded-md text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs font-medium">نوع السؤال الفرعي</label>
                                    <select value={branch.type} onChange={e => handleUpdateBranch(branch.id, 'type', e.target.value)} className="w-full p-1 border rounded-md text-sm bg-white">
                                        {questionTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium">عدد الفقرات للإجابة</label>
                                    <input type="number" value={branch.itemsToAnswer} onChange={e => handleUpdateBranch(branch.id, 'itemsToAnswer', parseInt(e.target.value) || 0)} className="w-full p-1 border rounded-md text-sm" />
                                </div>
                            </div>
                            <div className="mb-3">
                                <label className="text-xs font-medium">صيغة السؤال للفرع</label>
                                <input type="text" value={branch.instruction} onChange={e => handleUpdateBranch(branch.id, 'instruction', e.target.value)} placeholder="مثال: عرف ثلاثة مما يأتي" className="w-full p-1 border rounded-md text-sm" />
                            </div>

                            <label className="text-sm font-bold text-gray-600">فقرات السؤال الفرعي:</label>
                            <div className="space-y-2 mt-1">
                                {branch.subQuestions.map(subQ => (
                                    <div key={subQ.id} className="flex items-center gap-2">
                                        <input type="text" value={subQ.text} onChange={e => handleUpdateSubQuestion(branch.id, subQ.id, e.target.value)} className="w-full p-1.5 border rounded-md text-sm focus:ring-1 focus:ring-indigo-500" />
                                        <button onClick={() => deleteSubQuestion(branch.id, subQ.id)} className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors flex-shrink-0"><Icon name="trash" className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                <button onClick={() => addSubQuestion(branch.id)} className="w-full text-sm bg-green-100 text-green-700 font-semibold px-3 py-1.5 rounded-md hover:bg-green-200 transition-colors flex items-center justify-center gap-2">
                                    <Icon name="plus" className="w-4 h-4" />
                                    <span>إضافة فقرة</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="p-3 border-t bg-white rounded-b-lg flex justify-between items-center">
                    <button onClick={addBranch} className="bg-purple-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-purple-700 transition-colors text-sm">إضافة فرع جديد</button>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                        <button onClick={() => onSave(question)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm">حفظ التعديلات</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ExamGeneratorProps {
    teacher: Teacher;
}

export default function ExamGenerator({ teacher }: ExamGeneratorProps) {
    const { grades: teacherGrades, subject: teacherSubject, name: teacherName } = teacher;

    const [settings, setSettings] = useState<ExamSettings>({
        subject: teacherSubject,
        grade: teacherGrades[0] || '',
        examType: 'شهري',
        answerStyle: 'separate_sheet',
        totalScore: 100,
        topNote: teacherSubject === 'اللغة الانكليزية' 
            ? 'Note: Answer all the following questions.' 
            : 'ملاحظة: أجب عن خمسة أسئلة فقط، ولكل سؤال 20 درجة.',
        numberOfQuestions: 5,
    });
    const [source, setSource] = useState<{ text: string, images: { base64: string, mimeType: string }[] }>({ text: '', images: [] });
    const [examPaper, setExamPaper] = useState<ExamPaper>([]);
    const [examAnswers, setExamAnswers] = useState<ExamAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingAnswers, setIsGeneratingAnswers] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('paste');
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
    const [usage, setUsage] = useState<UsageData | null>(null);
    
    // State for URL extraction
    const [urlInput, setUrlInput] = useState('');
    const [fromPage, setFromPage] = useState('');
    const [toPage, setToPage] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);

    // State for templates
    const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
    const [selectedTemplateUrls, setSelectedTemplateUrls] = useState<string[]>([]);
    
    useEffect(() => {
        // If teacherGrades changes (e.g. after login), update the selected grade in settings
        if (teacherGrades.length > 0 && !teacherGrades.includes(settings.grade)) {
            setSettings(prev => ({ ...prev, grade: teacherGrades[0] }));
        }
    }, [teacherGrades, settings.grade]);

    useEffect(() => {
        const templates = getAvailableTemplates(settings.subject, settings.grade);
        setAvailableTemplates(templates);
        setSelectedTemplateUrls([]); // Reset selection when subject/grade changes
    }, [settings.subject, settings.grade]);

    useEffect(() => {
      if (teacher) {
        getUsageData(teacher).then(setUsage);
      }
    }, [teacher]);


    const handleSettingsChange = (field: keyof ExamSettings, value: string | number | boolean) => {
        setSettings(prev => {
            const newSettings = { ...prev, [field]: value };
            if (field === 'examType' && value !== 'وزاري') {
                newSettings.numberOfQuestions = 5;
            } else if (field === 'examType' && value === 'وزاري') {
                newSettings.numberOfQuestions = 6;
            }
            if (field === 'subject' && value === 'اللغة الانكليزية') {
                 newSettings.topNote = 'Note: Answer all the following questions.';
            } else if (field === 'subject') {
                 newSettings.topNote = 'ملاحظة: أجب عن خمسة أسئلة فقط، ولكل سؤال 20 درجة.';
            }
            return newSettings;
        });
    };

    const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            const newPreviews: string[] = [];
            const newImages: { base64: string, mimeType: string }[] = [];
        
            // Fix: Explicitly type `file` as `File` to ensure correct type inference.
            files.forEach((file: File) => {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                    const dataUrl = loadEvent.target?.result as string;
                    newPreviews.push(dataUrl);
                    const base64 = dataUrl.split(',')[1];
            
                    newImages.push({ base64, mimeType: file.type });
            
                    if (newImages.length === files.length) {
                        setImagePreviews(prev => [...prev, ...newPreviews]);
                        setSource(prev => ({...prev, images: [...prev.images, ...newImages]}));
                    }
                };
                reader.readAsDataURL(file);
            });
        }
    };
    
    const handleUrlExtract = async () => {
        setExtractionError(null);
        setIsExtracting(true);

        if (!urlInput) {
            setExtractionError("الرجاء إدخال رابط لصفحة الويب.");
            setIsExtracting(false);
            return;
        }
        
        const fromNum = fromPage ? parseInt(fromPage, 10) : 0;
        const toNum = toPage ? parseInt(toPage, 10) : 0;

        if ((fromNum || toNum) && (!fromNum || !toNum || fromNum > toNum)) {
            setExtractionError("الرجاء إدخال نطاق صفحات صحيح. يجب أن تكون 'من صفحة' أصغر من أو تساوي 'إلى صفحة'.");
            setIsExtracting(false);
            return;
        }

        try {
            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlInput)}`;
            const response = await fetch(proxyUrl);
            
            if (!response.ok) throw new Error(`فشل في جلب المحتوى. الحالة: ${response.status}`);

            const htmlContent = await response.text();

            if (!htmlContent) throw new Error("لم يتم العثور على محتوى في الرابط المقدم.");

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            doc.querySelectorAll('script, style, noscript, header, footer, nav, aside, form, img, svg, button, input').forEach(el => el.remove());
            
            let bodyContent = doc.body.innerHTML;
            bodyContent = bodyContent.replace(/<p.*?>/gi, '\n').replace(/<div.*?>/gi, '\n');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = bodyContent;
            const bodyText = tempDiv.textContent || "";
            
            const cleanedText = bodyText.replace(/(\s*\n\s*)+/g, '\n').trim();

            if (!cleanedText) {
                throw new Error("لم يتم العثور على نص قابل للاستخلاص في الصفحة بعد التنظيف.");
            }
            
            let extractedText = cleanedText;

            if (fromNum && toNum) {
                 const pageSegments = cleanedText.split(/(?=\b(?:page|صفحة)\s+\d+\b)/i);

                if (pageSegments.length <= 1) {
                    throw new Error("لم يتمكن النظام من العثور على علامات ترقيم الصفحات (مثل 'Page 1') في المحتوى. يرجى ترك حقول الصفحات فارغة لاستخلاص النص كاملاً.");
                }

                const extractedContent: string[] = [];
                
                for (const segment of pageSegments) {
                    const match = segment.match(/\b(?:page|صفحة)\s+(\d+)\b/i);
                    if (match) {
                        const currentPageNum = parseInt(match[1], 10);
                        if (currentPageNum >= fromNum && currentPageNum <= toNum) {
                            extractedContent.push(segment);
                        }
                    }
                }
                
                if (extractedContent.length === 0) {
                    throw new Error(`لم يتم العثور على محتوى للصفحات المطلوبة (${fromNum}-${toNum}). يرجى التحقق من أرقام الصفحات في الموقع.`);
                }
                extractedText = extractedContent.join('\n\n');
            }

            setSource(prev => ({ ...prev, text: extractedText }));
            setActiveTab('paste');
            setUrlInput('');
            setFromPage('');
            setToPage('');

        } catch (error: any) {
            console.error('Error extracting web page text:', error);
            setExtractionError(error.message || "حدث خطأ أثناء محاولة جلب محتوى الصفحة. يرجى التحقق من الرابط.");
        } finally {
            setIsExtracting(false);
        }
    };

    const handleTemplateSelection = (url: string) => {
        setSelectedTemplateUrls(prev => 
            prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
        );
    };

    const handleGenerateExam = async () => {
        if (!source.text && source.images.length === 0) {
            setError("يرجى توفير محتوى المادة الدراسية أولاً (نص أو صور).");
            return;
        }

        const currentUsage = await getUsageData(teacher);
        if (currentUsage.examQuestionGenerations <= 0) {
            setError("لقد وصلت إلى الحد الأقصى لتوليد أسئلة الامتحانات لهذا الشهر.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setExamPaper([]);
        setExamAnswers([]);
        try {
            await decrementUsage(teacher, 'examQuestionGenerations');
            const updatedUsage = await getUsageData(teacher);
            setUsage(updatedUsage);

            const generatedPaper = await generateExam(source, settings, selectedTemplateUrls);
            
             // Post-processing to clean up redundancies
            const cleanedPaper = generatedPaper.map(question => {
                // Clean branches within each question
                const cleanedBranches = question.branches.map(branch => {
                    let newBranch = { ...branch };
                    
                    // Rule 1: If branch instruction is similar to question instruction, remove branch instruction.
                    const qInstruction = question.instruction.replace(/\s/g, '').toLowerCase();
                    const bInstruction = branch.instruction.replace(/\s/g, '').toLowerCase();
                    
                    if (qInstruction && bInstruction && (qInstruction.includes(bInstruction) || bInstruction.includes(qInstruction))) {
                        newBranch.instruction = '';
                    }

                    // Rule 2: If a sub-question's text is very similar to the branch instruction, remove that sub-question.
                    const branchInstructionText = newBranch.instruction.replace(/[^a-zA-Z\u0600-\u06FF]/g, "").toLowerCase(); // keep only letters
                    
                    if (newBranch.subQuestions.length === 1 && branchInstructionText) {
                        const subQuestionText = newBranch.subQuestions[0].text.replace(/[^a-zA-Z\u0600-\u06FF]/g, "").toLowerCase();
                         if (branchInstructionText.includes(subQuestionText) || subQuestionText.includes(branchInstructionText)) {
                             newBranch.subQuestions = [];
                         }
                    }

                    return newBranch;
                });
                
                return { ...question, branches: cleanedBranches };
            });

            setExamPaper(cleanedPaper);

        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateAnswers = async () => {
        if(examPaper.length === 0) {
            setError("يرجى توليد أسئلة الامتحان أولاً.");
            return;
        }

        const currentUsage = await getUsageData(teacher);
        if (currentUsage.examAnswerGenerations <= 0) {
            setError("لقد وصلت إلى الحد الأقصى لتوليد إجابات الامتحانات لهذا الشهر.");
            return;
        }

        setIsGeneratingAnswers(true);
        setError(null);
        try {
            await decrementUsage(teacher, 'examAnswerGenerations');
            const updatedUsage = await getUsageData(teacher);
            setUsage(updatedUsage);
            
            const isEnglishExam = settings.subject === "اللغة الانكليزية";
            const generatedAnswers = await generateAnswersForExam(examPaper, isEnglishExam);
            setExamAnswers(generatedAnswers);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsGeneratingAnswers(false);
        }
    };
    
    const updateQuestion = (qId: string, newQuestionData: Partial<ExamQuestion>) => {
        setExamPaper(paper => paper.map(q => q.id === qId ? {...q, ...newQuestionData} : q));
    };

    const deleteQuestion = (qId: string) => {
        setExamPaper(paper => paper.filter(q => q.id !== qId));
    };
    
    const addQuestion = () => {
        const newQ: ExamQuestion = {
            id: `q-${Date.now()}`,
            title: `س${examPaper.length + 1}`,
            totalPoints: 20,
            instruction: 'أجب عن فرع واحد',
            branchesToAnswer: 1,
            branches: []
        };
        setExamPaper(paper => [...paper, newQ]);
    };
    
    const generateExamHtml = (paper: ExamPaper, answers?: ExamAnswer[]) => {
        const isEnglishExam = settings.subject === 'اللغة الانكليزية';

        if (isEnglishExam) {
            const header = `
                <div style="text-align: center; font-family: 'Times New Roman', serif; border-bottom: 2px double black; padding-bottom: 5px; margin-bottom: 10px;">
                    <p style="margin:0; font-size: 16px;">In The Name Of Allah</p>
                    <p style="margin:0; font-size: 14px;">${settings.examType} Exams for the Academic Year 2024-2025</p>
                    <h1 style="margin: 5px 0; font-size: 20px; font-weight: bold;">${settings.grade} - ${settings.subject}</h1>
                </div>
                <div style="display: flex; justify-content: space-between; font-family: 'Times New Roman', serif; margin-bottom: 10px; font-size: 14px;">
                    <span>Time: </span>
                    <span>${settings.topNote}</span>
                    <span>Score: ${settings.totalScore}</span>
                </div>
            `;

            const questionsHtml = paper.map(q => {
                const branchesHtml = q.branches.map(b => {
                    let subQuestionsHtml;
                    const isDefinitionsOnSeparateSheet = (b.type === 'تعاريف' || b.type.toLowerCase() === 'definitions') && settings.answerStyle === 'separate_sheet';

                    if (isDefinitionsOnSeparateSheet) {
                        subQuestionsHtml = `<div style="margin-left: 20px; line-height: 1.8;">${b.subQuestions.map((sq, i) => `${i + 1}. ${sq.text}`).join(',&nbsp;&nbsp;&nbsp;')}</div>`;
                    } else {
                        subQuestionsHtml = b.subQuestions.map((sq, i) => `<div style="margin-left: 20px; margin-bottom: 5px;">${i + 1}. ${sq.text}</div>`).join('');
                    }
                    
                    const branchAnswer = answers?.find(a => a.branchId === b.id)?.answerText || '';
    
                    return `
                        <div style="margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span>${b.instruction || `Branch (${String.fromCharCode(65 + q.branches.indexOf(b))})`}</span>
                                <span>(${b.points} Points)</span>
                            </div>
                            <div style="margin-top: 5px;">${subQuestionsHtml}</div>
                             ${answers ? `<div style="margin-top: 8px; padding: 8px; background-color: #f0fdf4; border-left: 4px solid #22c55e; color: #15803d; border-radius: 4px;"><strong style="color: #166534;">Answer:</strong> ${branchAnswer}</div>` : ''}
                        </div>
                    `;
                }).join(settings.answerStyle === 'on_paper' ? `<div style="height: 100px; border-bottom: 1px dotted #ccc; margin: 10px 0;"></div>` : '');
        
                return `
                    <div style="margin-bottom: 20px; page-break-inside: avoid;">
                        <h2 style="font-family: 'Times New Roman', serif; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px;">
                            <span>${q.title}: ${q.instruction}</span>
                            <span>(${q.totalPoints} Points)</span>
                        </h2>
                        ${branchesHtml}
                    </div>
                `;
            }).join('');

            return `
                <html lang="en" dir="ltr">
                <head>
                    <meta charset="UTF-8">
                    <style>
                        body { font-family: 'Times New Roman', serif; direction: ltr; line-height: 1.6; }
                        .page { width: 210mm; padding: 20px; margin: auto; background: white; }
                        @media print { body { -webkit-print-color-adjust: exact; } .page { box-shadow: none; border: none; margin: 0; padding: 0; } }
                    </style>
                </head>
                <body><div class="page">${header}${questionsHtml}</div></body>
                </html>`;

        } else {
            // Arabic version
            const header = `
                <div style="text-align: center; font-family: 'Amiri', serif; border-bottom: 2px double black; padding-bottom: 5px; margin-bottom: 10px;">
                    <p style="margin:0; font-size: 16px;">بسم الله الرحمن الرحيم</p>
                    <p style="margin:0; font-size: 14px;">امتحانات ${settings.examType} للعام الدراسي 2024-2025</p>
                    <h1 style="margin: 5px 0; font-size: 20px; font-weight: bold;">${settings.subject} للصف ${settings.grade}</h1>
                </div>
                <div style="display: flex; justify-content: space-between; font-family: 'Amiri', serif; margin-bottom: 10px; font-size: 14px;">
                    <span>الوقت: </span>
                    <span>${settings.topNote}</span>
                    <span>الدرجة: ${settings.totalScore}</span>
                </div>
            `;
        
            const questionsHtml = paper.map(q => {
                const branchesHtml = q.branches.map(b => {
                    let subQuestionsHtml;
                    const isDefinitionsOnSeparateSheet = b.type === 'تعاريف' && settings.answerStyle === 'separate_sheet';

                    if (isDefinitionsOnSeparateSheet) {
                        subQuestionsHtml = `<div style="margin-right: 20px; line-height: 2;">${b.subQuestions.map((sq, i) => `${i + 1}. ${sq.text}`).join('،&nbsp;&nbsp;&nbsp;')}</div>`;
                    } else {
                        subQuestionsHtml = b.subQuestions.map((sq, i) => `<div style="margin-right: 20px; margin-bottom: 5px;">${i + 1}. ${sq.text}</div>`).join('');
                    }

                    const branchAnswer = answers?.find(a => a.branchId === b.id)?.answerText || '';
    
                    return `
                        <div style="margin-bottom: 10px;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold;">
                                <span>${b.instruction || `فرع (${String.fromCharCode(1575 + q.branches.indexOf(b))})`}</span>
                                <span>(${b.points} درجة)</span>
                            </div>
                            <div style="margin-top: 5px;">${subQuestionsHtml}</div>
                             ${answers ? `<div style="margin-top: 8px; padding: 8px; background-color: #f0fdf4; border-right: 4px solid #22c55e; color: #15803d; border-radius: 4px;"><strong style="color: #166534;">الجواب:</strong> ${branchAnswer}</div>` : ''}
                        </div>
                    `;
                }).join(settings.answerStyle === 'on_paper' ? `<div style="height: 100px; border-bottom: 1px dotted #ccc; margin: 10px 0;"></div>` : '');
        
                return `
                    <div style="margin-bottom: 20px; page-break-inside: avoid;">
                        <h2 style="font-family: 'Amiri', serif; display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px;">
                            <span>${q.title}: ${q.instruction}</span>
                            <span>(${q.totalPoints} درجة)</span>
                        </h2>
                        ${branchesHtml}
                    </div>
                `;
            }).join('');
        
            return `
                <html lang="ar" dir="rtl">
                <head>
                    <meta charset="UTF-8">
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Times New Roman', serif; direction: rtl; line-height: 1.6; }
                        .page { width: 210mm; padding: 20px; margin: auto; background: white; }
                         @media print { body { -webkit-print-color-adjust: exact; } .page { box-shadow: none; border: none; margin: 0; padding: 0; } }
                    </style>
                </head>
                <body><div class="page">${header}${questionsHtml}</div></body>
                </html>
            `;
        }
    };

    const exportDoc = (type: 'pdf' | 'word') => {
        const isEnglishExam = settings.subject === 'اللغة الانكليزية';
        const html = generateExamHtml(examPaper);

        if (type === 'pdf') {
            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.left = '-9999px';
            container.innerHTML = html;
            document.body.appendChild(container);
            
            window.html2canvas(container.querySelector('.page') as HTMLElement, { scale: 2, useCORS: true, logging: true })
            .then(canvas => {
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                const imgHeight = canvas.height * pdfWidth / canvas.width;
                let heightLeft = imgHeight;
                let position = 0;
                
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;

                while (heightLeft > 0) {
                    position = -heightLeft;
                    pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                    heightLeft -= pdfHeight;
                }
                pdf.save(isEnglishExam ? 'exam.pdf' : 'الاسئلة.pdf');
            }).finally(() => {
                document.body.removeChild(container);
            });
        } else {
             const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
             const fileDownload = document.createElement("a");
             document.body.appendChild(fileDownload);
             fileDownload.href = source;
             fileDownload.download = isEnglishExam ? 'exam.doc' : 'الاسئلة.doc';
             fileDownload.click();
             document.body.removeChild(fileDownload);
        }
    };
    
    const TabButton: React.FC<{tab: Tab; label: string; icon: string;}> = ({ tab, label, icon }) => (
        <button
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center p-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab 
                    ? 'border-teal-500 text-teal-600 bg-teal-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
        >
            <Icon name={icon} className="w-5 h-5 ml-2" />
            {label}
        </button>
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-800">مولد أوراق الاختبارات</h1>
                <p className="text-gray-500 mt-1">قم بإنشاء أوراق اختبارات شهرية، نصف سنوية، ونهائية بسهولة.</p>
            </div>

            <div className="mb-4 flex flex-col md:flex-row items-center justify-center gap-4 p-4 bg-gray-100 rounded-lg border">
                <UsageCounter 
                    label="محاولات توليد الأسئلة"
                    remaining={usage?.examQuestionGenerations ?? USAGE_LIMITS.examQuestionGenerations}
                    limit={teacher.usageLimits?.examQuestionGenerations ?? USAGE_LIMITS.examQuestionGenerations}
                    isLoading={!usage}
                />
                <UsageCounter 
                    label="محاولات توليد الإجابات"
                    remaining={usage?.examAnswerGenerations ?? USAGE_LIMITS.examAnswerGenerations}
                    limit={teacher.usageLimits?.examAnswerGenerations ?? USAGE_LIMITS.examAnswerGenerations}
                    isLoading={!usage}
                />
            </div>

            <Section title="1. معلومات الاختبار الأساسية" icon="edit">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">المادة</label>
                        <input
                            type="text"
                            value={settings.subject}
                            readOnly
                            className="w-full p-2 border rounded-md bg-gray-200 text-gray-700 cursor-not-allowed"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">الصف</label>
                        <select value={settings.grade} onChange={e => handleSettingsChange('grade', e.target.value)} className="w-full p-2 border rounded-md bg-gray-50">
                            {teacherGrades.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">نوع الاختبار</label>
                        <select value={settings.examType} onChange={e => handleSettingsChange('examType', e.target.value)} className="w-full p-2 border rounded-md bg-gray-50">
                            {examTypes.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="numberOfQuestions" className="text-sm font-medium text-gray-700 block mb-1">عدد الأسئلة الرئيسية:</label>
                        <input
                            id="numberOfQuestions"
                            type="number"
                            min="1"
                            value={settings.numberOfQuestions}
                            onChange={e => handleSettingsChange('numberOfQuestions', parseInt(e.target.value))}
                            className="w-full p-2 border rounded-md bg-gray-50"
                        />
                    </div>
                </div>
            </Section>

            <Section title="2. محتوى المادة الدراسية" icon="book" description="ألصق النص، ارفع صور، أو استخدم رابط ويب لاستخلاص المحتوى الذي ستُبنى عليه الأسئلة.">
                <div className="border border-gray-200 rounded-lg">
                    <div className="flex">
                        <TabButton tab="image" label="رفع صور" icon="image" />
                        <TabButton tab="paste" label="لصق نص" icon="paste" />
                        <TabButton tab="url" label="استخلاص من رابط" icon="url" />
                    </div>
                    <div className="p-4">
                        {activeTab === 'image' && (
                            <div>
                                <label className="block w-full cursor-pointer bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                                    <Icon name="upload" className="w-10 h-10 mx-auto text-gray-400" />
                                    <span className="mt-2 block text-sm font-medium text-gray-600">اختر ملف أو ملفات صور</span>
                                    <p className="text-xs text-gray-500 mt-1">سيتم استخراج النصوص من الصور باستخدام OCR.</p>
                                    <input type="file" onChange={handleImageChange} accept="image/png, image/jpeg" className="hidden" multiple />
                                </label>
                                {imagePreviews.length > 0 && (
                                    <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                                        {imagePreviews.map((preview, index) => (
                                            <img key={index} src={preview} alt={`preview ${index}`} className="w-full h-auto object-cover rounded-md border" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'paste' && (
                             <textarea
                                value={source.text}
                                onChange={e => setSource(prev => ({ ...prev, text: e.target.value }))}
                                rows={10}
                                placeholder="ألصق محتوى الصفحات المحددة من الكتاب المدرسي هنا..."
                                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                            />
                        )}
                        {activeTab === 'url' && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                    <strong>ملاحظة:</strong> أدخل رابط صفحة ويب. يمكنك تحديد نطاق صفحات لاستخلاصها. إذا تركت الحقول فارغة، سيتم محاولة استخلاص النص كاملاً.
                                </p>
                                <div>
                                    <label htmlFor="urlInput" className="block text-sm font-medium text-gray-700 mb-1">رابط صفحة الويب</label>
                                    <input
                                        id="urlInput"
                                        type="url"
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        placeholder="https://example.com/article"
                                        className="w-full p-2 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm ltr"
                                        dir="ltr"
                                    />
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <label htmlFor="fromPage" className="block text-sm font-medium text-gray-700 mb-1">من صفحة</label>
                                        <input
                                            id="fromPage"
                                            type="number"
                                            value={fromPage}
                                            onChange={(e) => setFromPage(e.target.value)}
                                            placeholder="مثال: 1"
                                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                                            min="1"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label htmlFor="toPage" className="block text-sm font-medium text-gray-700 mb-1">إلى صفحة</label>
                                        <input
                                            id="toPage"
                                            type="number"
                                            value={toPage}
                                            onChange={(e) => setToPage(e.target.value)}
                                            placeholder="مثال: 3"
                                            className="w-full p-2 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                                            min="1"
                                        />
                                    </div>
                                </div>

                                {extractionError && <p className="text-red-600 text-center text-sm p-2 bg-red-50 rounded-md">{extractionError}</p>}
                                <button
                                    type="button"
                                    onClick={handleUrlExtract}
                                    disabled={isExtracting || !urlInput}
                                    className="w-full flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold py-2.5 px-4 rounded-md hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isExtracting ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            <span>جاري الاستخلاص...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Icon name="url" className="w-5 h-5"/>
                                            <span>استخلاص النص</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </Section>

            {availableTemplates.length > 0 && (
                <Section title="3. اختيار القالب (اختياري)" icon="image" description="اختر قالباً واحداً أو أكثر ليستخدمه الذكاء الاصطناعي كمرجع للتنسيق.">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {availableTemplates.map(url => (
                            <div key={url} onClick={() => handleTemplateSelection(url)} className={`cursor-pointer rounded-lg overflow-hidden border-4 transition-all duration-200 ${selectedTemplateUrls.includes(url) ? 'border-teal-500 shadow-lg' : 'border-transparent hover:border-teal-300'}`}>
                                <img src={url} alt="Exam template" className="w-full h-auto object-cover" />
                            </div>
                        ))}
                    </div>
                </Section>
            )}

            <Section title="4. تنظيم الاختبار" icon="settings">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                    <div>
                        <label className="font-semibold text-gray-700 block mb-2">طبيعة تنظيم الأسئلة:</label>
                        <div className="flex gap-4">
                             <label className="flex items-center gap-2"><input type="radio" name="answerStyle" value="separate_sheet" checked={settings.answerStyle === 'separate_sheet'} onChange={() => handleSettingsChange('answerStyle', 'separate_sheet')} /> الإجابة بورقة مستقلة</label>
                             <label className="flex items-center gap-2"><input type="radio" name="answerStyle" value="on_paper" checked={settings.answerStyle === 'on_paper'} onChange={() => handleSettingsChange('answerStyle', 'on_paper')} /> الإجابة على ورقة الأسئلة</label>
                        </div>
                    </div>
                     <div>
                        <label htmlFor="totalScore" className="font-semibold text-gray-700 block mb-2">مجموع درجات الاختبار:</label>
                        <input id="totalScore" type="number" value={settings.totalScore} onChange={e => handleSettingsChange('totalScore', parseInt(e.target.value))} className="w-full p-2 border rounded-md" />
                     </div>
                     <div className="md:col-span-2">
                        <label htmlFor="topNote" className="font-semibold text-gray-700 block mb-2">ملاحظة في أعلى الصفحة:</label>
                        <input id="topNote" type="text" value={settings.topNote} onChange={e => handleSettingsChange('topNote', e.target.value)} className="w-full p-2 border rounded-md" />
                     </div>
                </div>
            </Section>
            
            <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-xl shadow-sm border">
                <button
                    onClick={handleGenerateExam}
                    disabled={isLoading}
                    className="flex-grow bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center text-lg shadow-lg"
                >
                    {isLoading ? 'جاري توليد الأسئلة...' : 'توليد جميع الأسئلة آلياً'}
                </button>
            </div>
            
             {error && <div className="p-4 text-center bg-red-100 text-red-700 rounded-lg">{error}</div>}

            {examPaper.length > 0 && (
                 <Section title="ورقة الأسئلة" icon="list">
                    <div className="mb-4">
                        <div className="p-4 border rounded-lg bg-white shadow-inner">
                            <div dangerouslySetInnerHTML={{ __html: generateExamHtml(examPaper) }}></div>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mb-3 mt-6">تعديل الأسئلة</h3>
                    {examPaper.map((q) => (
                        <div key={q.id} className="p-4 border rounded-lg mb-4 bg-gray-50 flex justify-between items-center">
                            <span className="font-bold text-lg">{q.title}</span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setEditingQuestion(q)} className="text-sm bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-md hover:bg-yellow-200 font-semibold flex items-center gap-1"><Icon name="edit" className="w-4 h-4" /> تعديل</button>
                                <button onClick={() => deleteQuestion(q.id)} className="text-sm bg-red-100 text-red-700 px-3 py-1.5 rounded-md hover:bg-red-200 font-semibold flex items-center gap-1"><Icon name="trash" className="w-4 h-4" /> حذف</button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addQuestion} className="w-full bg-green-100 text-green-700 font-bold py-2 px-4 rounded-lg hover:bg-green-200 transition-colors flex items-center justify-center gap-2">
                        <Icon name="plus" className="w-5 h-5" /> إضافة سؤال جديد
                    </button>
                    
                    <div className="mt-6 p-4 bg-gray-100 rounded-lg flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button onClick={handleGenerateAnswers} disabled={isGeneratingAnswers} className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700 transition-colors">
                           {isGeneratingAnswers ? 'جاري توليد الأجوبة...' : 'توليد الإجابات النموذجية'}
                        </button>
                        <button onClick={() => exportDoc('word')} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">تصدير ورقة الأسئلة (Word)</button>
                        <button onClick={() => exportDoc('pdf')} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">تصدير ورقة الأسئلة (PDF)</button>
                    </div>

                    {examAnswers.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-xl font-bold mb-2">الأجوبة النموذجية</h3>
                            <div className="p-4 border rounded-lg bg-white shadow-inner">
                                <div dangerouslySetInnerHTML={{ __html: generateExamHtml(examPaper, examAnswers) }}></div>
                            </div>
                        </div>
                    )}
                 </Section>
            )}

            {editingQuestion && (
                <EditQuestionModal
                    question={editingQuestion}
                    onClose={() => setEditingQuestion(null)}
                    onSave={(updatedQuestion) => {
                        updateQuestion(updatedQuestion.id, updatedQuestion);
                        setEditingQuestion(null);
                    }}
                />
            )}

        </div>
    );
}