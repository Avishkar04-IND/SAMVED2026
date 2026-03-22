import { useState, useEffect, useRef } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { ref, onValue, push }          from 'firebase/database';
import { db as firebaseDb }            from '../services/firebase';
import { useAuth }                     from '../context/AuthContext';
import { getWorkersBySupervisor, autoAssignTask, removeWorker } from '../services/api';
import LangSwitcher from '../components/LangSwitcher';
import { useLang }  from '../context/LangContext';
import { t }        from '../services/i18n';
import { playSOSSound, playWarningSound, playEscalationSound, playAcknowledgeSound } from '../services/alertSound';
import GovtLayout                      from '../components/GovtLayout';
import WorkerCard                      from '../components/WorkerCard';
import WorkerDetail                    from '../components/WorkerDetail';
import AlertLog                        from '../components/AlertLog';
import SOSBanner                       from '../components/SOSBanner';

// Escalation stages timing (seconds)
const ESCALATION_STAGE2 = 120; // 2 min  → Area Manager notified
const ESCALATION_STAGE3 = 300; // 5 min  → Emergency protocol

export default function AdminDashboard() {
  const { user }                      = useAuth();
  const { lang }                      = useLang();
  const navigate                      = useNavigate();
  const [workers, setWorkers]         = useState([]);
  const [sensorMap, setSensorMap]     = useState({});
  const [alerts, setAlerts]           = useState([]);
  const [selectedWorker, setSelected] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [removingId, setRemovingId]   = useState(null);

  // activeSOS: { id, workerId, name, type, message, stage, firedAt, acknowledged }
  const [activeSOS, setActiveSOS]     = useState([]);

  const seenAlertKeys    = useRef(new Set());
  const isFirstAlertLoad = useRef(true);
  const workerStatusRef  = useRef({});
  const isFirstSensorLoad = useRef(true);

  // ── Escalation timer — runs every 10s ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setActiveSOS(prev => prev.map(sos => {
        if (sos.acknowledged) return sos;
        const elapsed = (now - sos.firedAt) / 1000;
        let newStage = sos.stage;
        if (elapsed >= ESCALATION_STAGE3) newStage = 3;
        else if (elapsed >= ESCALATION_STAGE2) newStage = 2;
        if (newStage !== sos.stage) {
          // Play escalation sound
          playEscalationSound();
          // Log escalation to Firebase
          push(ref(firebaseDb, 'alerts'), {
            workerId:     sos.workerId,
            workerName:   sos.name,
            supervisorId: user?.id,
            type:         'ESCALATION',
            message:      newStage === 3
              ? `🚨 STAGE 3 ESCALATION: No response for 5+ minutes for worker ${sos.name}. Emergency protocol activated!`
              : `📢 STAGE 2 ESCALATION: Alert unacknowledged for 2+ minutes for worker ${sos.name}. Area Manager notified.`,
            timestamp: now, seen: false,
          }).catch(console.error);
        }
        return { ...sos, stage: newStage };
      }));
    }, 10000);
    return () => clearInterval(interval);
  }, [user]);

  // ✅ Real-time worker list — listens for status changes (active/inactive)
  useEffect(() => {
    if (!user?.id) return;

    // Initial load from backend
    getWorkersBySupervisor(user.id)
      .then(res => {
        const list = res.data || [];
        setWorkers(list);
        list.forEach(w => autoAssignTask(w.workerId).catch(() => {}));
      })
      .catch(() => setError('Could not load workers. Is the server running?'))
      .finally(() => setLoading(false));

    // Also listen to Firebase workers node for live status changes
    const workersRef = ref(firebaseDb, 'users/workers');
    const unsub = onValue(workersRef, snap => {
      if (!snap.exists()) return;
      const updated = [];
      snap.forEach(child => {
        const w = child.val();
        if (w.supervisorId === user.id) updated.push(w);
      });
      if (updated.length > 0) setWorkers(updated);
    });
    return () => unsub();
  }, [user]);

  // Live sensor + auto-distress
  useEffect(() => {
    if (workers.length === 0) return;
    const unsub = onValue(ref(firebaseDb, 'sensorData/activeSession'), snap => {
      if (!snap.exists()) return;
      const data = snap.val();

      if (!data.workerId) {
        setSensorMap({});
        isFirstSensorLoad.current = true;
        return;
      }

      // ✅ Only ONE worker can have the device at a time
      // Clear all others and set only the active worker's data
      setSensorMap({ [data.workerId]: data });

      if (isFirstSensorLoad.current) {
        workerStatusRef.current[data.workerId] = data.status || 'SAFE';
        isFirstSensorLoad.current = false;
        return;
      }

      const isMyWorker = workers.some(w => w.workerId === data.workerId);
      if (!isMyWorker) return;

      const newStatus  = data.status || 'SAFE';
      const prevStatus = workerStatusRef.current[data.workerId] || 'SAFE';
      if (newStatus === prevStatus) return;
      workerStatusRef.current[data.workerId] = newStatus;

      const worker = workers.find(w => w.workerId === data.workerId);

      if (newStatus === 'DANGER' || newStatus === 'WARNING') {
        setActiveSOS(prev => {
          if (prev.some(s => s.workerId === data.workerId && s.type === newStatus && !s.acknowledged)) return prev;
          return [...prev, {
            id:           `auto-${data.workerId}-${Date.now()}`,
            workerId:     data.workerId,
            name:         worker?.name || data.workerName || data.workerId,
            type:         newStatus,
            stage:        1,
            firedAt:      Date.now(),
            acknowledged: false,
            message:      newStatus === 'DANGER'
              ? `🚨 DANGER: ${worker?.name} — Critical IoT reading! Immediate response required.`
              : `⚠️ WARNING: ${worker?.name} — Elevated sensor readings. Monitor closely.`,
          }];
        });
      }
      if (newStatus === 'SAFE') {
        setActiveSOS(prev => prev.filter(s => s.workerId !== data.workerId));
      }
    });
    return () => unsub();
  }, [workers]);

  // Alert log — real-time
  useEffect(() => {
    if (!user?.id) return;
    const unsub = onValue(ref(firebaseDb, 'alerts'), snap => {
      if (!snap.exists()) { setAlerts([]); isFirstAlertLoad.current = false; return; }
      const all = [];
      snap.forEach(child => {
        const a = child.val();
        if (a.supervisorId === user.id || !a.supervisorId) all.push({ id: child.key, ...a });
      });
      all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setAlerts(all);

      if (isFirstAlertLoad.current) {
        all.forEach(a => seenAlertKeys.current.add(a.id));
        isFirstAlertLoad.current = false;
        return;
      }

      all.forEach(a => {
        if (seenAlertKeys.current.has(a.id)) return;
        seenAlertKeys.current.add(a.id);
        if (a.type !== 'SOS' && a.type !== 'DANGER') return;
        const worker = workers.find(w => w.workerId === a.workerId);
        setActiveSOS(prev => {
          if (prev.some(s => s.id === a.id)) return prev;
          return [...prev, {
            id: a.id, workerId: a.workerId,
            name:         worker?.name || a.workerName || a.workerId,
            type:         a.type,
            stage:        1,
            firedAt:      Date.now(),
            acknowledged: false,
            message:      a.message,
          }];
        });
      });
    });
    return () => unsub();
  }, [user, workers]);

  const acknowledgeSOS = (id) => {
    playAcknowledgeSound();
    setActiveSOS(prev => prev.map(s => s.id === id ? { ...s, acknowledged: true } : s));
    // Log acknowledgement
    push(ref(firebaseDb, 'alerts'), {
      supervisorId: user?.id,
      type:         'ACK',
      message:      `✅ Alert acknowledged by supervisor ${user?.name} at ${new Date().toLocaleTimeString()}`,
      timestamp:    Date.now(), seen: true,
    }).catch(console.error);
  };

  const dismissSOS  = (id) => setActiveSOS(prev => prev.filter(s => s.id !== id));

  const handleRemoveWorker = async (workerId, workerName) => {
    if (!window.confirm(`Remove ${workerName} from your team?`)) return;
    setRemovingId(workerId);
    try {
      await removeWorker(user.id, workerId);
      setWorkers(prev => prev.filter(w => w.workerId !== workerId));
      setSensorMap(prev => { const n = { ...prev }; delete n[workerId]; return n; });
      setActiveSOS(prev => prev.filter(s => s.workerId !== workerId));
    } catch { setError('Failed to remove worker.'); }
    finally { setRemovingId(null); }
  };

  const handleSupervisorSOS = async (worker) => {
    await push(ref(firebaseDb, 'alerts'), {
      workerId:     worker.workerId,
      workerName:   worker.name,
      supervisorId: user.id,
      type:         'SOS',
      message:      `🆘 DISTRESS triggered by supervisor for worker ${worker.name} (${worker.workerId})`,
      timestamp:    Date.now(), seen: false,
    }).catch(console.error);
  };

  const counts = workers.reduce((acc, w) => {
    const status = sensorMap[w.workerId]?.status || 'SAFE';
    const active = w.status === 'active';
    if (!active)                   acc.inactive++;
    else if (status === 'DANGER')  acc.danger++;
    else if (status === 'WARNING') acc.warning++;
    else                           acc.safe++;
    return acc;
  }, { safe: 0, warning: 0, danger: 0, inactive: 0 });

  if (selectedWorker) {
    return (
      <GovtLayout breadcrumb={`Dashboard → ${selectedWorker.name}`}>
        <WorkerDetail
          worker={selectedWorker}
          sensorData={sensorMap[selectedWorker.workerId]}
          task={null}
          onBack={() => setSelected(null)}
          onSOS={() => { handleSupervisorSOS(selectedWorker); setSelected(null); }}
        />
      </GovtLayout>
    );
  }

  return (
    <GovtLayout breadcrumb="t('supervisor','dashboard',lang)">

      {/* SOS + Escalation Banners */}
      {activeSOS.map(sos => (
        <SOSBanner
          key={sos.id}
          workerName={sos.name}
          message={sos.message}
          type={sos.type}
          stage={sos.stage}
          onAcknowledge={!sos.acknowledged ? () => acknowledgeSOS(sos.id) : null}
          onDismiss={() => dismissSOS(sos.id)}
        />
      ))}

      {/* Escalation info strip — shown if any unacknowledged alerts */}
      {activeSOS.some(s => !s.acknowledged && s.stage >= 2) && (
        <div style={{ background: '#6a1b9a', color: '#fff', padding: '10px 16px', borderRadius: 4, marginBottom: 12, fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📢</span>
          <span><strong>Escalation Active:</strong> Unacknowledged alerts have been escalated. Acknowledge each alert to stop escalation.</span>
        </div>
      )}

      {error && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderLeft: '4px solid #c62828', borderRadius: 3, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c62828', display: 'flex', justifyContent: 'space-between' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: t('supervisor','totalWorkers',lang), val: workers.length, bg: 'var(--navy-light)', color: 'var(--navy)',  border: '#c5d3e8' },
          { label: t('supervisor','safe',lang),       val: counts.safe,    bg: '#e8f5e9',           color: '#2e7d32',      border: '#a5d6a7' },
          { label: t('supervisor','warning',lang),    val: counts.warning, bg: '#fffde7',           color: '#e65100',      border: '#ffe082' },
          { label: t('supervisor','danger',lang),     val: counts.danger,  bg: '#ffebee',           color: '#c62828',      border: '#ef9a9a' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 4, padding: '14px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: c.color }}>{c.val}</div>
            <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Section Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ color: 'var(--navy)', fontSize: 15, fontWeight: 700 }}>{t('supervisor','myWorkers',lang)} ({workers.length}/5)</h3>
        <button onClick={() => navigate('/supervisor/assign')}
          style={{ background: 'none', border: '1px solid var(--navy)', color: 'var(--navy)', padding: '6px 14px', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {t('supervisor','addWorkers',lang)}
        </button>
      </div>

      {/* Worker Cards */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>⏳ Loading worker data...</div>
      ) : workers.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', background: '#fff', border: '1px solid var(--border)', borderRadius: 4 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>👥</div>
          <div style={{ color: 'var(--text-mid)', marginBottom: 14 }}>{t('supervisor','noWorkers',lang)}</div>
          <button onClick={() => navigate('/supervisor/assign')}
            style={{ background: 'var(--navy)', color: '#fff', border: 'none', padding: '9px 20px', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {t('supervisor','assignNow',lang)}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 16, marginBottom: 24 }}>
          {workers.map(w => {
            const hasSOS = activeSOS.some(s => s.workerId === w.workerId && !s.acknowledged);
            return (
              <div key={w.workerId}>
                <WorkerCard
                  worker={w}
                  sensorData={sensorMap[w.workerId]}
                  onView={() => setSelected(w)}
                  onSOS={() => handleSupervisorSOS(w)}
                />
                {hasSOS && (
                  <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: '0 0 4px 4px', padding: '6px 12px', fontSize: 11, color: '#c62828', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>🚨 {t('supervisor','activeAlert',lang)}</span>
                    <span style={{ background: '#c62828', color: '#fff', padding: '1px 8px', borderRadius: 10 }}>
                      Stage {activeSOS.find(s => s.workerId === w.workerId)?.stage}/3
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleRemoveWorker(w.workerId, w.name)}
                  disabled={removingId === w.workerId}
                  style={{ width: '100%', marginTop: 4, padding: '6px', background: 'none', border: '1px solid #ef9a9a', color: '#c62828', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: removingId === w.workerId ? 0.6 : 1 }}>
                  {removingId === w.workerId ? t('supervisor','removing',lang) : t('supervisor','removeTeam',lang)}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* {t('supervisor','alertLog',lang)} */}
      <AlertLog alerts={alerts} />

    </GovtLayout>
  );
}