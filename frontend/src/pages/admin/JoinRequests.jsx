import './JoinRequests.css';
import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Eye, UserCheck, Users, Loader2 } from 'lucide-react';
import { StatusBadge, Card, Btn } from '../../components/ui/index';
import { adminApi, ApiError } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const tabs = [
  { key: 'Pending', label: 'Pending' },
  { key: 'Approved', label: 'Approved' },
  { key: 'Rejected', label: 'Rejected' },
];

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function titleCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Normalizes a backend JoinRequest (role/status uppercase-or-lowercase enums,
// requestedDate as an ISO string) into the shape this page's UI expects.
function normalize(req) {
  return {
    ...req,
    role: titleCase(req.role),
    status: titleCase(req.status),
    department: req.department || '—',
    rollId: req.rollId || '—',
    requestedDate: req.requestedDate ? new Date(req.requestedDate).toLocaleDateString() : '—',
  };
}

export default function JoinRequests() {
  const { token } = useAuth();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('Pending');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selected, setSelected] = useState([]);
  const [actingId, setActingId] = useState(null); // id currently being approved/rejected (disables its row)

  async function loadRequests() {
    setLoading(true);
    setError('');
    try {
      const data = await adminApi.listJoinRequests(token);
      setRequests((data.joinRequests || []).map(normalize));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load join requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const filtered = requests.filter(r => {
    if (r.status !== activeTab) return false;
    if (roleFilter !== 'All' && r.role !== roleFilter) return false;
    return true;
  });

  async function reject(id) {
    setActingId(id);
    try {
      await adminApi.rejectJoinRequest(token, id);
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'Rejected' } : r)));
      setSelected(prev => prev.filter(x => x !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reject request');
    } finally {
      setActingId(null);
    }
  }

  async function rejectSelected() {
    for (const id of selected) {
      // eslint-disable-next-line no-await-in-loop
      await reject(id);
    }
  }

  // Every role now supplies everything the backend needs right on its own
  // join form — students pick department + course same as faculty do, and
  // admins aren't department-scoped at all — so Approve is a single click
  // for all of them. The backend resolves department by the name captured
  // on the request and falls back to the course the applicant chose there
  // too (see approveJoinRequest in admin.controller.js).
  async function doApprove(id, payload = {}) {
    setActingId(id);
    try {
      await adminApi.approveJoinRequest(token, id, payload);
      setRequests(prev => prev.map(r => (r.id === id ? { ...r, status: 'Approved' } : r)));
      setSelected(prev => prev.filter(x => x !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to approve request');
    } finally {
      setActingId(null);
    }
  }

  function approveSelected() {
    selected.forEach(id => doApprove(id));
  }

  function toggleSelect(id) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  const counts = {
    Pending: requests.filter(r => r.status === 'Pending').length,
    Approved: requests.filter(r => r.status === 'Approved').length,
    Rejected: requests.filter(r => r.status === 'Rejected').length,
  };

  return (
    <div className="join-requests-1">
      {/* Header */}
      <div className="join-requests-2">
        <div>
          <h1 className="join-requests-3">Join Requests</h1>
          <p className="join-requests-4">Manage student and faculty join requests</p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Tab Bar */}
      <div className="join-requests-5">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelected([]);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
          >
            {tab.label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : tab.key === 'Pending' ? 'bg-amber-100 text-amber-700' : tab.key === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {counts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters + Bulk */}
      <div className="join-requests-6">
        {/* Role filter */}
        <div className="join-requests-7">
          {['All', 'Student', 'Faculty'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${roleFilter === role ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {role === 'All' ? 'All' : role === 'Student' ? (
                <span className="join-requests-8"><Users className="join-requests-9" /> Students</span>
              ) : (
                <span className="join-requests-8"><UserCheck className="join-requests-9" /> Faculty</span>
              )}
            </button>
          ))}
        </div>

        {/* Bulk actions */}
        {selected.length > 0 && activeTab === 'Pending' && (
          <div className="join-requests-10">
            <span className="join-requests-11">{selected.length} selected</span>
            <Btn variant="primary" size="sm" icon={<CheckCircle className="join-requests-12" />} onClick={approveSelected}>
              Approve Selected
            </Btn>
            <Btn variant="danger" size="sm" icon={<XCircle className="join-requests-12" />} onClick={rejectSelected}>
              Reject Selected
            </Btn>
          </div>
        )}
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <div className="join-requests-13">
            <Loader2 className="join-requests-15 animate-spin" />
            <p className="join-requests-17">Loading join requests…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="join-requests-13">
            <div className="join-requests-14">
              <Users className="join-requests-15" />
            </div>
            <h3 className="join-requests-16">No {activeTab.toLowerCase()} requests</h3>
            <p className="join-requests-17">All join requests will appear here</p>
          </div>
        ) : (
          <div className="join-requests-18">
            <table className="join-requests-19">
              <thead>
                <tr className="join-requests-20">
                  {activeTab === 'Pending' && (
                    <th className="join-requests-21">
                      <input
                        type="checkbox"
                        checked={selected.length === filtered.length && filtered.length > 0}
                        onChange={() => setSelected(selected.length === filtered.length ? [] : filtered.map(r => r.id))}
                        className="join-requests-22"
                      />
                    </th>
                  )}
                  {['Name', 'Email', 'Role', 'Department', 'Roll ID', 'Requested', 'Status', 'Actions'].map(h => (
                    <th key={h} className="join-requests-23">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="join-requests-24">
                {filtered.map(req => (
                  <tr key={req.id} className="join-requests-25">
                    {activeTab === 'Pending' && (
                      <td className="join-requests-26">
                        <input
                          type="checkbox"
                          checked={selected.includes(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          className="join-requests-22"
                        />
                      </td>
                    )}
                    <td className="join-requests-26">
                      <div className="join-requests-27">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${req.role === 'Faculty' ? 'bg-gradient-to-br from-violet-400 to-blue-500' : 'bg-gradient-to-br from-blue-400 to-cyan-500'}`}>
                          {initials(req.name)}
                        </div>
                        <div>
                          <div className="join-requests-28">{req.name}</div>
                          <div className="join-requests-29">{req.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="join-requests-30">{req.email}</td>
                    <td className="join-requests-26">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${req.role === 'Faculty' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                        {req.role}
                      </span>
                      {req.role === 'Student' && (
                        <span
                          title={req.faceEnrolled ? 'Face ID captured at sign-up' : 'Face ID not captured — student will need to set it up before Smart Attendance can recognize them'}
                          className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${req.faceEnrolled ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                        >
                          {req.faceEnrolled ? 'Face ID ✓' : 'No Face ID'}
                        </span>
                      )}
                    </td>
                    <td className="join-requests-30">{req.department}</td>
                    <td className="join-requests-31">{req.rollId}</td>
                    <td className="join-requests-32">{req.requestedDate}</td>
                    <td className="join-requests-26">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="join-requests-26">
                      <div className="join-requests-8">
                        <button className="join-requests-33" title="View Details">
                          <Eye className="join-requests-12" />
                        </button>
                        {req.status === 'Pending' && (
                          <>
                            <button
                              onClick={() => doApprove(req.id)}
                              disabled={actingId === req.id}
                              className="join-requests-34 disabled:opacity-50"
                            >
                              <CheckCircle className="join-requests-9" /> Approve
                            </button>
                            <button
                              onClick={() => reject(req.id)}
                              disabled={actingId === req.id}
                              className="join-requests-35 disabled:opacity-50"
                            >
                              <XCircle className="join-requests-9" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}