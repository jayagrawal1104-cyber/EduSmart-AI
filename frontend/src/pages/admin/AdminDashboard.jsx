import './AdminDashboard.css';
import { useEffect, useState } from 'react';
import { Users, ClipboardList, TrendingUp, AlertTriangle, Activity, BarChart2, ChevronRight, Loader2 } from 'lucide-react';
import { StatCard, SectionHeader, Card, ProgressBar, Btn } from '../../components/ui/index';
import { dashboardApi, adminApi, analyticsApi, ApiError } from '../../lib/api';
import { useNav } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function AdminDashboard() {
  const { navigate } = useNav();
  const { token } = useAuth();

  const [dashboard, setDashboard] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [atRiskTotal, setAtRiskTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [dashRes, deptRes, attendanceRes, riskRes] = await Promise.all([
          dashboardApi.getDashboard(token),
          adminApi.listDepartments(token),
          analyticsApi.attendanceByDepartment(token),
          analyticsApi.atRiskStudents(token, { limit: 1 }),
        ]);

        const attendanceById = Object.fromEntries(
          (attendanceRes.departments || []).map((row) => [row.department.id, row.attendanceRate])
        );
        const deptBase = deptRes.departments || [];
        const perfResults = await Promise.all(
          deptBase.map((d) => analyticsApi.performanceOverview(token, { departmentId: d.id }).catch(() => null))
        );

        setDepartments(
          deptBase.map((d, i) => ({
            ...d,
            attendanceRate: attendanceById[d.id] ?? null,
            avgPerformance: perfResults[i]?.averageScore ?? null,
          }))
        );
        setDashboard(dashRes);
        setAtRiskTotal(riskRes.total ?? 0);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div style={{ color: '#dc2626', padding: '2rem' }}>{error}</div>;
  }

  const kpiCards = [
    {
      label: 'Avg Attendance (30d)',
      value: dashboard.attendance30d.rate !== null ? `${dashboard.attendance30d.rate}%` : '—',
      sub: `${dashboard.attendance30d.total} records in the last 30 days`,
      icon: <ClipboardList className="admin-dashboard-1" />,
      color: 'green',
    },
    {
      label: 'Avg Performance',
      value: dashboard.averagePerformance !== null ? `${dashboard.averagePerformance}%` : '—',
      sub: 'Across all departments',
      icon: <TrendingUp className="admin-dashboard-1" />,
      color: 'blue',
    },
    {
      label: 'At-Risk Students',
      value: String(atRiskTotal ?? 0),
      sub: 'Attendance below 75%',
      icon: <AlertTriangle className="admin-dashboard-1" />,
      color: 'red',
    },
    {
      label: 'Pending Join Requests',
      value: String(dashboard.counts.pendingJoinRequests),
      sub: 'Awaiting approval',
      icon: <Users className="admin-dashboard-1" />,
      color: 'amber',
    },
  ];

  return (
    <div className="admin-dashboard-2">
      {/* Header */}
      <div className="admin-dashboard-3">
        <div>
          <h1 className="admin-dashboard-4">Institution Overview</h1>
          <p className="admin-dashboard-5">{today}</p>
        </div>
        <div className="admin-dashboard-6">
          <Btn variant="outline" size="sm" icon={<Activity className="admin-dashboard-7" />} onClick={() => navigate('admin/reports')}>
            Live Status
          </Btn>
          <Btn variant="primary" size="sm" icon={<BarChart2 className="admin-dashboard-7" />} onClick={() => navigate('admin/reports')}>
            Generate Report
          </Btn>
        </div>
      </div>

      {/* KPI cards */}
      <div className="admin-dashboard-8">
        {kpiCards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      <div className="admin-dashboard-9">
        {/* Quick Actions + Recent Activity */}
        <div className="admin-dashboard-15">
          {/* Quick Actions */}
          <Card className="admin-dashboard-16">
            <SectionHeader title="Quick Actions" />
            <div className="admin-dashboard-17">
              <button onClick={() => navigate('admin/reports')} className="admin-dashboard-18">
                <div className="admin-dashboard-19"><BarChart2 className="admin-dashboard-20" /></div>
                <div>
                  <div className="admin-dashboard-21">Generate Report</div>
                  <div className="admin-dashboard-22">PDF / CSV / Excel</div>
                </div>
                <ChevronRight className="admin-dashboard-23" />
              </button>
              <button onClick={() => navigate('admin/performance')} className="admin-dashboard-18">
                <div className="admin-dashboard-24"><AlertTriangle className="admin-dashboard-25" /></div>
                <div>
                  <div className="admin-dashboard-21">View At-Risk Students</div>
                  <div className="admin-dashboard-22">{atRiskTotal ?? 0} students flagged</div>
                </div>
                <ChevronRight className="admin-dashboard-23" />
              </button>
              <button onClick={() => navigate('admin/join-requests')} className="admin-dashboard-18">
                <div className="admin-dashboard-26"><Users className="admin-dashboard-27" /></div>
                <div>
                  <div className="admin-dashboard-21">Manage Join Requests</div>
                  <div className="admin-dashboard-22">{dashboard.counts.pendingJoinRequests} pending approvals</div>
                </div>
                <ChevronRight className="admin-dashboard-23" />
              </button>
            </div>
          </Card>

          {/* Recent Activity */}
          <Card className="admin-dashboard-16">
            <SectionHeader
              title="Recent Activity"
              action={<button onClick={() => navigate('admin/audit-logs')} className="admin-dashboard-28">All Logs</button>}
            />
            <div className="admin-dashboard-14">
              {dashboard.recentActivity.length === 0 && <div style={{ color: '#94a3b8', padding: '0.5rem 0' }}>No activity yet</div>}
              {dashboard.recentActivity.map((log) => (
                <div key={log.id} className="admin-dashboard-29">
                  <div className="admin-dashboard-30">
                    {log.userLabel.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </div>
                  <div className="admin-dashboard-31">
                    <div className="admin-dashboard-32">{log.action}</div>
                    <div className="admin-dashboard-22">{log.userLabel} · {timeAgo(log.timestamp)}</div>
                  </div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${log.status === 'Success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Department Performance Table */}
      <Card className="admin-dashboard-16">
        <SectionHeader
          title="Department Performance"
          sub={`Across all ${departments.length} department${departments.length === 1 ? '' : 's'}`}
          action={<button onClick={() => navigate('admin/departments')} className="admin-dashboard-12">View Details <ChevronRight className="admin-dashboard-13" /></button>}
        />
        <div className="admin-dashboard-33">
          <table className="admin-dashboard-34">
            <thead>
              <tr className="admin-dashboard-35">
                {['Department', 'Students', 'Faculty', 'Attendance', 'Performance'].map((h) => (
                  <th key={h} className="admin-dashboard-36">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="admin-dashboard-37">
              {departments.map((dept) => (
                <tr key={dept.id} className="admin-dashboard-38">
                  <td className="admin-dashboard-39">
                    <div className="admin-dashboard-40">{dept.name}</div>
                    <div className="admin-dashboard-22">{dept.code}</div>
                  </td>
                  <td className="admin-dashboard-41">{dept.studentCount}</td>
                  <td className="admin-dashboard-41">{dept.facultyCount}</td>
                  <td className="admin-dashboard-39">
                    <div className="admin-dashboard-6">
                      <span className={`font-semibold text-sm ${dept.attendanceRate >= 80 ? 'text-green-600' : dept.attendanceRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
                        {dept.attendanceRate !== null ? `${dept.attendanceRate}%` : '—'}
                      </span>
                      <div className="admin-dashboard-42">
                        <ProgressBar value={dept.attendanceRate ?? 0} color={dept.attendanceRate >= 80 ? 'green' : dept.attendanceRate >= 75 ? 'amber' : 'red'} />
                      </div>
                    </div>
                  </td>
                  <td className="admin-dashboard-39">
                    <div className="admin-dashboard-6">
                      <span className="admin-dashboard-43">{dept.avgPerformance !== null ? `${dept.avgPerformance}%` : '—'}</span>
                      <div className="admin-dashboard-42">
                        <ProgressBar value={dept.avgPerformance ?? 0} color="blue" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}