import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GradebookState, Student, CustomColumn, Teacher } from '../types';
import { gradebooksRef } from '../services/firebaseService';
import Icon from './Icon';

// Declare global vars from CDN scripts
declare global {
  interface Window {
    jspdf: any;
    XLSX: any;
    html2canvas: any;
  }
}

// Initial State Definition
const getInitialState = (): GradebookState => ({
    info: { schoolName: '', teacherName: '', subjectName: '', className: '', year: '2025-2026', examMaxGrade: 100 },
    students: [],
    semesters: [
        { months: [{ customColumns: [] }, { customColumns: [] }] },
        { months: [{ customColumns: [] }, { customColumns: [] }] }
    ]
});


interface GradebookProps {
    teacher: Teacher;
}

// --- Main Component ---
export default function Gradebook({ teacher }: GradebookProps) {
    const { name: teacherName, subject: subjectName, grades: teacherGrades, id: teacherId } = teacher;

    const [view, setView] = useState<'list' | 'detail'>('list');
    const [activeRecordKey, setActiveRecordKey] = useState<string | null>(null);
    const [gradebookState, setGradebookState] = useState<GradebookState>(getInitialState());
    
    // States for the list view
    const [savedRecords, setSavedRecords] = useState<Record<string, GradebookState['info']>>({});
    const [newRecordClass, setNewRecordClass] = useState<string>(teacherGrades[0] || '');
    const [newRecordSection, setNewRecordSection] = useState<string>('');
    const [isLoadingList, setIsLoadingList] = useState(true);

    // --- Data Loading and Management ---
    const loadSavedRecordsList = useCallback(() => {
        if (!teacherId) {
            setSavedRecords({});
            setIsLoadingList(false);
            return;
        }
        setIsLoadingList(true);
        gradebooksRef.child(teacherId).once('value', (snapshot) => {
            const recordsData = snapshot.val();
            const loadedRecords: Record<string, GradebookState['info']> = {};
            if (recordsData) {
                Object.keys(recordsData).forEach(key => {
                    loadedRecords[key] = recordsData[key].info || {};
                });
            }
            setSavedRecords(loadedRecords);
        }).catch(error => {
            console.error("Firebase: could not load records list", error);
            setSavedRecords({});
        }).finally(() => {
            setIsLoadingList(false);
        });
    }, [teacherId]);

    useEffect(() => {
        loadSavedRecordsList();
    }, [loadSavedRecordsList]);

    const handleGoToRecord = (key: string) => {
        setIsLoadingList(true);
        gradebooksRef.child(teacherId).child(key).once('value', (snapshot) => {
            if (snapshot.exists()) {
                const savedState = snapshot.val();
                const initialState = getInitialState();
                
                const mergedState: GradebookState = {
                    info: { ...initialState.info, ...(savedState.info || {}) },
                    students: (savedState.students || []).map((s: any) => ({ ...s, grades: s.grades || {} })),
                    semesters: savedState.semesters || initialState.semesters
                };
                
                setGradebookState(mergedState);
                setActiveRecordKey(key);
                setView('detail');
            } else {
                alert('فشل في تحميل السجل. لم يتم العثور عليه.');
            }
        }).catch(error => {
            alert('حدث خطأ أثناء تحميل السجل.');
            console.error("Firebase: Failed to load record:", error);
        }).finally(() => {
            setIsLoadingList(false);
        });
    };

    const handleCreateNewRecord = () => {
        if (!newRecordClass || !newRecordSection) {
            alert('يرجى اختيار الصف وإدخال اسم للشعبة.');
            return;
        }
        const key = `${newRecordClass}_${newRecordSection.trim()}`;
        if (savedRecords[key]) {
            alert('يوجد سجل محفوظ بنفس هذا الاسم. يرجى اختيار اسم مختلف.');
            return;
        }

        const newState = getInitialState();
        newState.info = {
            ...newState.info,
            teacherName: teacherName,
            subjectName: subjectName,
            className: `${newRecordClass} / ${newRecordSection.trim()}`
        };

        setIsLoadingList(true);
        gradebooksRef.child(teacherId).child(key).set(newState).then(() => {
            setGradebookState(newState);
            setActiveRecordKey(key);
            setView('detail');
            loadSavedRecordsList(); // Refresh list in the background
        }).catch(error => {
            alert('حدث خطأ أثناء إنشاء السجل الجديد.');
            console.error("Firebase: Failed to create new record:", error);
        }).finally(() => {
            setIsLoadingList(false);
        });
    };
    
    const handleDeleteRecord = (key: string) => {
        if (window.confirm(`هل أنت متأكد من حذف السجل "${key.replace(/_/g, ' - ')}"? لا يمكن التراجع عن هذا الإجراء.`)) {
            setIsLoadingList(true);
            gradebooksRef.child(teacherId).child(key).remove().then(() => {
                alert('تم حذف السجل المحدد.');
                loadSavedRecordsList();
            }).catch(error => {
                alert('حدث خطأ أثناء حذف السجل.');
                console.error("Firebase: Failed to delete record:", error);
            }).finally(() => {
                 setIsLoadingList(false);
            });
        }
    };
    
    const handleSaveRecord = (stateToSave: GradebookState, silent = false): Promise<boolean> => {
        return new Promise((resolve) => {
            if (!activeRecordKey) {
                if (!silent) alert('خطأ: لا يوجد سجل نشط للحفظ.');
                resolve(false);
                return;
            }
            if (!silent) setIsLoadingList(true);
    
            gradebooksRef.child(teacherId).child(activeRecordKey).set(stateToSave).then(() => {
                if (!silent) {
                    alert(`تم حفظ التغييرات للسجل "${activeRecordKey.replace(/_/g, ' - ')}" بنجاح!`);
                }
                setGradebookState(stateToSave);
                loadSavedRecordsList();
                if (!silent) setIsLoadingList(false);
                resolve(true);
            }).catch(error => {
                if (!silent) alert('حدث خطأ أثناء حفظ السجل.');
                console.error("Firebase: Failed to save record:", error);
                if (!silent) setIsLoadingList(false);
                resolve(false);
            });
        });
    };


    if (view === 'list') {
        return (
            <div className="max-w-4xl mx-auto space-y-6 p-4">
                 {isLoadingList && <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"><div className="text-lg font-semibold">...جاري التحميل</div></div>}
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-800">إدارة سجلات الدرجات</h1>
                    <p className="text-gray-500 mt-1">قم بإنشاء سجل جديد أو اختر سجلاً محفوظًا للعمل عليه.</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h2 className="text-xl font-bold text-teal-700 mb-4">إنشاء سجل جديد</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">الصف</label>
                            <select value={newRecordClass} onChange={e => setNewRecordClass(e.target.value)} className="w-full p-2 border rounded-md bg-white">
                                {teacherGrades.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                        </div>
                         <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الشعبة</label>
                             <input type="text" value={newRecordSection} onChange={e => setNewRecordSection(e.target.value)} placeholder="مثال: أ, ب, 1, 2" className="w-full p-2 border rounded-md" />
                        </div>
                        <div className="md:col-span-1">
                            <button onClick={handleCreateNewRecord} disabled={isLoadingList || !newRecordClass || !newRecordSection} className="w-full bg-teal-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-teal-700 disabled:bg-gray-400">
                                <Icon name="plus" className="inline w-5 h-5 ml-2"/>
                                إنشاء سجل جديد
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">السجلات المحفوظة</h2>
                    <div className="space-y-3">
                        {Object.keys(savedRecords).length > 0 ? (
                            Object.keys(savedRecords).map(key => (
                                <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border hover:shadow-md transition-shadow">
                                    <div>
                                        <p className="font-bold text-gray-700">{savedRecords[key]?.className || key.replace(/_/g, ' - ')}</p>
                                        <p className="text-sm text-gray-500">المادة: {savedRecords[key]?.subjectName || subjectName}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => handleGoToRecord(key)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700 text-sm">الدخول للسجل</button>
                                        <button onClick={() => handleDeleteRecord(key)} className="bg-red-100 text-red-700 p-2 rounded-md hover:bg-red-200"><Icon name="trash" className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 p-4">لا توجد سجلات محفوظة حاليًا.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (view === 'detail') {
        return <GradebookDetailView 
                  initialState={gradebookState} 
                  onSave={handleSaveRecord} 
                  onBack={() => setView('list')} 
                  isLoading={isLoadingList}
                />;
    }

    return null;
}


// --- Detail View Component ---
interface GradebookDetailViewProps {
    initialState: GradebookState;
    onSave: (state: GradebookState, silent?: boolean) => Promise<boolean>;
    onBack: () => void;
    isLoading: boolean;
}

function GradebookDetailView({ initialState, onSave, onBack, isLoading }: GradebookDetailViewProps) {
    const [state, setState] = useState<GradebookState>(initialState);
    const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
    const [pasteNamesValue, setPasteNamesValue] = useState<string>('');
    const importInputRef = useRef<HTMLInputElement>(null);
    const [isSavingOnBack, setIsSavingOnBack] = useState(false);
    
    // Export states
    const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
    const [isExporting, setIsExporting] = useState(false);
    const [exportMessage, setExportMessage] = useState('');

    // Sync state if initial state changes (e.g., loading a different record)
    useEffect(() => {
        setState(initialState);
    }, [initialState]);

    const updateState = (updater: (draft: GradebookState) => void) => {
        setState(prevState => {
            const newState: GradebookState = JSON.parse(JSON.stringify(prevState));
            updater(newState);
            return newState;
        });
    };
    
    const handleBackAndSave = async () => {
        setIsSavingOnBack(true);
        const success = await onSave(state, true); // silent save
        setIsSavingOnBack(false);
        if (success) {
            onBack();
        } else {
            alert('فشل حفظ التغييرات تلقائيًا. يرجى المحاولة مرة أخرى باستخدام زر "حفظ التغييرات".');
        }
    };
    
    // All the state manipulation functions from the original component
    const addStudentRow = (name = '') => {
        updateState(draft => {
            const newId = draft.students.length > 0 ? Math.max(...draft.students.map(s => s.id)) + 1 : 1;
            draft.students.push({ id: newId, name: name, grades: {} });
        });
    };
    
    const removeStudent = (studentId: number) => {
        if (window.confirm('هل أنت متأكد من حذف هذا الطالب؟ سيتم حذف جميع درجاته بشكل نهائي.')) {
            // Create a new state object to avoid direct mutation
            const newState: GradebookState = JSON.parse(JSON.stringify(state));
            const studentIndex = newState.students.findIndex(s => s.id === studentId);
            
            if (studentIndex > -1) {
                // Remove the student from the new state object
                newState.students.splice(studentIndex, 1);
                
                // Update the UI optimistically
                setState(newState);
                
                // Persist the change to the database silently
                onSave(newState, true);
            }
        }
    };

    const addColumn = (semIndex: number, monthIndex: number) => {
        updateState(draft => {
            draft.semesters[semIndex].months[monthIndex].customColumns.push({ title: 'نشاط', max: 25 });
        });
    };
    
    const removeColumn = (semIndex: number, monthIndex: number, colIndex: number) => {
        updateState(draft => {
            const monthColumns = draft.semesters[semIndex].months[monthIndex].customColumns;
            monthColumns.splice(colIndex, 1);
            // Re-key grades for remaining columns to prevent gaps
            draft.students.forEach(student => {
                 for (let i = colIndex; i < monthColumns.length; i++) {
                    const oldKey = `s${semIndex}-m${monthIndex}-c${i + 1}`;
                    const newKey = `s${semIndex}-m${monthIndex}-c${i}`;
                    if (student.grades[oldKey] !== undefined) {
                        student.grades[newKey] = student.grades[oldKey];
                        delete student.grades[oldKey];
                    }
                }
                 delete student.grades[`s${semIndex}-m${monthIndex}-c${monthColumns.length}`];
            });
        });
    };

    const updateInfo = (field: keyof GradebookState['info'], value: string) => {
        updateState(draft => { (draft.info as any)[field] = value; });
    };

    const updateExamMaxGrade = (value: string) => {
        updateState(draft => {
            let numValue = parseInt(value, 10);
            if (isNaN(numValue) || numValue < 0) numValue = 0;
            if (numValue > 100) numValue = 100;
            draft.info.examMaxGrade = numValue;
        });
    };

    const updateColumn = (semIndex: number, monthIndex: number, colIndex: number, field: 'title' | 'max', value: string | number) => {
        updateState(draft => {
            const column = draft.semesters[semIndex].months[monthIndex].customColumns[colIndex];
            if (field === 'title' && typeof value === 'string') column.title = value;
            else if (field === 'max' && typeof value === 'number') column.max = value;
        });
    };
    
    const updateStudentName = (studentId: number, name: string) => {
        updateState(draft => {
            const student = draft.students.find(s => s.id === studentId);
            if (student) student.name = name;
        });
    };
    
    const updateGrade = (studentId: number, key: string, value: string) => {
        updateState(draft => {
            const student = draft.students.find(s => s.id === studentId);
            if (student) {
                student.grades[key] = value === '' ? null : parseInt(value, 10);
            }
        });
    };

    const copyToAllMonths = () => {
        updateState(draft => {
            const sourceCols = JSON.parse(JSON.stringify(draft.semesters[0].months[0].customColumns));
            draft.semesters[0].months[1].customColumns = JSON.parse(JSON.stringify(sourceCols));
            draft.semesters[1].months[0].customColumns = JSON.parse(JSON.stringify(sourceCols));
            draft.semesters[1].months[1].customColumns = JSON.parse(JSON.stringify(sourceCols));
        });
    };
    
    const handlePasteNames = () => {
        const names = pasteNamesValue.split('\n').map(name => name.trim()).filter(name => name);
        if (names.length > 0) {
            updateState(draft => {
                let maxId = draft.students.length > 0 ? Math.max(...draft.students.map(s => s.id)) : 0;
                const newStudents = names.map(name => ({
                    id: ++maxId,
                    name: name,
                    grades: {}
                }));
                draft.students.push(...newStudents);
            });
        }
        setPasteNamesValue('');
        setIsPasteModalOpen(false);
    };

    const handleImportClick = () => {
        importInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = window.XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: (string[])[] = window.XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                const names = json
                    .slice(1) // Ignore the first row (header)
                    .map(row => row[0])
                    .filter(name => typeof name === 'string' && name.trim() !== '');
                
                if (names.length > 0) {
                     updateState(draft => {
                        let maxId = draft.students.length > 0 ? Math.max(...draft.students.map(s => s.id)) : 0;
                        const newStudents = names.map(name => ({ id: ++maxId, name, grades: {} }));
                        draft.students.push(...newStudents);
                    });
                    alert(`تم استيراد ${names.length} طالب بنجاح.`);
                } else {
                    alert('لم يتم العثور على أسماء في العمود الأول من ملف Excel (بعد تجاهل الصف الأول).');
                }
            } catch (error) {
                console.error("Error importing from Excel:", error);
                alert("حدث خطأ أثناء استيراد الملف. يرجى التأكد من أن الملف بصيغة Excel صحيحة.");
            }
        };
        reader.readAsBinaryString(file);
        if(e.target) e.target.value = ''; // Reset input to allow re-importing same file
    };

    const handleGradeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, studentIndex: number, key: string) => {
        if (e.key === 'Enter' || e.key === 'ArrowDown') {
            e.preventDefault();
            const nextStudent = state.students[studentIndex + 1];
            if (nextStudent) {
                const nextInputId = `grade-input-${nextStudent.id}-${key}`;
                const nextInput = document.getElementById(nextInputId) as HTMLInputElement;
                if (nextInput) {
                    nextInput.focus();
                    nextInput.select();
                }
            }
        }
    };
    
    // --- Calculation Functions ---
    const calculateAllGrades = (student: Student) => {
        const calcs: Record<string, any> = {};
        
        const calculateMonth = (semIdx: number, monthIdx: number) => {
            let dailyTotal = 0;
            state.semesters[semIdx].months[monthIdx].customColumns.forEach((col, i) => {
                dailyTotal += student.grades[`s${semIdx}-m${monthIdx}-c${i}`] || 0;
            });
            const exam = student.grades[`s${semIdx}-m${monthIdx}-exam`] || 0;
            const dailyMax = state.semesters[semIdx].months[monthIdx].customColumns.reduce((acc, c) => acc + c.max, 0);
            const examMax = state.info.examMaxGrade;

            let displayAvg: number;
            let normalizedAvg: number;

            if (dailyMax < 100 && examMax < 100 && dailyMax > 0 && examMax > 0) {
                displayAvg = dailyTotal + exam;
                const combinedMax = dailyMax + examMax;
                normalizedAvg = combinedMax > 0 ? (displayAvg / combinedMax) * 100 : 0;
            } else {
                const normalizedDaily = dailyMax > 0 ? (dailyTotal / dailyMax) * 100 : 0;
                const normalizedExam = examMax > 0 ? (exam / examMax) * 100 : 0;
                const avg = (normalizedDaily + normalizedExam) / 2;
                displayAvg = Math.round(avg);
                normalizedAvg = avg;
            }
            return { dailyTotal, normalizedAvg: Math.round(normalizedAvg), displayAvg: Math.round(displayAvg) };
        };

        const s0m0 = calculateMonth(0, 0);
        const s0m1 = calculateMonth(0, 1);
        calcs.s0_m0_dailyTotal = s0m0.dailyTotal;
        calcs.s0_m0_displayAvg = s0m0.displayAvg;
        calcs.s0_m1_dailyTotal = s0m1.dailyTotal;
        calcs.s0_m1_displayAvg = s0m1.displayAvg;
        calcs.s0_avg = Math.round((s0m0.normalizedAvg + s0m1.normalizedAvg) / 2);

        const s1m0 = calculateMonth(1, 0);
        const s1m1 = calculateMonth(1, 1);
        calcs.s1_m0_dailyTotal = s1m0.dailyTotal;
        calcs.s1_m0_displayAvg = s1m0.displayAvg;
        calcs.s1_m1_dailyTotal = s1m1.dailyTotal;
        calcs.s1_m1_displayAvg = s1m1.displayAvg;
        calcs.s1_avg = Math.round((s1m0.normalizedAvg + s1m1.normalizedAvg) / 2);

        const midYearGrade = student.grades['midYear'] || 0;
        calcs.yearlyEffort = Math.round((calcs.s0_avg + midYearGrade + calcs.s1_avg) / 3);
        const finalExamGrade = student.grades['finalExam'] || 0;
        calcs.finalGrade = Math.round((calcs.yearlyEffort + finalExamGrade) / 2);

        return calcs;
    };
    
    // --- Export Functions ---
    const generateExportHtml = (exportType: 'pdf' | 'word', pageBreakClass: string = 'page-break') => {
        const isPortraitPdf = exportType === 'pdf' && orientation === 'portrait';
        const chunkSize = orientation === 'landscape' ? 20 : 30;

        const studentChunks: Student[][] = [];
        for (let i = 0; i < state.students.length; i += chunkSize) {
            studentChunks.push(state.students.slice(i, i + chunkSize));
        }
        if (studentChunks.length === 0) {
            studentChunks.push([]);
        }

        const tableHtml = (semIndex: number, chunk: Student[], pageIndex: number) => {
            const info = state.info;
            const semester = state.semesters[semIndex];
            const month1Cols = semester.months[0].customColumns;
            const month2Cols = semester.months[1].customColumns;
            const getMonthlyAvgMax = (monthCols: CustomColumn[]) => (monthCols.reduce((a, b) => a + (b.max || 0), 0) + info.examMaxGrade > 100) ? 100 : monthCols.reduce((a, b) => a + (b.max || 0), 0) + info.examMaxGrade;
            const month1AvgMax = getMonthlyAvgMax(month1Cols);
            const month2AvgMax = getMonthlyAvgMax(month2Cols);

            return `
                <div class="info-header">
                    <div>مدرس المادة: ${info.teacherName}</div>
                    <div>الصف والشعبة: ${info.className}</div>
                    <div>المادة الدراسية: ${info.subjectName}</div>
                    <div>إدارة مدرسة: ${info.schoolName}</div>
                </div>
                <h3 class="table-title">الدرجات اليومية للفصل الدراسي ${semIndex === 0 ? 'الاول' : 'الثاني'} - العام الدراسي ${info.year}</h3>
                <table>
                    <thead>
                        <tr>
                            <th rowspan="3" style="background-color: #2E8B57; color: white;">ت</th>
                            <th rowspan="3" style="background-color: #2E8B57; color: white; min-width: 150px;">اسم الطالب</th>
                            <th colspan="${month1Cols.length + 3}" style="background-color: #B0E0E6;">الشهر الأول</th>
                            <th colspan="${month2Cols.length + 3}" style="background-color: #DDA0DD;">الشهر الثاني</th>
                            ${semIndex === 0 ? `
                                <th rowspan="3" style="background-color: #90EE90;">معدل الفصل الاول</th>
                                <th rowspan="3" style="background-color: #90EE90;">نصف السنة</th>
                            ` : `
                                <th rowspan="3" style="background-color: #DDA0DD;">معدل الفصل الثاني</th>
                                <th rowspan="3" style="background-color: #FFD700;">السعي السنوي</th>
                                <th rowspan="3" style="background-color: #FFD700;">الامتحان النهائي</th>
                                <th rowspan="3" style="background-color: #FFD700;">الدرجة النهائية</th>
                            `}
                        </tr>
                        <tr>
                            ${month1Cols.map(c => `<th style="background-color: #B0E0E6;">${c.title}</th>`).join('')}
                            <th style="background-color: #B0E0E6;">م.يومي</th><th style="background-color: #B0E0E6;">تحريري</th><th style="background-color: #B0E0E6;">المعدل</th>
                            ${month2Cols.map(c => `<th style="background-color: #DDA0DD;">${c.title}</th>`).join('')}
                            <th style="background-color: #DDA0DD;">م.يومي</th><th style="background-color: #DDA0DD;">تحريري</th><th style="background-color: #DDA0DD;">المعدل</th>
                        </tr>
                        <tr>
                            ${month1Cols.map(c => `<th>${c.max || 0}</th>`).join('')}
                            <th>${month1Cols.reduce((a, b) => a + (b.max || 0), 0)}</th><th>${info.examMaxGrade}</th><th>${month1AvgMax}</th>
                            ${month2Cols.map(c => `<th>${c.max || 0}</th>`).join('')}
                            <th>${month2Cols.reduce((a, b) => a + (b.max || 0), 0)}</th><th>${info.examMaxGrade}</th><th>${month2AvgMax}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chunk.map((student, index) => {
                            const calcs = calculateAllGrades(student);
                            const month1DailyTotal = semIndex === 0 ? calcs.s0_m0_dailyTotal : calcs.s1_m0_dailyTotal;
                            const month1DisplayAvg = semIndex === 0 ? calcs.s0_m0_displayAvg : calcs.s1_m0_displayAvg;
                            const month2DailyTotal = semIndex === 0 ? calcs.s0_m1_dailyTotal : calcs.s1_m1_dailyTotal;
                            const month2DisplayAvg = semIndex === 0 ? calcs.s0_m1_displayAvg : calcs.s1_m1_displayAvg;
                            
                            return `
                                <tr>
                                    <td>${pageIndex * chunkSize + index + 1}</td>
                                    <td style="text-align: right; padding-right: 5px; white-space: nowrap;">${student.name}</td>
                                    ${month1Cols.map((c, i) => `<td>${student.grades[`s${semIndex}-m0-c${i}`] != null ? student.grades[`s${semIndex}-m0-c${i}`] : ''}</td>`).join('')}
                                    <td>${month1DailyTotal}</td>
                                    <td>${student.grades[`s${semIndex}-m0-exam`] != null ? student.grades[`s${semIndex}-m0-exam`] : ''}</td>
                                    <td style="font-weight: bold;">${month1DisplayAvg}</td>
                                    ${month2Cols.map((c, i) => `<td>${student.grades[`s${semIndex}-m1-c${i}`] != null ? student.grades[`s${semIndex}-m1-c${i}`] : ''}</td>`).join('')}
                                    <td>${month2DailyTotal}</td>
                                    <td>${student.grades[`s${semIndex}-m1-exam`] != null ? student.grades[`s${semIndex}-m1-exam`] : ''}</td>
                                    <td style="font-weight: bold;">${month2DisplayAvg}</td>
                                    ${semIndex === 0 ? `
                                        <td style="font-weight: bold;">${calcs.s0_avg}</td>
                                        <td>${student.grades['midYear'] != null ? student.grades['midYear'] : ''}</td>
                                    ` : `
                                        <td style="font-weight: bold;">${calcs.s1_avg}</td>
                                        <td style="font-weight: bold;">${calcs.yearlyEffort}</td>
                                        <td>${student.grades['finalExam'] != null ? student.grades['finalExam'] : ''}</td>
                                        <td style="font-weight: bold;">${calcs.finalGrade}</td>
                                    `}
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        };

        const allPages: string[] = [];
        studentChunks.forEach((chunk, pageIndex) => {
            allPages.push(`<div class="export-page">${tableHtml(0, chunk, pageIndex)}</div>`);
        });
        studentChunks.forEach((chunk, pageIndex) => {
            allPages.push(`<div class="export-page">${tableHtml(1, chunk, pageIndex)}</div>`);
        });

        const styles = `
            <style>
                ${exportType === 'word' ? `
                    @page WordSection1 {
                        size: ${orientation === 'landscape' ? '297mm 210mm' : '210mm 297mm'};
                        margin: 1cm;
                    }
                    div.WordSection1 {
                        page: WordSection1;
                    }
                ` : ''}
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body { font-family: 'Tajawal', sans-serif; direction: rtl; }
                .export-page { 
                    width: ${orientation === 'landscape' ? '297mm' : '210mm'}; 
                    height: ${orientation === 'landscape' ? '210mm' : '297mm'}; 
                    padding: 10mm 10mm 20mm 10mm;
                    box-sizing: border-box; 
                    background: white; 
                    display: flex;
                    flex-direction: column;
                }
                .info-header { display: flex; justify-content: space-between; align-items: center; font-size: ${isPortraitPdf ? '11px' : '14px'}; font-weight: 700; margin-bottom: 1rem; color: black; }
                .table-title { text-align: center; font-weight: 700; margin-bottom: 0.5rem; color: black; }
                table { border-collapse: collapse; width: 100%; font-size: ${isPortraitPdf ? '8px' : '11px'}; margin-bottom: 1rem; }
                th, td { 
                    border: 1px solid black; 
                    padding: ${isPortraitPdf ? '8px 4px' : '6px'};
                    text-align: center; 
                    vertical-align: middle; 
                    font-weight: 700;
                    color: black;
                }
                th { background-color: #f2f2f2; }
                .page-break { page-break-before: always; }
            </style>
        `;

        const pagesContent = allPages.join(`<div class="${pageBreakClass}"></div>`);
        const bodyContent = exportType === 'word' ? `<div class="WordSection1">${pagesContent}</div>` : pagesContent;
        return `<html><head><meta charset="UTF-8">${styles}</head><body>${bodyContent}</body></html>`;
    };
    

    const handleExport = async (type: 'pdf' | 'word') => {
        setIsExporting(true);
        setExportMessage('جاري تجهيز الملف للتصدير...');
        await new Promise(res => setTimeout(res, 50));

        if (type === 'word') {
            const html = generateExportHtml('word', 'page-break');
            const blob = new Blob([html], { type: 'application/msword' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'sijil-al-darajat.doc';
            a.click();
            URL.revokeObjectURL(url);
            setIsExporting(false);
            return;
        }

        if (type === 'pdf') {
            try {
                const { jsPDF } = window.jspdf;
                const fullHtml = generateExportHtml('pdf', '');
                
                const container = document.createElement('div');
                container.style.position = 'absolute';
                container.style.left = '-9999px';
                document.body.appendChild(container);
                container.innerHTML = fullHtml;
                
                const pages = container.querySelectorAll('.export-page');
                if (pages.length === 0) {
                    throw new Error("لم يتم إنشاء محتوى للتصدير.");
                }

                const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4', compress: true });
                
                for (let i = 0; i < pages.length; i++) {
                    setExportMessage(`جاري معالجة الصفحة ${i + 1} من ${pages.length}...`);
                    const page = pages[i] as HTMLElement;
                    const canvas = await window.html2canvas(page, { scale: 2, useCORS: true });
                    const imgData = canvas.toDataURL('image/jpeg', 0.85);
                    
                    const pdfWidth = pdf.internal.pageSize.getWidth();
                    const pdfHeight = pdf.internal.pageSize.getHeight();
                    
                    if (i > 0) {
                        pdf.addPage(undefined, orientation);
                    }
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                }
                
                pdf.save('sijil-al-darajat.pdf');
                document.body.removeChild(container);
            } catch (error) {
                console.error("PDF Export Error:", error);
                alert("حدث خطأ أثناء تصدير ملف PDF.");
            } finally {
                setIsExporting(false);
            }
        }
    };
    
    // --- Render Functions ---
    const renderPage = (semIndex: number) => {
        const info = state.info;
        const semester = state.semesters[semIndex];
        const month1Cols = semester.months[0].customColumns;
        const month2Cols = semester.months[1].customColumns;

        const getMonthlyAvgMax = (monthCols: CustomColumn[]) => {
            const dailyMax = monthCols.reduce((a, b) => a + (b.max || 0), 0);
            const examMax = state.info.examMaxGrade;
            if (dailyMax < 100 && examMax < 100 && dailyMax > 0 && examMax > 0) {
                return dailyMax + examMax;
            }
            return 100;
        };
        const month1AvgMax = getMonthlyAvgMax(month1Cols);
        const month2AvgMax = getMonthlyAvgMax(month2Cols);
    
        const createInputCell = (key: string, max: number, colClass = '', studentId: number, studentGrade: number | null, studentIndex: number) => (
            <td className={colClass}>
                <input 
                    id={`grade-input-${studentId}-${key}`}
                    type="text" 
                    pattern="\d*" 
                    maxLength={3} 
                    className={`grade-input ${colClass}`} 
                    defaultValue={studentGrade != null ? studentGrade : ''} 
                    onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const input = e.currentTarget;
                        let value = input.value.replace(/[^0-9]/g, '');
                        if (max && parseInt(value, 10) > max) {
                            value = String(max);
                        }
                        input.value = value;
                        updateGrade(studentId, key, value);

                        const numericValue = parseInt(value, 10);
                        if (!isNaN(numericValue) && numericValue >= 11) {
                            const nextStudent = state.students[studentIndex + 1];
                            if (nextStudent) {
                                const nextInputId = `grade-input-${nextStudent.id}-${key}`;
                                const nextInput = document.getElementById(nextInputId) as HTMLInputElement;
                                if (nextInput) {
                                    nextInput.focus();
                                    nextInput.select();
                                }
                            }
                        }
                    }} 
                    onKeyDown={(e) => handleGradeInputKeyDown(e, studentIndex, key)}
                    disabled={isLoading} 
                />
            </td>
        );

        return (
            <div className="table-container">
                <div className="info-header">
                    <div>مدرس المادة: ${info.teacherName}</div>
                    <div>الصف والشعبة: ${info.className}</div>
                    <div>المادة الدراسية: ${info.subjectName}</div>
                    <div>إدارة مدرسة: ${info.schoolName}</div>
                </div>
                <h3 className="text-center font-bold mb-2">الدرجات اليومية للفصل الدراسي ${semIndex === 0 ? 'الاول' : 'الثاني'} - العام الدراسي ${info.year}</h3>
                <table className={semIndex === 0 ? 'table-first-semester' : 'table-second-semester'}>
                    <thead>
                        <tr>
                            <th rowSpan={3} style={{backgroundColor: '#006400', color: 'white'}}>ت</th>
                            <th rowSpan={3} style={{minWidth: '150px', backgroundColor: '#006400', color: 'white'}}>اسم الطالب</th>
                            <th colSpan={month1Cols.length > 0 ? month1Cols.length + 3 : 3} style={{backgroundColor: '#4682B4'}}>الشهر الأول</th>
                            <th colSpan={month2Cols.length > 0 ? month2Cols.length + 3 : 3} style={{backgroundColor: '#BA55D3'}}>الشهر الثاني</th>
                            {semIndex === 0 ? <>
                                <th rowSpan={3} style={{backgroundColor: '#3CB371'}}>معدل الفصل الاول</th>
                                <th rowSpan={3} style={{backgroundColor: '#3CB371'}}>نصف السنة</th>
                            </> : <>
                                <th rowSpan={3} style={{backgroundColor: '#BA55D3'}}>معدل الفصل الثاني</th>
                                <th rowSpan={3} style={{backgroundColor: '#FFD700'}}>السعي السنوي</th>
                                <th rowSpan={3} style={{backgroundColor: '#FFD700'}}>الامتحان النهائي</th>
                                <th rowSpan={3} style={{backgroundColor: '#FFD700'}}>الدرجة النهائية</th>
                            </>}
                        </tr>
                        <tr>
                            {month1Cols.map((c, i) => <th key={`s${semIndex}-m0-h${i}`} style={{backgroundColor: '#B0E0E6'}}>{c.title}</th>)}
                            <th style={{backgroundColor: '#B0E0E6'}}>مجموع اليومي</th><th style={{backgroundColor: '#B0E0E6'}}>التحريري</th><th style={{backgroundColor: '#B0E0E6'}}>المعدل</th>
                            {month2Cols.map((c, i) => <th key={`s${semIndex}-m1-h${i}`} style={{backgroundColor: '#DDA0DD'}}>{c.title}</th>)}
                            <th style={{backgroundColor: '#DDA0DD'}}>مجموع اليومي</th><th style={{backgroundColor: '#DDA0DD'}}>التحريري</th><th style={{backgroundColor: '#DDA0DD'}}>المعدل</th>
                        </tr>
                         <tr>
                            {month1Cols.map((c, i) => <th key={`s${semIndex}-m0-max${i}`}>{c.max || 0}</th>)}
                            <th>${month1Cols.reduce((a, b) => a + (b.max || 0), 0)}</th>
                            <th><input type="number" className="grade-input" value={state.info.examMaxGrade} onInput={e => updateExamMaxGrade(e.currentTarget.value)} max="100" min="0" disabled={isLoading}/></th>
                            <th>${month1AvgMax}</th>
                            {month2Cols.map((c, i) => <th key={`s${semIndex}-m1-max${i}`}>{c.max || 0}</th>)}
                            <th>${month2Cols.reduce((a, b) => a + (b.max || 0), 0)}</th>
                            <th><input type="number" className="grade-input" value={state.info.examMaxGrade} onInput={e => updateExamMaxGrade(e.currentTarget.value)} max="100" min="0" disabled={isLoading}/></th>
                            <th>${month2AvgMax}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {state.students.map((student, index) => {
                             const calcs = calculateAllGrades(student);
                             return (
                                <tr key={student.id}>
                                    <td>${index + 1}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '4px' }}>
                                            <input type="text" className="grade-input" defaultValue={student.name} onBlur={e => updateStudentName(student.id, e.target.value)} disabled={isLoading} />
                                            <button onClick={() => removeStudent(student.id)} className="delete-student-btn" title="حذف الطالب" disabled={isLoading}>
                                                <Icon name="trash" className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </td>
                                    {month1Cols.map((c, i) => createInputCell(`s${semIndex}-m0-c${i}`, c.max, '', student.id, student.grades[`s${semIndex}-m0-c${i}`], index))}
                                    <td style={{backgroundColor: '#f0f8ff'}}>{semIndex === 0 ? calcs.s0_m0_dailyTotal : calcs.s1_m0_dailyTotal}</td>
                                    {createInputCell(`s${semIndex}-m0-exam`, state.info.examMaxGrade, '', student.id, student.grades[`s${semIndex}-m0-exam`], index)}
                                    <td style={{fontWeight: 'bold', backgroundColor: '#e0f0ff'}}>{semIndex === 0 ? calcs.s0_m0_displayAvg : calcs.s1_m0_displayAvg}</td>
                                    
                                    {month2Cols.map((c, i) => createInputCell(`s${semIndex}-m1-c${i}`, c.max, '', student.id, student.grades[`s${semIndex}-m1-c${i}`], index))}
                                    <td style={{backgroundColor: '#fff0f5'}}>{semIndex === 0 ? calcs.s0_m1_dailyTotal : calcs.s1_m1_dailyTotal}</td>
                                    {createInputCell(`s${semIndex}-m1-exam`, state.info.examMaxGrade, '', student.id, student.grades[`s${semIndex}-m1-exam`], index)}
                                    <td style={{fontWeight: 'bold', backgroundColor: '#ffe4f1'}}>{semIndex === 0 ? calcs.s0_m1_displayAvg : calcs.s1_m1_displayAvg}</td>
                                    
                                    {semIndex === 0 ? <>
                                        <td style={{fontWeight: 'bold', backgroundColor: '#f0fff0'}}>{calcs.s0_avg}</td>
                                        {createInputCell('midYear', 100, 'cell-mid-year', student.id, student.grades['midYear'], index)}
                                    </> : <>
                                        <td style={{fontWeight: 'bold', backgroundColor: '#f0fff0'}}>{calcs.s1_avg}</td>
                                        <td style={{fontWeight: 'bold', backgroundColor: '#fffacd'}}>{calcs.yearlyEffort}</td>
                                        {createInputCell('finalExam', 100, 'cell-mid-year', student.id, student.grades['finalExam'], index)}
                                        <td style={{fontWeight: 'bold', backgroundColor: '#fffacd'}}>{calcs.finalGrade}</td>
                                    </>}
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    // --- Return JSX for Detail View ---
    return (
        <div className="bg-gray-50 relative">
             {(isLoading || isSavingOnBack || isExporting) && 
                <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 text-white p-4">
                    <h2 className="text-2xl font-bold mb-4">${isExporting ? 'جاري تصدير الملف...' : 'جاري الحفظ...'}</h2>
                     <svg className="animate-spin h-10 w-10 text-white mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <p className="text-lg font-semibold">${exportMessage}</p>
                    <p className="mt-4">${isSavingOnBack ? 'يتم حفظ بياناتك قبل العودة...' : (isExporting ? 'قد تستغرق العملية بضع لحظات...' : 'يرجى الانتظار...')}</p>
                </div>
            }

            {isPasteModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4" onClick={() => setIsPasteModalOpen(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold mb-4">لصق قائمة أسماء الطلاب</h3>
                        <p className="text-sm text-gray-600 mb-2">ألصق قائمة الأسماء هنا، مع التأكد من أن كل اسم في سطر منفصل.</p>
                        <textarea value={pasteNamesValue} onChange={e => setPasteNamesValue(e.target.value)} rows={10} className="w-full p-2 border rounded-md"></textarea>
                        <div className="mt-4 flex justify-end gap-2">
                            <button onClick={() => setIsPasteModalOpen(false)} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">إلغاء</button>
                            <button onClick={handlePasteNames} className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-teal-700">إضافة الطلاب</button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="p-4 bg-white shadow-md sticky top-0 z-10">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                    <button onClick={handleBackAndSave} disabled={isSavingOnBack} className="flex items-center gap-2 bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700">
                        <Icon name="arrow-right" className="w-5 h-5"/> العودة إلى قائمة السجلات
                    </button>
                     <div className="flex-grow flex flex-wrap items-center justify-center gap-3">
                        <button onClick={() => addStudentRow()} className="flex items-center gap-2 bg-blue-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-blue-700 transition-colors shadow text-base">
                            <Icon name="user" className="w-5 h-5"/>
                            إضافة طالب
                        </button>
                        <button onClick={() => setIsPasteModalOpen(true)} className="flex items-center gap-2 bg-indigo-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-indigo-700 transition-colors shadow text-base">
                            <Icon name="paste" className="w-5 h-5"/>
                            لصق قائمة طلاب
                        </button>
                        <input type="file" ref={importInputRef} onChange={handleFileImport} className="hidden" accept=".xlsx, .xls" />
                        <button onClick={handleImportClick} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-green-700 transition-colors shadow text-base">
                            <Icon name="upload" className="w-5 h-5"/>
                            استيراد من Excel
                        </button>
                     </div>
                     <button onClick={() => onSave(state)} disabled={isLoading} className="flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700">
                        <Icon name="check-circle" className="w-5 h-5"/> حفظ التغييرات
                    </button>
                 </div>
            </div>

            <div className="p-4 space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-md border">
                    <h3 className="text-lg font-bold mb-3 text-gray-700">المعلومات الأساسية للسجل</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <input type="text" placeholder="اسم المدرسة" value={state.info.schoolName} onChange={e => updateInfo('schoolName', e.target.value)} className="p-2 border rounded-md" disabled={isLoading} />
                        <input type="text" placeholder="العام الدراسي" value={state.info.year} onChange={e => updateInfo('year', e.target.value)} className="p-2 border rounded-md" disabled={isLoading} />
                        <input type="text" placeholder="اسم المدرس" value={state.info.teacherName} readOnly className="p-2 border rounded-md bg-gray-200" />
                        <input type="text" placeholder="المادة" value={state.info.subjectName} readOnly className="p-2 border rounded-md bg-gray-200" />
                        <input type="text" placeholder="الصف/الشعبة" value={state.info.className} readOnly className="p-2 border rounded-md bg-gray-200" />
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md border">
                    <h3 className="text-lg font-bold mb-3 text-gray-700">إعدادات الأعمدة (الشهر الأول)</h3>
                    <div className="flex flex-wrap items-start gap-4">
                        {state.semesters[0].months[0].customColumns.map((col, i) => (
                            <div key={i} className="p-2 border rounded-md bg-gray-50 relative">
                                <button onClick={() => removeColumn(0, 0, i)} className="absolute -top-2 -left-2 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">x</button>
                                <input type="text" value={col.title} onChange={e => updateColumn(0, 0, i, 'title', e.target.value)} className="p-1 border rounded-md w-24 mb-1" disabled={isLoading}/>
                                <input type="number" value={col.max} onChange={e => updateColumn(0, 0, i, 'max', parseInt(e.target.value) || 0)} className="p-1 border rounded-md w-24" disabled={isLoading}/>
                            </div>
                        ))}
                         <button onClick={() => addColumn(0, 0)} className="self-center flex items-center gap-2 bg-teal-500 text-white font-bold py-2.5 px-5 rounded-lg hover:bg-teal-600 transition-colors shadow">
                            <Icon name="plus" className="w-5 h-5"/>
                            إضافة عمود
                        </button>
                    </div>
                     <button onClick={copyToAllMonths} className="mt-3 text-sm bg-purple-100 text-purple-700 font-semibold px-3 py-1.5 rounded-md hover:bg-purple-200">تطبيق على كل الأشهر</button>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md border">
                    <h3 className="text-lg font-bold mb-3 text-gray-700">تصدير وطباعة</h3>
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-4">
                            <span className="font-semibold">اتجاه الورقة:</span>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="orientation" value="landscape" checked={orientation === 'landscape'} onChange={() => setOrientation('landscape')} /> أفقي
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="orientation" value="portrait" checked={orientation === 'portrait'} onChange={() => setOrientation('portrait')} /> عمودي
                            </label>
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={() => handleExport('pdf')} disabled={isExporting} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                                <Icon name="pdf-export" className="w-5 h-5"/> تصدير PDF
                            </button>
                            <button onClick={() => handleExport('word')} disabled={isExporting} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
                                <Icon name="word" className="w-5 h-5"/> تصدير Word
                            </button>
                        </div>
                    </div>
                </div>

                {renderPage(0)}
                {renderPage(1)}
            </div>
            <style>{`
                .gradebook-container { padding: 1rem; }
                .table-container { overflow-x: auto; background-color: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem;}
                table { border-collapse: collapse; width: 100%; font-size: 0.8rem; }
                th, td { border: 1px solid #ccc; padding: 0.3rem; text-align: center; vertical-align: middle; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .grade-input { width: 100%; border: none; text-align: center; background-color: transparent; padding: 0.2rem; border-radius: 3px; }
                .grade-input:focus { outline: 1px solid #4fd1c5; background-color: #e6fffa; }
                .info-header { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 0.5rem; font-size: 0.9rem; }
                .delete-student-btn {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    color: #9ca3af; /* gray-400 */
                    padding: 0 4px;
                    opacity: 0;
                    transition: opacity 0.2s, color 0.2s;
                    flex-shrink: 0;
                }
                .delete-student-btn:hover {
                    color: #ef4444; /* red-500 */
                }
                tr:hover .delete-student-btn {
                    opacity: 1;
                }
                .table-first-semester th, .table-first-semester td { border-color: #4682B4; }
                .table-second-semester th, .table-second-semester td { border-color: #BA55D3; }
            `}</style>
        </div>
    );
}
