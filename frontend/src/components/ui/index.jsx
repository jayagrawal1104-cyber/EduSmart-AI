import './index.css';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info } from 'lucide-react';
// Badge variants
export function Badge({
  children,
  variant = 'default',
  size = 'sm'
}) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    danger: 'bg-red-50 text-red-700',
    info: 'bg-blue-50 text-blue-700',
    ai: 'bg-violet-50 text-violet-700',
    neutral: 'bg-slate-50 text-slate-600'
  };
  const sizes = {
    xs: 'px-1.5 py-0.5 text-[10px]',
    sm: 'px-2 py-0.5 text-xs'
  };
  return <span className={`inline-flex items-center gap-1 font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>;
}
export function RiskBadge({
  level
}) {
  const config = {
    Low: {
      variant: 'success',
      label: 'Low Risk'
    },
    Medium: {
      variant: 'warning',
      label: 'Medium Risk'
    },
    High: {
      variant: 'danger',
      label: 'High Risk'
    }
  };
  return <Badge variant={config[level].variant}>{config[level].label}</Badge>;
}
export function AIBadge({
  label = 'AI Powered'
}) {
  return <Badge variant="ai">
      <Sparkles className="index-1" />
      {label}
    </Badge>;
}
export function StatusBadge({
  status
}) {
  const map = {
    Active: 'success',
    Inactive: 'neutral',
    Suspended: 'danger',
    Pending: 'warning',
    Approved: 'success',
    Rejected: 'danger',
    Present: 'success',
    Absent: 'danger',
    Late: 'warning',
    Submitted: 'info',
    Graded: 'success',
    Verified: 'success',
    Failed: 'danger',
    Warning: 'warning',
    Success: 'success',
    Trial: 'warning'
  };
  return <Badge variant={map[status] || 'neutral'}>{status}</Badge>;
}

// Cards
export function Card({
  children,
  className = ''
}) {
  return <div className={`bg-white border border-slate-200 rounded-xl shadow-sm transition-all duration-300 hover:shadow-md hover:border-brand-200 ${className}`}>
      {children}
    </div>;
}

// Stat card
export function StatCard({
  label,
  value,
  sub,
  trend,
  icon,
  color = 'blue',
  onClick
}) {
  const colors = {
    blue: 'stat-icon stat-icon-blue',
    green: 'stat-icon stat-icon-green',
    amber: 'stat-icon stat-icon-amber',
    red: 'stat-icon stat-icon-red',
    violet: 'stat-icon stat-icon-violet'
  };
  return <div
      className={`index-2${onClick ? ' cursor-pointer' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e => { if (e.key === 'Enter' || e.key === ' ') onClick(e); }) : undefined}
    >
      <div className="index-3">
        <div className={colors[color]}>{icon}</div>
        {trend && <div className={`flex items-center gap-1 text-xs font-medium ${trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-slate-400'}`}>
            {trend.direction === 'up' ? <TrendingUp className="index-4" /> : trend.direction === 'down' ? <TrendingDown className="index-4" /> : null}
            {trend.value}%
          </div>}
      </div>
      <div className="index-5">{value}</div>
      <div className="index-6">{label}</div>
      {sub && <div className="index-7">{sub}</div>}
    </div>;
}

// AI Insight Card
export function AIInsightCard({
  insight,
  onAction
}) {
  const config = {
    info: {
      icon: <Info className="index-8" />,
      bg: 'bg-blue-50 border-blue-100',
      iconBg: 'bg-blue-100 text-blue-600',
      titleColor: 'text-blue-900'
    },
    warning: {
      icon: <AlertTriangle className="index-8" />,
      bg: 'bg-amber-50 border-amber-100',
      iconBg: 'bg-amber-100 text-amber-600',
      titleColor: 'text-amber-900'
    },
    critical: {
      icon: <AlertTriangle className="index-8" />,
      bg: 'bg-red-50 border-red-100',
      iconBg: 'bg-red-100 text-red-600',
      titleColor: 'text-red-900'
    },
    success: {
      icon: <CheckCircle className="index-8" />,
      bg: 'bg-green-50 border-green-100',
      iconBg: 'bg-green-100 text-green-600',
      titleColor: 'text-green-900'
    }
  };
  const c = config[insight.type] || config.info;
  return <div className={`rounded-xl border p-4 ${c.bg}`}>
      <div className="index-9">
        <div className={`p-1.5 rounded-lg mt-0.5 ${c.iconBg}`}>{c.icon}</div>
        <div className="index-10">
          <div className="index-11">
            <p className={`text-sm font-semibold ${c.titleColor}`}>{insight.title}</p>
            {insight.confidence && <span className="index-12">{insight.confidence}% confidence</span>}
          </div>
          <p className="index-13">{insight.description}</p>
          {insight.data && <ul className="index-14">
              {insight.data.map((d, i) => <li key={i} className="index-15">
                  <span className="index-16" />
                  {d}
                </li>)}
            </ul>}
          {insight.recommendation && <p className="index-17">Recommendation: {insight.recommendation}</p>}
          <div className="index-18">
            {insight.action && <button onClick={onAction} className="index-19">
                {insight.action} →
              </button>}
            <AIBadge label="AI Insight" />
          </div>
        </div>
      </div>
    </div>;
}

