

import React, { useState, useMemo } from 'react';
import Icon from './Icon';

interface EncyclopediaLink {
  grade: string;
  subject: string;
  url: string;
}

const encyclopediaLinks: EncyclopediaLink[] = [
  // الثالث متوسط
  { grade: 'الثالث متوسط', subject: 'الاحياء', url: 'https://salemali2230-alt.github.io/mo3' },
  { grade: 'الثالث متوسط', subject: 'اللغة العربية', url: 'https://salemali2230-alt.github.io/moar3' },
  { grade: 'الثالث متوسط', subject: 'اللغة الانكليزية', url: 'https://salemali2230-alt.github.io/eng3' },
  { grade: 'الثالث متوسط', subject: 'التربية الاسلامية', url: 'https://salemali2230-alt.github.io/moas3' },
  { grade: 'الثالث متوسط', subject: 'الكيمياء', url: 'https://salemali2230-alt.github.io/mok3' },
  { grade: 'الثالث متوسط', subject: 'الفيزياء', url: 'https://salemali2230-alt.github.io/mof3' },
  { grade: 'الثالث متوسط', subject: 'الاجتماعيات', url: 'https://salemali2230-alt.github.io/moj3' },

  // الاول متوسط
  { grade: 'الاول متوسط', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/ms1/' },
  { grade: 'الاول متوسط', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/mh1/' },
  { grade: 'الاول متوسط', subject: 'الاجتماعيات', url: 'https://kadumjr-boop.github.io/ma1/' },
  { grade: 'الاول متوسط', subject: 'الفيزياء', url: 'https://kadumjr-boop.github.io/mp1/' },
  { grade: 'الاول متوسط', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/mc1/' },
  { grade: 'الاول متوسط', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/mar1/' },
  { grade: 'الاول متوسط', subject: 'اللغة الانكليزية', url: 'https://kadumjr-boop.github.io/men1/' },
  { grade: 'الاول متوسط', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/mhs1/' },

  // الثاني متوسط
  { grade: 'الثاني متوسط', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/ms2/' },
  { grade: 'الثاني متوسط', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/mh2/' },
  { grade: 'الثاني متوسط', subject: 'الاجتماعيات', url: 'https://kadumjr-boop.github.io/mg2/' },
  { grade: 'الثاني متوسط', subject: 'الفيزياء', url: 'https://kadumjr-boop.github.io/mp2/' },
  { grade: 'الثاني متوسط', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/mc2/' },
  { grade: 'الثاني متوسط', subject: 'اللغة العربية', url: 'https://kadumjr-boop.github.io/mar2/' },
  { grade: 'الثاني متوسط', subject: 'اللغة الانكليزية', url: 'https://kadumjr-boop.github.io/mn2/' },
  { grade: 'الثاني متوسط', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/mh/' },

  // الرابع العلمي
  { grade: 'الرابع العلمي', subject: 'التربية الاسلامية', url: 'https://kadumjr-boop.github.io/ms4' },
  { grade: 'الرابع العلمي', subject: 'الاحياء', url: 'https://kadumjr-boop.github.io/mh4' },
  { grade: 'الرابع العلمي', subject: 'الفيزياء', url: 'https://kadumjr-boop.github.io/mf4' },
  { grade: 'الرابع العلمي', subject: 'الكيمياء', url: 'https://kadumjr-boop.github.io/mc4' },
  { grade: 'الرابع العلمي', subject: 'الحاسوب', url: 'https://kadumjr-boop.github.io/mha4' },
];

interface EducationalEncyclopediaProps {
  teacherSubject: string;
  teacherGrades: string[];
}

export default function EducationalEncyclopedia({ teacherSubject, teacherGrades }: EducationalEncyclopediaProps) {
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  const filteredLinks = useMemo(() => {
    if (!teacherSubject || !teacherGrades) return [];
    return encyclopediaLinks.filter(link =>
      link.subject === teacherSubject && teacherGrades.includes(link.grade)
    );
  }, [teacherSubject, teacherGrades]);

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadHtml = async (link: EncyclopediaLink) => {
    setDownloadingUrl(link.url);
    try {
      // Using a CORS proxy to fetch content from a different origin on the client-side
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(link.url)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`فشل في جلب المحتوى. الحالة: ${response.status}`);
      }
      const htmlContent = await response.text();

      const blob = new Blob([htmlContent], { type: 'text/html' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `موسوعة-${link.subject}-${link.grade}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

    } catch (error) {
      console.error('Download failed:', error);
      alert('عذراً، فشلت عملية تحميل المحتوى. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.');
    } finally {
      setDownloadingUrl(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white p-6 rounded-lg shadow-lg mb-6">
          <h2 className="text-2xl font-bold mb-4">لأستاذ المادة الفاضل:</h2>
          <p className="mb-4 opacity-90">الموسوعة التعليمية ليست مجرد منصة أخرى، بل هي شريكك الرقمي في رحلة التعليم. تخيل أن بين يديك مكتبة ضخمة من الأسئلة التفاعلية والاختبارات المخصصة، مصممة بدقة لتتوافق مع كل فصل من فصول المنهج.</p>
          <p className="font-semibold mb-3">تتيح لك هذه المنصة:</p>
          <ul className="space-y-3">
              <li className="flex items-start">
                  <Icon name="check-circle" className="w-6 h-6 text-green-400 mr-3 mt-1 flex-shrink-0" />
                  <div>
                      <strong className="font-bold">قياس مستوى الطلاب:</strong> بسهولة ودقة، يمكنك معرفة نقاط القوة والضعف لدى كل طالب أو صف.
                  </div>
              </li>
              <li className="flex items-start">
                  <Icon name="sparkles" className="w-6 h-6 text-yellow-400 mr-3 mt-1 flex-shrink-0" />
                  <div>
                      <strong className="font-bold">تحفيز المشاركة:</strong> حوّل المراجعة إلى لعبة ممتعة وتحدٍ شيق يحفز الطلاب على التفاعل والمنافسة الإيجابية.
                  </div>
              </li>
              <li className="flex items-start">
                  <Icon name="book" className="w-6 h-6 text-blue-400 mr-3 mt-1 flex-shrink-0" />
                  <div>
                      <strong className="font-bold">توفير الوقت والجهد:</strong> بدلاً من إعداد أسئلة لكل درس، يمكنك الاعتماد على محتوى غني ومتجدد جاهز للاستخدام الفوري.
                  </div>
              </li>
          </ul>
      </div>

      <div className="space-y-4">
        {filteredLinks.length > 0 ? (
          filteredLinks.map((link, index) => (
            <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-grow">
                <div className="bg-indigo-100 p-3 rounded-full mt-1">
                  <Icon name="book" className="w-8 h-8 text-indigo-700" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-gray-800">موسوعة {link.subject}</h3>
                  <p className="text-sm font-semibold text-gray-500 mb-2">{link.grade}</p>
                  <p className="text-gray-600">أسئلة تفاعلية واختبارات مخصصة لمادة {link.subject}.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <button
                    onClick={() => handleDownloadHtml(link)}
                    disabled={downloadingUrl === link.url}
                    className="bg-green-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400"
                  >
                    {downloadingUrl === link.url ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        <span>جاري التحميل...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="upload" className="w-5 h-5" />
                        <span>تحميل (HTML)</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenLink(link.url)}
                    className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Icon name="url" className="w-5 h-5" />
                    <span>فتح الموسوعة</span>
                  </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <Icon name="list" className="w-12 h-12 mx-auto text-gray-400" />
            <p className="mt-4 text-gray-600">نعتذر، لا توجد موسوعة تعليمية متاحة لمادتك والمراحل الدراسية المخصصة لك حاليًا.</p>
            <p className="text-sm text-gray-500">نعمل على إضافة المزيد من الموارد، يرجى المراجعة لاحقًا.</p>
          </div>
        )}
      </div>
    </div>
  );
}