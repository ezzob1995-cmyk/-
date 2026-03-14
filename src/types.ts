export interface Course {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  category?: string;
  createdAt: any;
}

export interface Unit {
  id: string;
  courseId: string;
  title: string;
  order: number;
}

export type LessonDisplayMode = 'standard' | 'flashcards' | 'mindmap' | 'interactive_journey';

export interface Lesson {
  id: string;
  unitId: string;
  courseId: string;
  title: string;
  content: string;
  summary?: string;
  order: number;
  displayMode?: LessonDisplayMode;
}

export type ActivityType = 'game' | 'quiz' | 'video' | 'audio';

export interface Activity {
  id: string;
  lessonId: string;
  unitId: string;
  courseId: string;
  type: ActivityType;
  title: string;
  data: string; // JSON string
  url?: string;
  order: number;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  totalXp: number;
  level: number;
  role: 'admin' | 'student';
}

export interface UserProgress {
  id: string;
  userId: string;
  lessonId: string;
  completed: boolean;
  score: number;
  xpEarned: number;
  updatedAt: any;
}
