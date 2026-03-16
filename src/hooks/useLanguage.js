import { useState, useEffect } from 'react'
import { translations } from '../data/translations'

// Default language: hin (Hinglish) — existing app strings
let globalLang = localStorage.getItem('nagrik_lang') || 'hin'
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
    const val = translations[lang]?.[key] ?? translations['hin']?.[key] ?? key
    return typeof val === 'function' ? val(...args) : val
  }

  return { lang, setLang: setGlobalLang, t }
}