import { useState, useEffect, useRef, useCallback } from 'react';
import { ref, onValue, push, update, get }  from 'firebase/database';
import { db as firebaseDb }    from '../services/firebase';
import { useAuth }             from '../context/AuthContext';
import { getCurrentTask, completeTask, triggerSOS } from '../services/api';
import GovtLayout              from '../components/GovtLayout';
import GradeTag                from '../components/GradeTag';
import SOSBanner               from '../components/SOSBanner';
import EntryChecklist          from '../components/EntryChecklist';
import LangSwitcher            from '../components/LangSwitcher';
import { useLang }             from '../context/LangContext';
import { t }                   from '../services/i18n';
import { playWarningSound, playDangerSound, playSOSSound, playDeadManWarning } from '../services/alertSound';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_HISTORY        = 20;
const POLL_LABEL_GAP     = 4;
const DEAD_MAN_WARN_SEC  = 180; // 3 min — show warning
const DEAD_MAN_SOS_SEC   = 300; // 5 min — trigger SOS
const SHIFT_KEY          = 'safetynet_shift';

const THRESHOLDS = {
  temperature: { warning: 33, danger: 37 },
  gasDiff:     { warning: 20, danger: 50 },
  humidity:    { warning: 80, danger: 95 },
};

const STATUS_STYLE_BASE = {
  SAFE:    { bg: '#e8f5e9', color: '#2e7d32', pulse: false },
  WARNING: { bg: '#fffde7', color: '#e65100', pulse: false },
  DANGER:  { bg: '#ffebee', color: '#c62828', pulse: true  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function saveShift(data) {
  if (data) localStorage.setItem(SHIFT_KEY, JSON.stringify(data));
  else      localStorage.removeItem(SHIFT_KEY);
}
function loadShift(userId) {
  try {
    const s = JSON.parse(localStorage.getItem(SHIFT_KEY));
    return s?.workerId === userId ? s : null;
  } catch { return null; }
}

async function getSupId(workerId) {
  try {
    const snap = await get(ref(firebaseDb, `users/workers/${workerId}/supervisorId`));
    return snap.exists() ? snap.val() : null;
  } catch { return null; }
}

async function writeAlert(workerId, workerName, supervisorId, type, message) {
  await push(ref(firebaseDb, 'alerts'), {
    workerId, workerName, supervisorId,
    type, message, timestamp: Date.now(), seen: false,
  }).catch(console.error);
}

function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e7d32', display: 'inline-block', animation: 'livePulse 1.4s ease-in-out infinite' }} />
      <span style={{ fontSize: 11, color: '#2e7d32', fontWeight: 600, letterSpacing: 0.5 }}>LIVE</span>
    </span>
  );
}

