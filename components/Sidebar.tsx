import React, { useState } from 'react';
import Icon from './Icon';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: 'lessonPlanner' | 'examGrader' | 'gradebook' | 'englishLessonPlanner' | 'examGenerator' | 'answerSheetExporter' | 'curriculumLinks' | 'interactiveTools' | 'educationalEncyclopedia' | 'coverEditor') => void;
  teacherName: string;
  onLogout: () => void;
  onToggle: () => void;
  onShowAboutUs: () => void;
}

export default function Sidebar({ activePage, setActivePage, teacherName, onLogout, onToggle, onShowAboutUs }: SidebarProps): React.ReactNode {
  
  const [openSections, setOpenSections] = useState({
    planning: true,
    exams: true,
    resources: true,
    tools: true,
  });

  const toggleSection = (sectionId: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const navGroups = [
    {
      id: 'planning',
      title: 'تخطيط الدروس',
      icon: 'dashboard',
      items: [
        { id: 'lessonPlanner', label: 'الخطة اليومية للدرس', icon: 'dashboard' },
        { id: 'englishLessonPlanner', label: 'Daily lesson plan', icon: 'book' },
      ]
    },
    {
      id: 'exams',
      title: 'الامتحانات والدرجات',
      icon: 'edit',
      items: [
        { id: 'examGenerator', label: 'مولد اوراق الامتحانات', icon: 'edit' },
        { id: 'examGrader', label: 'مدقق الامتحانات الآلي', icon: 'check-circle' },
        { id: 'answerSheetExporter', label: 'اوراق اجابة الطالب', icon: 'document-check' },
        { id: 'gradebook', label: 'سجل الدرجات', icon: 'table-cells' },
      ]
    },
    {
      id: 'resources',
      title: 'الموارد التعليمية',
      icon: 'book',
      items: [
        { id: 'curriculumLinks', label: 'روابط المنهج الدراسي', icon: 'url' },
        { id: 'interactiveTools', label: 'الوسائل التعليمية', icon: 'sparkles' },
        { id: 'educationalEncyclopedia', label: 'الموسوعة التعليمية', icon: 'book' },
      ]
    },
    {
      id: 'tools',
      title: 'أدوات إضافية',
      icon: 'settings',
      items: [
        { id: 'coverEditor', label: 'محرر أغلفة المستندات', icon: 'image' },
        { id: 'aboutUs', label: 'من نحن', icon: 'info' },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-teal-800 text-white flex-col hidden md:flex flex-shrink-0" dir="rtl">
      <div className="flex items-center justify-between h-20 border-b border-teal-700 px-4">
        <div className="flex items-center overflow-hidden">
            <Icon name="book" className="w-8 h-8 ml-3 flex-shrink-0" />
            <h1 className="text-xl font-bold whitespace-nowrap">تربوي تك الاستاذ</h1>
        </div>
        <button 
            onClick={onToggle} 
            className="p-2 rounded-full bg-red-600 hover:bg-red-700 transition-colors shadow-md"
            aria-label="إخفاء القائمة الجانبية"
        >
            <Icon name="arrow-right" className="w-6 h-6" />
        </button>
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.id}>
            <button 
              onClick={() => toggleSection(group.id as keyof typeof openSections)}
              className="w-full flex items-center justify-between p-3 text-right text-teal-100 font-semibold hover:bg-teal-700/50 rounded-lg transition-colors"
            >
              <div className="flex items-center">
                <Icon name={group.icon} className="w-5 h-5 ml-3" />
                <span>{group.title}</span>
              </div>
              <Icon 
                name="chevron-down" 
                className={`w-5 h-5 transition-transform duration-300 ${openSections[group.id as keyof typeof openSections] ? 'rotate-180' : ''}`} 
              />
            </button>
            <div 
              className={`transition-all duration-500 ease-in-out overflow-hidden ${openSections[group.id as keyof typeof openSections] ? 'max-h-[500px]' : 'max-h-0'}`}
            >
              <ul className="pt-2 pr-4 pb-1 space-y-1 border-r-2 border-teal-700 mr-5">
                {group.items.map(item => (
                  <li key={item.id}>
                    <a 
                      href="#" 
                      onClick={(e) => { 
                        e.preventDefault();
                        if (item.id === 'aboutUs') {
                          onShowAboutUs();
                        } else {
                          const targetPage = item.id as any;
                          setActivePage(targetPage);
                          // Switch dir for english page
                          const mainContent = document.querySelector('main');
                          if(mainContent) {
                            if (targetPage === 'englishLessonPlanner') {
                              mainContent.dir = 'ltr';
                            } else {
                              mainContent.dir = 'rtl';
                            }
                          }
                        }
                      }}
                      className={`flex items-center p-2 rounded-lg font-medium transition-colors text-sm ${activePage === item.id ? 'bg-teal-700 text-white' : 'text-teal-200 hover:bg-teal-700/50 hover:text-white'}`}
                      aria-current={activePage === item.id ? 'page' : undefined}
                    >
                      <Icon name={item.icon} className="w-5 h-5 ml-3" />
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </nav>
      <div className="p-4 border-t border-teal-700 text-center text-sm text-teal-200">
        <p className="mb-2">أهلاً بك، <strong className="font-bold text-white">{teacherName}</strong></p>
        <button 
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 bg-red-600 text-white font-semibold py-2 px-3 rounded-lg hover:bg-red-700 transition-colors"
        >
          <Icon name="arrow-right" className="w-5 h-5" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}