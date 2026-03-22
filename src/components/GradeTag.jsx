export default function GradeTag({ grade }) {
  const config = {
    A: { label: 'Class A — Fit',        bg: '#e8f5e9', color: '#2e7d32', border: '#a5d6a7' },
    B: { label: 'Class B — Moderate',   bg: '#fffde7', color: '#e65100', border: '#ffe082' },
    C: { label: 'Class C — High Risk',  bg: '#ffebee', color: '#c62828', border: '#ef9a9a' },
  };
  const c = config[grade] || config['A'];
  return (
    <span style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.border}`,
      padding: '2px 9px', borderRadius: 3,
      fontSize: 11, fontWeight: 700,
    }}>
      {c.label}
    </span>
  );
}