import { useState, useEffect } from 'react';
import { ref, onValue }        from 'firebase/database';
import { db as firebaseDb }    from '../services/firebase';
import GradeTag                from './GradeTag';

const statusStyle = {
  SAFE:    { bg: '#e8f5e9', color: '#2e7d32', label: '✅ SAFE'    },
  WARNING: { bg: '#fffde7', color: '#e65100', label: '⚠️ WARNING' },
  DANGER:  { bg: '#ffebee', color: '#c62828', label: '🚨 DANGER'  },
};

function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2e7d32', display: 'inline-block', animation: 'liveDotWD 1.4s ease-in-out infinite' }} />
      <span style={{ fontSize: 10, color: '#2e7d32', fontWeight: 600 }}>LIVE</span>
    </span>
  );
}

export default function WorkerDetail({ worker, task, onBack, onSOS }) {
  // ✅ Own Firebase listener — doesn't rely on prop being passed correctly
  const [liveData, setLiveData]   = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Listen to activeSession directly — updates every 2s from ESP32
    const unsub = onValue(ref(firebaseDb, 'sensorData/activeSession'), snap => {
      if (!snap.exists()) return;
      const data = snap.val();
      // Accept data if it belongs to this worker OR no workerId set (testing mode)
      if (!data.workerId || data.workerId === worker.workerId) {
        setLiveData(data);
        setLastUpdate(new Date());
      }
    });
    return () => unsub();
  }, [worker.workerId]);

  const status = liveData?.status || 'SAFE';
  const s      = statusStyle[status] || statusStyle['SAFE'];
  const gasDiff = liveData ? (liveData.gasDiff ?? (liveData.gasLevel - liveData.baseline)) : null;

  return (
    <div>
      <style>{`
        @keyframes liveDotWD {
          0%,100%{ opacity:1; transform:scale(1); }
          50%    { opacity:.5; transform:scale(1.4); }
        }
        @keyframes dangerPulseWD {
          0%,100%{ box-shadow:0 0 0 0 rgba(198,40,40,0.4); }
          50%    { box-shadow:0 0 0 8px rgba(198,40,40,0); }
        }
      `}</style>

      {/* Back + SOS */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--navy)', padding: '7px 16px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          ← Back to Dashboard
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdate && <LiveDot />}
          <button onClick={onSOS} style={{ background: '#c62828', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            🆘 Trigger Distress
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div style={{
        background: s.bg, border: `1.5px solid ${s.color}`,
        borderRadius: 6, padding: '14px 18px', marginBottom: 18,
        display: 'flex', alignItems: 'center', gap: 14,
        animation: status === 'DANGER' ? 'dangerPulseWD 1.6s ease-in-out infinite' : 'none',
      }}>
        <div style={{ fontSize: 32 }}>👷</div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: s.color }}>{s.label}</div>
          <div style={{ fontSize: 13, color: 'var(--text-mid)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span><strong>{worker.name}</strong></span>
            <span>·</span>
            <span>{worker.workerId}</span>
            <span>·</span>
            <GradeTag grade={worker.healthClass || 'A'} />
            {lastUpdate && <span style={{ fontSize: 11, color: 'var(--text-light)' }}>· Updated: {lastUpdate.toLocaleTimeString()}</span>}
          </div>
        </div>
      </div>

      {/* No data yet */}
      {!liveData && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '14px 18px', marginBottom: 18, fontSize: 13, color: '#e65100', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📡</span>
          <div>
            <div style={{ fontWeight: 600 }}>Waiting for live sensor data…</div>
            <div style={{ fontSize: 12, marginTop: 2, opacity: 0.8 }}>Worker must start their shift and have the IoT device powered on.</div>
          </div>
        </div>
      )}

      {/* 6 Sensor Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 18 }}>
        {[
          { icon: '🌡️', label: 'Temperature', val: liveData?.temperature != null ? `${liveData.temperature}` : '--',  unit: '°C',  alert: liveData?.temperature > 33 },
          { icon: '💧', label: 'Humidity',    val: liveData?.humidity    != null ? `${liveData.humidity}`    : '--',  unit: '%',   alert: liveData?.humidity > 80 },
          { icon: '🧪', label: 'Gas Avg',     val: liveData?.gasLevel    != null ? `${liveData.gasLevel}`    : '--',  unit: 'ppm', alert: gasDiff > 20 },
          { icon: '📊', label: 'Gas Raw',     val: liveData?.gasRaw      != null ? `${liveData.gasRaw}`      : '--',  unit: 'ppm', alert: false },
          { icon: '📉', label: 'Gas Diff',    val: gasDiff               != null ? `${gasDiff}`              : '--',  unit: 'ppm', alert: gasDiff > 20 },
          { icon: '📐', label: 'Baseline',    val: liveData?.baseline    != null ? `${liveData.baseline}`    : '--',  unit: 'ppm', alert: false },
        ].map(item => (
          <div key={item.label} style={{
            background: item.alert ? '#fff5f5' : '#fff',
            border: `1px solid ${item.alert ? '#ef9a9a' : 'var(--border)'}`,
            borderRadius: 6, padding: '14px 10px', textAlign: 'center',
            boxShadow: item.alert ? '0 2px 8px rgba(198,40,40,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{item.icon}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: item.alert ? '#c62828' : 'var(--navy)', fontVariantNumeric: 'tabular-nums' }}>
              {item.val}
              {item.val !== '--' && <span style={{ fontSize: 11, fontWeight: 500, color: item.alert ? '#c62828' : 'var(--text-light)', marginLeft: 2 }}>{item.unit}</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* GPS + Task Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>

        {/* GPS */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: 'var(--navy)', padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>📍 GPS Location</span>
            {liveData?.gpsFixed
              ? <span style={{ fontSize: 10, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>FIXED</span>
              : <span style={{ fontSize: 10, background: '#fff8e1', color: '#e65100', padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>ACQUIRING</span>}
          </div>
          <div style={{ padding: '14px' }}>
            {liveData?.gpsFixed ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  {[
                    { label: 'Latitude',   val: `${Number(liveData.latitude).toFixed(6)}° N` },
                    { label: 'Longitude',  val: `${Number(liveData.longitude).toFixed(6)}° E` },
                    { label: 'Speed',      val: `${liveData.speedKph || 0} km/h` },
                    { label: 'Satellites', val: `${liveData.satellites || 0} 🛰️` },
                  ].map(r => (
                    <div key={r.label} style={{ background: 'var(--bg)', borderRadius: 4, padding: '7px 10px' }}>
                      <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase', marginBottom: 2 }}>{r.label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>{r.val}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--text-light)' }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>📡</div>
                <div style={{ fontSize: 13 }}>Acquiring GPS fix…</div>
                <div style={{ fontSize: 11, marginTop: 3 }}>Keep device outdoors</div>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>⏱️ Uptime: {liveData?.uptime || 0}s</span>
              <span>Gas Diff: <strong style={{ color: gasDiff > 20 ? '#c62828' : 'var(--text-mid)' }}>{gasDiff ?? '--'}</strong></span>
            </div>
          </div>
        </div>

        {/* Task */}
        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ background: 'var(--navy)', padding: '10px 14px', color: '#fff', fontSize: 13, fontWeight: 700 }}>
            📋 Assigned Task
          </div>
          <div style={{ padding: '14px' }}>
            {task ? (
              <>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 8 }}>{task.title}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ background: '#e8eaf6', color: '#3949ab', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>📍 {task.zone}</span>
                  <span style={{ background: '#fff8e1', color: '#e65100', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>⏱️ {task.duration}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <GradeTag grade={task.healthClass} />
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>auto-assigned by health class</span>
                </div>
                <span style={{ background: task.status === 'completed' ? '#e8f5e9' : '#fffde7', color: task.status === 'completed' ? '#2e7d32' : '#e65100', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
                  {task.status === 'completed' ? '✅ Completed' : '🟡 In Progress'}
                </span>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-light)' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>No task assigned yet</div>
                <div style={{ fontSize: 11, marginTop: 4 }}>Task is auto-assigned based on health class</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alert info bar */}
      <div style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', fontSize: 12, color: 'var(--text-mid)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <span>📐 Baseline: <strong>{liveData?.baseline ?? '--'}</strong></span>
        <span>📊 Gas Diff: <strong style={{ color: gasDiff > 20 ? '#c62828' : 'inherit' }}>{gasDiff ?? '--'}</strong></span>
        <span>⏱️ Device uptime: <strong>{liveData?.uptime ?? '--'}s</strong></span>
        <span>🔄 Last update: <strong>{lastUpdate ? lastUpdate.toLocaleTimeString() : 'Not yet'}</strong></span>
      </div>
    </div>
  );
}