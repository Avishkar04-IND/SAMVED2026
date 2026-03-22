import { useState } from 'react';
import { useLang } from '../context/LangContext';
import { t }       from '../services/i18n';

const CHECKLIST_IDS = [
  { id: 'buddy',  icon: '👷', key: 'item1' },
  { id: 'rescue', icon: '🪢', key: 'item2' },
  { id: 'gas',    icon: '🧪', key: 'item3' },
  { id: 'comms',  icon: '📡', key: 'item4' },
  { id: 'permit', icon: '📋', key: 'item5' },
];

export default function EntryChecklist({ onConfirm, onCancel }) {
  const [checked, setChecked] = useState({});
  const { lang } = useLang();
  // Build checklist with current language inside component
  const CHECKLIST = CHECKLIST_IDS.map(item => ({
    ...item,
    label: t('checklist', item.key, lang),
  }));

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const allDone = CHECKLIST.every(item => checked[item.id]);

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(18,40,80,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }}>
      <div style={{
        background: '#fff', borderRadius: 8,
        width: '100%', maxWidth: 520,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ background: 'var(--navy)', padding: '16px 20px' }}>
          <div style={{ color: '#fff', fontSize: 16, fontWeight: 800 }}>
            📋 Confined Space Entry Checklist
          </div>
          <div style={{ color: '#a8bcd8', fontSize: 12, marginTop: 3 }}>
            All items must be confirmed before entry is permitted — SMC Safety Protocol
          </div>
        </div>

        {/* Warning strip */}
        <div style={{ background: '#fff8e1', borderBottom: '1px solid #ffe082', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#e65100', fontWeight: 600 }}>
          ⚠️ Skipping this checklist violates municipal safety regulations and puts your life at risk.
        </div>

        {/* Items */}
        <div style={{ padding: '16px 20px' }}>
          {CHECKLIST.map((item, i) => (
            <div key={item.id} onClick={() => toggle(item.id)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '10px 12px', marginBottom: 8,
                borderRadius: 6, cursor: 'pointer',
                background: checked[item.id] ? '#e8f5e9' : '#fafbfc',
                border: `1.5px solid ${checked[item.id] ? '#a5d6a7' : '#e0e0e0'}`,
                transition: 'all 0.15s',
              }}>
              <div style={{
                width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 1,
                background: checked[item.id] ? '#2e7d32' : '#fff',
                border: `2px solid ${checked[item.id] ? '#2e7d32' : '#b0bec5'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 13, fontWeight: 800,
              }}>
                {checked[item.id] ? '✓' : ''}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: checked[item.id] ? '#2e7d32' : 'var(--navy)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{item.icon}</span> {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ padding: '0 20px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-light)', marginBottom: 6 }}>
            <span>Progress</span>
            <span style={{ fontWeight: 700, color: allDone ? '#2e7d32' : 'var(--text-mid)' }}>
              {Object.values(checked).filter(Boolean).length} / {CHECKLIST.length} completed
            </span>
          </div>
          <div style={{ height: 6, background: '#e0e0e0', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: allDone ? '#2e7d32' : 'var(--saffron)',
              width: `${(Object.values(checked).filter(Boolean).length / CHECKLIST.length) * 100}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '12px 20px 18px', display: 'flex', gap: 10, borderTop: '1px solid var(--border)' }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '10px', background: '#fff',
            border: '1px solid var(--border)', color: 'var(--text-mid)',
            borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={() => allDone && onConfirm()} disabled={!allDone}
            style={{
              flex: 2, padding: '10px',
              background: allDone ? 'linear-gradient(135deg,#2e7d32,#43a047)' : '#e0e0e0',
              color: allDone ? '#fff' : '#9e9e9e',
              border: 'none', borderRadius: 4,
              fontSize: 13, fontWeight: 800,
              cursor: allDone ? 'pointer' : 'not-allowed',
              boxShadow: allDone ? '0 3px 10px rgba(46,125,50,0.3)' : 'none',
              transition: 'all 0.2s',
            }}>
            {allDone ? '✅ All Clear — Start Shift' : `Complete all ${CHECKLIST.length} items to proceed`}
          </button>
        </div>
      </div>
    </div>
  );
}