'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { translate } from '../lib/translations';
const LanguageContext = createContext(null);
export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en');
  useEffect(() => { try { if (localStorage.getItem('pipeline-language') === 'pt') setLanguage('pt'); } catch {} }, []);
  useEffect(() => { document.documentElement.lang = language === 'pt' ? 'pt-BR' : 'en'; }, [language]);
  function changeLanguage(value) { setLanguage(value); try { localStorage.setItem('pipeline-language', value); } catch {} }
  return <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t: text => translate(text, language) }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  return <div className="language-toggle" role="group" aria-label="Language / Idioma"><button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button><button type="button" lang="pt-BR" aria-pressed={language === 'pt'} onClick={() => setLanguage('pt')}>Português</button></div>;
}
