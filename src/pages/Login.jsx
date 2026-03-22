import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { workerLogin, supervisorLogin } from '../services/api';
import '../index.css';
import { useLang }   from '../context/LangContext';
import { t as tr }   from '../services/i18n';
import { LANGUAGES } from '../services/i18n';
import { unlockAudio } from '../services/alertSound';

export default function Login() {
  const { login }    = useAuth();
  const navigate     = useNavigate();

  const [role, setRole]         = useState('worker');
  const [name, setName]         = useState('');
  const [userId, setUserId]     = useState('');
  const [dept, setDept]         = useState('');
  const [code, setCode]         = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { lang, changeLang }    = useLang();

  const handleLogin = async () => {
    unlockAudio(); // unlock browser audio on first interaction
    setError('');
    if (!name.trim() || !userId.trim()) {
      setError('Please fill in all required fields.'); return;
    }
    if (role === 'supervisor' && (!dept || !code.trim())) {
      setError('Department and Access Code are required for Supervisor login.'); return;
    }

    setLoading(true);
    try {
      let res;
      if (role === 'worker') {
        res = await workerLogin({ name: name.trim(), workerId: userId.trim() });
        const user = { ...res.data.user, role: 'worker', id: userId.trim() };
        login(user);
        navigate('/worker/dashboard');
      } else {
        res = await supervisorLogin({
          name: name.trim(), supervisorId: userId.trim(),
          department: dept, accessCode: code.trim(),
        });
        const user = { ...res.data.user, role: 'supervisor', id: userId.trim() };
        login(user);
        // Go to assign page if no workers assigned yet, else dashboard
        const hasWorkers = res.data.user?.workers?.length > 0;
        navigate(hasWorkers ? '/supervisor/dashboard' : '/supervisor/assign');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter') handleLogin(); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── TOP RIBBON ── */}
      <div className="govt-header">
        <div className="top-ribbon">
          <div>🇮🇳 &nbsp;Government of Maharashtra &nbsp;|&nbsp; Solapur Municipal Corporation</div>
          <div>
            <a href="#" style={{marginRight:4}}>Screen Reader</a>
            {LANGUAGES.map(l => (
              <button key={l.code} onClick={() => changeLang(l.code)}
                style={{ background: lang===l.code ? "var(--saffron)":"transparent", color: lang===l.code?"#fff":"#a8bcd8", border: lang===l.code?"none":"1px solid #a8bcd8", padding:"1px 8px", borderRadius:2, cursor:"pointer", fontSize:11, marginLeft:4, fontFamily:"inherit" }}>
                {l.native}
              </button>
            ))}
          </div>
        </div>
        <div className="header-inner">
          <div className="logo">🛡️</div>
          <div className="title-block">
            <div className="main">SafetyNet Pro — Smart Sanitation Safety System</div>
            <div className="deva">स्मार्ट स्वच्छता सुरक्षा प्रणाली</div>
            <div className="sub">IoT-Enabled Worker Safety Monitoring | Solapur Municipal Corporation</div>
          </div>
          <div className="header-right">
            <span className="badge badge-saffron">SAMVED 2026</span><br/>
            <span style={{ color: '#a8bcd8', fontSize: '11px', marginTop: 5, display: 'block' }}>
              Dept. of Urban Development, Maharashtra
            </span>
          </div>
        </div>
      </div>

      {/* ── NAV ── */}
      <div className="govt-nav">
        <div className="nav-inner">
          <a href="#" className="active">🏠 Home</a>
          <a href="#">About</a>
          <a href="#">Help</a>
          <a href="#">Contact</a>
          <a href="#">Emergency: 1800-XXX-XXXX</a>
        </div>
      </div>

      {/* ── BREADCRUMB ── */}
      <div className="breadcrumb">
        Home &rsaquo; <span>Login Portal</span>
      </div>

      {/* ── MAIN ── */}
      <main style={{ flex: 1, padding: '32px 16px 48px', background: 'var(--bg)' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 400px',
          gap: 28, maxWidth: 1000,
          margin: '0 auto', alignItems: 'start'
        }}>

          {/* LEFT — INFO PANEL */}
          <div>
            {/* Stats */}
            <div className="grid-3" style={{ marginBottom: 18 }}>
              {[
                { num: '5',  lbl: 'Active Workers'  },
                { num: '2',  lbl: 'Supervisors'      },
                { num: '0',  lbl: 'Active Alerts'    },
              ].map(s => (
                <div key={s.lbl} className="card" style={{ textAlign: 'center', padding: '14px 10px' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)' }}>{s.num}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', marginTop: 4 }}>{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Instructions */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">📢 {tr('login','instructions',lang)}</div>
              <div className="card-body" style={{ padding: '12px 16px' }}>
                <ul style={{ listStyle: 'none' }}>
                  {[
                    'Workers must login before entering any confined space or manhole.',
                    'Ensure your safety helmet IoT device is powered ON before logging in.',
                    'Supervisors must assign workers to their team before monitoring begins.',
                    'In case of emergency, press the physical SOS button on the helmet.',
                    'For login issues contact your Area Manager or call the helpline.',
                  ].map((item, i) => (
                    <li key={i} style={{
                      fontSize: 12.5, color: 'var(--text-mid)',
                      padding: '6px 0', borderBottom: '1px solid #f0f0f0',
                      display: 'flex', gap: 8
                    }}>
                      <span style={{ color: 'var(--saffron)', fontWeight: 700, flexShrink: 0 }}>›</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* {tr('login','systemStatus',lang)} */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">🟢 System Status</div>
              <div className="card-body" style={{ padding: '12px 16px' }}>
                {[
                  ['Firebase Database', '🟢 Online'],
                  ['GPS Tracking',      '🟢 Operational'],
                  ['Alert System',      '🟢 Active'],
                  ['Last Data Sync',    'A few seconds ago'],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: 12.5, padding: '5px 0',
                    borderBottom: '1px solid #f0f0f0', color: 'var(--text-mid)'
                  }}>
                    <span>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Helpline */}
            <div style={{
              background: 'var(--navy-light)', border: '1px solid var(--border)',
              borderRadius: 4, padding: '10px 14px', fontSize: 12, color: 'var(--text-mid)'
            }}>
              📞 <strong>Help Desk:</strong> 1800-XXX-XXXX (Toll Free) &nbsp;|&nbsp;
              <strong>Email:</strong> safetysupport@solapurmc.gov.in<br/>
              Working Hours: Mon–Sat, 6:00 AM – 8:00 PM
            </div>
          </div>

          {/* RIGHT — LOGIN CARD */}
          <div className="card" style={{ boxShadow: 'var(--shadow-lg)' }}>

            {/* Card Header */}
            <div style={{ background: 'var(--navy)', padding: '16px 22px', textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>
                {tr('login','title',lang)}
              </div>
              <div style={{ color: '#a8bcd8', fontSize: 12, marginTop: 3 }}>
                {tr('login','subtitle',lang)}
              </div>
            </div>

            {/* Role Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '2px solid var(--border)' }}>
              {[
                { key: 'worker',     icon: '👷', label: tr('login','workerTab',lang)     },
                { key: 'supervisor', icon: '🧑‍💼', label: tr('login','supervisorTab',lang) },
              ].map(tab => (
                <button key={tab.key} onClick={() => { setRole(tab.key); setError(''); }}
                  style={{
                    padding: '13px 10px', textAlign: 'center', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, border: 'none',
                    borderRight: tab.key === 'worker' ? '1px solid var(--border)' : 'none',
                    borderBottom: role === tab.key ? '2px solid var(--saffron)' : '2px solid transparent',
                    marginBottom: -2,
                    background: role === tab.key ? '#fff' : '#f8f9fb',
                    color: role === tab.key ? 'var(--navy)' : 'var(--text-light)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    transition: 'all 0.15s',
                  }}>
                  <span style={{ fontSize: 18 }}>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            {/* Form */}
            <div style={{ padding: 22 }}>

              {error && (
                <div className="alert alert-error" style={{ marginBottom: 14 }}>
                  ⚠️ {error}
                </div>
              )}

              <div className="form-group">
                <label>Full Name <span className="req">*</span></label>
                <input className="form-control" type="text"
                  placeholder="Enter your full name"
                  value={name} onChange={e => setName(e.target.value)}
                  onKeyDown={handleKeyDown} />
              </div>

              <div className="form-group">
                <label>
                  {role === 'worker' ? 'Worker ID' : 'Supervisor ID'}
                  <span className="req">*</span>
                </label>
                <input className="form-control" type="text"
                  placeholder={role === 'worker' ? 'e.g. WRK-001' : 'e.g. SUP-001'}
                  value={userId} onChange={e => setUserId(e.target.value)}
                  onKeyDown={handleKeyDown} />
              </div>

              {/* Supervisor-only fields */}
              {role === 'supervisor' && (
                <div style={{
                  background: 'var(--navy-light)', border: '1px solid #c5d3e8',
                  borderRadius: 3, padding: 14, marginBottom: 16
                }}>
                  <div style={{
                    fontSize: 11.5, fontWeight: 700, color: 'var(--navy)',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    🔐 Supervisor Credentials
                  </div>
                  <div className="form-group" style={{ marginBottom: 12 }}>
                    <label>Department <span className="req">*</span></label>
                    <select className="form-control" value={dept} onChange={e => setDept(e.target.value)}>
                      <option value="">— Select Department —</option>
                      <option>Sewer &amp; Drainage</option>
                      <option>Manhole Operations</option>
                      <option>Storm Water</option>
                      <option>Urban Sanitation</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Access Code <span className="req">*</span></label>
                    <input className="form-control" type="password"
                      placeholder="Enter supervisor access code"
                      value={code} onChange={e => setCode(e.target.value)}
                      onKeyDown={handleKeyDown} />
                  </div>
                </div>
              )}

              <hr className="divider" />

              <button className="btn btn-primary btn-full"
                onClick={handleLogin} disabled={loading}
                style={{ padding: '11px', fontSize: 14, opacity: loading ? 0.7 : 1 }}>
                {loading ? '⏳ ' + tr('login','loggingIn',lang) : tr('login','loginBtn',lang)}
              </button>

              <div className="text-muted text-center mt-8" style={{ lineHeight: 1.6 }}>
                By logging in you agree to the Terms of Use of Solapur Municipal Corporation.<br/>
                Forgot your ID? Contact your <span style={{ color: 'var(--navy)', fontWeight: 600 }}>Area Manager</span>.
              </div>
            </div>

            {/* Helpline strip */}
            <div style={{
              background: '#fff8f0', borderTop: '1px solid #f0d8c0',
              padding: '9px 22px', display: 'flex', alignItems: 'center',
              gap: 8, fontSize: 12, color: 'var(--text-mid)'
            }}>
              📞 &nbsp;Helpline: <strong style={{ color: 'var(--saffron)' }}>1800-XXX-XXXX</strong>
              &nbsp;|&nbsp; Available 6 AM – 8 PM
            </div>
          </div>

        </div>
      </main>

      {/* ── FOOTER ── */}
      <div className="govt-footer">
        <div className="footer-inner">
          <div>© 2026 Solapur Municipal Corporation &nbsp;|&nbsp; SafetyNet Pro v1.0 &nbsp;|&nbsp; SAMVED 2026</div>
          <div>
            <a href="#">Privacy Policy</a>
            <a href="#">Disclaimer</a>
            <a href="#">Help</a>
          </div>
          <div>Designed by Team Phoenix_26</div>
        </div>
      </div>

    </div>
  );
}