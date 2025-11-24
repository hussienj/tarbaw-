// This file is renamed to LessonPlanner.tsx in spirit.
// It replaces the old form and display components.
import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { UserInputs, LessonPlanData, EnglishUserInputs, EnglishLessonPlanData, Teacher } from '../types';
import Icon from './Icon';
import { getUsageData, decrementUsage, USAGE_LIMITS, UsageData } from '../services/firebaseService';

const { jsPDF } = window.jspdf;

declare global {
  interface Window {
    pdfjsLib: any;
    html2canvas: any;
    jspdf: any;
  }
}

interface LessonPlannerProps {
  userInputs: UserInputs;
  setUserInputs: React.Dispatch<React.SetStateAction<UserInputs>>;
  planContent: LessonPlanData;
  setPlanContent: React.Dispatch<React.SetStateAction<LessonPlanData>>;
  source: { text: string; images: string[] };
  setSource: React.Dispatch<React.SetStateAction<{ text: string; images: string[] }>>;
  onGenerate: (sections?: (keyof LessonPlanData)[]) => void;
  isGenerating: Record<string, boolean>;
  error: string | null;
  onReset: () => void;
  teacher: Teacher;
}

interface EnglishLessonPlannerProps {
  userInputs: EnglishUserInputs;
  setUserInputs: React.Dispatch<React.SetStateAction<EnglishUserInputs>>;
  planContent: EnglishLessonPlanData;
  setPlanContent: React.Dispatch<React.SetStateAction<EnglishLessonPlanData>>;
  source: { text: string; images: string[] };
  setSource: React.Dispatch<React.SetStateAction<{ text: string; images: string[] }>>;
  onGenerate: (sections?: (keyof EnglishLessonPlanData)[]) => void;
  isGenerating: Record<string, boolean>;
  error: string | null;
  onReset: () => void;
  teacher: Teacher;
}


type Tab = 'image' | 'paste' | 'url';

