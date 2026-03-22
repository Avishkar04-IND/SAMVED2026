import { useState, useEffect } from 'react';
import { useAuth }             from '../context/AuthContext';
import { getTaskHistory }      from '../services/api';
import GovtLayout              from '../components/GovtLayout';
import GradeTag                from '../components/GradeTag';

export default function WorkHistory() {
  const { user }             = useAuth();
  const [history, setHistory]= useState([]);
  const [loading, setLoading]= useState(true);

  useEffect(() => {
    if (!user?.id) return;
    getTaskHistory(user.id)
      .then(res => setHistory(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <GovtLayout breadcrumb="Worker → Work History">

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ color: 'var(--navy)' }}>📁 My Work History</h2>
        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>{history.length} records found</span>
      </div>

      {/* Filter bar */}
      <div style={{ background: 'var(--navy-light)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 14px', marginBottom: 18, display: 'flex', gap: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-mid)', fontWeight: 600 }}>Filter:</span>
        <select className="form-control" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
          <option>All Time</option>
          <option>This Week</option>
          <option>This Month</option>
        </select>
        <select className="form-control" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}>
          <option>All Classes</option>
          <option>Class A</option>
          <option>Class B</option>
          <option>Class C</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-light)' }}>⏳ Loading history...</div>
      ) : history.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📋</div>
          <div style={{ color: 'var(--text-light)' }}>No completed tasks yet. Complete your first task to see history here.</div>
        </div>
      ) : (
        <div className="card">
          {history.map((task, i) => (
            <div key={i} style={{
              padding: '14px 18px',
              borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 0 ? '#fff' : '#fafbfc',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--navy)', marginBottom: 4 }}>
                    ✅ {task.title}
                  </div>
                  <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-light)', flexWrap: 'wrap' }}>
                    <span>📍 {task.zone}</span>
                    <span>⏱️ {task.duration}</span>
                    {task.assignedAt && <span>📅 {new Date(task.assignedAt).toLocaleDateString()}</span>}
                    {task.completedAt && <span>🏁 Completed: {new Date(task.completedAt).toLocaleTimeString()}</span>}
                  </div>
                </div>
                <div style={{ marginLeft: 12, flexShrink: 0 }}>
                  <GradeTag grade={task.healthClass} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </GovtLayout>
  );
}