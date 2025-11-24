import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import { Teacher } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyBbDCfmJzQrKhD_6vFX1PKsAEvefOpjsPc",
  authDomain: "trbawetk.firebaseapp.com",
  databaseURL: "https://trbawetk-default-rtdb.firebaseio.com",
  projectId: "trbawetk",
  storageBucket: "trbawetk.firebasestorage.app",
  messagingSenderId: "870494691428",
  appId: "1:870494691428:web:e898f967d3d8d89eae3f71",
  measurementId: "G-HFCJY7P8KM"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const database = firebase.database();

// Export a reference to the 'appData' node in your database
export const appDataRef = database.ref('appData');

// Export a reference to the 'gradebooks' node for storing grade records
export const gradebooksRef = database.ref('gradebooks');

// --- USAGE LIMITS ---
export const usageDataRef = database.ref('usageData');

// Default limits for paid (monthly/yearly) accounts
export const USAGE_LIMITS = {
  lessonPlanGenerations: 30,
  examQuestionGenerations: 5,
  examAnswerGenerations: 5,
  graderQuestionGenerations: 7,
};

// Limits for trial accounts
export const TRIAL_USAGE_LIMITS = {
  lessonPlanGenerations: 3,
  examQuestionGenerations: 2,
  examAnswerGenerations: 2,
  graderQuestionGenerations: 2,
};


export type UsageData = {
  lastReset: string; // YYYY-MM
  lessonPlanGenerations: number;
  examQuestionGenerations: number;
  examAnswerGenerations: number;
  graderQuestionGenerations: number;
};

// Function to get or reset usage data for a teacher
export const getUsageData = async (teacher: Teacher): Promise<UsageData> => {
  if (!teacher || !teacher.id) {
      const defaultLimits = teacher?.status === 'trial' ? TRIAL_USAGE_LIMITS : USAGE_LIMITS;
      return { lastReset: '', ...defaultLimits };
  }
  const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const teacherUsageRef = usageDataRef.child(teacher.id);

  const baseLimits = teacher.status === 'trial' ? TRIAL_USAGE_LIMITS : USAGE_LIMITS;
  const limitsToUse = { ...baseLimits, ...teacher.usageLimits };

  const snapshot = await teacherUsageRef.once('value');
  const data = snapshot.val();

  if (data && data.lastReset === currentMonth) {
    // Data for the current month exists.
    const currentData = { ...limitsToUse, ...data };

    // Cap each feature's remaining count at its current limit.
    (Object.keys(limitsToUse) as Array<keyof typeof USAGE_LIMITS>).forEach(key => {
        if (currentData[key] > limitsToUse[key]) {
            currentData[key] = limitsToUse[key];
        }
    });

    return currentData;
  } else {
    // Needs reset or first time
    const newUsageData: UsageData = {
      lastReset: currentMonth,
      ...limitsToUse
    };
    await teacherUsageRef.set(newUsageData);
    return newUsageData;
  }
};

// Function to decrement usage for a specific feature
export const decrementUsage = (teacher: Teacher, feature: keyof typeof USAGE_LIMITS): Promise<void> => {
  if (!teacher || !teacher.id) return Promise.resolve();
  
  const featureRef = usageDataRef.child(teacher.id).child(feature);
  const baseLimits = teacher.status === 'trial' ? TRIAL_USAGE_LIMITS : USAGE_LIMITS;
  const limitsToUse = { ...baseLimits, ...teacher.usageLimits };
  
  return featureRef.transaction((currentValue) => {
    // If the node doesn't exist, this will be null. Start from the limit.
    if (currentValue === null) {
      return limitsToUse[feature] - 1; 
    }
    // Only decrement if there are uses left.
    if (currentValue > 0) {
      return currentValue - 1;
    }
    // If it's already 0 or less, don't change it.
    return currentValue; 
  }).then(() => { /* Transaction complete */ });
};
