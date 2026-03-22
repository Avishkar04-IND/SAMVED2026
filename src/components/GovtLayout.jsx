import { useAuth }      from '../context/AuthContext';
import { useNavigate }  from 'react-router-dom';
import { useLang }      from '../context/LangContext';
import LangSwitcher     from './LangSwitcher';
import { t }            from '../services/i18n';

export default function GovtLayout({ children, breadcrumb }) {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const { lang, changeLang, LANGUAGES } = useLang();

  const handleLogout = () => { logout(); navigate('/'); };

  const navLinkStyle = {
    color: '#fff', fontSize: 12.5, fontWeight: 600,
    padding: '0 14px', height: 36,
    display: 'inline-flex', alignItems: 'center',
    textDecoration: 'none', cursor: 'pointer',
    borderRight: '1px solid rgba(255,255,255,0.25)',
    background: 'transparent', border: 'none',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── TOP RIBBON ── */}
      <div style={{ background: '#122850', color: '#cdd8ec', fontSize: 11.5, padding: '5px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>🇮🇳 &nbsp;{t('common','govt',lang)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <button onClick={() => navigate('/profile')} style={{ background: 'transparent', border: '1px solid #a8bcd8', color: '#a8bcd8', padding: '2px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
              👤 {user.name}
              <span style={{ background: 'var(--saffron)', color: '#fff', padding: '1px 7px', borderRadius: 2, fontSize: 10, fontWeight: 700 }}>
                {user.role?.toUpperCase()}
              </span>
            </button>
          )}
          <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid #a8bcd8', color: '#a8bcd8', padding: '2px 10px', borderRadius: 2, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            Logout
          </button>
        </div>
      </div>

      {/* ── HEADER ── */}
      <div style={{ background: 'var(--navy)', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, border: '3px solid #a8bcd8', flexShrink: 0 }}>🛡️</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>{t('common','appName',lang)} — {t('common','appSubtitle',lang)}</div>
            <div style={{ color: '#a8bcd8', fontSize: 11.5, marginTop: 2 }}>{t('common','appDesc',lang)}</div>
          </div>
          <span style={{ background: 'var(--saffron)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 3 }}>SAMVED 2026</span>
        </div>
      </div>

      {/* ── NAV ── */}
      <div style={{ background: 'var(--saffron)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', alignItems: 'center', height: 36, padding: '0 0 0 24px' }}>
          {user?.role === 'supervisor' ? (
            <>
              <button onClick={() => navigate('/supervisor/dashboard')} style={navLinkStyle}>🏠 Dashboard</button>
              <button onClick={() => navigate('/supervisor/assign')}    style={navLinkStyle}>👥 Manage Workers</button>
            </>
          ) : (
            <>
              <button onClick={() => navigate('/worker/dashboard')} style={navLinkStyle}>🏠 My Dashboard</button>
              <button onClick={() => navigate('/worker/history')}   style={navLinkStyle}>📋 Work History</button>
            </>
          )}
          <button style={{ ...navLinkStyle, marginLeft: 'auto' }}>📞 {t('common','emergency',lang)}</button>
          <LangSwitcher style={{ marginLeft: 12, paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,0.25)' }} />
        </div>
      </div>

      {/* ── BREADCRUMB ── */}
      {breadcrumb && (
        <div style={{ background: 'var(--navy-light)', borderBottom: '1px solid var(--border)', padding: '7px 24px', fontSize: 12, color: 'var(--text-light)' }}>
          Home &rsaquo; <span style={{ color: 'var(--navy)', fontWeight: 600 }}>{breadcrumb}</span>
        </div>
      )}

      {/* ── CONTENT ── */}
      <main style={{ flex: 1, background: 'var(--bg)', padding: '24px 16px' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      {/* ── FOOTER ── */}
      <div style={{ background: '#122850', color: '#8fa5c8', fontSize: 12, padding: '12px 24px', borderTop: '3px solid var(--saffron)' }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>© 2026 Solapur Municipal Corporation &nbsp;|&nbsp; SafetyNet Pro v1.0 &nbsp;|&nbsp; SAMVED 2026</div>
          <div>Designed by Team Phoenix_26</div>
        </div>
      </div>

    </div>
  );
}