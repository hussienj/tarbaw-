
import React, { useState, useMemo, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import LessonPlanForm, { EnglishLessonPlanner } from './components/LessonPlanForm';
import ExamGrader from './components/ExamGrader';
import Gradebook from './components/Gradebook';
import ExamGenerator from './components/ExamGenerator';
import AnswerSheetExporter from './components/AnswerSheetExporter';
import InteractiveTools from './components/InteractiveTools';
import EducationalEncyclopedia from './components/EducationalEncyclopedia';
import CoverEditor from './components/CoverEditor';
import { LessonPlanData, UserInputs, EnglishLessonPlanData, EnglishUserInputs, Teacher, AppData } from './types';
import { generatePlan } from './services/geminiService';
import { generateEnglishPlan } from './services/englishGeminiService';
import Icon from './components/Icon';
import { appDataRef, USAGE_LIMITS } from './services/firebaseService';
import firebase from 'firebase/compat/app';


// --- INITIAL STATE & HELPERS ---

const initialUserInputs: UserInputs = {
  class: '', date: '', chapterTitle: '', lessonTitle: '', 
  sessions: '1', teacherName: '', principalName: ''
};
const initialPlanContent: LessonPlanData = {
  learningOutcomes: [], priorKnowledge: '', materialsAndTools: [], vocabulary: [],
  teachingProcess: { warmUp: '', activity: '', explanation: '', assessment: '', expansion: '' },
  finalAssessment: '', homework: ''
};
const initialEnglishUserInputs: EnglishUserInputs = {
  unit: '', lesson: '', date: '', subject: '', className: '', teacherName: ''
};
const initialEnglishPlanContent: EnglishLessonPlanData = {
  objectives: [], procedures: [], materials: [], language: '', vocabulary: [], evaluation: '', homework: ''
};

const initialAppData: AppData = {
    teachers: [],
    subjects: ["التربية الاسلامية", "اللغة العربية", "اللغة الانكليزية", "الرياضيات", "الاجتماعيات", "الاحياء", "الفيزياء", "الكيمياء", "الحاسوب", "الجغرافية", "التاريخ", "علم الاجتماع", "اللغة الفرنسية", "جرائم حزب البعث"],
};

const ADMIN_PASSWORD = "Asasxzxz!@#rtyooo";

const generatePassword = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};


// --- CURRICULUM LINKS DATA & COMPONENT ---