const UsageCounter: React.FC<{
  label: string;
  remaining: number;
  limit: number;
  isLoading: boolean;
}> = ({ label, remaining, limit, isLoading }) => {
  const percentage = limit > 0 ? (remaining / limit) * 100 : 0;
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
      <div className="w-full bg-gray-600 rounded-full h-2.5">
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

/**
 * Generates an HTML string for the lesson plan, styled for export.
 * @param plan - The lesson plan data.
 * @param user - The user input data (teacher, class, etc.).
 * @param format - The target export format ('pdf' or 'word').
 * @returns An HTML string.
 */
const generateExportHtml = (plan: LessonPlanData, user: UserInputs, format: 'pdf' | 'word'): string => {
    let styles: any;
    let headerHtml: string;
    let footerHtml: string;

    const processNumberedArray = (arr: string[], olStyle: string) => `<ol style="${olStyle}">${(Array.isArray(arr) ? arr : []).map(item => `<li>${item || '&nbsp;'}</li>`).join('')}</ol>`;
    const noBottomMarginPFactory = (pStyle: string) => pStyle.replace(/margin: 0 0 [^ ]+ 0;/, 'margin: 0;');
    const teachingProcessHtmlFactory = (pStyle: string, strongStyle: string, noBottomPStyle: string) => plan.teachingProcess ? `
      <p style="${pStyle}"><strong style="${strongStyle}">التهيئة:</strong> ${plan.teachingProcess.warmUp || ''}</p>
      <p style="${pStyle}"><strong style="${strongStyle}">النشاط:</strong> ${plan.teachingProcess.activity || ''}</p>
      <p style="${pStyle}"><strong style="${strongStyle}">الشرح:</strong> ${plan.teachingProcess.explanation || ''}</p>
      <p style="${pStyle}"><strong style="${strongStyle}">التقييم (ضمن التدريس):</strong> ${plan.teachingProcess.assessment || ''}</p>
      <p style="${noBottomPStyle}"><strong style="${strongStyle}">التوسع:</strong> ${plan.teachingProcess.expansion || ''}</p>
    ` : '';

    if (format === 'word') {
        styles = {
            page: `direction: rtl; font-family: 'Times New Roman', serif; background: white; color: black; font-size: 14pt;`,
            p: `margin: 0 0 10px 0;`,
            strong: `font-weight: bold;`,
            table: `width: 100%; border-collapse: collapse; border: 2px solid black;`,
            tdContent: `border: 1px solid black; padding: 8px; vertical-align: top; text-align: right; line-height: 1.6;`,
            tdLabel: `border: 1px solid black; padding: 8px; font-weight: bold; width: 150px; text-align: center; vertical-align: middle; background-color: #e9ecef;`,
            ol: `padding-right: 20px; margin: 0;`,
        };
        const headerFooterPStyle = `margin: 0; padding: 0; font-size: 14pt;`;
        headerHtml = `
          <div style="border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 10px;">
            <table style="width:100%;">
              <tr>
                <td style="text-align: right; width: 50%;">
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">عنوان الدرس:</strong> ${user.lessonTitle || ''}</p>
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">التاريخ:</strong> ${user.date || ''}</p>
                </td>
                <td style="text-align: left; width: 50%;">
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">الصف:</strong> ${user.class || ''}</p>
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">عدد الحصص:</strong> ${user.sessions || ''}</p>
                </td>
              </tr>
            </table>
          </div>
        `;
        footerHtml = `
          <div style="border-top: 2px solid black; padding-top: 10px; margin-top: 10px;">
            <table style="width:100%;">
              <tr>
                <td style="text-align: right; width: 50%;">
                  <strong style="${styles.strong}">مدير المدرسة</strong><br/><br/>${user.principalName || ''}
                </td>
                <td style="text-align: left; width: 50%;">
                  <strong style="${styles.strong}">مدرس المادة</strong><br/><br/>${user.teacherName || ''}
                </td>
              </tr>
            </table>
          </div>
        `;
    } else { // pdf
        styles = {
            page: `direction: rtl; font-family: 'Tajawal', sans-serif; background: white; color: black; width: 210mm; height: 297mm; padding: 15mm 15mm 10mm 15mm; box-sizing: border-box; display: flex; flex-direction: column;`,
            header: `display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 10px; font-size: 14px;`,
            footer: `display: flex; justify-content: space-between; align-items: flex-start; border-top: 2px solid black; padding-top: 10px; margin-top: 10px; font-size: 14px; text-align: center;`,
            footerBlock: `width: 45%;`,
            table: `width: 100%; border-collapse: collapse; border: 2px solid black; flex-grow: 1;`,
            tdContent: `border: 1px solid black; padding: 8px; vertical-align: top; text-align: right; line-height: 1.6; font-size: 12px;`,
            tdLabel: `border: 1px solid black; padding: 8px; font-weight: bold; width: 150px; text-align: center; vertical-align: middle; background-color: #e9ecef; font-size: 13px;`,
            ol: `padding-right: 20px; margin: 0;`,
            p: `margin: 0 0 10px 0;`,
            strong: `font-weight: bold;`
        };
        const noBottomMarginP = noBottomMarginPFactory(styles.p);
        headerHtml = `
          <div style="${styles.header}">
            <div>
              <p style="${styles.p}"><strong style="${styles.strong}">عنوان الدرس:</strong> ${user.lessonTitle || ''}</p>
              <p style="${noBottomMarginP}"><strong style="${styles.strong}">التاريخ:</strong> ${user.date || ''}</p>
            </div>
            <div>
              <p style="${styles.p}"><strong style="${styles.strong}">الصف:</strong> ${user.class || ''}</p>
              <p style="${noBottomMarginP}"><strong style="${styles.strong}">عدد الحصص:</strong> ${user.sessions || ''}</p>
            </div>
          </div>
        `;
        footerHtml = `
           <div style="${styles.footer}">
             <div style="${styles.footerBlock}">
               <strong style="${styles.strong}">مدير المدرسة</strong><br><br>${user.principalName || ''}
             </div>
             <div style="${styles.footerBlock}">
               <strong style="${styles.strong}">مدرس المادة</strong><br><br>${user.teacherName || ''}
             </div>
          </div>
        `;
    }
    
    const noBottomMarginP = noBottomMarginPFactory(styles.p);
    const teachingProcessHtml = teachingProcessHtmlFactory(styles.p, styles.strong, noBottomMarginP);
    
    const tableRows = [
        { label: 'النتاجات التعليمية', content: processNumberedArray(plan.learningOutcomes, styles.ol) },
        { label: 'التعليم القبلي', content: plan.priorKnowledge || '' },
        { label: 'المواد والأدوات', content: (Array.isArray(plan.materialsAndTools) ? plan.materialsAndTools : []).join('، ') },
        { label: 'المفردات', content: (Array.isArray(plan.vocabulary) ? plan.vocabulary : []).join('، ') },
        { label: 'التدريس', content: teachingProcessHtml },
        { label: 'التقييم النهائي (الختامي)', content: plan.finalAssessment || '' },
        { label: 'الواجب البيتي (المهمة الختامية)', content: plan.homework || '' },
        { label: 'الملاحظات', content: '-' }
    ];

    const tableHtml = tableRows.map(row => `
        <tr>
            <td style="${styles.tdLabel}">${row.label}</td>
            <td style="${styles.tdContent}">${row.content || '&nbsp;'}</td>
        </tr>
    `).join('');

    return `
      <div style="${styles.page}">
        ${headerHtml}
        <table style="${styles.table}">
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
        ${footerHtml}
      </div>
    `;
};

const generateEnglishExportHtml = (plan: EnglishLessonPlanData, user: EnglishUserInputs, format: 'pdf' | 'word'): string => {
    let styles: any;
    let headerHtml: string;
    let footerHtml: string;

    const processArray = (arr: string[], ulStyle: string) => `<ul style="${ulStyle}">${(Array.isArray(arr) ? arr : []).map(item => `<li>${item || '&nbsp;'}</li>`).join('')}</ul>`;

    if (format === 'word') {
        styles = {
            page: `direction: ltr; font-family: 'Times New Roman', serif; background: white; color: black; font-size: 12pt;`,
            p: `margin: 0 0 10px 0;`,
            strong: `font-weight: bold;`,
            table: `width: 100%; border-collapse: collapse; border: 2px solid black;`,
            tdContent: `border: 1px solid black; padding: 8px; vertical-align: top; text-align: left; line-height: 1.5;`,
            tdLabel: `border: 1px solid black; padding: 8px; font-weight: bold; width: 150px; text-align: left; vertical-align: middle; background-color: #e9ecef;`,
            ul: `padding-left: 20px; margin: 0; list-style-type: disc;`,
        };
        const headerFooterPStyle = `margin: 0; padding: 0; font-size: 12pt;`;
        headerHtml = `
          <div style="border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 10px;">
            <table style="width:100%;">
              <tr>
                <td style="text-align: left; width: 50%; border: none;">
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">Subject:</strong> ${user.subject || ''}</p>
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">Date:</strong> ${user.date || ''}</p>
                </td>
                <td style="text-align: right; width: 50%; border: none;">
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">Class:</strong> ${user.className || ''}</p>
                  <p style="${headerFooterPStyle}"><strong style="${styles.strong}">Unit:</strong> ${user.unit || ''} &nbsp;&nbsp; <strong style="${styles.strong}">Lesson:</strong> ${user.lesson || ''}</p>
                </td>
              </tr>
            </table>
          </div>
        `;
         footerHtml = `
          <div style="border-top: 2px solid black; padding-top: 10px; margin-top: 20px;">
            <table style="width:100%; border: none;">
              <tr>
                <td style="text-align: left; width: 50%; border: none;">
                  <strong style="${styles.strong}">Headmaster</strong><br/><br/>___________________
                </td>
                <td style="text-align: right; width: 50%; border: none;">
                  <strong style="${styles.strong}">Teacher's Name</strong><br/><br/>${user.teacherName || '___________________'}
                </td>
              </tr>
            </table>
          </div>
        `;
    } else { // pdf
        styles = {
            page: `direction: ltr; font-family: 'Helvetica', sans-serif; background: white; color: black; width: 210mm; height: 297mm; padding: 15mm; box-sizing: border-box; display: flex; flex-direction: column;`,
            header: `display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid black; padding-bottom: 10px; margin-bottom: 10px; font-size: 12px;`,
            table: `width: 100%; border-collapse: collapse; border: 2px solid black; flex-grow: 1;`,
            tdContent: `border: 1px solid black; padding: 8px; vertical-align: top; text-align: left; line-height: 1.5; font-size: 11px;`,
            tdLabel: `border: 1px solid black; padding: 8px; font-weight: bold; width: 120px; text-align: left; vertical-align: middle; background-color: #e9ecef; font-size: 12px;`,
            ul: `padding-left: 20px; margin: 0; list-style-type: disc;`,
            p: `margin: 0 0 8px 0;`,
            strong: `font-weight: bold;`
        };
        headerHtml = `
          <div style="${styles.header}">
            <div>
              <p style="${styles.p}"><strong style="${styles.strong}">Subject:</strong> ${user.subject || ''}</p>
              <p style="${styles.p}"><strong style="${styles.strong}">Date:</strong> ${user.date || ''}</p>
            </div>
            <div>
              <p style="${styles.p}"><strong style="${styles.strong}">Class:</strong> ${user.className || ''}</p>
              <p style="${styles.p}"><strong style="${styles.strong}">Unit:</strong> ${user.unit || ''} &nbsp;&nbsp; <strong style="${styles.strong}">Lesson:</strong> ${user.lesson || ''}</p>
            </div>
          </div>
        `;
        footerHtml = `
            <div style="border-top: 2px solid black; padding-top: 10px; margin-top: auto; display: flex; justify-content: space-between; font-size: 12px;">
                <div><strong style="${styles.strong}">Headmaster</strong><br/><br/>___________________</div>
                <div><strong style="${styles.strong}">Teacher's Name</strong><br/><br/>${user.teacherName || '___________________'}</div>
            </div>`;
    }

    const tableRows = [
        { label: 'Objectives', content: processArray(plan.objectives, styles.ul) },
        { label: 'Procedures', content: processArray(plan.procedures, styles.ul) },
        { label: 'Materials', content: (Array.isArray(plan.materials) ? plan.materials : []).join(', ') },
        { label: 'Language', content: plan.language || '' },
        { label: 'Vocabulary', content: (Array.isArray(plan.vocabulary) ? plan.vocabulary : []).join(', ') },
        { label: 'Evaluation', content: plan.evaluation || '' },
        { label: 'Homework', content: plan.homework || '' },
    ];

    const tableHtml = tableRows.map(row => `
        <tr>
            <td style="${styles.tdLabel}">${row.label}</td>
            <td style="${styles.tdContent}">${row.content || '&nbsp;'}</td>
        </tr>
    `).join('');

    return `
      <div style="${styles.page}">
        ${headerHtml}
        <table style="${styles.table}">
          <tbody>
            ${tableHtml}
          </tbody>
        </table>
        ${footerHtml}
      </div>
    `;
};


const Section: React.FC<{
  title: string,
  icon: string,
  description: string,
  children: React.ReactNode,
  dir?: 'ltr' | 'rtl'
}> = ({ title, icon, description, children, dir='rtl' }) => (
  <div className="bg-white rounded-lg shadow-md border border-gray-200" dir={dir}>
    <div className="p-4 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <Icon name={icon} className="w-6 h-6 text-teal-600" />
        <div>
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
    </div>
    <div className="p-4">
      {children}
    </div>
  </div>
);

const GenerateButton: React.FC<{
  onClick: () => void;
  isGenerating: boolean;
  text?: string;
}> = ({ onClick, isGenerating, text = "توليد" }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={isGenerating}
    className="flex items-center justify-center gap-2 bg-teal-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 transition-colors"
  >
    {isGenerating ? (
      <>
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>جاري التوليد...</span>
      </>
    ) : (
      <>
        <Icon name="sparkles" className="w-5 h-5" />
        <span>{text}</span>
      </>
    )}
  </button>
);


const TabButton: React.FC<{
  tab: Tab;
  activeTab: Tab;
  onClick: (tab: Tab) => void;
  label: string;
  icon: string;
}> = ({ tab, activeTab, onClick, label, icon }) => (
  <button
    type="button"
    onClick={() => onClick(tab)}
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

const EditableField: React.FC<{
  label: string;
  content: string | string[];
  isGenerating: boolean;
  onUpdate: (newContent: string | string[]) => void;
}> = ({ label, content, isGenerating, onUpdate }) => {
  const isArray = Array.isArray(content);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdate(e.target.value);
  };
  
  const handleArrayChange = (index: number, value: string) => {
    const newContent = [...(content as string[])];
    newContent[index] = value;
    onUpdate(newContent);
  };
  
  const addArrayItem = () => {
    onUpdate([...(content as string[]), '']);
  };

  const removeArrayItem = (index: number) => {
    onUpdate((content as string[]).filter((_, i) => i !== index));
  };
  
  const renderContent = () => {
    if (isGenerating) {
      return (
        <div className="p-4 bg-gray-100 rounded-md animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
      );
    }
    
    if (isArray) {
      return (
        <div className="space-y-2">
          {(content as string[]).map((item, index) => (
             <div key={index} className="flex items-center gap-2">
               <input 
                 type="text" 
                 value={item} 
                 onChange={e => handleArrayChange(index, e.target.value)} 
                 className="w-full p-2 border rounded-md text-sm"
               />
               <button onClick={() => removeArrayItem(index)} className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200"><Icon name="trash" className="w-4 h-4" /></button>
             </div>
          ))}
          <button onClick={addArrayItem} className="w-full text-sm bg-green-100 text-green-700 font-semibold p-1.5 rounded-md hover:bg-green-200">إضافة عنصر</button>
        </div>
      );
    }

    return (
      <textarea 
        value={content as string} 
        onChange={handleTextChange} 
        rows={4}
        className="w-full p-2 border rounded-md text-sm"
      />
    );
  };

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h4 className="font-bold text-gray-700 mb-2">{label}</h4>
      {renderContent()}
    </div>
  );
};

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

