/**
 * Firestore adapter — substitui o localAdapter.
 * Os stores não precisam mudar, apenas o import.
 *
 * Coleções no Firestore:
 *   teachers        — professores aprovados
 *   periods         — tempos de aula
 *   substitutions   — substituições registradas
 *   pendingTeachers — cadastros aguardando aprovação do admin
 *   users           — perfis de usuário (role: admin | professor)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const firestoreAdapter = {
  async getCollection<T>(col: string): Promise<T[]> {
    const snap = await getDocs(collection(db, col));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  },

  async getDoc<T>(col: string, id: string): Promise<T | null> {
    const snap = await getDoc(doc(db, col, id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
  },

  async setDoc<T extends { id: string }>(col: string, data: T): Promise<void> {
    await setDoc(doc(db, col, data.id), data);
  },

  async deleteDoc(col: string, id: string): Promise<void> {
    await deleteDoc(doc(db, col, id));
  },

  async queryWhere<T>(col: string, field: string, value: unknown): Promise<T[]> {
    const q = query(collection(db, col), where(field, "==", value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
  },
};
