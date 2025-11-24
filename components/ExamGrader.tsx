import React, { useState, useEffect, useCallback, ChangeEvent, useRef } from 'react';
import { AnswerKey, Question, GradingResult, StudentFile, Student, Teacher } from '../types';
import Icon from './Icon';
import { gradeSingleStudentPaper, gradeSingleStudentPaperWithImageKey, generateQuestionsFromContent } from '../services/examGraderService';
import { getUsageData, decrementUsage, USAGE_LIMITS, UsageData } from '../services/firebaseService';
import { gradebooksRef } from '../services/firebaseService';

const { utils, writeFile } = window.XLSX;
const { jsPDF } = window.jspdf;

type StepId = 'setup' | 'grade' | 'results';
type KeyMode = 'create' | 'image';
type SourceTab = 'paste' | 'image' | 'url';

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

const Section: React.FC<{
  title: string,
  icon: string,
  description?: string,
  children: React.ReactNode,
  className?: string;
}> = ({ title, icon, description, children, className = '' }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <Icon name={icon} className="w-7 h-7 text-teal-600" />
        <div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
      </div>
    </div>
    <div className="p-4 md:p-5">
      {children}
    </div>
  </div>
);

const ProgressBar: React.FC<{ progress: number, message: string }> = ({ progress, message }) => (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 text-white p-4">
        <h2 className="text-2xl font-bold mb-4">جاري تصدير الملف...</h2>
        <div className="w-full max-w-lg bg-gray-600 rounded-full h-4 mb-2">
            <div className="bg-teal-500 h-4 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="text-lg font-semibold">{message}</p>
        <p className="mt-1 text-2xl font-bold">{Math.round(progress)}%</p>
    </div>
);

// --- Sub-components for each step ---

