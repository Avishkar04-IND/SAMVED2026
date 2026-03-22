import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAuth }             from '../context/AuthContext';
import { getUnassignedWorkers, assignWorkers, getWorkersBySupervisor, removeWorker } from '../services/api';
import GovtLayout              from './GovtLayout';

export default function AssignWorkers() {
  const { user }                   = useAuth();
  const navigate                   = useNavigate();
  const [available, setAvailable]  = useState([]);
  const [myWorkers, setMyWorkers]  = useState([]);
  const [selected, setSelected]    = useState([]);
  const [loading, setLoading]      = useState(true);
  const [saving, setSaving]        = useState(false);
  const [removingId, setRemovingId]= useState(null);
  const [error, setError]          = useState('');
  const [success, setSuccess]      = useState('');
  const [search, setSearch]        = useState('');

  useEffect(() => {
    if (!user?.id) return;
    Promise.all([
      getUnassignedWorkers(),
      getWorkersBySupervisor(user.id),
    ]).then(([avRes, myRes]) => {
      setAvailable(avRes.data || []);
      setMyWorkers(myRes.data || []);
    }).catch(() => setError('Failed to load workers.'))
      .finally(() => setLoading(false));
  }, [user]);

  const toggle = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(w => w !== id));
    } else {
      if (myWorkers.length + selected.length >= 5) {
        setError('Maximum 5 workers per supervisor.'); return;
      }
      setSelected([...selected, id]);
    }
    setError('');
  };

  const handleAssign = async () => {
    if (selected.length === 0) { setError('Please select at least one worker.'); return; }
    setSaving(true);
    try {
      await assignWorkers(user.id, [...myWorkers.map(w => w.workerId), ...selected]);
      setSuccess(`✅ ${selected.length} worker(s) added to your team!`);
      setTimeout(() => navigate('/supervisor/dashboard'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign workers.');
    } finally { setSaving(false); }
  };

  const handleRemove = async (workerId, workerName) => {
    if (!window.confirm(`Remove ${workerName} from your team?`)) return;
    setRemovingId(workerId);
    try {
      await removeWorker(user.id, workerId);
      setMyWorkers(prev => prev.filter(w => w.workerId !== workerId));
      setSuccess(`✅ ${workerName} removed from team.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('Failed to remove worker.');
    } finally { setRemovingId(null); }
  };

  const filtered = available.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.workerId?.toLowerCase().includes(search.toLowerCase())
  );

  const totalAfter = myWorkers.length + selected.length;

  return (
    <GovtLayout breadcrumb="Supervisor → Manage Workers">
      <div style={{ maxWidth: 750, margin: '0 auto' }}>

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ color: 'var(--navy)', fontSize: 18, fontWeight: 700 }}>👥 Manage Your Team</h2>
          <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 4 }}>
            Add or remove workers from your supervision team. Maximum 5 workers.
          </p>
        </div>

        <div style={{ background: 'var(--navy-light)', border: '1px solid #c5d3e8', borderLeft: '4px solid var(--navy)', borderRadius: 4, padding: '10px 14px', marginBottom: 18, fontSize: 13, color: 'var(--navy)' }}>
          ℹ️ &nbsp;Supervisor: <strong>{user?.name}</strong> &nbsp;|&nbsp; ID: <strong>{user?.id}</strong> &nbsp;|&nbsp; Team size: <strong>{totalAfter} / 5</strong>
        </div>

        {error   && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderLeft: '4px solid #c62828', borderRadius: 3, padding: '9px 12px', marginBottom: 14, fontSize: 13, color: '#c62828' }}>⚠️ {error}</div>}
        {success && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderLeft: '4px solid #2e7d32', borderRadius: 3, padding: '9px 12px', marginBottom: 14, fontSize: 13, color: '#2e7d32' }}>{success}</div>}

        {/* Current Team */}
        {myWorkers.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>✅ Current Team</span>
              <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>{myWorkers.length} workers</span>
            </div>
            {myWorkers.map((w, i) => (
              <div key={w.workerId} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                borderBottom: i < myWorkers.length - 1 ? '1px solid var(--border)' : 'none',
                background: '#fff',
              }}>
                <div style={{ fontSize: 22 }}>👷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{w.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 1 }}>ID: {w.workerId} &nbsp;·&nbsp;
                    <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 }}>Active</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(w.workerId, w.name)}
                  disabled={removingId === w.workerId}
                  style={{ background: 'none', border: '1px solid #ef9a9a', color: '#c62828', padding: '4px 12px', borderRadius: 3, fontSize: 12, fontWeight: 600, cursor: 'pointer', opacity: removingId === w.workerId ? 0.6 : 1 }}>
                  {removingId === w.workerId ? '⏳' : '✕ Remove'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add New Workers */}
        {totalAfter < 5 && (
          <>
            <h3 style={{ color: 'var(--navy)', fontSize: 14, fontWeight: 700, marginBottom: 12 }}>➕ Add New Workers</h3>
            <div style={{ marginBottom: 14 }}>
              <input
                style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 3, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
                placeholder="🔍  Search by name or worker ID..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div className="card" style={{ marginBottom: 18 }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Available Workers</span>
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85 }}>{filtered.length} found</span>
              </div>
              {loading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)' }}>⏳ Loading...</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-light)' }}>
                  {available.length === 0 ? 'No unassigned workers. Workers need to login first.' : 'No workers match your search.'}
                </div>
              ) : (
                filtered.map((w, i) => {
                  const isSel = selected.includes(w.workerId);
                  return (
                    <div key={w.workerId} onClick={() => toggle(w.workerId)}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', background: isSel ? 'var(--navy-light)' : '#fff', cursor: 'pointer' }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggle(w.workerId)}
                        style={{ width: 16, height: 16, accentColor: 'var(--navy)', cursor: 'pointer' }} />
                      <div style={{ fontSize: 22 }}>👷</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--navy)' }}>{w.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 2 }}>ID: {w.workerId}</div>
                      </div>
                      {isSel && <span style={{ background: 'var(--navy)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 3 }}>✓ Selected</span>}
                    </div>
                  );
                })
              )}
            </div>

            {selected.length > 0 && (
              <button onClick={handleAssign} disabled={saving}
                style={{ width: '100%', padding: 12, background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 3, fontSize: 14, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? '⏳ Adding...' : `✅ Add ${selected.length} Worker(s) to Team →`}
              </button>
            )}
          </>
        )}

        {totalAfter >= 5 && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 4, padding: '12px 16px', fontSize: 13, color: '#e65100', textAlign: 'center' }}>
            ⚠️ Team is full (5/5). Remove a worker first before adding new ones.
          </div>
        )}

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={() => navigate('/supervisor/dashboard')}
            style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-mid)', padding: '8px 20px', borderRadius: 3, fontSize: 13, cursor: 'pointer' }}>
            ← Back to Dashboard
          </button>
        </div>

      </div>
    </GovtLayout>
  );
}