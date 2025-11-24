

import React from 'react';
import Icon from './Icon';

export default function CoverEditor() {
  const handleStartDesign = () => {
    window.open('https://service-58570933966.us-west1.run.app/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex items-center justify-center min-h-full p-4 bg-gray-50">
      <div
        className="w-full max-w-3xl p-8 mx-auto overflow-hidden bg-white rounded-2xl shadow-2xl"
        style={{ background: 'linear-gradient(to bottom, #fdf4f6, #f6e8eb)' }}
      >
        <div className="space-y-8 text-center">
          <h1
            className="text-4xl font-bold text-gray-800 md:text-5xl"
            style={{ color: '#4a4a4a' }}
          >
            محرر صور المستندات المدرسية
          </h1>

          <p className="max-w-2xl mx-auto text-lg leading-relaxed text-gray-700">
            أداة تعليمية مبتكرة تسهّل على المعلمين والإداريين تصميم أغلفة احترافية لسجلاتهم
            التعليمية مثل سجل الدرجات، الخطط، الملازم والسجلات الإدارية. اختر من تصاميم جاهزة،
            وخصصها بسهولة عبر تعديل النصوص والمعلومات كاسم المعلم، الصف، المادة والتاريخ. ضع
            صورتك الشخصية في الغلاف أو شعار مدرستك بثوانٍ معدودة، دون الحاجة لأي خبرة في
            التصميم.
          </p>

          <div className="p-4 my-8 bg-white/70 rounded-lg shadow-inner border border-pink-100">
            <p className="text-xl font-bold" style={{ color: '#d63384' }}>
              <span role="img" aria-label="student cap" className="ml-2">
                🎓
              </span>
              ابدأ الآن واصنع مستنداتك بأسلوب يليق برسالتك التعليمية!
            </p>
          </div>

          <button
            onClick={handleStartDesign}
            className="inline-flex items-center justify-center gap-3 px-12 py-4 font-bold text-white transition-transform transform rounded-xl shadow-lg hover:scale-105"
            style={{
              background: 'linear-gradient(45deg, #f76b8a, #e91e63)',
              textShadow: '1px 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            <Icon name="edit" className="w-6 h-6" />
            <span className="text-xl">ابدأ تصميم الغلاف</span>
          </button>
        </div>
      </div>
    </div>
  );
}