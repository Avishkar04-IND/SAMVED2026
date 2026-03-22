import { useState, useEffect } from 'react';
import { ref, onValue }        from 'firebase/database';
import { db as firebaseDb }    from '../services/firebase';
import { useAuth }             from '../context/AuthContext';
import { updateProfile }       from '../services/api';
import GovtLayout              from '../components/GovtLayout';
import GradeTag                from '../components/GradeTag';
import LangSwitcher            from '../components/LangSwitcher';
import { useLang }             from '../context/LangContext';
import { t }                   from '../services/i18n';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// ── Small reusable field display ──────────────────────────────
function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-light)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, minWidth: 140 }}>{label}</span>
      <span style={{ fontSize: 13, color: highlight ? '#c62828' : 'var(--text)', fontWeight: highlight ? 700 : 400, textAlign: 'right', flex: 1, marginLeft: 12 }}>
        {value || <span style={{ color: '#bbb', fontStyle: 'italic' }}>Not provided</span>}
      </span>
    </div>
  );
}

// ── Section card wrapper ───────────────────────────────────────
function Section({ title, icon, children, accent }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderTop: `3px solid ${accent || 'var(--navy)'}`, borderRadius: 4, marginBottom: 18, boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>{title}</span>
      </div>
      <div style={{ padding: '6px 18px 14px' }}>{children}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, login }       = useAuth();
  const { lang }              = useLang();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const [totalShifts, setTotalShifts] = useState(0);

  // Form state
  const [form, setForm] = useState({});

  // Load full profile from Firebase
  useEffect(() => {
    if (!user?.id) return;
    const path = user.role === 'supervisor'
      ? `users/supervisors/${user.id}`
      : `users/workers/${user.id}`;

    const unsub = onValue(ref(firebaseDb, path), snap => {
      if (snap.exists()) {
        setProfile(snap.val());
        setForm(snap.val());
      }
    });
    return () => unsub();
  }, [user]);

  // Count total shifts for worker
  useEffect(() => {
    if (!user?.id || user.role !== 'worker') return;
    const unsub = onValue(ref(firebaseDb, `sessions/${user.id}`), snap => {
      if (snap.exists()) {
        let count = 0;
        snap.forEach(child => { if (child.val().status === 'completed') count++; });
        setTotalShifts(count);
      }
    });
    return () => unsub();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateProfile(user.role, user.id, form);
      setProfile(res.data.user);
      // Update AuthContext with new data
      login({ ...user, ...res.data.user });
      setEditing(false);
      setMsg('✅ Profile updated successfully.');
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('❌ Failed to save. Try again.');
      setTimeout(() => setMsg(''), 3000);
    } finally { setSaving(false); }
  };

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  if (!profile) return (
    <GovtLayout breadcrumb={t('profile','title',lang)}>
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>⏳ Loading profile...</div>
    </GovtLayout>
  );

  const isWorker = user.role === 'worker';

  return (
    <GovtLayout breadcrumb={t('profile','title',lang)}>

      {msg && (
        <div style={{ background: msg.startsWith('❌') ? '#ffebee' : '#e8f5e9', border: `1px solid ${msg.startsWith('❌') ? '#ef9a9a' : '#a5d6a7'}`, borderLeft: `4px solid ${msg.startsWith('❌') ? '#c62828' : '#2e7d32'}`, borderRadius: 3, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: msg.startsWith('❌') ? '#c62828' : '#2e7d32', fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* Profile Header */}
      <div style={{ background: 'var(--navy)', borderRadius: 6, padding: '24px 28px', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 22, boxShadow: '0 2px 10px rgba(0,0,0,0.15)' }}>
        <div style={{ width: 72, height: 72, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, border: '3px solid #a8bcd8', flexShrink: 0 }}>
          {isWorker ? '👷' : '🧑‍💼'}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontSize: 20, fontWeight: 800 }}>{profile.name}</div>
          <div style={{ color: '#a8bcd8', fontSize: 13, marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>🪪 ID: <strong style={{ color: '#d4e0f0' }}>{profile.workerId || profile.supervisorId}</strong></span>
            <span>🏢 {profile.department || 'Sanitation'}</span>
            <span>📅 Joined: {profile.joiningDate || 'N/A'}</span>
            {isWorker && <span>⏱️ Last seen: {profile.lastSeen ? new Date(profile.lastSeen).toLocaleDateString() : 'N/A'}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ background: isWorker ? '#e8f5e9' : '#e8eef7', color: isWorker ? '#2e7d32' : 'var(--navy)', padding: '3px 12px', borderRadius: 3, fontSize: 12, fontWeight: 700 }}>
            {isWorker ? '👷 WORKER' : '🧑‍💼 SUPERVISOR'}
          </span>
          {isWorker && <GradeTag grade={profile.healthClass || 'A'} />}
          <button onClick={() => setEditing(!editing)} style={{ background: editing ? '#c62828' : 'var(--saffron)', color: '#fff', border: 'none', padding: '6px 16px', borderRadius: 3, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {editing ? t('common','cancel',lang) : t('profile','editProfile',lang)}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isWorker ? '1fr 1fr' : '1fr 1fr', gap: 18 }}>

        {/* LEFT COLUMN */}
        <div>
          {/* Basic Info */}
          <Section title={t('profile','basicInfo',lang)} icon="👤" accent="var(--navy)">
            {editing ? (
              <>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label>{t('profile','phone',lang)}</label>
                  <input className="form-control" value={form.phone || ''} onChange={e => set('phone', e.target.value)} placeholder="e.g. 9876543210" />
                </div>
                <div className="form-group">
                  <label>{t('profile','department',lang)}</label>
                  <select className="form-control" value={form.department || ''} onChange={e => set('department', e.target.value)}>
                    <option>Sanitation</option>
                    <option>Sewer & Drainage</option>
                    <option>Manhole Operations</option>
                    <option>Storm Water</option>
                    <option>Urban Sanitation</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('profile','address',lang)}</label>
                  <input className="form-control" value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Residential address" />
                </div>
              </>
            ) : (
              <>
                <InfoRow label={t('profile','basicInfo',lang)}   value={profile.name} />
                <InfoRow label="ID"          value={profile.workerId || profile.supervisorId} />
                <InfoRow label={t('profile','department',lang)}  value={profile.department} />
                <InfoRow label={t('profile','phone',lang)}       value={profile.phone} />
                <InfoRow label={t('profile','address',lang)}     value={profile.address} />
                <InfoRow label="Joined"      value={profile.joiningDate} />
              </>
            )}
          </Section>

          {/* Worker Stats */}
          {isWorker && (
            <Section title={t('profile','workStats',lang)} icon="📊" accent="var(--saffron)">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 10 }}>
                {[
                  { label: t('profile','totalShifts',lang), val: totalShifts, icon: '🔄' },
                  { label: t('profile','healthClass',lang), val: profile.healthClass || 'A', icon: '💪' },
                  { label: t('profile','status',lang),       val: profile.status === 'active' ? 'Active' : 'Offline', icon: '📡' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '12px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{s.val}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 12 }}>
                <InfoRow label={t('profile','lastActive',lang)}    value={profile.lastSeen ? new Date(profile.lastSeen).toLocaleString() : 'N/A'} />
                <InfoRow label={t('profile','supervisor',lang)}     value={profile.supervisorId || 'Not assigned'} />
              </div>
            </Section>
          )}

          {/* Supervisor Stats */}
          {!isWorker && (
            <Section title={t('profile','teamOverview',lang)} icon="👥" accent="var(--saffron)">
              <div style={{ marginTop: 10 }}>
                <InfoRow label={t('profile','totalShifts',lang)} value={`${Array.isArray(profile.workers) ? profile.workers.length : 0} / 5`} />
                <InfoRow label="Department"       value={profile.department} />
                <InfoRow label={t('profile','lastActive',lang)}      value={profile.lastSeen ? new Date(profile.lastSeen).toLocaleString() : 'N/A'} />
              </div>
            </Section>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Medical Info — workers only */}
          {isWorker && (
            <Section title={t('profile','medical',lang)} icon="🏥" accent="#c62828">
              <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 4, padding: '8px 12px', marginTop: 10, marginBottom: 12, fontSize: 12, color: '#e65100', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span>⚠️</span>
                <span>This information is used by supervisors and emergency responders. Keep it accurate and up to date.</span>
              </div>
              {editing ? (
                <>
                  <div className="form-group">
                    <label>{t('profile','bloodGroup',lang)} <span style={{ color: '#c62828' }}>*</span></label>
                    <select className="form-control" value={form.bloodGroup || ''} onChange={e => set('bloodGroup', e.target.value)}>
                      <option value="">— Select —</option>
                      {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Known Medical Conditions</label>
                    <input className="form-control" value={form.conditions || ''} onChange={e => set('conditions', e.target.value)} placeholder="e.g. Asthma, Hypertension (or None)" />
                  </div>
                  <div className="form-group">
                    <label>Allergies</label>
                    <input className="form-control" value={form.allergies || ''} onChange={e => set('allergies', e.target.value)} placeholder="e.g. Penicillin, Dust (or None)" />
                  </div>
                  <div style={{ background: 'var(--navy-light)', border: '1px solid #c5d3e8', borderRadius: 4, padding: '12px', marginTop: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>🆘 Emergency Contact</div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label>Contact Name</label>
                      <input className="form-control" value={form.emergencyContactName || ''} onChange={e => set('emergencyContactName', e.target.value)} placeholder="Full name of emergency contact" />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label>Contact Phone</label>
                      <input className="form-control" value={form.emergencyContactPhone || ''} onChange={e => set('emergencyContactPhone', e.target.value)} placeholder="Mobile number" />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label={t('profile','bloodGroup',lang)}  value={profile.bloodGroup}  highlight={!profile.bloodGroup} />
                  <InfoRow label="Conditions"   value={profile.conditions || 'None'} />
                  <InfoRow label="Allergies"    value={profile.allergies  || 'None'} />
                  <div style={{ marginTop: 12, background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4, padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#c62828', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>🆘 Emergency Contact</div>
                    <InfoRow label="Name"  value={profile.emergencyContactName}  highlight={!profile.emergencyContactName} />
                    <InfoRow label="Phone" value={profile.emergencyContactPhone} highlight={!profile.emergencyContactPhone} />
                  </div>
                  {(!profile.bloodGroup || !profile.emergencyContactName) && (
                    <div style={{ marginTop: 12, background: '#fff3e0', border: '1px solid #ffcc02', borderRadius: 4, padding: '10px 12px', fontSize: 12, color: '#e65100', display: 'flex', gap: 8 }}>
                      <span>⚠️</span>
                      <span>{t('profile','missingFields',lang)}</span>
                    </div>
                  )}
                </>
              )}
            </Section>
          )}

          {/* Safety Protocol — both roles */}
          <Section title={t('profile','safety',lang)} icon="🛡️" accent="#2e7d32">
            <div style={{ marginTop: 10 }}>
              {isWorker ? (
                <>
                  <InfoRow label="Confined Space" value="Allowed only with valid permit + buddy" />
                  <InfoRow label="Gas Threshold"  value="Warning > +20 ppm, Danger > +50 ppm from baseline" />
                  <InfoRow label="Temp Threshold" value="Warning > 33°C, Danger > 37°C" />
                  <InfoRow label="Dead Man Switch" value="Auto-SOS after 5 min no device response" />
                  <InfoRow label="SOS Protocol"   value="Press helmet button OR app SOS button" />
                  <InfoRow label="Rescue Line"     value="1800-XXX-XXXX (Toll Free, 24x7)" />
                </>
              ) : (
                <>
                  <InfoRow label="Response Time"  value="Acknowledge SOS within 2 minutes" />
                  <InfoRow label="Escalation"     value="2 min → Area Manager, 5 min → Emergency" />
                  <InfoRow label="Emergency"      value="108 (Ambulance), 101 (Fire), 100 (Police)" />
                  <InfoRow label="Rescue Line"    value="1800-XXX-XXXX (Toll Free, 24x7)" />
                  <InfoRow label="Max Workers"    value="5 workers per supervisor" />
                </>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Save Button */}
      {editing && (
        <div style={{ position: 'sticky', bottom: 16, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', boxShadow: '0 -2px 12px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-light)' }}>You have unsaved changes</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setEditing(false); setForm(profile); }} style={{ background: '#fff', border: '1px solid var(--border)', color: 'var(--text-mid)', padding: '9px 20px', borderRadius: 3, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
              {t('profile','discard',lang)}
            </button>
            <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#ccc' : 'var(--navy)', color: '#fff', border: 'none', padding: '9px 24px', borderRadius: 3, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              {saving ? t('profile','saving',lang) : t('profile','saveChanges',lang)}
            </button>
          </div>
        </div>
      )}

    </GovtLayout>
  );
}