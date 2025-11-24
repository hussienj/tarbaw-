

export interface LessonPlanData {
  learningOutcomes: string[];
  priorKnowledge: string;
  materialsAndTools: string[];
  vocabulary: string[];
  teachingProcess: {
    warmUp: string;
    activity: string;
    explanation: string;
    assessment: string;
    expansion: string;
  };
  finalAssessment: string;
  homework: string;
}

export interface UserInputs {
  class: string;
  date: string;
  chapterTitle: string;
  lessonTitle: string;
  sessions: string;
  teacherName: string;
  principalName: string;
}

// Types for English Lesson Planner
export interface EnglishLessonPlanData {
  objectives: string[];
  procedures: string[];
  materials: string[];
  language: string;
  vocabulary: string[];
  evaluation: string;
  homework: string;
}

export interface EnglishUserInputs {
  unit: string;
  lesson: string;
  date: string;
  subject: string;
  className: string;
  teacherName: string;
}


// Types for Exam Grader
export interface Question {
  id: string; // for React keys
  question: string;
  options: { A: string; B: string; C: string; D: string; };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | '';
}

export type AnswerKey = Question[];

export interface StudentFile {
    name: string;
    type: 'image' | 'pdf';
    base64: string; // For images
    url?: string; // For PDF.js
}

export interface GradingResult {
  studentName: string;
  studentSection: string;
  fileName: string; 
  summary: {
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    scorePercentage: number;
  };
  details: {
    questionNumber: number;
    questionText: string;
    studentAnswer: string;
    correctAnswer: string;
    status: 'صحيحة' | 'خاطئة';
  }[];
}

// Types for Exam Generator
export type QuestionType =
  | 'تعاريف'
  | 'تعاليل'
  | 'مقارنات'
  | 'فراغات'
  | 'اختر من متعدد'
  | 'صح وخطأ'
  | 'ارسم'
  | 'أسئلة مقالية'
  | 'انشاء'
  | 'أحكام التلاوة'
  | 'الحفظ'
  | 'التفسير والمعاني'
  | 'الحديث الشريف'
  | 'نوع آخر';

export interface ExamSubQuestion {
  id: string;
  text: string;
}

export interface ExamBranch {
  id: string;
  points: number;
  type: QuestionType;
  instruction: string; // "عرف خمسة مما يأتي"
  itemsToAnswer: number;
  subQuestions: ExamSubQuestion[];
  answer?: string; // For entire branch
}

export interface ExamQuestion {
  id: string;
  title: string; // "س1"
  totalPoints: number;
  instruction: string; // "أجب عن فرعين فقط"
  branchesToAnswer: number;
  branches: ExamBranch[];
}

export type ExamPaper = ExamQuestion[];

export interface ExamSettings {
  subject: string;
  grade: string;
  examType: string;
  answerStyle: 'on_paper' | 'separate_sheet';
  totalScore: number;
  topNote: string;
  numberOfQuestions: number;
}

export type FullExam = {
  settings: ExamSettings;
  paper: ExamPaper;
}

export type ExamAnswer = {
    questionId: string;
    branchId: string;
    answerText: string;
}

// --- NEW TYPES FOR ADMIN/AUTH ---
export interface Teacher {
  id: string;
  name: string;
  subject: string;
  password: string;
  grades: string[];
  status: 'trial' | 'monthly' | 'yearly';
  statusStartDate?: string; // ISO string for trial and monthly start dates
  trialDurationDays?: number;
  usageLimits?: {
    lessonPlanGenerations: number;
    examQuestionGenerations: number;
    examAnswerGenerations: number;
    graderQuestionGenerations: number;
  };
}

export interface AppData {
  teachers: Teacher[];
  subjects: string[];
}


// Types for Gradebook
export type Student = {
    id: number;
    name: string;
    grades: Record<string, number | null>;
};

export type CustomColumn = {
    title: string;
    max: number;
};

export type Month = {
    customColumns: CustomColumn[];
};

export type Semester = {
    months: Month[];
};

export type GradebookState = {
    info: { schoolName: string; teacherName: string; subjectName: string; className: string; year: string; examMaxGrade: number; };
    students: Student[];
    semesters: Semester[];
};
