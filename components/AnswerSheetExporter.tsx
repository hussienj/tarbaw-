import React, { useState, useEffect } from 'react';
import Icon from './Icon';
import { GradebookState, Student as GradebookStudent, AnswerKey } from '../types';
import { gradebooksRef } from '../services/firebaseService';

declare global {
  interface Window {
    jspdf: any;
  }
}

const { jsPDF } = window.jspdf;

const Section: React.FC<{
  title: string,
  icon: string,
  children: React.ReactNode
}> = ({ title, icon, children }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <Icon name={icon} className="w-7 h-7 text-gray-500" />
            <div>
                <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            </div>
        </div>
        <div className="p-5">{children}</div>
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

export default function AnswerSheetExporter({ teacherName }: { teacherName: string }) {
    const [savedRecords, setSavedRecords] = useState<Record<string, string>>({});
    const [selectedRecordKey, setSelectedRecordKey] = useState<string>('');
    const [students, setStudents] = useState<GradebookStudent[]>([]);
    const [className, setClassName] = useState<string>('');
    const [numQuestions, setNumQuestions] = useState<number>(10);
    const [amiriFontBase64, setAmiriFontBase64] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [exportProgress, setExportProgress] = useState(0);
    const [exportMessage, setExportMessage] = useState('');

    useEffect(() => {
        // Load Amiri font for PDF generation
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

        // Load saved gradebook records from Firebase
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
                 setSavedRecords({});
            });
        } else {
            setSavedRecords({});
        }

        // Load the number of questions from the last answer key in localStorage
        try {
            const savedKey = localStorage.getItem('examAnswerKey');
            if (savedKey) {
                const parsedKey: AnswerKey = JSON.parse(savedKey);
                if (Array.isArray(parsedKey) && parsedKey.length > 0) {
                    setNumQuestions(parsedKey.length);
                }
            }
        } catch (e) {
            console.error("Failed to load or parse answer key from localStorage", e);
        }
    }, [teacherName]);

    useEffect(() => {
        if (selectedRecordKey && teacherName) {
            gradebooksRef.child(teacherName).child(selectedRecordKey).once('value', (snapshot) => {
                if (snapshot.exists()) {
                    const record: GradebookState = snapshot.val();
                    setStudents(record.students || []);
                    setClassName(record.info?.className || '');
                } else {
                    console.warn(`Record with key "${selectedRecordKey}" not found for teacher "${teacherName}".`);
                    setStudents([]);
                    setClassName('');
                }
            }).catch(error => {
                console.error("Failed to load gradebook record from Firebase:", error);
                setStudents([]);
                setClassName('');
            });
        } else {
            setStudents([]);
            setClassName('');
        }
    }, [selectedRecordKey, teacherName]);

    const handleExport = async () => {
        if (students.length === 0) {
            alert('يرجى اختيار سجل يحتوي على طلاب أولاً.');
            return;
        }
        if (!amiriFontBase64) {
            alert('الخط العربي لم يتم تحميله بعد، يرجى الانتظار قليلاً والمحاولة مرة أخرى.');
            return;
        }

        setIsExporting(true);
        setExportProgress(0);
        setExportMessage('بدء عملية التصدير...');

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        doc.addFileToVFS('Amiri-Regular.ttf', amiriFontBase64);
        doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
        doc.setFont('Amiri');
        
        const pageHeight = doc.internal.pageSize.getHeight();
        const topMargin = 15; // Top margin from page edge
        const bottomMargin = 10; // Bottom margin from page edge

        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            
            if (i > 0) {
                doc.addPage();
            }

            // --- Draw Page Header ---
            doc.setFontSize(16);
            doc.text('ورقة إجابة الطالب', 105, topMargin, { align: 'center' });
            
            const studentInfoY = topMargin + 10;
            doc.setFontSize(12);
            doc.text(`اسم الطالب: ${student.name}`, 200, studentInfoY, { align: 'right' });
            doc.text(`الشعبة: ${className}`, 45, studentInfoY, { align: 'right' });
            
            const lineY = studentInfoY + 3;
            doc.line(10, lineY, 200, lineY);
            // --- End Page Header ---

            // --- Dynamic Question Layout Calculation ---
            const questionsStartY = lineY + 4;
            const availableHeight = pageHeight - questionsStartY - bottomMargin;
            
            if (availableHeight <= 0) {
                console.error("Not enough space on the page for questions.");
                setIsExporting(false);
                alert("خطأ: لا توجد مساحة كافية في الصفحة لرسم الأسئلة. حاول تقليل عدد الأسئلة.");
                return;
            }

            const totalHeightPerQuestion = availableHeight / numQuestions;
            
            if (totalHeightPerQuestion < 15) { // 15mm minimum height
                console.warn(`Calculated height per question (${totalHeightPerQuestion}mm) is very small. The output might be cramped.`);
            }

            const boxMargin = Math.max(1, Math.min(3, totalHeightPerQuestion * 0.1));
            const boxHeight = totalHeightPerQuestion - boxMargin;

            // --- Draw Questions ---
            for (let qIndex = 0; qIndex < numQuestions; qIndex++) {
                const qNum = qIndex + 1;
                const y = questionsStartY + (qIndex * totalHeightPerQuestion);
                
                doc.setDrawColor(180, 180, 180);
                doc.rect(10, y, 190, boxHeight);

                const textBaselineShift = 2.5;
                
                doc.setFontSize(14);
                doc.text(`س${qNum}:`, 198, y + boxHeight * 0.4 - textBaselineShift, { align: 'right' });
        
                doc.setFontSize(12);
                const optionTopY = y + boxHeight * 0.45 - textBaselineShift;
                const optionBottomY = y + boxHeight * 0.8 - textBaselineShift;
                doc.text('.A', 180, optionTopY);
                doc.text('.C', 180, optionBottomY);
                doc.text('.B', 125, optionTopY);
                doc.text('.D', 125, optionBottomY);
                
                const answerBoxHeight = 10;
                const answerBoxY = y + (boxHeight - answerBoxHeight) / 2;
                doc.setFontSize(14);
                doc.text('الجواب:', 60, answerBoxY + answerBoxHeight / 2 + textBaselineShift);
                doc.setDrawColor(0, 0, 0);
                doc.rect(20, answerBoxY, 30, answerBoxHeight);
            }
            
            const progress = ((i + 1) / students.length) * 100;
            setExportProgress(progress);
            setExportMessage(`جاري تجهيز ورقة الطالب: ${student.name}`);
            await new Promise(resolve => setTimeout(resolve, 20));
        }

        doc.save(`اوراق_اجابة_${className || 'الطلاب'}.pdf`);
        setIsExporting(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {isExporting && <ProgressBar progress={exportProgress} message={exportMessage} />}

            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-800">تصدير نماذج فارغة لأوراق امتحان الطالب</h1>
                <p className="text-gray-500 mt-1">جهّز أوراق إجابة موحدة لطلابك متوافقة مع نظام التدقيق الآلي.</p>
            </div>
            
            <div className="p-4 bg-teal-50 border-r-4 border-teal-500 text-teal-800 rounded-lg shadow-sm">
                <h3 className="font-bold text-lg mb-2">الأستاذ الفاضل،</h3>
                <p className="mb-3">هذه الصفحة مخصصة لتجهيز وتصدير نماذج إجابات موحدة لطلابك. مصممة لتتوافق مع نظام التدقيق الآلي وتسهل عليك عملية إجراء الاختبارات.</p>
                <h4 className="font-semibold mb-2">مميزات هذه النماذج:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong className="font-semibold">شخصية لكل طالب:</strong> يتم إنشاء ورقة خاصة لكل طالب تحتوي على اسمه وشعبته، مما يقلل الأخطاء ويسهل التنظيم.</li>
                    <li><strong className="font-semibold">سهولة الاستخدام:</strong> يمكن طباعة الأوراق وتوزيعها مباشرة. الطالب يحتاج فقط لتلوين حرف الإجابة الصحيحة في المربع المخصص.</li>
                    <li><strong className="font-semibold">توفير وتوزيع رقمي:</strong> يمكنك إرسال ملف PDF المُصدَّر إلى طلابك، مما يخفف من طباعة وتوزيع الأوراق ويختصر التكاليف والجهد.</li>
                    <li><strong className="font-semibold">نموذج موحد ومتعدد الاستخدامات:</strong> التصميم قياسي ويمكن استخدامه لمختلف المواد الدراسية، مما يجعله أداة فعالة لجميع المدرسين في المدرسة.</li>
                </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Section title="1. اختيار قائمة الطلاب" icon="list">
                    <div className="space-y-3">
                        <label htmlFor="record-select" className="font-semibold text-gray-700">اختر سجل الدرجات المحفوظ:</label>
                        <select
                            id="record-select"
                            value={selectedRecordKey}
                            onChange={e => setSelectedRecordKey(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md bg-white focus:ring-2 focus:ring-teal-500"
                        >
                            <option value="">-- اختر سجلاً --</option>
                            {Object.entries(savedRecords).map(([key, name]) => (
                                <option key={key} value={key}>{name}</option>
                            ))}
                        </select>
                        <div className="p-3 bg-gray-100 rounded-md text-center text-gray-700">
                           تم تحميل <span className="font-bold text-teal-600">{students.length}</span> طالب من سجل: <span className="font-bold">{savedRecords[selectedRecordKey] || '-'}</span>
                        </div>
                    </div>
                </Section>
                
                <Section title="2. تجهيز وتصدير الملف" icon="settings">
                    <div className="space-y-3">
                        <label htmlFor="question-count" className="font-semibold text-gray-700">عدد الأسئلة في الورقة:</label>
                        <input
                            id="question-count"
                            type="number"
                            value={numQuestions}
                            onChange={e => setNumQuestions(parseInt(e.target.value, 10) || 0)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500"
                            min="1"
                        />
                        <p className="text-xs text-gray-500 bg-yellow-50 p-2 rounded-md border border-yellow-200">
                            <strong>ملاحظة:</strong> تم تحديد العدد تلقائياً بناءً على آخر مفتاح إجابة تم إنشاؤه في صفحة مدقق الاختبارات. يمكنك تغييره حسب الحاجة.
                        </p>
                    </div>
                </Section>
            </div>
            
            <div className="mt-4">
                <button 
                    onClick={handleExport}
                    disabled={students.length === 0 || isExporting}
                    className="w-full flex items-center justify-center gap-3 bg-teal-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-lg shadow-md"
                >
                    <Icon name="pdf-export" className="w-6 h-6" />
                    <span>تصدير ملف PDF لجميع الطلاب</span>
                </button>
            </div>
        </div>
    );
}