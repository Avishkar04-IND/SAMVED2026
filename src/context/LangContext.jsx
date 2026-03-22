import { createContext, useContext, useState } from 'react';
import { LANGUAGES } from '../services/i18n';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem('safetynet_lang') || 'en'
  );

  const changeLang = (code) => {
    localStorage.setItem('safetynet_lang', code);
    setLangState(code); // ✅ React state update — no reload needed
  };

  return (
    <LangContext.Provider value={{ lang, changeLang, LANGUAGES }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);