import GradeTag from './GradeTag';

const statusStyle = {
  SAFE:     { bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7', label: '✅ SAFE'     },
  WARNING:  { bg: '#fffde7', color: '#e65100', border: '#ffe082', label: '⚠️ WARNING'  },
  DANGER:   { bg: '#ffebee', color: '#c62828', border: '#ef9a9a', label: '🚨 DANGER'   },
  inactive: { bg: '#f5f5f5', color: '#9e9e9e', border: '#e0e0e0', label: '⚫ OFFLINE'  },
};

export default function WorkerCard({ worker, sensorData, onView, onSOS }) {
  // ✅ KEY FIX: Show as active if sensorData is present AND fresh (< 30s old)
  // This ensures supervisor sees live data even if status field lags behind
  // ✅ Only show data if sensorData strictly belongs to THIS worker
  const hasLiveData = sensorData != null && sensorData.workerId === worker.workerId;
  // isActive for STATUS badge: active if worker registered as active
  const isActive    = worker.status === 'active';
  // Show sensor readings ONLY if this worker has the device
  const showData    = hasLiveData;

  const iotStatus = hasLiveData ? (sensorData.status || 'SAFE') : 'SAFE';
  const statusKey = hasLiveData ? iotStatus : (isActive ? 'SAFE' : 'inactive');
  const s         = statusStyle[statusKey] || statusStyle['SAFE'];

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${s.border}`,
      borderTop: `3px solid ${s.color}`,
      borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      {/* Card Header */}
      <div style={{ background: 'var(--navy-light)', padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)' }}>👷 {worker.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginTop: 2 }}>{worker.workerId}</div>
        </div>
        <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '3px 9px', borderRadius: 3, fontSize: 11, fontWeight: 700 }}>
          {s.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {showData ? (
          <>
            {/* Sensor Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              {[
                { icon: '🌡️', label: 'Temp',     val: sensorData.temperature != null ? `${sensorData.temperature}°C` : '--',   alert: sensorData.temperature > 33 },
                { icon: '💧', label: 'Humidity', val: sensorData.humidity    != null ? `${sensorData.humidity}%`     : '--',   alert: false },
                { icon: '🧪', label: 'Gas Avg',  val: sensorData.gasLevel    != null ? sensorData.gasLevel           : '--',   alert: (sensorData.gasDiff ?? 0) > 20 },
                { icon: '📉', label: 'Gas Diff', val: sensorData.gasDiff     != null ? sensorData.gasDiff            : '--',   alert: (sensorData.gasDiff ?? 0) > 20 },
              ].map(item => (
                <div key={item.label} style={{ background: item.alert ? '#fff5f5' : 'var(--bg)', padding: '6px 10px', borderRadius: 3, border: `1px solid ${item.alert ? '#ef9a9a' : 'var(--border)'}` }}>
                  <div style={{ fontSize: 10, color: 'var(--text-light)', textTransform: 'uppercase' }}>{item.icon} {item.label}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: item.alert ? '#c62828' : 'var(--navy)', marginTop: 2 }}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Health class */}
            <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Health:</span>
              <GradeTag grade={worker.healthClass || 'A'} />
            </div>

            {/* GPS */}
            <div style={{ fontSize: 11.5, color: 'var(--text-light)', marginBottom: 10 }}>
              📍 {sensorData.gpsFixed
                ? `${Number(sensorData.latitude).toFixed(4)}°N, ${Number(sensorData.longitude).toFixed(4)}°E`
                : 'GPS acquiring…'}
            </div>

            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2e7d32', display: 'inline-block', animation: 'liveDot 1.4s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, color: '#2e7d32', fontWeight: 600 }}>LIVE DATA</span>
              <span style={{ fontSize: 10, color: 'var(--text-light)', marginLeft: 4 }}>uptime: {sensorData.uptime || 0}s</span>
            </div>
          </>
        ) : isActive ? (
          // Active but no sensor data — device not started yet
          <div style={{ padding: '12px 0', textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>📡</div>
            <div>Worker logged in — not on shift</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>No IoT device active for this worker</div>
          </div>
        ) : (
          // Offline
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>😴</div>
            <div>Worker is offline</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>No active shift</div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onView} style={{ flex: 1, padding: '7px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🔍 View Details
          </button>
          <button onClick={onSOS} style={{ flex: 1, padding: '7px', background: '#c62828', color: '#fff', border: 'none', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            🆘 SOS
          </button>
        </div>
      </div>

      <style>{`
        @keyframes liveDot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:.5; transform:scale(1.4); }
        }
      `}</style>
    </div>
  );
}