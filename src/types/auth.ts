export type UserRole = "admin" | "professor" | "pending";

export interface UserProfile {
  id: string;          // Firebase Auth UID
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  teacherId?: string;  // linked Teacher document id
  createdAt: string;
}
