import { useLanguage } from '../hooks/useLanguage'
import { LANGUAGES } from '../data/translations'

export default function LangToggle() {
  const { lang, setLang } = useLanguage()

  return (
    <div style={{
      display: 'flex',
      background: '#1A1A1A',
      border: '1px solid #252525',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          title={l.name}
          style={{
            padding: '5px 9px',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            background: lang === l.code ? '#FF6B00' : 'transparent',
            color: lang === l.code ? '#fff' : '#555',
            transition: 'all 0.2s',
            minWidth: 28,
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}