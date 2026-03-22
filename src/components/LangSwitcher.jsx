import { useLang } from '../context/LangContext';

export default function LangSwitcher({ style = {} }) {
  const { lang, changeLang, LANGUAGES } = useLang();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, ...style }}>
      <span style={{ fontSize: 11, color: 'var(--text-light)', marginRight: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        🌐
      </span>
      {LANGUAGES.map(l => (
        <button
          key={l.code}
          onClick={() => changeLang(l.code)}
          style={{
            padding:      '3px 10px',
            borderRadius: 3,
            border:       lang === l.code ? 'none' : '1px solid var(--border)',
            background:   lang === l.code ? 'var(--navy)' : '#fff',
            color:        lang === l.code ? '#fff' : 'var(--text-mid)',
            fontSize:     12,
            fontWeight:   lang === l.code ? 700 : 400,
            cursor:       'pointer',
            fontFamily:   'inherit',
            transition:   'all 0.15s',
          }}>
          {l.native}
        </button>
      ))}
    </div>
  );
}