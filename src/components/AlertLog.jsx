import { useLang } from '../context/LangContext';
import { t }       from '../services/i18n';

export default function AlertLog({ alerts = [] }) {
  const { lang } = useLang();

  const typeStyle = {
    DANGER:     { color: '#c62828', icon: '🚨' },
    WARNING:    { color: '#e65100', icon: '⚠️' },
    SAFE:       { color: '#2e7d32', icon: '✅' },
    SOS:        { color: '#c62828', icon: '🆘' },
    ESCALATION: { color: '#6a1b9a', icon: '📢' },
    ACK:        { color: '#2e7d32', icon: '✓'  },
  };

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📋 {t('supervisor','alertLog',lang)}</span>
        <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.85 }}>{alerts.length} records</span>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {alerts.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)', fontSize: 13 }}>
            ✅ No alerts recorded yet
          </div>
        ) : (
          alerts.map((a, i) => {
            const s = typeStyle[a.type] || typeStyle['SAFE'];
            return (
              <div key={a.id || i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 14px',
                borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none',
                background: i % 2 === 0 ? '#fff' : '#fafbfc',
              }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: s.color, fontWeight: 600 }}>{a.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 3 }}>
                    {a.workerId && <span>Worker: {a.workerId} &nbsp;·&nbsp; </span>}
                    {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : ''}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-light)', flexShrink: 0 }}>
                  {a.timestamp ? new Date(a.timestamp).toLocaleDateString() : ''}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}