import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Firebase Storage import removed — photos are now stored as base64 in Firestore directly.
// This avoids Storage CORS/permissions issues and the silent upload failures.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)

// NOTE: If you later want to re-enable Firebase Storage (e.g. for after-photos
// uploaded by BMC officers), just add back:
//   import { getStorage } from 'firebase/storage'
//   export const storage = getStorage(app)
// and update BmcDashboard.jsx to import it from here.