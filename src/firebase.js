import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyD5XlFFb9jNlazaCAA4JmN9xRbjdwVfVVs",
  authDomain: "asistencia-estudiantes-37ebe.firebaseapp.com",
  projectId: "asistencia-estudiantes-37ebe",
  storageBucket: "asistencia-estudiantes-37ebe.appspot.com",
  messagingSenderId: "389726328899",
  appId: "1:389726328899:web:654976dddf14209246dcf6",
  measurementId: "G-JEC7C52SM2"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const db = getFirestore(app);      // ✅ Firestore para registrar estudiantes
export const storage = getStorage(app);   // ✅ Storage para subir QR
