import './SuperAdminDashboard.css';
import { useState } from 'react';
import { Building2, Users, Brain, Activity, TrendingUp, TrendingDown, CheckCircle, AlertTriangle, Server, Cpu, Database, Globe, ChevronRight, MoreHorizontal } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { StatCard, AIBadge, StatusBadge } from '../../components/ui';
import { superAdminInstitutions } from '../../data/mockData';
import { useNav } from '../../context/NavigationContext';
const platformStats = {
  institutions: 1500,
  activeStudents: 1240000,
  activeFaculty: 89000,
  aiQueriesMonth: 4200000,
  mau: 1150000
};
const growthData = [{
  month: 'Mar',
  institutions: 1180,
  students: 980000,
  queries: 3100000
}, {
  month: 'Apr',
  institutions: 1220,
  students: 1020000,
  queries: 3400000
}, {
  month: 'May',
  institutions: 1280,
  students: 1060000,
  queries: 3600000
}, {
  month: 'Jun',
  institutions: 1340,
  students: 1110000,
  queries: 3800000
}, {
  month: 'Jul',
  institutions: 1410,
  students: 1160000,
  queries: 3950000
}, {
  month: 'Aug',
  institutions: 1460,
  students: 1200000,
  queries: 4100000
}, {
  month: 'Sep',
  institutions: 1500,
  students: 1240000,
  queries: 4200000
}];
const regionDistribution = [{
  region: 'South India',
  count: 620,
  color: '#1d4ed8'
}, {
  region: 'West India',
  count: 480,
  color: '#7c3aed'
}, {
  region: 'North India',
  count: 280,
  color: '#0891b2'
}, {
  region: 'East India',
  count: 120,
  color: '#059669'
}];
const systemHealth = [{
  service: 'API Gateway',
  status: 'Operational',
  latency: '12ms',
  uptime: '99.97%'
}, {
  service: 'AI Intelligence Engine',
  status: 'Operational',
  latency: '280ms',
  uptime: '99.91%'
}, {
  service: 'Attendance Service',
  status: 'Operational',
  latency: '45ms',
  uptime: '99.99%'
}, {
  service: 'Database Cluster',
  status: 'Operational',
  latency: '8ms',
  uptime: '100%'
}, {
  service: 'Storage Service',
  status: 'Operational',
  latency: '32ms',
  uptime: '99.98%'
}, {
  service: 'Notification Service',
  status: 'Degraded',
  latency: '840ms',
  uptime: '98.2%'
}];
const recentActivity = [{
  action: 'New institution registered',
  detail: 'Global Tech Academy — Karnataka',
  time: '12 min ago',
  type: 'info'
}, {
  action: 'Institution onboarded',
  detail: 'PES University — Bengaluru',
  time: '1 hr ago',
  type: 'success'
}, {
  action: 'High AI query volume',
  detail: 'VIT: 12K queries in 1 hour (2× normal)',
  time: '2 hr ago',
  type: 'warning'
}, {
  action: 'Support ticket resolved',
  detail: 'Timetable generation issue — MIT',
  time: '3 hr ago',
  type: 'success'
}, {
  action: 'Security alert cleared',
  detail: 'Multiple login attempts from unknown IP',
  time: '5 hr ago',
  type: 'warning'
}];
function fmt(n) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return String(n);
}
export default function SuperAdminDashboard() {
  const {
    navigate
  } = useNav();
  const [activeTab, setActiveTab] = useState('overview');
  return <div className="super-admin-dashboard-1">
      {/* Header */}
      <div className="super-admin-dashboard-2">
        <div>
          <div className="super-admin-dashboard-3">
            <h1 className="super-admin-dashboard-4">Platform Overview</h1>
            <AIBadge label="Live" />
          </div>
          <p className="super-admin-dashboard-5">EduSmart AI platform status and metrics · September 1, 2026</p>
        </div>
        <div className="super-admin-dashboard-6">
          <button onClick={() => setActiveTab('overview')} className={`text-sm font-medium px-3 py-1.5 rounded-lg ${activeTab === 'overview' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            Overview
          </button>
          <button onClick={() => setActiveTab('system')} className={`text-sm font-medium px-3 py-1.5 rounded-lg ${activeTab === 'system' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            System Health
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="super-admin-dashboard-7">
        <StatCard label="Institutions" value={fmt(platformStats.institutions)} icon={<Building2 className="super-admin-dashboard-8" />} color="blue" trend={{
        value: 7,
        direction: 'up'
      }} sub="Active tenants" />
        <StatCard label="Active Students" value={fmt(platformStats.activeStudents)} icon={<Users className="super-admin-dashboard-8" />} color="green" trend={{
        value: 12,
        direction: 'up'
      }} sub="This month" />
        <StatCard label="Faculty" value={fmt(platformStats.activeFaculty)} icon={<Users className="super-admin-dashboard-8" />} color="violet" trend={{
        value: 9,
        direction: 'up'
      }} sub="Across platforms" />
        <StatCard label="AI Queries" value={fmt(platformStats.aiQueriesMonth)} icon={<Brain className="super-admin-dashboard-8" />} color="violet" trend={{
        value: 18,
        direction: 'up'
      }} sub="This month" />
        <StatCard label="Monthly Active Users" value={fmt(platformStats.mau)} icon={<Activity className="super-admin-dashboard-8" />} color="blue" trend={{
        value: 5,
        direction: 'up'
      }} sub="MAU" />
        <StatCard label="AI Uptime" value="99.94%" icon={<TrendingUp className="super-admin-dashboard-8" />} color="green" sub="Last 90 days" />
      </div>

      {activeTab === 'overview' ? <>
          {/* Growth charts */}
          <div className="super-admin-dashboard-9">
            <div className="super-admin-dashboard-10">
              <div className="super-admin-dashboard-11">
                <h2 className="super-admin-dashboard-12">Institution Growth</h2>
                <span className="super-admin-dashboard-13"><TrendingUp className="super-admin-dashboard-14" /> +7% MoM</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="instGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{
                fontSize: 11,
                fill: '#94a3b8'
              }} axisLine={false} tickLine={false} />
                  <YAxis tick={{
                fontSize: 11,
                fill: '#94a3b8'
              }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }} />
                  <Area type="monotone" dataKey="institutions" stroke="#7c3aed" strokeWidth={2} fill="url(#instGrad)" name="Institutions" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="super-admin-dashboard-10">
              <div className="super-admin-dashboard-11">
                <h2 className="super-admin-dashboard-12">AI Query Volume</h2>
                <span className="super-admin-dashboard-13"><TrendingUp className="super-admin-dashboard-14" /> +18% MoM</span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={growthData}>
                  <defs>
                    <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{
                fontSize: 11,
                fill: '#94a3b8'
              }} axisLine={false} tickLine={false} />
                  <YAxis tick={{
                fontSize: 11,
                fill: '#94a3b8'
              }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0'
              }} formatter={v => [`${fmt(v)} queries`, 'AI Queries']} />
                  <Area type="monotone" dataKey="queries" stroke="#1d4ed8" strokeWidth={2} fill="url(#qGrad)" name="AI Queries" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Region distribution + Recent activity */}
          <div className="super-admin-dashboard-15">
            <div className="super-admin-dashboard-10">
              <h2 className="super-admin-dashboard-16">Institutions by Region</h2>
              <div className="super-admin-dashboard-17">
                {regionDistribution.map(p => <div key={p.region}>
                    <div className="super-admin-dashboard-18">
                      <span className="super-admin-dashboard-19">{p.region}</span>
                      <span className="super-admin-dashboard-12">{p.count}</span>
                    </div>
                    <div className="super-admin-dashboard-20">
                      <div className="super-admin-dashboard-21" style={{
                  width: `${p.count / 1500 * 100}%`,
                  backgroundColor: p.color
                }} />
                    </div>
                  </div>)}
              </div>
              <button className="super-admin-dashboard-22">View All Regions →</button>
            </div>

            <div className="super-admin-dashboard-23">
              <div className="super-admin-dashboard-11">
                <h2 className="super-admin-dashboard-12">Recent Platform Activity</h2>
                <button className="super-admin-dashboard-24">View All →</button>
              </div>
              <div className="super-admin-dashboard-25">
                {recentActivity.map((a, i) => <div key={i} className="super-admin-dashboard-26">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${a.type === 'success' ? 'bg-green-50 text-green-600' : a.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      {a.type === 'success' ? <CheckCircle className="super-admin-dashboard-27" /> : a.type === 'warning' ? <AlertTriangle className="super-admin-dashboard-27" /> : <Activity className="super-admin-dashboard-27" />}
                    </div>
                    <div className="super-admin-dashboard-28">
                      <div className="super-admin-dashboard-29">{a.action}</div>
                      <div className="super-admin-dashboard-30">{a.detail}</div>
                    </div>
                    <div className="super-admin-dashboard-31">{a.time}</div>
                  </div>)}
              </div>
            </div>
          </div>

          {/* Institution table */}
          <div className="super-admin-dashboard-32">
            <div className="super-admin-dashboard-33">
              <h2 className="super-admin-dashboard-12">Top Institutions</h2>
              <button onClick={() => navigate('superadmin/institutions')} className="super-admin-dashboard-34">
                View All <ChevronRight className="super-admin-dashboard-14" />
              </button>
            </div>
            <div className="super-admin-dashboard-35">
              <table className="super-admin-dashboard-36">
                <thead>
                  <tr className="super-admin-dashboard-37">
                    {['Institution', 'Code', 'Users', 'AI Usage', 'Status', ''].map(h => <th key={h} className="super-admin-dashboard-38">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="super-admin-dashboard-39">
                  {superAdminInstitutions.map(inst => <tr key={inst.id} className="super-admin-dashboard-40">
                      <td className="super-admin-dashboard-41">
                        <div className="super-admin-dashboard-42">{inst.name}</div>
                        <div className="super-admin-dashboard-43">{inst.id}</div>
                      </td>
                      <td className="super-admin-dashboard-44">{inst.code}</td>
                      <td className="super-admin-dashboard-45">{inst.students.toLocaleString()} / {inst.faculty}</td>
                      <td className="super-admin-dashboard-41">
                        <div className="super-admin-dashboard-46">
                          <div className="super-admin-dashboard-47">
                            <div className={`h-full rounded-full ${inst.usage > 80 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{
                        width: `${inst.usage}%`
                      }} />
                          </div>
                          <span className="super-admin-dashboard-48">{inst.usage}%</span>
                        </div>
                      </td>
                      <td className="super-admin-dashboard-41"><StatusBadge status={inst.status} /></td>
                      <td className="super-admin-dashboard-41">
                        <button className="super-admin-dashboard-49"><MoreHorizontal className="super-admin-dashboard-8" /></button>
                      </td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </> : (/* System Health Tab */
    <div className="super-admin-dashboard-50">
          {/* System metrics */}
          <div className="super-admin-dashboard-51">
            {[{
          label: 'API Latency',
          value: '12ms',
          icon: <Globe className="super-admin-dashboard-8" />,
          status: 'good',
          sub: 'P95: 28ms'
        }, {
          label: 'CPU Usage',
          value: '34%',
          icon: <Cpu className="super-admin-dashboard-8" />,
          status: 'good',
          sub: '16 vCPUs'
        }, {
          label: 'DB Connections',
          value: '847',
          icon: <Database className="super-admin-dashboard-8" />,
          status: 'good',
          sub: 'Max: 2000'
        }, {
          label: 'Active Sessions',
          value: '18,240',
          icon: <Users className="super-admin-dashboard-8" />,
          status: 'good',
          sub: 'Concurrent users'
        }].map(m => <div key={m.label} className="super-admin-dashboard-52">
                <div className="super-admin-dashboard-53">
                  <div className="super-admin-dashboard-54">{m.icon}</div>
                  <div className={`w-2 h-2 rounded-full ${m.status === 'good' ? 'bg-green-500' : 'bg-amber-500'}`} />
                </div>
                <div className="super-admin-dashboard-55">{m.value}</div>
                <div className="super-admin-dashboard-56">{m.label}</div>
                <div className="super-admin-dashboard-57">{m.sub}</div>
              </div>)}
          </div>

          {/* Service status */}
          <div className="super-admin-dashboard-32">
            <div className="super-admin-dashboard-58">
              <h2 className="super-admin-dashboard-12">Service Status</h2>
              <span className="super-admin-dashboard-59">
                <div className="super-admin-dashboard-60" />
                5/6 Operational
              </span>
            </div>
            <div className="super-admin-dashboard-39">
              {systemHealth.map(s => <div key={s.service} className="super-admin-dashboard-61">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === 'Operational' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  <div className="super-admin-dashboard-62">{s.service}</div>
                  <div className={`text-xs font-medium ${s.status === 'Operational' ? 'text-green-600' : 'text-amber-600'}`}>{s.status}</div>
                  <div className="super-admin-dashboard-63">P50: {s.latency}</div>
                  <div className="super-admin-dashboard-64">{s.uptime} up</div>
                </div>)}
            </div>
          </div>

          {/* Uptime history bar */}
          <div className="super-admin-dashboard-10">
            <div className="super-admin-dashboard-11">
              <h2 className="super-admin-dashboard-12">Platform Uptime — Last 90 days</h2>
              <span className="super-admin-dashboard-65">99.94%</span>
            </div>
            <div className="super-admin-dashboard-66">
              {Array.from({
            length: 90
          }).map((_, i) => {
            const isDown = [12, 34, 67].includes(i);
            const isDegraded = [23, 45, 78].includes(i);
            return <div key={i} title={isDown ? 'Incident' : isDegraded ? 'Degraded' : 'Operational'} className={`flex-1 h-8 rounded-[2px] ${isDown ? 'bg-red-400' : isDegraded ? 'bg-amber-400' : 'bg-green-400'}`} />;
          })}
            </div>
            <div className="super-admin-dashboard-67">
              <span>90 days ago</span>
              <span className="super-admin-dashboard-68">
                <span className="super-admin-dashboard-69"><span className="super-admin-dashboard-70" /> Operational</span>
                <span className="super-admin-dashboard-69"><span className="super-admin-dashboard-71" /> Degraded</span>
                <span className="super-admin-dashboard-69"><span className="super-admin-dashboard-72" /> Incident</span>
              </span>
              <span>Today</span>
            </div>
          </div>
        </div>)}
    </div>;
}