// Progress bar
export function ProgressBar({
  value,
  max = 100,
  color = 'blue',
  showLabel = false
}) {
  const pct = Math.min(100, value / max * 100);
  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    violet: 'bg-violet-600'
  };
  return <div className="index-20">
      <div className="index-21">
        <div className={`h-full rounded-full ${colors[color]}`} style={{
        width: `${pct}%`
      }} />
      </div>
      {showLabel && <span className="index-22">{value}%</span>}
    </div>;
}

// Empty state
export function EmptyState({
  icon,
  title,
  description,
  action
}) {
  return <div className="index-23">
      <div className="index-24">
        {icon}
      </div>
      <h3 className="index-25">{title}</h3>
      <p className="index-26">{description}</p>
      {action && <button onClick={action.onClick} className="index-27">
          {action.label} →
        </button>}
    </div>;
}

// Section header
export function SectionHeader({
  title,
  sub,
  action,
  badge
}) {
  return <div className="index-28">
      <div>
        <div className="index-20">
          <h2 className="index-29">{title}</h2>
          {badge}
        </div>
        {sub && <p className="index-30">{sub}</p>}
      </div>
      {action && <div className="index-31">{action}</div>}
    </div>;
}

// Table
export function Table({
  headers,
  children,
  className = ''
}) {
  return <div className={`overflow-x-auto ${className}`}>
      <table className="index-32">
        <thead>
          <tr className="index-33">
            {headers.map(h => <th key={h} className="index-34">
                {h}
              </th>)}
          </tr>
        </thead>
        <tbody className="index-35">
          {children}
        </tbody>
      </table>
    </div>;
}

// Input
export function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
  icon,
  hint
}) {
  return <div>
      {label && <label className="index-36">
          {label}{required && <span className="index-37">*</span>}
        </label>}
      <div className="index-38">
        {icon && <div className="index-39">{icon}</div>}
        <input type={type} placeholder={placeholder} value={value} onChange={e => onChange?.(e.target.value)} className={`w-full border border-slate-200 rounded-lg py-2.5 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white ${icon ? 'pl-10' : 'pl-3'}`} />
      </div>
      {hint && <p className="index-7">{hint}</p>}
    </div>;
}

// Select
export function Select({
  label,
  options,
  value,
  onChange,
  required
}) {
  return <div>
      {label && <label className="index-36">
          {label}{required && <span className="index-37">*</span>}
        </label>}
      <select value={value} onChange={e => onChange?.(e.target.value)} className="index-40">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>;
}

// Button
export function Btn({
  children,
  variant = 'primary',
  size = 'md',
  onClick,
  disabled,
  type = 'button',
  className = '',
  icon
}) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 border border-blue-600 hover:shadow-md hover:-translate-y-0.5',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 hover:-translate-y-0.5',
    ghost: 'text-slate-600 hover:bg-slate-100 border border-transparent',
    danger: 'bg-red-600 text-white hover:bg-red-700 border border-red-600 hover:shadow-md hover:-translate-y-0.5',
    outline: 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 hover:shadow-sm hover:-translate-y-0.5'
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm'
  };
  return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex items-center gap-2 font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 transition-all duration-200 active:translate-y-0 ${variants[variant]} ${sizes[size]} ${className}`}>
      {icon}
      {children}
    </button>;
}

// Risk gauge display
export function RiskGauge({
  score,
  risk
}) {
  const color = risk === 'Low' ? '#16a34a' : risk === 'Medium' ? '#d97706' : '#dc2626';
  const rotation = score / 100 * 180;
  return <div className="index-41">
      <div className="index-42">
        <svg viewBox="0 0 120 60" className="index-43">
          <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke="#f1f5f9" strokeWidth="10" strokeLinecap="round" />
          <path d="M 10 55 A 50 50 0 0 1 110 55" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${score / 100 * 157} 157`} />
          <g transform={`translate(60, 55) rotate(${rotation - 90})`}>
            <line x1="0" y1="0" x2="0" y2="-38" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="0" r="4" fill="#0f172a" />
          </g>
        </svg>
      </div>
      <div className="index-44">{score}</div>
      <div className="index-30">Academic Health Score</div>
    </div>;
}