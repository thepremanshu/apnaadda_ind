import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDHfMzgqiUHBaiwINCm0scl1ns4-mdfa94",
  authDomain: "hello-84022.firebaseapp.com",
  databaseURL: "https://hello-84022-default-rtdb.firebaseio.com",
  projectId: "hello-84022",
  storageBucket: "hello-84022.firebasestorage.app",
  messagingSenderId: "1063041671503",
  appId: "1:1063041671503:web:6921e93bc6cf1bbf3ae53a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Enable Firestore offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      // This can happen if you have multiple tabs open.
      console.warn('Firestore persistence failed: multiple tabs open.');
    } else if (err.code == 'unimplemented') {
      // The browser is not supported.
      console.warn('Firestore persistence not supported in this browser.');
    }
  });


export { auth, db };