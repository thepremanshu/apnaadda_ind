import { User as FirebaseUser } from "firebase/auth";

export interface Course {
  id: string;
  title: string;
  category: string;
  videoUrl: string; // Direct video file URL (e.g., from Firebase Storage)
  notesUrl: string;
  createdAt: any;
}

export interface AppUser {
  uid: string;
  email: string | null;
  role: 'admin' | 'user';
  nickname?: string;
  emoji?: string;
  createdAt?: any;
  completedCourses?: string[];
}

export interface AuthContextType {
  user: FirebaseUser | null;
  appUser: AppUser | null;
  loading: boolean;
}

// New Types for Chat
export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'admin' | 'system';
  timestamp: any;
}

export interface SupportChat {
  id: string;
  userId: string;
  userEmail: string;
  lastMessage: string;
  timestamp: any;
  status: 'new' | 'read';
}