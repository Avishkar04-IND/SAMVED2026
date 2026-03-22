import { useEffect } from 'react';
import { playSOSSound, playWarningSound, playEscalationSound } from '../services/alertSound';

export default function SOSBanner({ workerName, message, type = 'SOS', stage = 1, onDismiss, onAcknowledge }) {
  const isWarning = type === 'WARNING';

  // ── Play sound when banner appears ────────────────────────────
  useEffect(() => {
    if (stage === 3)         playEscalationSound();
    else if (stage === 2)    playEscalationSound();
    else if (isWarning)      playWarningSound();
    else                     playSOSSound();

    // For DANGER/SOS — repeat sound every 8 seconds until dismissed
    if (!isWarning) {
      const interval = setInterval(() => {
        if (stage >= 2) playEscalationSound();
        else            playSOSSound();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [type, stage]); // re-run if stage escalates

  const stageConfig = {
    1: { bg: isWarning ? '#e65100' : '#c62828', label: isWarning ? 'WARNING ALERT'    : 'SOS ALERT',                shadow: isWarning ? 'rgba(230,81,0,0.4)' : 'rgba(198,40,40,0.4)' },
    2: { bg: '#6a1b9a',                          label: 'ESCALATED — Area Manager Notified',                        shadow: 'rgba(106,27,154,0.4)' },
    3: { bg: '#1a237e',                          label: 'CRITICAL ESCALATION — Emergency Protocol',                 shadow: 'rgba(26,35,126,0.4)' },
  };

  const sc   = stageConfig[stage] || stageConfig[1];
  const icon = stage === 3 ? '🚨' : stage === 2 ? '📢' : isWarning ? '⚠️' : '🆘';

  const defaultMsg = isWarning
    ? 'Elevated sensor readings detected. Monitor closely.'
    : 'Emergency distress signal received. Respond immediately.';

  return (
    <div style={{
      background: sc.bg, color: '#fff',
      padding: '14px 20px', borderRadius: 4,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 10, boxShadow: `0 2px 12px ${sc.shadow}`,
      animation: 'sosPulse 1s ease-in-out infinite',
      border: stage > 1 ? '2px solid rgba(255,255,255,0.3)' : 'none',
    }}>
      <style>{`@keyframes sosPulse { 0%,100%{opacity:1} 50%{opacity:0.88} }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
        <span style={{ fontSize: 26, flexShrink: 0 }}>{icon}</span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{sc.label}</span>
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 8px', fontSize: 11 }}>
              {workerName}
            </span>
            {stage > 1 && (
              <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                Stage {stage}/3
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 3 }}>{message || defaultMsg}</div>
          {stage === 3 && (
            <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4, background: 'rgba(255,255,255,0.2)', padding: '3px 10px', borderRadius: 4, display: 'inline-block' }}>
              📞 Emergency: 1800-XXX-XXXX &nbsp;|&nbsp; Ambulance: 108
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
        {onAcknowledge && (
          <button onClick={onAcknowledge} style={{ background: '#fff', color: sc.bg, border: 'none', padding: '7px 14px', borderRadius: 3, cursor: 'pointer', fontWeight: 800, fontSize: 12 }}>
            ✓ Acknowledge
          </button>
        )}
        <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.5)', color: '#fff', padding: '7px 12px', borderRadius: 3, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}