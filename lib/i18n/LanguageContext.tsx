'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { translations, Lang, Translations } from './translations'

interface LanguageContextValue {
  lang: Lang
  t: Translations
  toggle: () => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ar',
  t: translations.ar,
  toggle: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ar')

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang | null
    if (saved === 'en' || saved === 'ar') setLang(saved)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    localStorage.setItem('lang', lang)
  }, [lang])

  function toggle() {
    setLang((l) => (l === 'ar' ? 'en' : 'ar'))
  }

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  return useContext(LanguageContext)
}