const curriculumLinks = [
  // الثالث متوسط
  { grade: 'الثالث متوسط', subject: 'التربية الاسلامية', url: 'https://hussien1977.github.io/aslam3' },
  { grade: 'الثالث متوسط', subject: 'الاحياء', url: 'https://hussien1977.github.io/ah3' },
  { grade: 'الثالث متوسط', subject: 'الاجتماعيات', url: 'https://hussien1977.github.io/a' },
  { grade: 'الثالث متوسط', subject: 'الفيزياء', url: 'https://hussien1977.github.io/fez3' },
  { grade: 'الثالث متوسط', subject: 'الكيمياء', url: 'https://hussien1977.github.io/kem3' },
  { grade: 'الثالث متوسط', subject: 'الرياضيات', url: 'https://hussien1977.github.io/read3' },
  { grade: 'الثالث متوسط', subject: 'اللغة العربية', url: 'https://hussien1977.github.io/arab3' },
  { grade: 'الثالث متوسط', subject: 'اللغة العربية', url: 'https://hussien1977.github.io/arab3-2' },
  { grade: 'الثالث متوسط', subject: 'اللغة الانكليزية', url: 'https://hussien1977.github.io/english3' },
  { grade: 'الثالث متوسط', subject: 'اللغة الانكليزية', url: 'https://hussien1977.github.io/enn3' },

  // الاول متوسط
  { grade: 'الاول متوسط', subject: 'التربية الاسلامية', url: 'https://hussien1977.github.io/as1' },
  { grade: 'الاول متوسط', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/ahh1' },
  { grade: 'الاول متوسط', subject: 'الاجتماعيات', url: 'https://kadumjr-boop.github.io/ag1' },
  { grade: 'الاول متوسط', subject: 'الفيزياء', url: 'https://kadumjr-boop.github.io/ph1' },
  { grade: 'الاول متوسط', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/ch1' },
  { grade: 'الاول متوسط', subject: 'الرياضيات', url: 'https://kadumjr-boop.github.io/math1' },
  { grade: 'الاول متوسط', subject: 'اللغة العربية', url: 'https://hussien1977.github.io/ar1' },
  { grade: 'الاول متوسط', subject: 'اللغة العربية', url: 'https://hussien1977.github.io/ar12' },
  { grade: 'الاول متوسط', subject: 'اللغة الانكليزية', url: 'https://hussien1977.github.io/en1' },
  { grade: 'الاول متوسط', subject: 'اللغة الانكليزية', url: 'https://hussien1977.github.io/en3' },
  { grade: 'الاول متوسط', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/ha1' },

  // الثاني متوسط
  { grade: 'الثاني متوسط', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/as2' },
  { grade: 'الثاني متوسط', subject: 'الاحياء', url: 'https://hussien1977.github.io/ah2' },
  { grade: 'الثاني متوسط', subject: 'الاجتماعيات', url: 'https://hussien1977.github.io/aht2' },
  { grade: 'الثاني متوسط', subject: 'الفيزياء', url: 'https://kadumjr-boop.github.io/ph2' },
  { grade: 'الثاني متوسط', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/ch2' },
  { grade: 'الثاني متوسط', subject: 'الرياضيات', url: 'https://kadumjr-boop.github.io/ma2' },
  { grade: 'الثاني متوسط', subject: 'اللغة العربية', url: 'https://hussien1977.github.io/ar21' },
  { grade: 'الثاني متوسط', subject: 'اللغة العربية', url: 'https://hussien1977.github.io/ar22' },
  { grade: 'الثاني متوسط', subject: 'اللغة الانكليزية', url: 'https://hussien1977.github.io/en2' },
  { grade: 'الثاني متوسط', subject: 'اللغة الانكليزية', url: 'https://hussien1977.github.io/eng2' },
  { grade: 'الثاني متوسط', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/h2' },
  
  // الرابع العلمي
  { grade: 'الرابع العلمي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/s4' },
  { grade: 'الرابع العلمي', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/h4' },
  { grade: 'الرابع العلمي', subject: 'الفيزياء', url: 'https://kadumjr-boop.github.io/ph4' },
  { grade: 'الرابع العلمي', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/ch4' },
  { grade: 'الرابع العلمي', subject: 'الرياضيات', url: 'https://kadumjr-boop.github.io/ma4' },
  { grade: 'الرابع العلمي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag4' },
  { grade: 'الرابع العلمي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag24' },
  { grade: 'الرابع العلمي', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/ha4' },
  { grade: 'الرابع العلمي', subject: 'اللغة الفرنسية', url: 'https://kadumjr-boop.github.io/f4' },
 { grade: 'الرابع العلمي', subject: 'جرائم حزب البعث', url: 'https://kadumjr-boop.github.io/gr' },

  // الرابع الادبي
  { grade: 'الرابع الادبي', subject: 'التاريخ', url: 'https://kadumjr-boop.github.io/t4' },
  { grade: 'الرابع الادبي', subject: 'الجغرافية', url: 'https://kadumjr-boop.github.io/g4' },
  { grade: 'الرابع الادبي', subject: 'علم الاجتماع', url: 'https://kadumjr-boop.github.io/ag4' },
  { grade: 'الرابع الادبي', subject: 'الرياضيات', url: 'https://kadumjr-boop.github.io/mat4' },
  { grade: 'الرابع الادبي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag4' },
  { grade: 'الرابع الادبي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag24' },
  { grade: 'الرابع الادبي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/s4' },
 { grade: 'الرابع الادبي', subject: 'جرائم حزب البعث', url: 'https://kadumjr-boop.github.io/gr' },

  // الخامس العلمي
  { grade: 'الخامس العلمي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/s5' },
  { grade: 'الخامس العلمي', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/h5' },
  { grade: 'الخامس العلمي', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/ch5' },
  { grade: 'الخامس العلمي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ar5' },
  { grade: 'الخامس العلمي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/a52' },
  { grade: 'الخامس العلمي', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/ha5' },
  { grade: 'الخامس العلمي', subject: 'علم الارض', url: 'https://kadumjr-boop.github.io/ae5' },

  // الخامس الادبي
  { grade: 'الخامس الادبي', subject: 'الفلسفة وعلم النفس', url: 'https://kadumjr-boop.github.io/fa5' },
  { grade: 'الخامس الادبي', subject: 'الجغرافية', url: 'https://kadumjr-boop.github.io/g5' },
  { grade: 'الخامس الادبي', subject: 'التاريخ', url: 'https://kadumjr-boop.github.io/t5' },
  { grade: 'الخامس الادبي', subject: 'الرياضيات', url: 'https://kadumjr-boop.github.io/ma5' },
  { grade: 'الخامس الادبي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/s5' },
  { grade: 'الخامس الادبي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ar5' },
  { grade: 'الخامس الادبي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/a52' },

  // السادس العلمي
  { grade: 'السادس العلمي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/as6' },
  { grade: 'السادس العلمي', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/h6' },
  { grade: 'السادس العلمي', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/ch6' },
  { grade: 'السادس العلمي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag6' },
  { grade: 'السادس العلمي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag26' },

  // السادس الادبي
  { grade: 'السادس الادبي', subject: 'الاقتصاد', url: 'https://kadumjr-boop.github.io/a6' },
  { grade: 'السادس الادبي', subject: 'التاريخ', url: 'https://kadumjr-boop.github.io/t6' },
  { grade: 'السادس الادبي', subject: 'الجغرافية', url: 'https://kadumjr-boop.github.io/g6' },
  { grade: 'السادس الادبي', subject: 'الرياضيات', url: 'https://kadumjr-boop.github.io/ma6' },
  { grade: 'السادس الادبي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/as6' },
  { grade: 'السادس الادبي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag6' },
  { grade: 'السادس الادبي', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/ag26' },
  { grade: 'السادس الادبي', subject: 'جرائم حزب البعث', url: 'https://kadumjr-boop.github.io/gr' },
];

const CurriculumLinks = ({ teacherSubject, teacherGrades }: { teacherSubject: string; teacherGrades: string[] }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const filteredLinks = useMemo(() => {
    if (!teacherSubject || !teacherGrades) return [];
    return curriculumLinks.filter(link => 
      link.subject === teacherSubject && teacherGrades.includes(link.grade)
    );
  }, [teacherSubject, teacherGrades]);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">روابط المنهج الدراسي</h1>
      <div className="bg-teal-50 border-r-4 border-teal-500 text-teal-800 p-4 rounded-lg shadow-sm">
        <p>أستاذنا الفاضل، تضع بين يديك مكتبة إلكترونية متكاملة تضم روابط المناهج الدراسية الحديثة المصممة خصيصًا لتخصصك. استعرض الكتب، اقتبس منها ما يلزمك لإعداد خططك وامتحاناتك، أو انسخ الرابط مباشرة بضغطة زر. كل ما تحتاجه صار أقرب إليك.</p>
      </div>

      <div className="space-y-4">
        {filteredLinks.length > 0 ? (
          filteredLinks.map((link, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-teal-100 p-3 rounded-full">
                  <Icon name="book" className="w-6 h-6 text-teal-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">كتاب {link.subject}</h3>
                  <p className="text-sm text-gray-500">{link.grade}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(link.url)}
                  className={`py-2 px-4 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 ${copiedUrl === link.url ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  <Icon name={copiedUrl === link.url ? 'check-circle' : 'paste'} className="w-5 h-5" />
                  <span>{copiedUrl === link.url ? 'تم النسخ' : 'نسخ الرابط'}</span>
                </button>
                <button
                  onClick={() => setPreviewUrl(link.url)}
                  className="bg-teal-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-teal-700 transition-colors flex items-center gap-2"
                >
                  <Icon name="url" className="w-5 h-5" />
                  <span>معاينة</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <Icon name="list" className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600">لا توجد روابط منهج دراسي متاحة حاليًا لمادتك والمراحل الدراسية المخصصة لك.</p>
            <p className="text-sm text-gray-500">يرجى مراجعة المسؤول لإضافة الروابط اللازمة.</p>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-lg">
              <h3 className="font-bold text-gray-700 text-lg">معاينة المنهج الدراسي</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="p-2 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white transition-colors"
                aria-label="إغلاق المعاينة"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="flex-grow">
              <iframe
                src={previewUrl}
                title="معاينة المنهج الدراسي"
                className="w-full h-full border-0"
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// --- SUB-COMPONENTS (LOGIN, ADMIN PANEL) ---

const LoginScreen = ({ onTeacherLogin, onAdminClick, error, clearError }: { 
    onTeacherLogin: (password: string) => void, 
    onAdminClick: () => void,
    error: string | null,
    clearError: () => void
}) => {
    const [password, setPassword] = useState('');
    const [localError, setLocalError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        clearError();
        setLocalError('');
        if (!password) {
            setLocalError('يرجى إدخال كلمة المرور.');
            return;
        }
        onTeacherLogin(password);
    };
    
    const errorToDisplay = error || localError;
    
    const newFeatures = [
        {
            icon: 'dashboard',
            title: 'توليد خطط يومية احترافية',
            description: 'أنشئ خططًا دراسية يومية متكاملة بضغطة زر، مصممة لتلبية احتياجات طلابك وتحقيق أفضل النتائج.',
        },
        {
            icon: 'edit',
            title: 'إنشاء أسئلة الامتحانات',
            description: 'صمم أسئلة امتحانية شاملة ومتنوعة بسهولة، مع خيارات متعددة لتغطية كافة جوانب المنهج الدراسي.',
        },
        {
            icon: 'check-circle',
            title: 'اختبارات يومية مع فحص\nتلقائي',
            description: 'وفر وقتك وجهدك عبر إنشاء اختبارات يومية مصغرة يتم تصحيحها تلقائيًا، مع تزويدك بتحليلات فورية لأداء الطلاب.',
        },
        {
            icon: 'table-cells',
            title: 'تكوين سجلات الدرجات',
            description: 'نظم درجات طلابك وأصدر سجلات دقيقة واحترافية بسهولة، مما يسهل عليك متابعة تقدمهم الأكاديمي.',
        },
        {
            icon: 'image',
            title: 'تصميم أغلفة السجلات\nالمدرسية',
            description: 'أضف لمسة إبداعية لمستنداتك عبر تصميم أغلفة جذابة ومخصصة لسجلاتك ودفاترك المدرسية.',
        },
        {
            icon: 'sparkles',
            title: 'موسوعات ومسابقات\nتفاعلية',
            description: 'حوّل المادة الدراسية إلى تجربة ممتعة عبر موسوعات غنية ومسابقات تفاعلية تزيد من حماس الطلاب وتعمق فهمهم.',
        },
    ];

    const socialLinks = [
        { href: 'https://www.facebook.com/profile.php?id=61581018180062', icon: 'https://i.imgur.com/zC26Bw6.png', text: 'تابعنا على صفحتنا في الفيسبوك' },
        { href: 'https://wa.me/9647883315837', icon: 'https://i.imgur.com/Nhimac3.png', text: 'لتفعيل الاشتراك للعام الدراسي الحالي تواصل معنا عبر الواتساب' },
        { href: 'https://www.instagram.com/trbawetk/?utm_source=qr&igsh=MXNoNTNmdDRncnNjag%3D%3D#', icon: 'https://i.imgur.com/J6SeeNQ.png', text: 'شاهد جديدنا على الانستغرام' },
        { href: 'https://t.me/trbawetk', icon: 'https://i.imgur.com/6O8Yfiq.png', text: 'انضم إلى مجتمعنا على التليكرام' },
        { href: 'tel:07883315837', icon: 'https://i.imgur.com/psPzTUV.png', text: 'للاتصال المباشر: 07883315837' }
    ];


    return (
       <div className="min-h-screen bg-gray-100 py-10 px-4" dir="rtl">
            <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-t-4 border-cyan-400">
                {/* Header Section */}
                <div className="p-8 sm:p-12 text-center">
                    <Icon name="sparkles" className="w-16 h-16 mx-auto text-cyan-500 mb-4" />
                    <h1 className="text-4xl md:text-5xl font-bold text-gray-800">تربوي تك الأستاذ</h1>
                    <p className="mt-4 text-lg text-gray-600 max-w-3xl mx-auto">
                        موقع وتطبيق متكامل لكل ما يحتاجه المدرس في مختلف الاختصاصات للمراحل الثانوية.
                    </p>

                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {newFeatures.map((feature, index) => (
                            <div key={index} className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 text-right transition-transform hover:-translate-y-2 flex items-start gap-4">
                                <div className="flex-grow">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2 whitespace-pre-line">{feature.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{feature.description}</p>
                                </div>
                                <div className="bg-cyan-100 text-cyan-600 p-3 rounded-full flex-shrink-0">
                                     <Icon name={feature.icon} className="w-6 h-6" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Login Form Section */}
                <div className="bg-gray-100 p-6 sm:p-8">
                     <div className="w-full max-w-md mx-auto space-y-6">
                        <div className="text-center">
                            <h2 className="text-3xl font-bold text-gray-800">تسجيل الدخول</h2>
                            <p className="text-gray-600 mt-2">يرجى إدخال كلمة المرور للمتابعة</p>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="password" className="sr-only">كلمة المرور</label>
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => { 
                                        setPassword(e.target.value); 
                                        setLocalError(''); 
                                        clearError();
                                    }}
                                    className="w-full px-4 py-3 text-lg text-center border-2 border-gray-300 rounded-lg focus:ring-teal-500 focus:border-teal-500 transition shadow-sm"
                                    placeholder="أدخل كلمة المرور الخاصة بك"
                                />
                            </div>
                            {errorToDisplay && <p className="text-red-500 text-center">{errorToDisplay}</p>}
                            <button type="submit" className="w-full px-4 py-3 font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition shadow-lg">
                                تسجيل الدخول
                            </button>
                        </form>
                        <div className="text-center">
                            <button onClick={onAdminClick} className="text-sm text-gray-500 hover:text-teal-600 hover:underline">
                                دخول المسؤول
                            </button>
                        </div>
                    </div>
                </div>

                {/* Social Links Section */}
                <div className="bg-blue-50/50 p-6 sm:p-10">
                    <div className="max-w-lg mx-auto space-y-4">
                        {socialLinks.map((link, index) => (
                            <a
                                key={index}
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-5 p-4 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all duration-300"
                            >
                                <img src={link.icon} alt="" className="w-10 h-10 object-contain" />
                                <span className="font-semibold text-gray-700 text-base md:text-lg">{link.text}</span>
                            </a>
                        ))}
                    </div>
                </div>

                 {/* Concluding sentence */}
                 <div className="p-6 text-center">
                    <p className="text-lg text-gray-700 font-semibold">
                        كل هذا وأكثر تجدونه في تطبيق واحد... تربوي تك الأستاذ، الخيار الأمثل لكل تربوي.
                    </p>
                </div>
            </div>
        </div>
    );
};

const AdminLogin = ({ onAdminLogin, onBack }: { onAdminLogin: (password: string) => void, onBack: () => void }) => {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (password === ADMIN_PASSWORD) {
            onAdminLogin(password);
        } else {
            setError('كلمة مرور المسؤول غير صحيحة.');
        }
    };

    return (
         <div className="flex items-center justify-center min-h-screen bg-gray-100" dir="rtl">
            <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg">
                 <div className="text-center">
                    <Icon name="settings" className="w-16 h-16 mx-auto text-purple-600" />
                    <h1 className="text-3xl font-bold text-gray-800 mt-4">لوحة تحكم المسؤول</h1>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} className="w-full px-4 py-3 text-center border-2 border-gray-300 rounded-lg" placeholder="كلمة مرور المسؤول" />
                    {error && <p className="text-red-500 text-center">{error}</p>}
                    <button type="submit" className="w-full px-4 py-3 font-bold text-white bg-purple-600 rounded-lg hover:bg-purple-700">الدخول</button>
                    <button type="button" onClick={onBack} className="w-full px-4 py-2 mt-2 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300">العودة</button>
                </form>
            </div>
        </div>
    );
};

const EditLimitsModal = ({ teacher, onClose, onSave }: { teacher: Teacher, onClose: () => void, onSave: (limits: Teacher['usageLimits']) => void }) => {
    const [limits, setLimits] = useState<Teacher['usageLimits']>(() => ({
        ...USAGE_LIMITS,
        ...teacher.usageLimits,
    }));

    const handleChange = (feature: keyof typeof USAGE_LIMITS, value: string) => {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue) && numValue >= 0) {
            setLimits(prev => ({ ...prev, [feature]: numValue }));
        }
    };

    const labels: Record<keyof typeof USAGE_LIMITS, string> = {
        lessonPlanGenerations: 'توليد الخطط اليومية',
        examQuestionGenerations: 'توليد أسئلة الامتحانات',
        examAnswerGenerations: 'توليد إجابات الامتحانات',
        graderQuestionGenerations: 'توليد أسئلة المدقق',
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b">
                    <h3 className="text-lg font-bold">تعديل حدود الاستخدام لـ {teacher.name}</h3>
                </div>
                <div className="p-6 space-y-4">
                    {Object.keys(USAGE_LIMITS).map(key => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{labels[key as keyof typeof USAGE_LIMITS]}</label>
                            <input
                                type="number"
                                value={limits ? limits[key as keyof typeof USAGE_LIMITS] : ''}
                                onChange={e => handleChange(key as keyof typeof USAGE_LIMITS, e.target.value)}
                                className="w-full p-2 border rounded-md"
                            />
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md hover:bg-gray-300">إلغاء</button>
                    <button onClick={() => onSave(limits)} className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-blue-700">حفظ التغييرات</button>
                </div>
            </div>
        </div>
    );
};


const AdminPanel = ({ appData, setAppData, onLogout }: { appData: AppData, setAppData: (update: (data: AppData) => AppData) => void, onLogout: () => void }) => {
    const [newTeacherName, setNewTeacherName] = useState('');
    const [newTeacherSubject, setNewTeacherSubject] = useState(appData.subjects[0] || '');
    const [newTeacherGrades, setNewTeacherGrades] = useState<string[]>([]);
    const [newTeacherTrialDays, setNewTeacherTrialDays] = useState(1);
    const [newSubject, setNewSubject] = useState('');
    const [openSections, setOpenSections] = useState({ teachers: true, subjects: true });
    const [editingTeacherLimits, setEditingTeacherLimits] = useState<Teacher | null>(null);

    const availableGrades = ["غير مخصص", "الاول متوسط", "الثاني متوسط", "الثالث متوسط", "الرابع العلمي", "الرابع الادبي", "الخامس العلمي", "الخامس الادبي", "السادس العلمي", "السادس الادبي"];

    const toggleSection = (section: 'teachers' | 'subjects') => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleGradeSelection = (grade: string) => {
        setNewTeacherGrades(prev => {
            const isSelected = prev.includes(grade);
            if (isSelected) return prev.filter(g => g !== grade);
            if (prev.length < 3) return [...prev, grade];
            return prev;
        });
    };

    const addTeacher = () => {
        if (!newTeacherName || !newTeacherSubject) return;
        const newTeacher: Teacher = {
            id: `t-${Date.now()}`,
            name: newTeacherName,
            subject: newTeacherSubject,
            password: generatePassword(),
            grades: newTeacherGrades,
            status: 'trial',
            statusStartDate: new Date().toISOString(),
            trialDurationDays: newTeacherTrialDays,
        };
        setAppData(prev => ({ ...prev, teachers: [...prev.teachers, newTeacher] }));
        setNewTeacherName('');
        setNewTeacherGrades([]);
    };
    
    const deleteTeacher = (id: string) => setAppData(prev => ({ ...prev, teachers: prev.teachers.filter(t => t.id !== id) }));
    const regeneratePassword = (id: string) => setAppData(prev => ({ ...prev, teachers: prev.teachers.map(t => t.id === id ? { ...t, password: generatePassword() } : t) }));
    const activateSubscription = (id: string, type: 'monthly' | 'yearly') => {
        setAppData(prev => ({ ...prev, teachers: prev.teachers.map(t => t.id === id ? { ...t, status: type, statusStartDate: new Date().toISOString() } : t) }));
    };
    const updateTeacherLimits = (id: string, limits: Teacher['usageLimits']) => setAppData(prev => ({ ...prev, teachers: prev.teachers.map(t => t.id === id ? { ...t, usageLimits: limits } : t) }));

    const addSubject = () => {
        if (!newSubject || appData.subjects.includes(newSubject)) return;
        setAppData(prev => ({ ...prev, subjects: [...prev.subjects, newSubject] }));
        setNewSubject('');
    };
    const deleteSubject = (subject: string) => setAppData(prev => ({ ...prev, subjects: prev.subjects.filter(s => s !== subject) }));

    const getSubscriptionInfo = (teacher: Teacher): string => {
        if (teacher.status === 'yearly') return 'اشتراك سنوي';
        if (!teacher.statusStartDate) {
            const statusMap = { trial: 'تجريبي', monthly: 'شهري', yearly: 'سنوي' };
            return `اشتراك ${statusMap[teacher.status]}`;
        }
    
        const startDate = new Date(teacher.statusStartDate);
        const durationDays = teacher.status === 'trial' ? (teacher.trialDurationDays || 0) : 30;
        const type = teacher.status === 'trial' ? 'الفترة التجريبية' : 'الاشتراك الشهري';
    
        const expiryDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        const now = new Date();
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
        if (daysLeft <= 0) return `${type} انتهت`;
        return `تنتهي بعد ${daysLeft} يوم`;
    };
    
    const statusTextMap = {
        trial: 'تجريبي',
        monthly: 'شهري',
        yearly: 'سنوي'
    };

    const statusColorMap = {
        trial: 'bg-yellow-100 text-yellow-800',
        monthly: 'bg-blue-100 text-blue-800',
        yearly: 'bg-green-100 text-green-800'
    };


    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8" dir="rtl">
            {editingTeacherLimits && (
                <EditLimitsModal
                    teacher={editingTeacherLimits}
                    onClose={() => setEditingTeacherLimits(null)}
                    onSave={(limits) => {
                        updateTeacherLimits(editingTeacherLimits.id, limits);
                        setEditingTeacherLimits(null);
                    }}
                />
            )}
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">لوحة تحكم المسؤول</h1>
                    <button onClick={onLogout} className="flex items-center gap-2 bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600">
                       <Icon name="arrow-right" className="w-5 h-5" /> تسجيل الخروج
                    </button>
                </div>

                {/* Teacher Management */}
                <div className="bg-white rounded-xl shadow-md border mb-6 overflow-hidden transition-all duration-500">
                    <button onClick={() => toggleSection('teachers')} className="w-full flex justify-between items-center p-6 text-right focus:outline-none hover:bg-gray-50 transition-colors">
                        <h2 className="text-2xl font-semibold text-teal-700">إدارة المدرسين</h2>
                        <Icon name="chevron-down" className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${openSections.teachers ? 'rotate-180' : ''}`} />
                    </button>
                    <div className={`transition-all duration-500 ease-in-out ${openSections.teachers ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-6 pt-0">
                            <div className="p-4 bg-gray-50 rounded-lg border mb-4 space-y-4">
                                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <input type="text" value={newTeacherName} onChange={e => setNewTeacherName(e.target.value)} placeholder="اسم المدرس الجديد" className="p-2 border rounded-md" />
                                    <select value={newTeacherSubject} onChange={e => setNewTeacherSubject(e.target.value)} className="p-2 border rounded-md bg-white">
                                        {appData.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    <input type="number" value={newTeacherTrialDays} onChange={e => setNewTeacherTrialDays(parseInt(e.target.value, 10))} placeholder="أيام التجربة" className="p-2 border rounded-md" />
                                </div>
                                <div>
                                    <h3 className="text-md font-semibold mb-2 text-gray-700">المراحل الدراسية (3 كحد أقصى)</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-x-4 gap-y-2">
                                        {availableGrades.map(grade => (
                                            <label key={grade} className="flex items-center space-x-2 rtl:space-x-reverse p-2 rounded-md hover:bg-gray-200 cursor-pointer">
                                                <input type="checkbox" checked={newTeacherGrades.includes(grade)} onChange={() => handleGradeSelection(grade)} disabled={newTeacherGrades.length >= 3 && !newTeacherGrades.includes(grade)} className="form-checkbox h-4 w-4 text-teal-600" />
                                                <span className="text-sm text-gray-800">{grade}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button onClick={addTeacher} className="w-full md:w-auto bg-teal-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-teal-700">إضافة مدرس (تجريبي)</button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-3">الاسم</th><th className="px-4 py-3">الاختصاص</th><th className="px-4 py-3">المراحل</th><th className="px-4 py-3">كلمة المرور</th><th className="px-4 py-3">الحالة</th><th className="px-4 py-3">معلومات</th><th className="px-4 py-3">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {appData.teachers.map(teacher => (
                                            <tr key={teacher.id} className="bg-white border-b">
                                                <td className="px-4 py-2 font-medium">{teacher.name}</td>
                                                <td className="px-4 py-2">{teacher.subject}</td>
                                                <td className="px-4 py-2 text-xs">{teacher.grades?.join(', ') || 'غير محدد'}</td>
                                                <td className="px-4 py-2 font-mono text-blue-600">{teacher.password}</td>
                                                <td className="px-4 py-2"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusColorMap[teacher.status]}`}>{statusTextMap[teacher.status]}</span></td>
                                                <td className="px-4 py-2 text-xs">{getSubscriptionInfo(teacher)}</td>
                                                <td className="px-4 py-2 space-x-2 space-x-reverse text-xs">
                                                    {teacher.status === 'trial' && (
                                                        <>
                                                            <button onClick={() => activateSubscription(teacher.id, 'monthly')} className="font-medium text-blue-600 hover:underline">تفعيل شهري</button>
                                                            <button onClick={() => activateSubscription(teacher.id, 'yearly')} className="font-medium text-green-600 hover:underline">تفعيل سنوي</button>
                                                        </>
                                                    )}
                                                    <button onClick={() => setEditingTeacherLimits(teacher)} className="font-medium text-purple-600 hover:underline">الحدود</button>
                                                    <button onClick={() => regeneratePassword(teacher.id)} className="font-medium text-blue-600 hover:underline">إعادة توليد</button>
                                                    <button onClick={() => deleteTeacher(teacher.id)} className="font-medium text-red-600 hover:underline">حذف</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>


                {/* Subject Management */}
                <div className="bg-white rounded-xl shadow-md border overflow-hidden transition-all duration-500">
                     <button onClick={() => toggleSection('subjects')} className="w-full flex justify-between items-center p-6 text-right focus:outline-none hover:bg-gray-50 transition-colors">
                        <h2 className="text-2xl font-semibold text-purple-700">إدارة المواد الدراسية</h2>
                        <Icon name="chevron-down" className={`w-6 h-6 text-gray-500 transition-transform duration-300 ${openSections.subjects ? 'rotate-180' : ''}`} />
                     </button>
                     <div className={`transition-all duration-500 ease-in-out ${openSections.subjects ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                        <div className="p-6 pt-0">
                            <div className="grid md:grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg border">
                                <input type="text" value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="اسم المادة الجديدة" className="p-2 border rounded-md md:col-span-2" />
                                <button onClick={addSubject} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700">إضافة مادة</button>
                            </div>
                            <ul className="space-y-2">
                                {appData.subjects.map(subject => (
                                    <li key={subject} className="flex justify-between items-center p-3 bg-gray-100 rounded-md">
                                        <span>{subject}</span>
                                        <button onClick={() => deleteSubject(subject)} className="text-red-500 hover:text-red-700"><Icon name="trash" className="w-5 h-5"/></button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};

const SubscriptionBanner = ({ teacher }: { teacher: Teacher }) => {
    if (teacher.status === 'yearly' || !teacher.statusStartDate) return null;

    const calculateDaysLeft = () => {
        const startDate = new Date(teacher.statusStartDate);
        const duration = teacher.status === 'trial' ? (teacher.trialDurationDays || 1) : 30;
        const expiryDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
        const now = new Date();
        const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, daysLeft);
    };
    
    const daysLeft = calculateDaysLeft();
    if (daysLeft === 0) return null;

    const typeText = teacher.status === 'trial' ? 'الفترة التجريبية' : 'الاشتراك الشهري';

    return (
        <div className="bg-yellow-400 text-yellow-900 text-center p-2 font-semibold text-sm w-full z-40">
            أنت في {typeText}. متبقي {daysLeft} أيام على انتهاء اشتراكك.
        </div>
    );
};


// --- MAIN APP COMPONENT ---

export default function App(): React.ReactNode {
  // --- STATE MANAGEMENT ---
  const [view, setView] = useState<'login' | 'teacher' | 'adminLogin' | 'adminPanel'>('login');
  const [appData, setAppData] = useState<AppData>(initialAppData);
  const [loggedInTeacher, setLoggedInTeacher] = useState<Teacher | null>(null);
  const isDataFromFirebase = useRef(false);

  // Load data from Firebase on initial render and listen for changes
  useEffect(() => {
    const handleValueChange = (snapshot: firebase.database.DataSnapshot) => {
        const data = snapshot.val();
        if (data) {
            isDataFromFirebase.current = true;
            
            const teachersData = data.teachers ? (Array.isArray(data.teachers) ? data.teachers : Object.values(data.teachers)) : [];
            const teachersArray = (teachersData as any[]).map(t_any => {
                const t = {...t_any};
                t.grades = t.grades || [];

                // Migrate status: paid -> yearly
                if (t.status === 'paid') t.status = 'yearly';
                else t.status = t.status || 'yearly';
                
                // Migrate date field: trialStartDate -> statusStartDate
                if (t.trialStartDate) {
                    t.statusStartDate = t.statusStartDate || t.trialStartDate;
                    delete t.trialStartDate;
                }
                return t;
            });
            
            const firebaseSubjects = data.subjects ? (Array.isArray(data.subjects) ? data.subjects : Object.values(data.subjects)) : [];
            const combinedSubjects = [...initialAppData.subjects, ...firebaseSubjects];
            const uniqueSubjects = [...new Set(combinedSubjects)];

            setAppData({ teachers: teachersArray as Teacher[], subjects: uniqueSubjects as string[] });
        } else {
            appDataRef.set(initialAppData);
        }
    };
    const errorCallback = (error: Error) => console.error("Firebase read failed:", error);
    appDataRef.on('value', handleValueChange, errorCallback as any);
    return () => appDataRef.off('value', handleValueChange);
  }, []);

  // Save data to Firebase whenever it changes locally
  useEffect(() => {
    if (isDataFromFirebase.current) {
        isDataFromFirebase.current = false;
        return;
    }
    if (appData === initialAppData && appData.teachers.length === 0) return;
    appDataRef.set(appData).catch(error => console.error("Firebase write failed:", error));
  }, [appData]);

  // States for Teacher View
  const [activePage, setActivePage] = useState<'lessonPlanner' | 'examGrader' | 'gradebook' | 'englishLessonPlanner' | 'examGenerator' | 'answerSheetExporter' | 'curriculumLinks' | 'interactiveTools' | 'educationalEncyclopedia' | 'coverEditor'>('lessonPlanner');
  const [userInputs, setUserInputs] = useState<UserInputs>(initialUserInputs);
  const [planContent, setPlanContent] = useState<LessonPlanData>(initialPlanContent);
  const [source, setSource] = useState<{ text: string; images: string[] }>({ text: '', images: [] });
  const [isGenerating, setIsGenerating] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  const [englishUserInputs, setEnglishUserInputs] = useState<EnglishUserInputs>(initialEnglishUserInputs);
  const [englishPlanContent, setEnglishPlanContent] = useState<EnglishLessonPlanData>(initialEnglishPlanContent);
  const [englishSource, setEnglishSource] = useState<{ text: string; images: string[] }>({ text: '', images: [] });
  const [isGeneratingEnglish, setIsGeneratingEnglish] = useState<Record<string, boolean>>({});
  const [englishError, setEnglishError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showAboutUs, setShowAboutUs] = useState(false);

  // --- LOGIN/LOGOUT LOGIC ---
  const handleTeacherLogin = (password: string) => {
      const teacher = appData.teachers.find(t => t.password === password);
      if (teacher) {
          const now = new Date();
          if (teacher.status === 'trial' && teacher.statusStartDate && teacher.trialDurationDays) {
              const startDate = new Date(teacher.statusStartDate);
              const duration = teacher.trialDurationDays;
              const expiryDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000);
              if (now > expiryDate) {
                  setError('انتهت الفترة التجريبية. يرجى مراجعة المسؤول لتفعيل اشتراكك.');
                  return; 
              }
          } else if (teacher.status === 'monthly' && teacher.statusStartDate) {
              const startDate = new Date(teacher.statusStartDate);
              const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
              if (now > expiryDate) {
                  setError('انتهى اشتراكك الشهري. يرجى مراجعة المسؤول لتجديد اشتراكك.');
                  return;
              }
          }

          setError(null); // Clear error on successful login
          setLoggedInTeacher(teacher);
          setUserInputs(prev => ({ ...prev, teacherName: teacher.name, chapterTitle: teacher.subject }));
          setEnglishUserInputs(prev => ({ ...prev, teacherName: teacher.name, subject: teacher.subject }));
          setView('teacher');
      } else {
          setError('كلمة المرور غير صحيحة.');
      }
  };
  const handleAdminLogin = () => setView('adminPanel');
  const handleLogout = () => {
      setLoggedInTeacher(null);
      setView('login');
  };

  // --- HANDLERS FOR TEACHER VIEW ---
  const handleGenerate = async (sections?: Array<keyof LessonPlanData>) => {
    const keysToGenerate = sections || Object.keys(initialPlanContent) as Array<keyof LessonPlanData>;
    const generatingState: Record<string, boolean> = {};
    keysToGenerate.forEach(key => generatingState[key] = true);
    if (!sections) generatingState['all'] = true;

    setIsGenerating(prev => ({ ...prev, ...generatingState }));
    setError(null);

    try {
      if (!source.text && source.images.length === 0) throw new Error("يرجى إدخال محتوى نصي أو رفع صورة من الكتاب أولاً.");
      const generatedData = await generatePlan(source, keysToGenerate);
      setPlanContent(prev => ({ ...prev, ...generatedData }));
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred.');
    } finally {
      const finishedState: Record<string, boolean> = {};
      keysToGenerate.forEach(key => finishedState[key] = false);
      if (!sections) finishedState['all'] = false;
      setIsGenerating(prev => ({ ...prev, ...finishedState }));
    }
  };
  
  const handleReset = () => {
    setUserInputs(prev => ({ ...initialUserInputs, teacherName: prev.teacherName, chapterTitle: prev.chapterTitle }));
    setPlanContent(initialPlanContent);
    setSource({ text: '', images: [] });
    setError(null);
  };

  const handleGenerateEnglish = async (sections?: Array<keyof EnglishLessonPlanData>) => {
    const keysToGenerate = sections || Object.keys(initialEnglishPlanContent) as Array<keyof EnglishLessonPlanData>;
    const generatingState: Record<string, boolean> = {};
    keysToGenerate.forEach(key => generatingState[key] = true);
    if (!sections) generatingState['all'] = true;

    setIsGeneratingEnglish(prev => ({ ...prev, ...generatingState }));
    setEnglishError(null);

    try {
      if (!englishSource.text && englishSource.images.length === 0) throw new Error("Please enter text content or upload a textbook image first.");
      const generatedData = await generateEnglishPlan(englishSource, keysToGenerate);
      setEnglishPlanContent(prev => ({ ...prev, ...generatedData }));
    } catch (e: any) {
      setEnglishError(e.message || 'An unknown error occurred.');
    } finally {
      const finishedState: Record<string, boolean> = {};
      keysToGenerate.forEach(key => finishedState[key] = false);
      if (!sections) finishedState['all'] = false;
      setIsGeneratingEnglish(prev => ({ ...prev, ...finishedState }));
    }
  };

  const handleResetEnglish = () => {
    setEnglishUserInputs(prev => ({ ...initialEnglishUserInputs, teacherName: prev.teacherName, subject: prev.subject }));
    setEnglishPlanContent(initialEnglishPlanContent);
    setEnglishSource({ text: '', images: [] });
    setEnglishError(null);
  };

  // --- RENDER LOGIC ---
  const renderContent = () => {
    if (!loggedInTeacher) return <div>Loading teacher data...</div>;
    switch (activePage) {
      case 'lessonPlanner':
        return <LessonPlanForm userInputs={userInputs} setUserInputs={setUserInputs} planContent={planContent} setPlanContent={setPlanContent} source={source} setSource={setSource} onGenerate={handleGenerate} isGenerating={isGenerating} error={error} onReset={handleReset} teacher={loggedInTeacher} />;
      case 'englishLessonPlanner':
        return <EnglishLessonPlanner userInputs={englishUserInputs} setUserInputs={setEnglishUserInputs} planContent={englishPlanContent} setPlanContent={setEnglishPlanContent} source={englishSource} setSource={setEnglishSource} onGenerate={handleGenerateEnglish} isGenerating={isGeneratingEnglish} error={englishError} onReset={handleResetEnglish} teacher={loggedInTeacher} />;
      case 'coverEditor':
        return <CoverEditor />;
      case 'examGenerator':
        return <ExamGenerator teacher={loggedInTeacher} />;
      case 'examGrader':
        return <ExamGrader teacher={loggedInTeacher} />;
      case 'answerSheetExporter':
        return <AnswerSheetExporter teacherName={loggedInTeacher.name} />;
      case 'curriculumLinks':
        return <CurriculumLinks teacherSubject={loggedInTeacher.subject} teacherGrades={loggedInTeacher.grades} />;
      case 'interactiveTools':
        return <InteractiveTools teacherSubject={loggedInTeacher.subject} teacherGrades={loggedInTeacher.grades} />;
      case 'educationalEncyclopedia':
        return <EducationalEncyclopedia teacherSubject={loggedInTeacher.subject} teacherGrades={loggedInTeacher.grades} />;
      case 'gradebook':
        return <Gradebook teacher={loggedInTeacher} />;
      default:
        return <div>يرجى تحديد صفحة</div>;
    }
  };

  const renderView = () => {
    switch(view) {
        case 'login':
            return <LoginScreen 
                        onTeacherLogin={handleTeacherLogin} 
                        onAdminClick={() => setView('adminLogin')} 
                        error={error}
                        clearError={() => setError(null)}
                    />;
        case 'adminLogin':
            return <AdminLogin onAdminLogin={handleAdminLogin} onBack={() => setView('login')} />;
        case 'adminPanel':
            return <AdminPanel appData={appData} setAppData={setAppData} onLogout={handleLogout} />;
        case 'teacher':
            return (
                <div className="flex min-h-screen bg-gray-100" dir="rtl">
                  {isSidebarOpen && (
                    <Sidebar activePage={activePage} setActivePage={setActivePage} teacherName={loggedInTeacher?.name || ''} onLogout={handleLogout} onToggle={() => setIsSidebarOpen(false)} onShowAboutUs={() => setShowAboutUs(true)} />
                  )}
                  <div className="relative flex-1 flex flex-col">
                    {loggedInTeacher && <SubscriptionBanner teacher={loggedInTeacher} />}
                    {!isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(true)} className="hidden md:block fixed top-4 right-4 z-30 p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg" aria-label="إظهار القائمة الجانبية">
                            <Icon name="arrow-left" className="w-6 h-6" />
                        </button>
                    )}
                    <main className="w-full flex-1 p-4 md:p-8 overflow-y-auto">
                      {renderContent()}
                    </main>
                  </div>
                  {showAboutUs && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setShowAboutUs(false)}>
                      <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end items-center p-3 border-b bg-gray-50 rounded-t-lg">
                          <button onClick={() => setShowAboutUs(false)} className="p-2 rounded-full bg-gray-200 hover:bg-red-500 hover:text-white transition-colors" aria-label="إغلاق">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                          </button>
                        </div>
                        <div className="flex-grow">
                          <iframe src="https://salemali2230-alt.github.io/w/" title="من نحن" className="w-full h-full border-0"></iframe>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
            );
        default:
            return <LoginScreen 
                        onTeacherLogin={handleTeacherLogin} 
                        onAdminClick={() => setView('adminLogin')} 
                        error={error}
                        clearError={() => setError(null)}
                    />;
    }
  };

  return <>{renderView()}</>;
}