// --- ARABIC LESSON PLANNER ---
export default function LessonPlanner({
  userInputs, setUserInputs, planContent, setPlanContent,
  source, setSource, onGenerate, isGenerating, error, onReset, teacher
}: LessonPlannerProps) {

  const [activeTab, setActiveTab] = useState<Tab>('paste');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const pdfPageRef = useRef<HTMLDivElement>(null);
  const [amiriFontBase64, setAmiriFontBase64] = useState('');
  
  // State for URL extraction
  const [urlInput, setUrlInput] = useState('');
  const [fromPage, setFromPage] = useState('');
  const [toPage, setToPage] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);

  // State for PDF export progress
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');
  
  // Usage limit state
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    if (teacher) {
      getUsageData(teacher).then(setUsage);
    }
  }, [teacher]);


    useEffect(() => {
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
    }, []);

  const handleInputChange = (field: keyof UserInputs, value: string) => {
    setUserInputs(prev => ({ ...prev, [field]: value }));
  };
  
  const handleGenerateClick = async (sections?: (keyof LessonPlanData)[]) => {
    setGenerationError(null);
    if (!teacher) {
        onGenerate(sections);
        return;
    }

    const usageToCheck = usage || await getUsageData(teacher);
    if (usageToCheck.lessonPlanGenerations <= 0) {
        setGenerationError("لقد وصلت إلى الحد الأقصى لتوليد الخطط اليومية لهذا الشهر.");
        setUsage(usageToCheck);
        return;
    }

    await decrementUsage(teacher, 'lessonPlanGenerations');
    const updatedUsage = await getUsageData(teacher);
    setUsage(updatedUsage);
    
    onGenerate(sections);
  };


  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newPreviews: string[] = [];
      const newImages: string[] = [];
      
