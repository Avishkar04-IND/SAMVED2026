import { initializeApp } from 'firebase/app';
import { getDatabase }   from 'firebase/database';

const firebaseConfig = {
  apiKey:            "AIzaSyDbtc8Vj_eTyu5gUjC5rxcrXUnsIv1iMcU",
  authDomain:        "samved-63bda.firebaseapp.com",
  databaseURL:       "https://samved-63bda-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "samved-63bda",
  storageBucket:     "samved-63bda.firebasestorage.app",
  messagingSenderId: "645959520526",
  appId:             "1:645959520526:web:603101d7b08fe0efdd475f",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);