const AnswerKeySetup = ({ onFinalize, teacher }: { onFinalize: (key: AnswerKey, imageKeyBase64?: string) => void, teacher: Teacher }) => {
    const { name: teacherName } = teacher;
    const [keyMode, setKeyMode] = useState<KeyMode>('create');
    const [isManualAddExpanded, setIsManualAddExpanded] = useState(false);
    
    // Manual & AI state
    const [localAnswerKey, setLocalAnswerKey] = useState<AnswerKey>([]);
    const [newQuestion, setNewQuestion] = useState<Omit<Question, 'id'>>({ question: '', options: { A: '', B: '', C: '', D: '' }, correctAnswer: '' });

    // AI Generation State
    const [source, setSource] = useState<{ text: string; images: { base64: string, mimeType: string }[] }>({ text: '', images: [] });
    const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    const [sourceTab, setSourceTab] = useState<SourceTab>('paste');
    const [numQuestions, setNumQuestions] = useState(10);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    // URL Extraction State
    const [urlInput, setUrlInput] = useState('');
    const [fromPage, setFromPage] = useState('');
    const [toPage, setToPage] = useState('');
    const [isExtracting, setIsExtracting] = useState(false);
    const [extractionError, setExtractionError] = useState<string | null>(null);

    // Image Key State
    const [answerKeyImage, setAnswerKeyImage] = useState<{name: string, base64: string} | null>(null);
    
    // Export State
    const [savedRecords, setSavedRecords] = useState<Record<string, string>>({});
    const [selectedRecordKey, setSelectedRecordKey] = useState<string>('');
    const [students, setStudents] = useState<Student[]>([]);
    const [className, setClassName] = useState<string>('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportMessage, setExportMessage] = useState('');
    const [amiriFontBase64, setAmiriFontBase64] = useState('');

    const [finalizeError, setFinalizeError] = useState<string | null>(null);
    const [usage, setUsage] = useState<UsageData | null>(null);

    const getFontSizeToFit = (doc: any, text: string, maxWidth: number, initialFontSize = 10, minFontSize = 6): number => {
        let fontSize = initialFontSize;
        doc.setFontSize(fontSize);
        let textWidth = doc.getTextWidth(text);

        while (textWidth > maxWidth && fontSize > minFontSize) {
            fontSize = Math.max(minFontSize, fontSize - 0.5);
            doc.setFontSize(fontSize);
            textWidth = doc.getTextWidth(text);
            if(fontSize === minFontSize && textWidth > maxWidth) break;
        }
        return fontSize;
    };
    
    useEffect(() => {
        // Load Amiri Font for PDF generation
        fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf')
            .then(res => res.arrayBuffer())
            .then(ab => {
                let binary = '';
                const bytes = new Uint8Array(ab);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                setAmiriFontBase64(window.btoa(binary));
            }).catch(err => console.error("Error loading font:", err));

        // Load saved gradebooks for export dropdown
        if (teacherName) {
            gradebooksRef.child(teacherName).once('value', (snapshot) => {
                const recordsData = snapshot.val();
                const loadedRecords: Record<string, string> = {};
                if (recordsData) {
                    Object.keys(recordsData).forEach(key => {
                        loadedRecords[key] = key.replace(/_/g, ' - ');
                    });
                }
                setSavedRecords(loadedRecords);
            }).catch(err => {
                 console.error("Error loading gradebook list from Firebase:", err);
            });
        }

        // Load other data
        if (teacher) getUsageData(teacher).then(setUsage);
        try {
            const savedKey = localStorage.getItem('examAnswerKey');
            if (savedKey) {
                const parsedKey: AnswerKey = JSON.parse(savedKey);
                if (Array.isArray(parsedKey) && parsedKey.length > 0) setLocalAnswerKey(parsedKey);
            }
        } catch (e) { console.error("Failed to load or parse answer key from localStorage", e); }
    }, [teacher, teacherName]);
    
     useEffect(() => {
        if (selectedRecordKey && teacherName) {
            gradebooksRef.child(teacherName).child(selectedRecordKey).once('value', (snapshot) => {
                if (snapshot.exists()) {
                    const record = snapshot.val();
                    setStudents(record.students || []);
                    setClassName(record.info?.className || '');
                } else {
                    setStudents([]); setClassName('');
                }
            });
        } else {
            setStudents([]); setClassName('');
        }
    }, [selectedRecordKey, teacherName]);


    const updateQuestion = (id: string, field: 'question' | 'correctAnswer', value: string) => {
        setLocalAnswerKey(prev => prev.map(q => q.id === id ? { ...q, [field]: value } : q));
    };

    const updateOption = (id: string, option: 'A' | 'B' | 'C' | 'D', value: string) => {
        setLocalAnswerKey(prev => prev.map(q => q.id === id ? { ...q, options: { ...q.options, [option]: value } } : q));
    };

    const addManualQuestion = () => {
        if (!newQuestion.correctAnswer) {
             setFinalizeError("يرجى تحديد الإجابة الصحيحة قبل الإضافة.");
             return;
        }
        setLocalAnswerKey(prev => [...prev, { ...newQuestion, id: `m-${Date.now()}` }]);
        setNewQuestion({ question: '', options: { A: '', B: '', C: '', D: '' }, correctAnswer: '' });
        setFinalizeError(null);
        setIsManualAddExpanded(false);
    };
    
    const removeQuestion = (id: string) => setLocalAnswerKey(localAnswerKey.filter(q => q.id !== id));
    
    const handleGenerate = async () => {
        if (!source.text && source.images.length === 0) {
            setAiError('يرجى توفير محتوى (نص أو صور) لتوليد الأسئلة منه.');
            return;
        }
        const currentUsage = usage || await getUsageData(teacher);
        if (currentUsage.graderQuestionGenerations <= 0) {
            setAiError("لقد وصلت إلى الحد الأقصى لتوليد الأسئلة لهذا الشهر.");
            setUsage(currentUsage);
            return;
        }
        
        setIsGenerating(true);
        setAiError(null);
        try {
            await decrementUsage(teacher, 'graderQuestionGenerations');
            const updatedUsage = await getUsageData(teacher);
            setUsage(updatedUsage);

            const generated = await generateQuestionsFromContent(source, numQuestions);
            const questionsWithIds = generated.map(q => ({ ...q, id: `g-${Date.now()}-${Math.random()}` }));
            setLocalAnswerKey(prev => [...prev, ...questionsWithIds]);
        } catch (e: any) {
            setAiError(e.message);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, target: 'source' | 'key') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target?.result as string;
                const base64 = dataUrl.split(',')[1];
                if (target === 'key') {
                    setAnswerKeyImage({ name: file.name, base64 });
                } else {
                    setImagePreviews(prev => [...prev, dataUrl]);
                    setSource(prev => ({ ...prev, images: [...prev.images, { base64, mimeType: file.type }] }));
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleUrlExtract = async () => {
        setExtractionError(null);
        setIsExtracting(true);
        try {
            if (!urlInput) throw new Error("الرجاء إدخال رابط لصفحة الويب.");
            
            if (!fromPage || !toPage) {
                throw new Error("يرجى تحديد نطاق الصفحات (من صفحة وإلى صفحة) قبل الاستخلاص.");
            }
            
            const fromNum = parseInt(fromPage, 10);
            const toNum = parseInt(toPage, 10);

            if (isNaN(fromNum) || isNaN(toNum) || fromNum <= 0 || toNum <= 0 || fromNum > toNum) {
                throw new Error("الرجاء إدخال نطاق صفحات صحيح. يجب أن تكون 'من صفحة' أصغر من أو تساوي 'إلى صفحة'.");
            }


            const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlInput)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`فشل في جلب المحتوى. الحالة: ${response.status}`);
            const htmlContent = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            doc.querySelectorAll('script, style, noscript, header, footer, nav, aside, form, img, svg, button, input').forEach(el => el.remove());

            let bodyContent = doc.body.innerHTML;
            bodyContent = bodyContent.replace(/<p.*?>/gi, '\n').replace(/<div.*?>/gi, '\n');
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = bodyContent;
            const bodyText = (tempDiv.textContent || "").replace(/(\s*\n\s*)+/g, '\n').trim();
            
            if (!bodyText) throw new Error("لم يتم العثور على نص قابل للاستخلاص في الصفحة.");
            
            const pageSegments = bodyText.split(/(?=\b(?:page|صفحة)\s+\d+\b)/i);

            if (pageSegments.length <= 1) {
                throw new Error("لم يتمكن النظام من العثور على علامات ترقيم الصفحات (مثل 'Page 1') في المحتوى. لا يمكن استخلاص نطاق محدد.");
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
            const extractedText = extractedContent.join('\n\n');

            setSource(prev => ({ ...prev, text: prev.text ? `${prev.text}\n\n${extractedText}`: extractedText }));
            setSourceTab('paste');
            setUrlInput('');
            setFromPage('');
            setToPage('');
            
        } catch (error: any) {
            setExtractionError(error.message);
        } finally {
            setIsExtracting(false);
        }
    };

    const handleFinalize = () => {
        setFinalizeError(null);
        if (keyMode === 'image') {
            if (answerKeyImage) onFinalize([], answerKeyImage.base64);
            else setFinalizeError("يرجى رفع صورة مفتاح الإجابة أولاً.");
        } else {
            if (localAnswerKey.length === 0) {
                setFinalizeError("يرجى إضافة سؤال واحد على الأقل أو توليده.");
                return;
            }
            if (localAnswerKey.some(q => !q.correctAnswer)) {
                setFinalizeError("يرجى التأكد من تحديد الإجابة الصحيحة لكل سؤال.");
                return;
            }
            localStorage.setItem('examAnswerKey', JSON.stringify(localAnswerKey));
            onFinalize(localAnswerKey);
        }
    };

    // --- EXPORT LOGIC ---
    const drawAnswerSheetPage = (doc: any, studentName: string | null, className: string | null, answerKey: AnswerKey) => {
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const topMargin = 15;
        const bottomMargin = 10;
        const leftMargin = 10;
        const rightMargin = 10;
        const contentWidth = pageWidth - leftMargin - rightMargin;

        const drawHeader = () => {
            doc.setFontSize(16);
            doc.text('ورقة إجابة الطالب', pageWidth / 2, topMargin, { align: 'center' });

            const studentInfoY = topMargin + 10;
            doc.setFontSize(12);
            doc.text(`اسم الطالب: ${studentName || '........................................................'}`, pageWidth - rightMargin, studentInfoY, { align: 'right' });
            doc.text(`الشعبة: ${className || '......................'}`, rightMargin + 35, studentInfoY, { align: 'right' });

            const lineY = studentInfoY + 3;
            doc.line(leftMargin, lineY, pageWidth - rightMargin, lineY);
            return lineY + 5;
        };

        const questionsStartY = drawHeader();
        const availableHeight = pageHeight - questionsStartY - bottomMargin;
        const totalQuestions = answerKey.length;
        if (totalQuestions === 0) return;

        // This enforces the single-page constraint.
        const heightPerQuestion = availableHeight / totalQuestions;

        answerKey.forEach((question, index) => {
            const qNum = index + 1;
            const blockY = questionsStartY + (index * heightPerQuestion);
            const blockMargin = 1;
            const blockHeight = heightPerQuestion - blockMargin;

            doc.setDrawColor(220, 220, 220);
            doc.rect(leftMargin, blockY, contentWidth, blockHeight);

            // --- Question text ---
            const questionText = `س${qNum}: ${question.question}`;
            const questionMaxWidth = contentWidth - 85;
            const questionFontSize = getFontSizeToFit(doc, questionText, questionMaxWidth, 11, 7);
            doc.setFontSize(questionFontSize);
            const questionTextY = blockY + blockHeight * 0.25;
            doc.text(questionText, pageWidth - rightMargin - 5, questionTextY, { align: 'right' });

            // --- Options text with dynamic font sizing ---
            const optionInitialFontSize = 10;
            const optionMinFontSize = 6;
            
            const gap = 5;
            const answerBoxEndsX = leftMargin + 5 + 30; // 10 + 5 + 30 = 45
            const optionsStartX = pageWidth - rightMargin; // 210 - 10 = 200
            const optionsTotalWidth = optionsStartX - answerBoxEndsX - gap;
            const optionMaxWidth = optionsTotalWidth / 2;

            const optionCol1X = optionsStartX;
            const optionCol2X = optionCol1X - optionMaxWidth - gap;

            const optionFirstRowY = blockY + blockHeight * 0.58;
            const optionSecondRowY = blockY + blockHeight * 0.82;

            const drawOptionNoWrap = (text: string, x: number, y: number) => {
                const fontSize = getFontSizeToFit(doc, text, optionMaxWidth, optionInitialFontSize, optionMinFontSize);
                doc.setFontSize(fontSize);
                doc.text(text, x, y, { align: 'right' });
            };

            drawOptionNoWrap(`أ) ${question.options.A}`, optionCol1X, optionFirstRowY);
            drawOptionNoWrap(`ب) ${question.options.B}`, optionCol2X, optionFirstRowY);
            drawOptionNoWrap(`ج) ${question.options.C}`, optionCol1X, optionSecondRowY);
            drawOptionNoWrap(`د) ${question.options.D}`, optionCol2X, optionSecondRowY);

            // --- Answer Box (Empty) ---
            const answerBoxHeight = Math.max(8, Math.min(12, blockHeight * 0.7));
            const answerBoxWidth = 30;
            const answerBoxY = blockY + (blockHeight - answerBoxHeight) / 2;
            doc.setDrawColor(0, 0, 0);
            doc.rect(leftMargin + 5, answerBoxY, answerBoxWidth, answerBoxHeight);
        });
    };

    const generateAnswerSheetHtml = (studentName: string | null, className: string | null, answerKey: AnswerKey) => {
        const getOptionHtml = (prefix: string, text: string) => {
            let style = 'font-size: 12pt;';
            if (text.length > 60) {
                style = 'font-size: 8pt;';
            } else if (text.length > 40) {
                style = 'font-size: 10pt;';
            }
            return `<div class="option" style="${style}">${prefix}) ${text}</div>`;
        };

        const getQuestionStyle = (text: string) => {
            let style = 'font-size: 14pt;';
            if (text.length > 100) {
                style = 'font-size: 10pt;';
            } else if (text.length > 70) {
                style = 'font-size: 12pt;';
            }
            return style;
        };

        let questionBlocks = '';
        answerKey.forEach((q, i) => {
            questionBlocks += `
                <div class="question-block">
                    <div class="question-header">
                        <div class="question-text" style="${getQuestionStyle(q.question)}"><span class="q-num">س${i + 1}:</span> ${q.question}</div>
                        <div class="answer-section">
                            <div class="answer-box"></div>
                        </div>
                    </div>
                    <div class="options-grid">
                        ${getOptionHtml('أ', q.options.A)}
                        ${getOptionHtml('ب', q.options.B)}
                        ${getOptionHtml('ج', q.options.C)}
                        ${getOptionHtml('د', q.options.D)}
                    </div>
                </div>
            `;
        });
    
        const header = `
            <div class="header">ورقة إجابة الطالب</div>
            <div class="info">
                <span>اسم الطالب: ${studentName || '........................................................'}</span>
                <span>الشعبة: ${className || '......................'}</span>
            </div>
        `;
    
        return `
            <html lang="ar" dir="rtl"><head><meta charset="UTF-8">
            <style>
                @page WordSection1 { size: 21cm 29.7cm; margin: 1.5cm; }
                div.WordSection1 { page: WordSection1; }
                body { font-family: 'Times New Roman', serif; direction: rtl; font-size: 14pt; }
                .container { width: 100%; }
                .header { text-align: center; font-size: 20px; font-weight: bold; }
                .info { display: flex; justify-content: space-between; margin: 20px 0; font-size: 14px; border-bottom: 1px solid black; padding-bottom: 10px; }
                .question-block {
                    border: 1px solid #ccc;
                    padding: 10px;
                    margin-bottom: 15px;
                    page-break-inside: avoid;
                }
                .question-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .question-text {
                    font-weight: bold;
                    flex-grow: 1;
                    white-space: nowrap;
                }
                .q-num { margin-left: 8px; }
                .answer-section {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                    margin-right: 20px;
                }
                .answer-box {
                    width: 80px;
                    height: 40px;
                    border: 1px solid black;
                }
                .options-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 5px 15px;
                    padding-right: 20px;
                }
                .option { padding: 4px; white-space: nowrap; }
            </style>
            </head><body><div class="WordSection1"><div class="container">
                ${header}
                ${questionBlocks}
            </div></div></body></html>`;
    };

    const handleExport = async (format: 'pdf' | 'word', type: 'student' | 'key' | 'section') => {
        if (!amiriFontBase64) {
            alert('الخط العربي لم يتم تحميله بعد، يرجى الانتظار قليلاً.');
            return;
        }

        setIsExporting(true);
        setExportProgress(0);
        setExportMessage('بدء عملية التصدير...');

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');

        if (type === 'section') {
            if (students.length === 0) {
                alert('يرجى اختيار سجل يحتوي على طلاب أولاً.');
                setIsExporting(false);
                return;
            }
            for (let i = 0; i < students.length; i++) {
                const student = students[i];
                if (i > 0) doc.addPage();
                drawAnswerSheetPage(doc, student.name, className, localAnswerKey);
                const progress = ((i + 1) / students.length) * 100;
                setExportProgress(progress);
                setExportMessage(`جاري تجهيز ورقة الطالب: ${student.name}`);
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            doc.save(`اوراق_اجابة_${className.replace(/\s/g, '_') || 'الطلاب'}.pdf`);

        } else if (type === 'student' && format === 'pdf') {
            drawAnswerSheetPage(doc, null, null, localAnswerKey);
            doc.save('ورقة_اجابة_فارغة.pdf');

        } else if (type === 'student' && format === 'word') {
            const html = generateAnswerSheetHtml(null, null, localAnswerKey);
            const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
            const a = document.createElement("a");
            a.href = source;
            a.download = 'ورقة_اجابة_فارغة.doc';
            a.click();
        
        } else if (type === 'key' && format === 'pdf') {
            doc.setFontSize(16);
            doc.text('مفتاح الإجابة النموذجي', 105, 15, { align: 'center' });
            let y = 30;
            localAnswerKey.forEach((q, i) => {
                if (y > 280) { doc.addPage(); y = 15; }
                const questionText = `س${i + 1}: ${q.question}`;
                const lines = doc.splitTextToSize(questionText, 180);
                doc.setFontSize(12);
                doc.text(lines, 200, y, { align: 'right' });
                y += lines.length * 7;
                doc.setFontSize(10);
                doc.setTextColor(0, 100, 0);
                doc.text(`الجواب الصحيح: ${q.correctAnswer}`, 200, y, { align: 'right' });
                doc.setTextColor(0, 0, 0);
                y += 10;
            });
            doc.save('مفتاح_الاجابة.pdf');
        }

        setIsExporting(false);
    };


    return (
        <div className="space-y-6">
            {isExporting && <ProgressBar progress={exportProgress} message={exportMessage} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => setKeyMode('create')} className={`p-4 rounded-lg text-center font-bold transition-all ${keyMode === 'create' ? 'bg-teal-600 text-white shadow-lg scale-105' : 'bg-white border hover:bg-gray-50'}`}>إنشاء مفتاح (يدوي أو AI)</button>
                <button onClick={() => setKeyMode('image')} className={`p-4 rounded-lg text-center font-bold transition-all ${keyMode === 'image' ? 'bg-teal-600 text-white shadow-lg scale-105' : 'bg-white border hover:bg-gray-50'}`}>رفع صورة مفتاح جاهز</button>
            </div>

            {keyMode === 'create' && (
                <div className="space-y-6">
                     <Section title="مفتاح الإجابة الحالي" icon="list" description="قائمة الأسئلة التي أضفتها أو ولدتها. يمكنك تعديل أي حقل مباشرة.">
                        {localAnswerKey.length > 0 ? (
                            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2">
                                {localAnswerKey.map((q, i) => (
                                    <div key={q.id} className="p-4 bg-gray-50 rounded-lg border space-y-3 relative">
                                        <button onClick={() => removeQuestion(q.id)} className="absolute top-2 left-2 p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200" aria-label="حذف السؤال">
                                            <Icon name="trash" className="w-4 h-4" />
                                        </button>
                                        <label className="font-bold text-gray-700">السؤال {i + 1}:</label>
                                        <textarea value={q.question} onChange={e => updateQuestion(q.id, 'question', e.target.value)} placeholder="نص السؤال" className="w-full p-2 border rounded-md text-sm" rows={2}/>
                                        <div className="grid grid-cols-2 gap-2">
                                            {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                                <input key={opt} type="text" placeholder={`نص الخيار ${opt}`} value={q.options[opt]} onChange={e => updateOption(q.id, opt, e.target.value)} className="w-full p-2 border rounded-md text-sm" />
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-4 pt-2">
                                            <span className="font-semibold text-sm">الإجابة الصحيحة:</span>
                                            <div className="flex items-center gap-2">
                                                {(['A', 'B', 'C', 'D'] as const).map(opt => (
                                                    <button key={opt} onClick={() => updateQuestion(q.id, 'correctAnswer', opt)} className={`w-8 h-8 rounded-md font-bold text-sm transition-colors ${q.correctAnswer === opt ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : <p className="text-center text-gray-500 py-4">لم يتم إضافة أي أسئلة بعد.</p>}
                    </Section>
                    
                    <div className="p-4 border-2 border-dashed rounded-lg bg-white">
                        <button onClick={() => setIsManualAddExpanded(!isManualAddExpanded)} className="w-full flex items-center justify-center font-bold text-lg text-gray-700">
                            <Icon name={isManualAddExpanded ? "chevron-down" : "plus"} className={`w-6 h-6 ml-2 transition-transform ${isManualAddExpanded ? 'rotate-180' : ''}`}/> إضافة سؤال جديد يدوياً
                        </button>
                        {isManualAddExpanded && (
                            <div className="mt-4 space-y-3 pt-4 border-t">
                                <input type="text" placeholder="نص السؤال..." value={newQuestion.question} onChange={e => setNewQuestion(p => ({ ...p, question: e.target.value }))} className="w-full p-2 border rounded-md" />
                                <div className="grid grid-cols-2 gap-2">
                                    {(['A', 'B', 'C', 'D'] as const).map(opt => <input key={opt} type="text" placeholder={`نص الخيار ${opt}`} value={newQuestion.options[opt]} onChange={e => setNewQuestion(p => ({ ...p, options: {...p.options, [opt]: e.target.value} }))} className="w-full p-2 border rounded-md text-sm" />)}
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-semibold">الإجابة الصحيحة:</span>
                                    {(['A', 'B', 'C', 'D'] as const).map(opt => <label key={opt} className="flex items-center gap-1 cursor-pointer"><input type="radio" name="new-q-answer" value={opt} checked={newQuestion.correctAnswer === opt} onChange={e => setNewQuestion(p => ({ ...p, correctAnswer: e.target.value as any}))} /> {opt}</label>)}
                                </div>
                                <button onClick={addManualQuestion} className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700">إضافة السؤال إلى القائمة</button>
                            </div>
                        )}
                    </div>

                    <Section title="توليد الأسئلة بالذكاء الاصطناعي" icon="sparkles" description="استخدم محتوى المادة الدراسية لإنشاء أسئلة اختيار من متعدد تلقائياً.">
                        <div className="mb-4 flex items-center justify-center">
                            <UsageCounter 
                                label="محاولات توليد الأسئلة"
                                remaining={usage?.graderQuestionGenerations ?? USAGE_LIMITS.graderQuestionGenerations}
                                limit={teacher.usageLimits?.graderQuestionGenerations ?? USAGE_LIMITS.graderQuestionGenerations}
                                isLoading={!usage}
                            />
                        </div>
                        <div className="border border-gray-200 rounded-lg">
                            <div className="flex">
                                {[{id: 'paste', label: 'لصق نص', icon: 'paste'}, {id: 'image', label: 'رفع صور', icon: 'image'}, {id: 'url', label: 'استخلاص من رابط', icon: 'url'}].map(tab => (
                                    <button key={tab.id} onClick={() => setSourceTab(tab.id as SourceTab)} className={`flex-1 flex items-center justify-center p-3 text-sm font-medium border-b-2 transition-colors ${sourceTab === tab.id ? 'border-teal-500 text-teal-600 bg-teal-50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}><Icon name={tab.icon} className="w-5 h-5 ml-2" />{tab.label}</button>
                                ))}
                            </div>
                            <div className="p-4">
                                {sourceTab === 'paste' && <textarea value={source.text} onChange={e => setSource(p => ({ ...p, text: e.target.value }))} rows={8} placeholder="ألصق محتوى الدرس هنا..." className="w-full p-2 border rounded-md"/>}
                                {sourceTab === 'image' && <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'source')} className="w-full p-2 border rounded-md" multiple/>}
                                {sourceTab === 'url' && (
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                                            <strong>ملاحظة:</strong> يجب تحديد نطاق الصفحات المراد استخلاص المحتوى منها.
                                        </p>
                                        <div>
                                            <label htmlFor="graderUrlInput" className="block text-sm font-medium text-gray-700 mb-1">رابط صفحة الويب</label>
                                            <input
                                                id="graderUrlInput"
                                                type="url"
                                                value={urlInput}
                                                onChange={e => setUrlInput(e.target.value)}
                                                placeholder="https://example.com"
                                                className="w-full p-2 border rounded-md ltr"
                                                dir="ltr"
                                            />
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex-1">
                                                <label htmlFor="graderFromPage" className="block text-sm font-medium text-gray-700 mb-1">من صفحة</label>
                                                <input
                                                    id="graderFromPage"
                                                    type="number"
                                                    value={fromPage}
                                                    onChange={(e) => setFromPage(e.target.value)}
                                                    placeholder="مثال: 1"
                                                    className="w-full p-2 border rounded-md"
                                                    min="1"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <label htmlFor="graderToPage" className="block text-sm font-medium text-gray-700 mb-1">إلى صفحة</label>
                                                <input
                                                    id="graderToPage"
                                                    type="number"
                                                    value={toPage}
                                                    onChange={(e) => setToPage(e.target.value)}
                                                    placeholder="مثال: 3"
                                                    className="w-full p-2 border rounded-md"
                                                    min="1"
                                                />
                                            </div>
                                        </div>
                                        <button onClick={handleUrlExtract} disabled={isExtracting || !urlInput || !fromPage || !toPage} className="w-full bg-gray-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-gray-700 disabled:bg-gray-400">{isExtracting ? 'جاري الاستخلاص...' : 'استخلاص النص'}</button>
                                        {extractionError && <p className="text-red-500 text-xs text-center mt-2">{extractionError}</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4">
                            <label>عدد الأسئلة (الأقصى 10):</label>
                            <input type="number" value={numQuestions} onChange={e => setNumQuestions(Math.min(10, parseInt(e.target.value, 10)))} min="1" max="10" className="p-2 border rounded-md w-24" />
                            <button onClick={handleGenerate} disabled={isGenerating} className="flex-grow bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">{isGenerating ? 'جاري التوليد...' : 'توليد الأسئلة'}</button>
                        </div>
                        {aiError && <p className="text-red-600 text-center mt-2">{aiError}</p>}
                    </Section>
                    
                    {localAnswerKey.length > 0 && (
                        <Section title="تصدير وطباعة" icon="check-circle" description="تصدير أوراق إجابة فارغة أو مخصصة للطلاب.">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                                    <h4 className="font-bold text-center">تصدير فردي</h4>
                                    <button onClick={() => handleExport('pdf', 'student')} className="w-full bg-red-600 text-white font-bold py-2 rounded-lg hover:bg-red-700">تصدير ورقة الطالب (PDF)</button>
                                    <button onClick={() => handleExport('word', 'student')} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700">تصدير ورقة الطالب (Word)</button>
                                    <button onClick={() => handleExport('pdf', 'key')} className="w-full bg-gray-700 text-white font-bold py-2 rounded-lg hover:bg-gray-800">تصدير مفتاح الإجابة (PDF)</button>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border space-y-3">
                                    <h4 className="font-bold text-center">تصدير لجميع طلاب الشعبة</h4>
                                    <select value={selectedRecordKey} onChange={e => setSelectedRecordKey(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                                        <option value="">- اختر شعبة -</option>
                                        {Object.entries(savedRecords).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
                                    </select>
                                    <div className="p-2 bg-green-100 text-green-800 text-sm text-center rounded-md">تم تحديد {students.length} طالب</div>
                                    <button onClick={() => handleExport('pdf', 'section')} disabled={students.length === 0} className="w-full bg-teal-600 text-white font-bold py-2 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">تصدير أوراق الشعبة (PDF)</button>
                                </div>
                            </div>
                        </Section>
                    )}

                </div>
            )}
            
            {keyMode === 'image' && (
                 <Section title="رفع صورة مفتاح الإجابة" icon="image" description="اختر صورة واضحة لمفتاح الإجابة النموذجي.">
                     <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, 'key')} className="w-full p-2 border rounded-md" />
                     {answerKeyImage && <img src={`data:image/jpeg;base64,${answerKeyImage.base64}`} alt="preview" className="mt-4 max-h-80 rounded-lg mx-auto border shadow-sm" />}
                 </Section>
            )}

            {finalizeError && <p className="text-red-600 text-center p-2 bg-red-100 rounded-md">{finalizeError}</p>}
            <div className="flex justify-center pt-4 border-t">
                 <button onClick={handleFinalize} className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 text-lg shadow-md transition-transform hover:scale-105">
                     <Icon name="check-circle" className="w-5 h-5 inline-block ml-2"/>
                     الانتقال إلى خطوة التدقيق
                </button>
            </div>
        </div>
    );
};

const Grading = ({ answerKey, answerKeyImageBase64, onGradingComplete }: { answerKey: AnswerKey, answerKeyImageBase64: string | null, onGradingComplete: (results: GradingResult[]) => void }) => {
    const [studentFiles, setStudentFiles] = useState<StudentFile[]>([]);
    const [isGrading, setIsGrading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
// Fix: Added explicit `File` type to the forEach callback parameter to ensure correct type inference.
            files.forEach((file: File) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64 = (event.target?.result as string).split(',')[1];
                    setStudentFiles(prev => [...prev, { name: file.name, type: 'image', base64 }]);
                };
                reader.readAsDataURL(file);
            });
        }
    };
    
    const startGrading = async () => {
        if(studentFiles.length === 0) {
            setError("يرجى رفع أوراق الطلاب أولاً.");
            return;
        }
        setIsGrading(true);
        setError(null);
        setProgress(0);
        const results: GradingResult[] = [];
        
        for(let i=0; i<studentFiles.length; i++) {
            const file = studentFiles[i];
            setCurrentFile(file.name);
            try {
                let result;
                if(answerKeyImageBase64) {
                    result = await gradeSingleStudentPaperWithImageKey(answerKeyImageBase64, {name: file.name, data: file.base64});
                } else {
                    result = await gradeSingleStudentPaper(answerKey, {name: file.name, data: file.base64});
                }
                results.push(result);
            } catch (e: any) {
                results.push({
                    fileName: file.name, studentName: 'خطأ في التدقيق', studentSection: '',
                    summary: { totalQuestions: 0, correctAnswers: 0, wrongAnswers: 0, scorePercentage: 0 },
                    details: [{ questionNumber: 0, studentAnswer: e.message, correctAnswer: '', status: 'خاطئة', questionText: 'فشل تحليل هذه الورقة' }]
                });
            }
            setProgress(((i + 1) / studentFiles.length) * 100);
        }
        
        onGradingComplete(results);
        setIsGrading(false);
    };

    return (
        <div className="space-y-6">
            <Section title="1. تجهيز مفتاح الإجابة" icon="check-circle" description="تم إعداد مفتاح الإجابة من الخطوة السابقة وهو جاهز للاستخدام.">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                    {answerKeyImageBase64 ? (
                        <p className="font-semibold text-green-800">تم رفع صورة مفتاح الإجابة بنجاح.</p>
                    ) : (
                        <p className="font-semibold text-green-800">مفتاح الإجابة جاهز ويحتوي على {answerKey.length} سؤال.</p>
                    )}
                </div>
            </Section>
            <Section title="2. تحميل إجابات الطلاب" icon="upload" description="ارفع جميع أوراق إجابات الطلاب (صور) دفعة واحدة.">
                <div className="space-y-4">
                    <div className="p-6 border-2 border-dashed border-gray-300 rounded-lg text-center bg-gray-50">
                        <Icon name="upload" className="w-12 h-12 mx-auto text-gray-400" />
                        <label htmlFor="student-papers-upload" className="mt-2 block text-sm font-medium text-gray-600 cursor-pointer">
                           اختر ملفات صور أو PDF
                           <p className="text-xs text-gray-500">يمكنك تحديد ملفات متعددة</p>
                        </label>
                        <input id="student-papers-upload" type="file" onChange={handleFileChange} accept="image/*" className="hidden" multiple />
                    </div>
                    {studentFiles.length > 0 && (
                        <div className="p-2 border rounded-md">
                            <p className="font-semibold">{studentFiles.length} ورقة تم رفعها وجاهزة للتدقيق.</p>
                        </div>
                    )}
                </div>
            </Section>
            {error && <p className="text-red-600 text-center p-2 bg-red-100 rounded-md">{error}</p>}
            <div className="flex justify-center pt-4 border-t">
                 <button onClick={startGrading} disabled={isGrading || studentFiles.length === 0} className="w-full md:w-auto bg-teal-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-lg shadow-md">
                    {isGrading ? '...جاري التدقيق' : 'ابدأ التصحيح والمقارنة'}
                </button>
            </div>
            {isGrading && (
                <div className="space-y-2 text-center">
                    <p>جاري تدقيق: {currentFile}</p>
                    <div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-blue-500 h-4 rounded-full" style={{width: `${progress}%`}}></div></div>
                    <p className="font-bold">{Math.round(progress)}%</p>
                </div>
            )}
        </div>
    );
};

const ResultsDisplay = ({ results, answerKey, onReset }: { results: GradingResult[], answerKey: AnswerKey, onReset: () => void }) => {
    const [expandedResult, setExpandedResult] = useState<string | null>(null);

    const exportToExcel = () => {
        const data = results.map(r => ({
            'اسم الطالب': r.studentName, 'الدرجة (%)': r.summary.scorePercentage, 'الإجابات الصحيحة': r.summary.correctAnswers,
            'الإجابات الخاطئة': r.summary.wrongAnswers, 'مجموع الأسئلة': r.summary.totalQuestions, 'اسم الملف': r.fileName
        }));
        const ws = utils.json_to_sheet(data);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "نتائج التدقيق");
        writeFile(wb, "نتائج_الطلاب.xlsx");
    };

    if (results.length === 0) {
        return (
            <Section title="النتائج النهائية" icon="list">
                <p className="text-center text-gray-500 p-4">لم يتم العثور على نتائج. يرجى إكمال خطوة التدقيق أولاً.</p>
                 <div className="flex justify-center mt-4"><button onClick={onReset} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">البدء من جديد</button></div>
            </Section>
        )
    }

    return (
        <Section title="النتائج النهائية" icon="list" description="هنا تعرض نتائج التدقيق الآلي لجميع أوراق الطلاب.">
            <div className="flex justify-between items-center mb-4">
                <button onClick={exportToExcel} className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700">تصدير إلى Excel</button>
                <button onClick={onReset} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">البدء من جديد</button>
            </div>
            <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th className="px-6 py-3">اسم الطالب</th><th className="px-6 py-3">الدرجة</th><th className="px-6 py-3">الإجابات الصحيحة</th><th className="px-6 py-3">الإجابات الخاطئة</th><th className="px-6 py-3">التفاصيل</th>
                        </tr>
                    </thead>
                    <tbody>
                        {results.map((result) => (
                            <React.Fragment key={result.fileName}>
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <td className="px-6 py-4 font-medium text-gray-900">{result.studentName}</td>
                                    <td className="px-6 py-4 font-bold text-lg">{result.summary.scorePercentage.toFixed(1)}%</td>
                                    <td className="px-6 py-4 text-green-600 font-semibold">{result.summary.correctAnswers}</td>
                                    <td className="px-6 py-4 text-red-600 font-semibold">{result.summary.wrongAnswers}</td>
                                    <td className="px-6 py-4"><button onClick={() => setExpandedResult(expandedResult === result.fileName ? null : result.fileName)} className="text-blue-600 hover:underline">{expandedResult === result.fileName ? 'إخفاء' : 'عرض'}</button></td>
                                </tr>
                                {expandedResult === result.fileName && (
                                    <tr className="bg-gray-50"><td colSpan={5} className="p-4">
                                        <h4 className="font-bold mb-2">تفاصيل إجابات: {result.studentName}</h4>
                                        <ul className="space-y-1">
                                            {result.details.map(d => (
                                                <li key={d.questionNumber} className={`p-2 rounded-md ${d.status === 'صحيحة' ? 'bg-green-100' : 'bg-red-100'}`}>
                                                    <strong>س{d.questionNumber}:</strong> {(d.questionText && d.questionText !== 'غير متوفر') && <span className="text-gray-600 text-xs"> "{d.questionText}"</span>}<br/>
                                                    إجابة الطالب: <span className="font-mono">{d.studentAnswer}</span> | الإجابة الصحيحة: <span className="font-mono">{d.correctAnswer}</span> - <span className={`font-bold ${d.status === 'صحيحة' ? 'text-green-700' : 'text-red-700'}`}>{d.status}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </td></tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </Section>
    );
};

export default function ExamGrader({ teacher }: { teacher: Teacher }): React.ReactNode {
  const [activeStep, setActiveStep] = useState<StepId>('setup');
  const [answerKey, setAnswerKey] = useState<AnswerKey>([]);
  const [answerKeyImageBase64, setAnswerKeyImageBase64] = useState<string | null>(null);
  const [results, setResults] = useState<GradingResult[]>([]);

  const handleKeyFinalized = (key: AnswerKey, imageKey?: string) => {
    setAnswerKey(key);
    setAnswerKeyImageBase64(imageKey || null);
    setActiveStep('grade');
  };

  const handleGradingComplete = (res: GradingResult[]) => {
    setResults(res);
    setActiveStep('results');
  };

  const handleReset = () => {
    setActiveStep('setup');
    setAnswerKey([]);
    setAnswerKeyImageBase64(null);
    setResults([]);
    localStorage.removeItem('examAnswerKey');
  };

  const renderCurrentStep = () => {
    switch (activeStep) {
      case 'setup': return <AnswerKeySetup onFinalize={handleKeyFinalized} teacher={teacher}/>;
      case 'grade': return <Grading answerKey={answerKey} answerKeyImageBase64={answerKeyImageBase64} onGradingComplete={handleGradingComplete} />;
      case 'results': return <ResultsDisplay results={results} answerKey={answerKey} onReset={handleReset} />;
      default: return null;
    }
  };
  
  const steps: {id: StepId, title: string, icon: string}[] = [
      { id: 'setup', title: '1. إعداد مفتاح الإجابة', icon: 'edit' },
      { id: 'grade', title: '2. تدقيق الاختبارات', icon: 'check-circle' },
      { id: 'results', title: '3. عرض النتائج', icon: 'list' }
  ];

  const activeStepIndex = steps.findIndex(s => s.id === activeStep);

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4">
        <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-800">مدقق الامتحانات الآلي</h1>
            <p className="text-gray-500 mt-1">أنشئ، دقق، وحلل اختبارات طلابك بسهولة وكفاءة باستخدام الذكاء الاصطناعي.</p>
        </div>
        
        <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center">
                {steps.map((step, index) => (
                    <React.Fragment key={step.id}>
                        <div className="flex flex-col items-center">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${index <= activeStepIndex ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                <Icon name={step.icon} className="w-5 h-5" />
                            </div>
                            <p className={`mt-2 text-xs font-semibold text-center ${index <= activeStepIndex ? 'text-teal-600' : 'text-gray-500'}`}>{step.title}</p>
                        </div>
                        {index < steps.length - 1 && <div className={`flex-1 h-1 mx-2 transition-colors ${index < activeStepIndex ? 'bg-teal-600' : 'bg-gray-200'}`}></div>}
                    </React.Fragment>
                ))}
            </div>
        </div>

        {renderCurrentStep()}
    </div>
  );
}