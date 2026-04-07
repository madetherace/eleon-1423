import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function getDocument<T = DocumentData>(path: string, id: string): Promise<T | null> {
  try {
    const docRef = doc(db, path, id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as T) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    return null;
  }
}

export async function getDocuments<T = DocumentData>(path: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  try {
    const colRef = collection(db, path);
    const q = query(colRef, ...constraints);
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function setDocument<T extends DocumentData>(path: string, id: string, data: T): Promise<void> {
  try {
    const docRef = doc(db, path, id);
    await setDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${path}/${id}`);
  }
}

export async function updateDocument(path: string, id: string, data: Partial<DocumentData>): Promise<void> {
  try {
    const docRef = doc(db, path, id);
    await updateDoc(docRef, data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
  }
}

export function subscribeToDocument<T = DocumentData>(
  path: string,
  id: string,
  callback: (data: T | null) => void
) {
  const docRef = doc(db, path, id);
  return onSnapshot(
    docRef,
    (docSnap) => {
      callback(docSnap.exists() ? (docSnap.data() as T) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
    }
  );
}

export function subscribeToCollection<T = DocumentData>(
  path: string,
  callback: (data: T[]) => void,
  ...constraints: QueryConstraint[]
) {
  const colRef = collection(db, path);
  const q = query(colRef, ...constraints);
  return onSnapshot(
    q,
    (querySnapshot) => {
      callback(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T)));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
