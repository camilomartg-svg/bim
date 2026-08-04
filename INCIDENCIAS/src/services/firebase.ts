import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence, enableIndexedDbPersistence } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Extract project from URL if available, else fallback to database ID in config
const urlParams = new URLSearchParams(window.location.search);
const urlProject = urlParams.get('project');
const databaseId = urlProject || (firebaseConfig as any).firestoreDatabaseId || 'ai-studio-235d0d5f-8239-4595-8dc2-ee264a9977f9';

export const db = getFirestore(app, databaseId);

// Connect in standard live online mode (persistence is disabled to avoid iframe sandbox offline locks)

export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