function MetricCard({ icon, label, value, unit, alert, sub }) {
  return (
    <div style={{ background: alert ? '#fff5f5' : '#fff', border: `1.5px solid ${alert ? '#ef9a9a' : '#e0e0e0'}`, borderRadius: 8, padding: '14px 10px', textAlign: 'center', boxShadow: alert ? '0 2px 12px rgba(198,40,40,0.10)' : '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.3s ease', position: 'relative', overflow: 'hidden' }}>
      {alert && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#c62828,#ef5350)', animation: 'alertBar 1s ease-in-out infinite alternate' }} />}
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: alert ? '#c62828' : '#1a237e', fontVariantNumeric: 'tabular-nums' }}>
        {value ?? '--'}
        {value != null && unit && <span style={{ fontSize: 12, fontWeight: 500, color: alert ? '#c62828' : '#546e7a', marginLeft: 2 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 10, color: '#90a4ae', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: '#b0bec5', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function GraphCard({ title, icon, data, dataKey, color, unit, thresholds }) {
  const gradientId = `grad-${dataKey}`;
  const isEmpty    = !data || data.length === 0;
  const computedDomain = (() => {
    if (!data || data.length === 0) return ['auto', 'auto'];
    const vals = data.map(d => d[dataKey]).filter(v => v != null);
    if (vals.length === 0) return ['auto', 'auto'];
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 2, pad = range * 0.35;
    return [parseFloat((min - pad).toFixed(1)), parseFloat((max + pad).toFixed(1))];
  })();
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return <div style={{ background: '#1a237e', color: '#fff', borderRadius: 6, padding: '7px 13px', fontSize: 12, fontWeight: 600 }}><div style={{ color: '#90caf9', fontSize: 10, marginBottom: 2 }}>Reading #{label}</div><div>{payload[0].value?.toFixed(1)} {unit}</div></div>;
  };
  return (
    <div style={{ background: '#fff', border: '1.5px solid #e8eaf6', borderRadius: 10, padding: '16px 18px', boxShadow: '0 2px 10px rgba(26,35,126,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}><span style={{ fontSize: 18 }}>{icon}</span><span style={{ fontWeight: 700, fontSize: 13, color: '#1a237e' }}>{title}</span></div>
        <LiveDot />
      </div>
      {isEmpty ? (
        <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b0bec5', fontSize: 13, background: '#fafafa', borderRadius: 6 }}>📡 Waiting for sensor data…</div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="tick" tick={{ fontSize: 9, fill: '#b0bec5' }} tickFormatter={(v, i) => (i % POLL_LABEL_GAP === 0 ? `#${v}` : '')} axisLine={false} tickLine={false} />
            <YAxis domain={computedDomain} tick={{ fontSize: 9, fill: '#b0bec5' }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {thresholds?.warning != null && <ReferenceLine y={thresholds.warning} stroke="#ff9800" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'WARN', position: 'insideTopRight', fontSize: 9, fill: '#ff9800' }} />}
            {thresholds?.danger  != null && <ReferenceLine y={thresholds.danger}  stroke="#f44336" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: 'DANGER', position: 'insideTopRight', fontSize: 9, fill: '#f44336' }} />}
            <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, fill: color, strokeWidth: 0 }} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
      {data?.length > 0 && <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}><span style={{ background: `${color}18`, color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>Latest: {data[data.length - 1]?.[dataKey]?.toFixed(1)} {unit}</span></div>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function WorkerDashboard() {
  const { user } = useAuth();
  const { lang } = useLang();

  // ✅ Computed inside component so lang is available
  const STATUS_STYLE = {
    SAFE:    { ...STATUS_STYLE_BASE.SAFE,    label: t('worker','statusSafe',lang)   },
    WARNING: { ...STATUS_STYLE_BASE.WARNING, label: t('worker','statusWarn',lang)   },
    DANGER:  { ...STATUS_STYLE_BASE.DANGER,  label: t('worker','statusDanger',lang) },
  };

  const [sensor, setSensor]             = useState(null);
  const [task, setTask]                 = useState(null);
  const [sosActive, setSosActive]       = useState(false);
  const [sosMessage, setSosMessage]     = useState('');
  const [completing, setCompleting]     = useState(false);
  const [msg, setMsg]                   = useState('');
  const [lastUpdated, setLastUpdated]   = useState(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [history, setHistory]           = useState([]);
  const [teamInfo, setTeamInfo]          = useState({ supervisor: null, coWorkers: [] });
  const [showChecklist, setShowChecklist] = useState(false);

  // ── Dead Man's Switch state ──────────────────────────────────────────────
  const [deadManSecs, setDeadManSecs]   = useState(0); // seconds since last data
  const [deadManFired, setDeadManFired] = useState(false);
  const lastDataTime                    = useRef(Date.now());
  const deadManInterval                 = useRef(null);

  const tickRef      = useRef(0);
  const lastAutoAlert = useRef('SAFE');

  // Restore shift from localStorage
  const saved = loadShift(user?.id);
  const [shiftActive, setShiftActive] = useState(!!saved);
  const [shiftId, setShiftId]         = useState(saved?.shiftId   || null);
  const [shiftStart, setShiftStart]   = useState(saved?.shiftStart || null);

  const shiftActiveRef = useRef(shiftActive);
  const shiftIdRef     = useRef(shiftId);
  useEffect(() => { shiftActiveRef.current = shiftActive; }, [shiftActive]);
  useEffect(() => { shiftIdRef.current     = shiftId;     }, [shiftId]);

  // ── Dead Man's Switch timer ───────────────────────────────────────────────
  useEffect(() => {
    if (!shiftActive) {
      clearInterval(deadManInterval.current);
      setDeadManSecs(0);
      setDeadManFired(false);
      return;
    }
    deadManInterval.current = setInterval(async () => {
      const elapsed = Math.floor((Date.now() - lastDataTime.current) / 1000);
      setDeadManSecs(elapsed);

      // Auto SOS at 5 minutes with no data
      if (elapsed >= DEAD_MAN_SOS_SEC && !deadManFired) {
        setDeadManFired(true);
        const supId = await getSupId(user.id);
        const alertMsg = `🆘 {t('worker','deadManWarn',lang).split(':')[0]} SWITCH: No response from worker ${user.name} (${user.id}) for 5+ minutes. Immediate check required!`;
        await writeAlert(user.id, user.name, supId, 'SOS', alertMsg);
        await update(ref(firebaseDb, `users/workers/${user.id}`), { sosActive: true }).catch(console.error);
        playSOSSound();
        setSosMessage(alertMsg);
        setSosActive(true);
      }
    }, 1000);
    return () => clearInterval(deadManInterval.current);
  }, [shiftActive, deadManFired, user]);

  const pushHistory = useCallback((snap) => {
    tickRef.current += 1;
    setHistory(prev => {
      const next = [...prev, { tick: tickRef.current, temperature: snap.temperature ?? null, humidity: snap.humidity ?? null, gasLevel: snap.gasLevel ?? null, gasRaw: snap.gasRaw ?? null, gasDiff: snap.gasDiff ?? null, baseline: snap.baseline ?? null }];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
  }, []);

  const archiveReading = useCallback((snap, currentShiftId) => {
    if (!user?.id || !currentShiftId) return;
    push(ref(firebaseDb, `sessions/${user.id}/${currentShiftId}/readings`), {
      timestamp: Date.now(), temperature: snap.temperature ?? null, humidity: snap.humidity ?? null,
      gasLevel: snap.gasLevel ?? null, gasRaw: snap.gasRaw ?? null, gasDiff: snap.gasDiff ?? null,
      baseline: snap.baseline ?? null, status: snap.status ?? 'SAFE',
    }).catch(console.error);
  }, [user]);

  // ── Live sensor listener ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const unsub = onValue(ref(firebaseDb, 'sensorData/activeSession'), async snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      const workerMatch = !data.workerId || data.workerId === user.id;
      if (!shiftActiveRef.current || !workerMatch) return;

      // Reset dead man timer on every data update
      lastDataTime.current = Date.now();
      setDeadManSecs(0);
      setDeadManFired(false);

      setSensor(data);
      pushHistory(data);
      setLastUpdated(new Date());
      archiveReading(data, shiftIdRef.current);

      // Auto-distress
      const newStatus  = data.status || 'SAFE';
      const prevStatus = lastAutoAlert.current;
      if (newStatus !== prevStatus) {
        lastAutoAlert.current = newStatus;
        if (newStatus === 'DANGER' || newStatus === 'WARNING') {
          const supId    = await getSupId(user.id);
          const alertMsg = newStatus === 'DANGER'
            ? `🚨 DANGER: Worker ${user.name} (${user.id}) — Critical IoT reading!`
            : `⚠️ WARNING: Worker ${user.name} (${user.id}) — Elevated readings detected.`;
          await writeAlert(user.id, user.name, supId, newStatus, alertMsg);
          await update(ref(firebaseDb, `users/workers/${user.id}`), { sosActive: newStatus === 'DANGER', lastStatus: newStatus }).catch(console.error);
          // Play sound on worker device
          if (newStatus === 'DANGER') playDangerSound();
          else playWarningSound();
          setSosMessage(alertMsg);
          setSosActive(true);
        }
        if (newStatus === 'SAFE' && prevStatus !== 'SAFE') {
          setSosActive(false); setSosMessage('');
          await update(ref(firebaseDb, `users/workers/${user.id}`), { sosActive: false, lastStatus: 'SAFE' }).catch(console.error);
        }
      }
    });
    return () => unsub();
  }, [user, pushHistory, archiveReading]);

  useEffect(() => {
    if (!user?.id) return;
    getCurrentTask(user.id).then(res => setTask(res.data)).catch(console.error);
  }, [user]);

  // Load supervisor info and co-workers
  useEffect(() => {
    if (!user?.id) return;
    // Get this worker's supervisorId
    const workerRef = ref(firebaseDb, `users/workers/${user.id}`);
    const unsub = onValue(workerRef, async snap => {
      if (!snap.exists()) return;
      const workerData = snap.val();
      const supId = workerData.supervisorId;
      if (!supId) return;

      // Get supervisor info
      const supSnap = await get(ref(firebaseDb, `users/supervisors/${supId}`));
      const supervisor = supSnap.exists() ? supSnap.val() : null;

      // Get all workers under same supervisor (co-workers)
      const allWorkersSnap = await get(ref(firebaseDb, 'users/workers'));
      const coWorkers = [];
      if (allWorkersSnap.exists()) {
        allWorkersSnap.forEach(child => {
          const w = child.val();
          // Include co-workers but NOT this worker themselves
          if (w.supervisorId === supId && w.workerId !== user.id) {
            coWorkers.push({
              workerId: w.workerId,
              name:     w.name,
              status:   w.status || 'inactive',
              healthClass: w.healthClass || 'A',
            });
          }
        });
      }
      setTeamInfo({ supervisor, coWorkers });
    });
    return () => unsub();
  }, [user]);

  // ── Start Shift — triggered AFTER checklist confirmed ─────────────────────
  const handleStartShift = async () => {
    if (!user?.id) return;
    setShiftLoading(true);
    try {
      const now = Date.now();
      await update(ref(firebaseDb, 'sensorData/activeSession'), { workerId: user.id, workerName: user.name, shiftStart: now });
      // ✅ Update worker status so supervisor sees them as ACTIVE
      await update(ref(firebaseDb, `users/workers/${user.id}`), { status: 'active', lastSeen: now });
      const newShift = await push(ref(firebaseDb, `sessions/${user.id}`), {
        workerName: user.name, workerId: user.id, shiftStart: now, shiftEnd: null, status: 'active',
        checklistCompleted: true,
      });
      saveShift({ workerId: user.id, shiftId: newShift.key, shiftStart: now });
      tickRef.current = 0;
      setHistory([]);
      lastAutoAlert.current = 'SAFE';
      lastDataTime.current  = Date.now();
      setDeadManFired(false);
      setShiftId(newShift.key);
      setShiftStart(now);
      setShiftActive(true);
      setMsg('✅ Shift started! IoT device is now assigned to you.');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      console.error(err);
      setMsg('❌ Failed to start shift. Try again.');
      setTimeout(() => setMsg(''), 4000);
    } finally { setShiftLoading(false); }
  };

  const handleEndShift = async () => {
    if (!user?.id || !shiftId) return;
    setShiftLoading(true);
    try {
      const now = Date.now();
      await update(ref(firebaseDb, `sessions/${user.id}/${shiftId}`), { shiftEnd: now, status: 'completed' });
      await update(ref(firebaseDb, 'sensorData/activeSession'), { workerId: null, workerName: null, shiftStart: null });
      // ✅ Update worker status back to inactive
      await update(ref(firebaseDb, `users/workers/${user.id}`), { status: 'inactive', lastSeen: Date.now() });
      saveShift(null);
      setShiftActive(false); setShiftId(null); setShiftStart(null);
      setSensor(null); setHistory([]); tickRef.current = 0;
      lastAutoAlert.current = 'SAFE';
      setDeadManSecs(0); setDeadManFired(false);
      setMsg('✅ Shift ended. Data saved to your history.');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setMsg('❌ Failed to end shift.'); setTimeout(() => setMsg(''), 4000);
    } finally { setShiftLoading(false); }
  };

  const handleSOS = async () => {
    setSosMessage(`🆘 Manual SOS triggered by ${user.name}`);
    setSosActive(true);
    try {
      const supId    = await getSupId(user.id);
      const alertMsg = `🆘 MANUAL SOS: Worker ${user.name} (${user.id}) pressed the emergency button!`;
      await writeAlert(user.id, user.name, supId, 'SOS', alertMsg);
      await update(ref(firebaseDb, `users/workers/${user.id}`), { sosActive: true });
      await triggerSOS(user.id, { supervisorId: supId || 'unknown', triggeredBy: user.name });
    } catch (err) { console.error('SOS error:', err); }
  };

  const handleComplete = async () => {
    setCompleting(true);
    try { await completeTask(user.id); setTask(null); setMsg('✅ Task marked as complete!'); setTimeout(() => setMsg(''), 3000); }
    catch { setMsg('Failed to complete task.'); }
    finally { setCompleting(false); }
  };

  const shiftDuration = shiftStart ? Math.floor((Date.now() - shiftStart) / 60000) : 0;
  const status  = sensor?.status || 'SAFE';
  const s       = STATUS_STYLE[status] || STATUS_STYLE.SAFE;
  const gasDiff = sensor?.gasDiff ?? 0;

  // Dead man warning (3-5 min range)
  const showDeadManWarning = shiftActive && deadManSecs >= DEAD_MAN_WARN_SEC && deadManSecs < DEAD_MAN_SOS_SEC;
  const deadManSecsLeft    = DEAD_MAN_SOS_SEC - deadManSecs;

  return (
    <GovtLayout breadcrumb="Worker Dashboard">
      <style>{`
        @keyframes livePulse   { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.3)} }
        @keyframes alertBar    { from{opacity:.6} to{opacity:1} }
        @keyframes dangerPulse { 0%,100%{box-shadow:0 0 0 0 rgba(198,40,40,0.45)} 50%{box-shadow:0 0 0 8px rgba(198,40,40,0)} }
        @keyframes shiftGlow   { 0%,100%{box-shadow:0 0 0 0 rgba(46,125,50,0.3)} 50%{box-shadow:0 0 0 10px rgba(46,125,50,0)} }
      `}</style>

      {/* Entry Checklist Modal */}
      {showChecklist && (
        <EntryChecklist
          onConfirm={() => { setShowChecklist(false); handleStartShift(); }}
          onCancel={() => setShowChecklist(false)}
        />
      )}

      {sosActive && (
        <SOSBanner
          workerName={user?.name}
          message={sosMessage}
          type={status === 'WARNING' ? 'WARNING' : 'SOS'}
          onDismiss={() => { setSosActive(false); setSosMessage(''); }}
        />
      )}

      {/* Dead Man Switch Warning */}
      {showDeadManWarning && (
        <div style={{ background: '#6a1b9a', color: '#fff', padding: '12px 18px', borderRadius: 4, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: 'sosPulse 1s infinite' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>⚠️ DEAD MAN'S SWITCH WARNING</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              No sensor data received for {Math.floor(deadManSecs / 60)}m {deadManSecs % 60}s.
              Auto-SOS in <strong>{Math.floor(deadManSecsLeft / 60)}m {deadManSecsLeft % 60}s</strong> — Are you okay?
            </div>
          </div>
          <button onClick={() => { lastDataTime.current = Date.now(); setDeadManSecs(0); }}
            style={{ background: '#fff', color: '#6a1b9a', border: 'none', padding: '8px 16px', borderRadius: 4, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            ✋ {t('worker','iAmOk',lang)}
          </button>
        </div>
      )}

      {msg && (
        <div style={{ background: msg.startsWith('❌') ? '#ffebee' : '#e8f5e9', border: `1px solid ${msg.startsWith('❌') ? '#ef9a9a' : '#a5d6a7'}`, borderRadius: 6, padding: '10px 16px', marginBottom: 14, fontSize: 13, color: msg.startsWith('❌') ? '#c62828' : '#2e7d32', fontWeight: 600 }}>
          {msg}
        </div>
      )}

      {/* Shift Banner */}
      <div style={{ background: shiftActive ? 'linear-gradient(135deg,#e8f5e9,#f1f8e9)' : 'linear-gradient(135deg,#e8eaf6,#ede7f6)', border: `1.5px solid ${shiftActive ? '#a5d6a7' : '#b39ddb'}`, borderRadius: 10, padding: '16px 20px', marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', animation: shiftActive ? 'shiftGlow 3s ease-in-out infinite' : 'none' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: shiftActive ? '#2e7d32' : '#4527a0' }}>
            {shiftActive ? t('worker','shiftActive',lang) : t('worker','noShift',lang)}
          </div>
          <div style={{ fontSize: 12, color: '#546e7a', marginTop: 4 }}>
            {shiftActive
              ? <><strong>{user?.name}</strong> &nbsp;·&nbsp; ⏱️ <strong>{shiftDuration} min</strong>{lastUpdated && <> &nbsp;·&nbsp; 🕐 {lastUpdated.toLocaleTimeString()}</>}{shiftActive && deadManSecs > 0 && <> &nbsp;·&nbsp; <span style={{ color: deadManSecs > DEAD_MAN_WARN_SEC ? '#c62828' : '#546e7a' }}>⏲️ Last data: {deadManSecs}s ago</span></>}</>
              : 'Complete the safety checklist to begin your shift.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {shiftActive && <GradeTag grade={user?.healthClass || 'A'} />}
          {!shiftActive ? (
            <button onClick={() => setShowChecklist(true)} disabled={shiftLoading}
              style={{ background: 'linear-gradient(135deg,#2e7d32,#43a047)', color: '#fff', border: 'none', padding: '11px 24px', borderRadius: 7, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: '0 3px 10px rgba(46,125,50,0.35)' }}>
              {t('worker','startShift',lang)}
            </button>
          ) : (
            <button onClick={handleEndShift} disabled={shiftLoading}
              style={{ background: shiftLoading ? '#ffcdd2' : 'linear-gradient(135deg,#c62828,#e53935)', color: '#fff', border: 'none', padding: '11px 24px', borderRadius: 7, fontSize: 13, fontWeight: 800, cursor: shiftLoading ? 'not-allowed' : 'pointer', boxShadow: '0 3px 10px rgba(198,40,40,0.30)' }}>
              {shiftLoading ? t('worker','ending',lang) : t('worker','endShift',lang)}
            </button>
          )}
        </div>
      </div>

      {!shiftActive ? (
        <div style={{ background: '#f8f9ff', border: '1.5px dashed #b0bec5', borderRadius: 10, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🪖</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1a237e', marginBottom: 8 }}>Ready to Start?</div>
          <div style={{ fontSize: 13, color: '#90a4ae', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Click <strong>Start Shift</strong> above to complete the <strong>safety checklist</strong> before entering any confined space.
            This is mandatory per SMC safety protocol.
          </div>
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {['📋 Entry Checklist', '🪖 Device Active', '👷 Buddy Present', '⏲️ Auto-SOS Active'].map(f => (
              <span key={f} style={{ background: '#e8eaf6', color: '#3949ab', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{f}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <div style={{ background: s.bg, border: `1.5px solid ${s.color}`, borderRadius: 8, padding: '12px 18px', marginBottom: 16, animation: s.pulse ? 'dangerPulse 1.6s ease-in-out infinite' : 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.label}</div>
          </div>

          {/* 6 Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
            <MetricCard icon="🌡️" label={t('worker','temperature',lang)} value={sensor?.temperature} unit="°C"  alert={sensor?.temperature > THRESHOLDS.temperature.warning} sub={sensor?.temperature > THRESHOLDS.temperature.danger ? '🔴 Critical' : sensor?.temperature > THRESHOLDS.temperature.warning ? '🟡 Elevated' : '🟢 Normal'} />
            <MetricCard icon="💧" label={t('worker','humidity',lang)}    value={sensor?.humidity}    unit="%"   alert={sensor?.humidity > THRESHOLDS.humidity.warning} />
            <MetricCard icon="🧪" label={t('worker','gasAvg',lang)}     value={sensor?.gasLevel}    unit="ppm" alert={gasDiff > THRESHOLDS.gasDiff.warning} sub="Rolling avg" />
            <MetricCard icon="📊" label={t('worker','gasRaw',lang)}     value={sensor?.gasRaw}      unit="ppm" alert={false} sub="Instantaneous" />
            <MetricCard icon="📉" label={t('worker','gasDiff',lang)}    value={sensor?.gasDiff}     unit="ppm" alert={gasDiff > THRESHOLDS.gasDiff.warning} sub={`Base: ${sensor?.baseline ?? '--'}`} />
            <MetricCard icon="📐" label={t('worker','baseline',lang)}    value={sensor?.baseline}    unit="ppm" alert={false} sub={sensor?.status ?? ''} />
          </div>

          {/* Graphs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
            <GraphCard title={t('worker','temperature',lang)}   icon="🌡️" data={history} dataKey="temperature" color="#ef5350" unit="°C"  thresholds={THRESHOLDS.temperature} />
            <GraphCard title={t('worker','gasDiff',lang)} icon="🧪" data={history} dataKey="gasDiff"     color="#ff9800" unit="ppm" thresholds={THRESHOLDS.gasDiff} />
            <GraphCard title={t('worker','humidity',lang)}      icon="💧" data={history} dataKey="humidity"     color="#1e88e5" unit="%"   thresholds={THRESHOLDS.humidity} />
          </div>

          {/* GPS + Task */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: '1.5px solid #e8eaf6', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#1a237e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📍 {t('worker','myLocation',lang)}</span>
                {sensor?.gpsFixed ? <span style={{ fontSize: 10, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{t('worker','gpsFixed',lang)}</span> : <span style={{ fontSize: 10, background: '#fff8e1', color: '#e65100', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{t('worker','gpsAcquiring',lang)}</span>}
              </div>
              <div style={{ padding: '14px 16px' }}>
                {sensor?.gpsFixed ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[{ label: 'Latitude', val: `${Number(sensor.latitude).toFixed(6)}° N` }, { label: 'Longitude', val: `${Number(sensor.longitude).toFixed(6)}° E` }, { label: 'Speed', val: `${sensor.speedKph || 0} km/h` }, { label: 'Satellites', val: `${sensor.satellites || 0} 🛰️` }].map(r => (
                      <div key={r.label} style={{ background: '#f8f9ff', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 10, color: '#90a4ae', textTransform: 'uppercase', marginBottom: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a237e' }}>{r.val}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#90a4ae' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📡</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Waiting for GPS fix…</div>
                  </div>
                )}
                <div style={{ marginTop: 10, fontSize: 11, color: '#b0bec5', textAlign: 'right' }}>⏱️ Uptime: {sensor?.uptime || 0}s</div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1.5px solid #e8eaf6', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', fontWeight: 700, fontSize: 13, color: '#1a237e' }}>{t('worker','currentTask',lang)}</div>
              <div style={{ padding: '14px 16px' }}>
                {task ? (
                  <>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1a237e', marginBottom: 8 }}>{task.title}</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ background: '#e8eaf6', color: '#3949ab', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>📍 {task.zone}</span>
                      <span style={{ background: '#fff8e1', color: '#e65100', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>⏱️ {task.duration}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <GradeTag grade={task.healthClass} />
                      <span style={{ fontSize: 11, color: '#90a4ae' }}>auto-assigned</span>
                    </div>
                    <button onClick={handleComplete} disabled={completing} style={{ width: '100%', padding: '10px', background: completing ? '#c8e6c9' : '#2e7d32', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: completing ? 'not-allowed' : 'pointer' }}>
                      {completing ? t('worker','completing',lang) : t('worker','markComplete',lang)}
                    </button>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0', color: '#90a4ae' }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t('worker','noTask',lang)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── MY TEAM ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>

            {/* Supervisor */}
            <div style={{ background: '#fff', border: '1.5px solid #e8eaf6', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: 'var(--navy)', padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 700 }}>
                🧑‍💼 My Supervisor
              </div>
              <div style={{ padding: '14px 16px' }}>
                {teamInfo.supervisor ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, background: 'var(--navy-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🧑‍💼</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--navy)' }}>{teamInfo.supervisor.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>ID: {teamInfo.supervisor.supervisorId}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-light)' }}>🏢 {teamInfo.supervisor.department || 'Sanitation'}</div>
                      {teamInfo.supervisor.phone && (
                        <div style={{ fontSize: 12, color: '#2e7d32', marginTop: 2 }}>📞 {teamInfo.supervisor.phone}</div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-light)', fontSize: 13 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>👤</div>
                    No supervisor assigned yet
                  </div>
                )}
              </div>
            </div>

            {/* Co-workers */}
            <div style={{ background: '#fff', border: '1.5px solid #e8eaf6', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ background: 'var(--navy)', padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>👷 My Co-workers</span>
                <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.8 }}>{teamInfo.coWorkers.length} in team</span>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                {teamInfo.coWorkers.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-light)', fontSize: 13 }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>👥</div>
                    No co-workers assigned yet
                  </div>
                ) : (
                  teamInfo.coWorkers.map((w, i) => (
                    <div key={w.workerId} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px',
                      borderBottom: i < teamInfo.coWorkers.length - 1 ? '1px solid var(--border)' : 'none',
                      background: i % 2 === 0 ? '#fff' : '#fafbfc',
                    }}>
                      <span style={{ fontSize: 20 }}>👷</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--navy)' }}>{w.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 1 }}>ID: {w.workerId}</div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                        background: w.status === 'active' ? '#e8f5e9' : '#f5f5f5',
                        color:      w.status === 'active' ? '#2e7d32' : '#9e9e9e',
                        border:     w.status === 'active' ? '1px solid #a5d6a7' : '1px solid #e0e0e0',
                      }}>
                        {w.status === 'active' ? '🟢 Active' : '⚫ Offline'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* SOS */}
          <div style={{ background: 'linear-gradient(135deg,#fff8f0,#fff3e0)', border: '1.5px solid #ffccbc', borderRadius: 10, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#bf360c' }}>{t('worker','sosTitle',lang)}</div>
              <div style={{ fontSize: 12, color: '#90a4ae', marginTop: 3 }}>Press only in case of emergency. Alerts your supervisor immediately.</div>
            </div>
            <button onClick={handleSOS}
              onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
              onMouseUp={e   => e.currentTarget.style.transform = 'scale(1)'}
              style={{ background: 'linear-gradient(135deg,#c62828,#e53935)', color: '#fff', border: 'none', padding: '11px 26px', borderRadius: 7, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 14px rgba(198,40,40,0.35)' }}>
              {t('worker','sosBtn',lang)}
            </button>
          </div>
        </>
      )}
    </GovtLayout>
  );
}