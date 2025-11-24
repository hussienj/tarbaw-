
import React, { useState, useMemo } from 'react';
import Icon from './Icon';

interface InteractiveTool {
  grade: string;
  subject: string;
  url: string;
  title: string;
  description: string;
}

const interactiveTools: InteractiveTool[] = [
  {
    grade: 'الثالث متوسط',
    subject: 'الفيزياء',
    url: 'https://salemali2230-alt.github.io/fhez/',
    title: 'محاكاة تفاعلية في الفيزياء',
    description: 'وسيلة تعليمية لاستكشاف مفاهيم فيزيائية متنوعة بشكل عملي وتفاعلي.',
  },
  // More tools can be added here in the future
];

interface InteractiveToolsProps {
  teacherSubject: string;
  teacherGrades: string[];
}

export default function InteractiveTools({ teacherSubject, teacherGrades }: InteractiveToolsProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    if (!teacherSubject || !teacherGrades) return [];
    return interactiveTools.filter(tool => 
      tool.subject === teacherSubject && teacherGrades.includes(tool.grade)
    );
  }, [teacherSubject, teacherGrades]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">الوسائل التعليمية التفاعلية</h1>
      <div className="bg-teal-50 border-r-4 border-teal-500 text-teal-800 p-4 rounded-lg shadow-sm">
        <p>أستاذنا الفاضل، نؤمن بأن التكنولوجيا تفتح آفاقًا جديدة للتعلم. هنا، نجمع لك وسائل تعليمية وتفاعلية مبتكرة مصممة خصيصًا لإثراء دروسك وجعلها تجربة لا تُنسى لطلابك.</p>
      </div>

      <div className="space-y-4">
        {filteredTools.length > 0 ? (
          filteredTools.map((tool, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="bg-purple-100 p-3 rounded-full mt-1">
                  <Icon name="sparkles" className="w-8 h-8 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">{tool.title}</h3>
                  <p className="text-sm font-semibold text-gray-500 mb-2">{tool.grade}</p>
                  <p className="text-gray-600">{tool.description}</p>
                </div>
              </div>
              <button
                onClick={() => setPreviewUrl(tool.url)}
                className="bg-purple-600 text-white font-semibold py-2 px-5 rounded-md hover:bg-purple-700 transition-colors flex items-center gap-2 flex-shrink-0 w-full sm:w-auto"
              >
                <Icon name="url" className="w-5 h-5" />
                <span>فتح الوسيلة</span>
              </button>
            </div>
          ))
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <Icon name="list" className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600">نعتذر، لا توجد وسائل تعليمية تفاعلية متاحة لمادتك والمراحل الدراسية المخصصة لك حاليًا.</p>
            <p className="text-sm text-gray-500">نعمل باستمرار على إضافة المزيد من الموارد المبتكرة، يرجى المراجعة لاحقًا.</p>
          </div>
        )}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-lg shadow-2xl w-full h-full max-w-6xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-3 border-b bg-gray-50 rounded-t-lg">
              <h3 className="font-bold text-gray-700 text-lg">معاينة الوسيلة التعليمية</h3>
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
                title="معاينة الوسيلة التعليمية"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin"
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}