// Fix: Added explicit `File` type to the forEach callback parameter to ensure correct type inference.
      files.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const dataUrl = loadEvent.target?.result as string;
          newPreviews.push(dataUrl);
          const base64 = dataUrl.split(',')[1];
          newImages.push(base64);
          
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
    
    if (fromNum && toNum && (toNum - fromNum + 1 > 10)) {
        setExtractionError("لا يمكن استخلاص أكثر من 10 صفحات في المرة الواحدة.");
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
        setActiveTab('paste'); // Switch to paste tab to show the result
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


  const exportPlan = async (format: 'pdf' | 'word') => {
    if (format === 'word') {
        const htmlContent = generateExportHtml(planContent, userInputs, format);
        const wordStyles = `<style>@page WordSection1 { size: 21cm 29.7cm; margin: 0.75cm; } div.WordSection1 { page: WordSection1; }</style>`;
        const sourceHTML = htmlContent.replace('</head>', `${wordStyles}</head>`)
                                    .replace('<div style="', '<div class="WordSection1" style="');

        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'lesson_plan.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
        return;
    }

    if (!amiriFontBase64) {
        alert('الخط العربي لم يتم تحميله بعد، يرجى الانتظار قليلاً والمحاولة مرة أخرى.');
        return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportMessage('جاري تجهيز المحتوى...');
    await new Promise(res => setTimeout(res, 50));

    const htmlContent = generateExportHtml(planContent, userInputs, format);
    
    setExportProgress(10);
    setExportMessage('جاري إنشاء الصفحة...');
    await new Promise(res => setTimeout(res, 50));

    const container = document.createElement('div');
    container.innerHTML = `<head>
            <meta charset="UTF-8">
            <link rel="preconnect" href="https://fonts.googleapis.com">
            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
            <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
        </head>
        <body>${htmlContent}</body>`;
    const page = container.querySelector('[style*="direction: rtl"]');
    if (page) {
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '210mm'; // A4 width
        document.body.appendChild(container);
        
        setExportProgress(25);
        setExportMessage('جاري تحويل الخطة إلى صورة...');
        await new Promise(res => setTimeout(res, 50));

        try {
            const canvas = await window.html2canvas(page as HTMLElement, { scale: 2, useCORS: true });
            
            setExportProgress(75);
            setExportMessage('جاري إنشاء ملف PDF...');
            await new Promise(res => setTimeout(res, 50));

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save("lesson_plan.pdf");

            setExportProgress(100);
            setExportMessage('اكتمل التصدير بنجاح!');
            await new Promise(res => setTimeout(res, 1000));

        } catch(e) {
            console.error("PDF export failed", e);
            alert("فشل في تصدير ملف PDF.");
        } finally {
            document.body.removeChild(container);
            setIsExporting(false);
        }
    } else {
         alert("فشل في تهيئة صفحة التصدير.");
         setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {isExporting && <ProgressBar progress={exportProgress} message={exportMessage} />}
      <h1 className="text-2xl font-bold text-gray-800 text-center">الخطة اليومية للدرس (اللغة العربية)</h1>
      
      <div className="mb-4 flex flex-col md:flex-row items-center justify-center gap-4">
        <UsageCounter 
          label="محاولات توليد الخطة"
          remaining={usage?.lessonPlanGenerations ?? USAGE_LIMITS.lessonPlanGenerations}
          limit={teacher.usageLimits?.lessonPlanGenerations ?? USAGE_LIMITS.lessonPlanGenerations}
          isLoading={!usage}
        />
      </div>

      <Section title="معلومات الخطة الأساسية" icon="edit" description="أدخل المعلومات الأساسية للدرس هنا.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الصف</label>
                <input type="text" value={userInputs.class} onChange={e => handleInputChange('class', e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                <input type="date" value={userInputs.date} onChange={e => handleInputChange('date', e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المادة</label>
                <input type="text" value={userInputs.chapterTitle} readOnly className="w-full p-2 border rounded-md bg-gray-200 text-gray-700 cursor-not-allowed" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الدرس</label>
                <input type="text" value={userInputs.lessonTitle} onChange={e => handleInputChange('lessonTitle', e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عدد الحصص</label>
                <input type="number" value={userInputs.sessions} onChange={e => handleInputChange('sessions', e.target.value)} min="1" className="w-full p-2 border rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المدرس</label>
                <input type="text" value={userInputs.teacherName} readOnly className="w-full p-2 border rounded-md bg-gray-200 text-gray-700 cursor-not-allowed" />
            </div>
            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم مدير المدرسة</label>
                <input type="text" value={userInputs.principalName} onChange={e => handleInputChange('principalName', e.target.value)} className="w-full p-2 border rounded-md" />
            </div>
        </div>
      </Section>

      <Section title="محتوى الدرس" icon="book" description="ألصق النص أو ارفع صورًا من الكتاب المدرسي لتوليد الخطة.">
        <div className="border border-gray-200 rounded-lg">
          <div className="flex">
            <TabButton tab="image" activeTab={activeTab} onClick={setActiveTab} label="رفع صور" icon="image" />
            <TabButton tab="paste" activeTab={activeTab} onClick={setActiveTab} label="لصق نص" icon="paste" />
            <TabButton tab="url" activeTab={activeTab} onClick={setActiveTab} label="استيراد من رابط" icon="url" />
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
                className="w-full p-3 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            )}
            {activeTab === 'url' && (
              <div className="space-y-4">
                  <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                      <strong>ملاحظة:</strong> أدخل رابط صفحة ويب. يمكنك تحديد نطاق صفحات (10 كحد أقصى) لاستخلاصها. إذا تركت الحقول فارغة، سيتم محاولة استخلاص النص كاملاً.
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
      
      <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg shadow-sm border">
        <GenerateButton onClick={() => handleGenerateClick()} isGenerating={isGenerating['all']} text="توليد الخطة كاملة" />
        <button type="button" onClick={onReset} className="flex items-center gap-2 bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-300">
          <Icon name="trash" className="w-5 h-5" />
          <span>إعادة تعيين</span>
        </button>
      </div>

      {(error || generationError) && <p className="text-red-600 text-center p-2 bg-red-100 rounded-md">{error || generationError}</p>}
      
      <Section title="محتوى الخطة المولَّدة" icon="list" description="هنا تظهر نتائج الخطة التي تم توليدها. يمكنك تعديل أي حقل مباشرة.">
        <div className="space-y-4">
           {Object.entries(planContent).map(([key, value]) => {
              const fieldKey = key as keyof LessonPlanData;
              const labelMap: Record<keyof LessonPlanData, string> = {
                  learningOutcomes: 'النتاجات التعليمية',
                  priorKnowledge: 'التعليم القبلي',
                  materialsAndTools: 'المواد والأدوات',
                  vocabulary: 'المفردات',
                  teachingProcess: 'التدريس',
                  finalAssessment: 'التقييم النهائي (الختامي)',
                  homework: 'الواجب البيتي (المهمة الختامية)',
              };

              const handleUpdate = (newValue: string | string[]) => {
                  setPlanContent(prev => ({...prev, [fieldKey]: newValue}));
              };
              
              if (fieldKey === 'teachingProcess') {
                const process = value as LessonPlanData['teachingProcess'];
                const processLabels: Record<keyof LessonPlanData['teachingProcess'], string> = {
                  warmUp: 'التهيئة',
                  activity: 'النشاط',
                  explanation: 'الشرح',
                  assessment: 'التقييم (ضمن التدريس)',
                  expansion: 'التوسع'
                };
                 return (
                    <div key={key} className="p-4 border rounded-lg bg-white shadow-sm">
                        <h4 className="font-bold text-gray-700 mb-2">{labelMap[fieldKey]}</h4>
                        <div className="space-y-2">
                          {Object.entries(process).map(([procKey, procValue]) => {
                            const pKey = procKey as keyof typeof process;
                            return(
                              <div key={pKey}>
                                <label className="text-sm font-semibold text-gray-600">{processLabels[pKey]}</label>
                                <textarea 
                                  value={procValue}
                                  onChange={e => setPlanContent(p => ({...p, teachingProcess: {...p.teachingProcess, [pKey]: e.target.value}}))}
                                  rows={2}
                                  className="w-full mt-1 p-2 border rounded-md text-sm"
                                />
                              </div>
                            )
                          })}
                        </div>
                    </div>
                );
              }

              return (
                  <EditableField 
                      key={fieldKey}
                      label={labelMap[fieldKey]}
                      content={value}
                      isGenerating={isGenerating[fieldKey]}
                      onUpdate={handleUpdate}
                  />
              );
           })}
        </div>
         <div className="mt-6 flex items-center justify-center gap-4">
            <button onClick={() => exportPlan('pdf')} className="flex items-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700">
                <Icon name="pdf" className="w-5 h-5" /> تصدير PDF
            </button>
            <button onClick={() => exportPlan('word')} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">
                <Icon name="word" className="w-5 h-5" /> تصدير Word
            </button>
        </div>
      </Section>
    </div>
  );
}



// --- ENGLISH LESSON PLANNER ---
export function EnglishLessonPlanner({
  userInputs, setUserInputs, planContent, setPlanContent,
  source, setSource, onGenerate, isGenerating, error, onReset, teacher
}: EnglishLessonPlannerProps) {
  
  const [activeTab, setActiveTab] = useState<Tab>('paste');
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
    
  // State for URL extraction
  const [urlInput, setUrlInput] = useState('');
  const [fromPage, setFromPage] = useState('');
  const [toPage, setToPage] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  
  // State for export progress
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportMessage, setExportMessage] = useState('');

  // Usage limit state
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  useEffect(() => {
    if (teacher) {
      getUsageData(teacher).then(setUsage);
    }
  }, [teacher]);

  const exportEnglishPlan = async (format: 'pdf' | 'word') => {
    if (format === 'word') {
        const htmlContent = generateEnglishExportHtml(planContent, userInputs, format);
        const wordStyles = `<style>@page WordSection1 { size: 21cm 29.7cm; margin: 1.5cm; } div.WordSection1 { page: WordSection1; }</style>`;
        const sourceHTML = `<html><head><meta charset="UTF-8">${wordStyles}</head><body>${htmlContent.replace('<div style="', '<div class="WordSection1" style="')}</body></html>`;

        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = 'english_lesson_plan.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
        return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportMessage('Preparing content...');
    await new Promise(res => setTimeout(res, 50));

    const htmlContent = generateEnglishExportHtml(planContent, userInputs, format);
    
    setExportProgress(10);
    setExportMessage('Creating page...');
    await new Promise(res => setTimeout(res, 50));

    const container = document.createElement('div');
    container.innerHTML = `<head>
            <meta charset="UTF-8">
        </head>
        <body>${htmlContent}</body>`;
    const page = container.querySelector('[style*="direction: ltr"]');
    if (page) {
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '210mm'; // A4 width
        document.body.appendChild(container);
        
        setExportProgress(25);
        setExportMessage('Rendering plan to image...');
        await new Promise(res => setTimeout(res, 50));

        try {
            const canvas = await window.html2canvas(page as HTMLElement, { scale: 2, useCORS: true });
            
            setExportProgress(75);
            setExportMessage('Creating PDF file...');
            await new Promise(res => setTimeout(res, 50));

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save("english_lesson_plan.pdf");

            setExportProgress(100);
            setExportMessage('Export complete!');
            await new Promise(res => setTimeout(res, 1000));

        } catch(e) {
            console.error("PDF export failed", e);
            alert("Failed to export PDF.");
        } finally {
            document.body.removeChild(container);
            setIsExporting(false);
        }
    } else {
         alert("Failed to initialize export page.");
         setIsExporting(false);
    }
  };

  const handleGenerateClick = async (sections?: (keyof EnglishLessonPlanData)[]) => {
    setGenerationError(null);
    if (!teacher) {
        onGenerate(sections);
        return;
    }

    const usageToCheck = usage || await getUsageData(teacher);
    if (usageToCheck.lessonPlanGenerations <= 0) {
        setGenerationError("You have reached the maximum number of daily plan generations for this month.");
        setUsage(usageToCheck);
        return;
    }

    await decrementUsage(teacher, 'lessonPlanGenerations');
    const updatedUsage = await getUsageData(teacher);
    setUsage(updatedUsage);
    
    onGenerate(sections);
  };
  
  const handleInputChange = (field: keyof EnglishUserInputs, value: string) => {
    setUserInputs(prev => ({ ...prev, [field]: value }));
  };
  
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newPreviews: string[] = [];
      const newImages: string[] = [];
      
// Fix: Added explicit `File` type to the forEach callback parameter to ensure correct type inference.
      files.forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
          const dataUrl = loadEvent.target?.result as string;
          newPreviews.push(dataUrl);
          const base64 = dataUrl.split(',')[1];
          newImages.push(base64);
          
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
        setExtractionError("Please enter a web page URL.");
        setIsExtracting(false);
        return;
    }
    
    const fromNum = fromPage ? parseInt(fromPage, 10) : 0;
    const toNum = toPage ? parseInt(toPage, 10) : 0;

    if ((fromNum || toNum) && (!fromNum || !toNum || fromNum > toNum)) {
        setExtractionError("Please enter a valid page range. 'From page' must be less than or equal to 'To page'.");
        setIsExtracting(false);
        return;
    }
    
    if (fromNum && toNum && (toNum - fromNum + 1 > 10)) {
        setExtractionError("You can extract a maximum of 10 pages at a time.");
        setIsExtracting(false);
        return;
    }

    try {
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(urlInput)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok) throw new Error(`Failed to fetch content. Status: ${response.status}`);

        const htmlContent = await response.text();

        if (!htmlContent) throw new Error("No content found at the provided URL.");

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
            throw new Error("No extractable text found on the page after cleaning.");
        }
        
        let extractedText = cleanedText;

        if (fromNum && toNum) {
             const pageSegments = cleanedText.split(/(?=\b(?:page|صفحة)\s+\d+\b)/i);

            if (pageSegments.length <= 1) {
                throw new Error("Could not find page markers (e.g., 'Page 1') in the content. Please leave page fields empty to extract the full text.");
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
                throw new Error(`Could not find content for the requested pages (${fromNum}-${toNum}). Please check the page numbers on the website.`);
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
        setExtractionError(error.message || "An error occurred while trying to fetch the page content. Please check the URL.");
    } finally {
        setIsExtracting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto" dir="ltr">
        {isExporting && <ProgressBar progress={exportProgress} message={exportMessage} />}
        <h1 className="text-2xl font-bold text-gray-800 text-center">Daily Lesson Plan (English)</h1>
      
        <div className="mb-4 flex flex-col md:flex-row items-center justify-center gap-4">
            <UsageCounter 
                label="Plan Generations"
                remaining={usage?.lessonPlanGenerations ?? USAGE_LIMITS.lessonPlanGenerations}
                limit={teacher.usageLimits?.lessonPlanGenerations ?? USAGE_LIMITS.lessonPlanGenerations}
                isLoading={!usage}
            />
        </div>
        
        <Section title="Basic Plan Information" icon="edit" description="Enter the basic information for the lesson here." dir="ltr">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                  <label htmlFor="en-unit" className="block text-sm font-medium text-gray-700">Unit</label>
                  <input type="text" id="en-unit" value={userInputs.unit} onChange={e => handleInputChange('unit', e.target.value)} className="mt-1 block w-full p-2 border rounded-md" />
              </div>
              <div>
                  <label htmlFor="en-lesson" className="block text-sm font-medium text-gray-700">Lesson</label>
                  <input type="text" id="en-lesson" value={userInputs.lesson} onChange={e => handleInputChange('lesson', e.target.value)} className="mt-1 block w-full p-2 border rounded-md" />
              </div>
               <div>
                  <label htmlFor="en-class" className="block text-sm font-medium text-gray-700">Class</label>
                  <input type="text" id="en-class" value={userInputs.className} onChange={e => handleInputChange('className', e.target.value)} className="mt-1 block w-full p-2 border rounded-md" />
              </div>
              <div>
                  <label htmlFor="en-date" className="block text-sm font-medium text-gray-700">Date</label>
                  <input type="date" id="en-date" value={userInputs.date} onChange={e => handleInputChange('date', e.target.value)} className="mt-1 block w-full p-2 border rounded-md" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Subject</label>
                  <input type="text" value={userInputs.subject} readOnly className="mt-1 block w-full p-2 border rounded-md bg-gray-200" />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Teacher's Name</label>
                  <input type="text" value={userInputs.teacherName} readOnly className="mt-1 block w-full p-2 border rounded-md bg-gray-200" />
              </div>
          </div>
        </Section>
        
        <Section title="Lesson Content" icon="book" description="Paste text or upload images from the textbook to generate the plan." dir="ltr">
            <div className="border border-gray-200 rounded-lg">
              <div className="flex">
                <TabButton tab="image" activeTab={activeTab} onClick={setActiveTab} label="Upload Images" icon="image" />
                <TabButton tab="paste" activeTab={activeTab} onClick={setActiveTab} label="Paste Text" icon="paste" />
                <TabButton tab="url" activeTab={activeTab} onClick={setActiveTab} label="Import from URL" icon="url" />
              </div>
              <div className="p-4">
                 {activeTab === 'image' && (
                    <div>
                        <label className="block w-full cursor-pointer bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                            <Icon name="upload" className="w-10 h-10 mx-auto text-gray-400" />
                            <span className="mt-2 block text-sm font-medium text-gray-600">Choose image file(s)</span>
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
                        placeholder="Paste content from the textbook here..."
                        className="w-full p-3 border rounded-md"
                    />
                )}
                 {activeTab === 'url' && (
                  <div className="space-y-4">
                      <p className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-md border border-yellow-200">
                          <strong>Note:</strong> Enter a web page URL. You can specify a page range (max 10 pages) to extract. If you leave the fields empty, it will try to extract the full text.
                      </p>
                      <div>
                          <label htmlFor="en_urlInput" className="block text-sm font-medium text-gray-700 mb-1">Web Page URL</label>
                          <input
                              id="en_urlInput"
                              type="url"
                              value={urlInput}
                              onChange={(e) => setUrlInput(e.target.value)}
                              placeholder="https://example.com/article"
                              className="w-full p-2 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                          />
                      </div>
                      
                      <div className="flex items-center gap-4">
                          <div className="flex-1">
                              <label htmlFor="en_fromPage" className="block text-sm font-medium text-gray-700 mb-1">From Page</label>
                              <input
                                  id="en_fromPage"
                                  type="number"
                                  value={fromPage}
                                  onChange={(e) => setFromPage(e.target.value)}
                                  placeholder="e.g., 1"
                                  className="w-full p-2 border rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                                  min="1"
                              />
                          </div>
                          <div className="flex-1">
                              <label htmlFor="en_toPage" className="block text-sm font-medium text-gray-700 mb-1">To Page</label>
                              <input
                                  id="en_toPage"
                                  type="number"
                                  value={toPage}
                                  onChange={(e) => setToPage(e.target.value)}
                                  placeholder="e.g., 3"
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
									<span>Extracting...</span>
								</>
							) : (
								<>
									<Icon name="url" className="w-5 h-5"/>
									<span>Extract Text</span>
								</>
							)}
						</button>
                  </div>
                )}
              </div>
            </div>
        </Section>
        
        <div className="flex items-center justify-center gap-4 p-4 bg-white rounded-lg shadow-sm border">
            <GenerateButton onClick={() => handleGenerateClick()} isGenerating={isGenerating['all']} text="Generate Full Plan" />
            <button type="button" onClick={onReset} className="flex items-center gap-2 bg-gray-200 text-gray-700 font-semibold px-4 py-2 rounded-lg hover:bg-gray-300">
                <Icon name="trash" className="w-5 h-5" />
                <span>Reset</span>
            </button>
        </div>

        {(error || generationError) && <p className="text-red-600 text-center p-2 bg-red-100 rounded-md">{error || generationError}</p>}
      
        <Section title="Generated Plan Content" icon="list" description="The results of the generated plan appear here. You can edit any field directly." dir="ltr">
            <div className="space-y-4">
               {Object.entries(planContent).map(([key, value]) => {
                  const fieldKey = key as keyof EnglishLessonPlanData;
                  const labelMap: Record<keyof EnglishLessonPlanData, string> = {
                      objectives: 'Objectives',
                      procedures: 'Procedures',
                      materials: 'Materials',
                      language: 'Language',
                      vocabulary: 'Vocabulary',
                      evaluation: 'Evaluation',
                      homework: 'Homework',
                  };

                  const handleUpdate = (newValue: string | string[]) => {
                      setPlanContent(prev => ({...prev, [fieldKey]: newValue}));
                  };
                  
                  return (
                      <EditableField 
                          key={fieldKey}
                          label={labelMap[fieldKey]}
                          content={value}
                          isGenerating={isGenerating[fieldKey]}
                          onUpdate={handleUpdate}
                      />
                  );
               })}
            </div>
             <div className="mt-6 flex items-center justify-center gap-4">
                <button onClick={() => exportEnglishPlan('pdf')} className="flex items-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700">
                    <Icon name="pdf" className="w-5 h-5" /> Export PDF
                </button>
                <button onClick={() => exportEnglishPlan('word')} className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700">
                    <Icon name="word" className="w-5 h-5" /> Export Word
                </button>
            </div>
        </Section>
    </div>
  );
}