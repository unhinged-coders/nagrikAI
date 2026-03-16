import { useState, useEffect } from 'react'
import { translations } from '../data/translations'

// Global language state — shared across all components
let globalLang = localStorage.getItem('nagrik_lang') || 'en'
const listeners = new Set()

export const setGlobalLang = (lang) => {
  globalLang = lang
  localStorage.setItem('nagrik_lang', lang)
  listeners.forEach(fn => fn(lang))
}

export const useLanguage = () => {
  const [lang, setLang] = useState(globalLang)

  useEffect(() => {
    const handler = (l) => setLang(l)
    listeners.add(handler)
    return () => listeners.delete(handler)
  }, [])

  const t = (key, ...args) => {
    const val = translations[lang]?.[key] ?? translations['en']?.[key] ?? key
    return typeof val === 'function' ? val(...args) : val
  }

  return { lang, setLang: setGlobalLang, t }
}