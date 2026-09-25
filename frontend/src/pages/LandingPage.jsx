import './LandingPage.css';
import { useState, useEffect, useRef } from 'react';
import { Brain, BarChart3, Users, Shield, Zap, ChevronRight, Menu, X, BookOpen, GraduationCap, Building2, CheckCircle, ArrowRight, Globe, Lock, TrendingUp, Sparkles, Bell, Activity } from 'lucide-react';
import { useNav } from '../context/NavigationContext';
function Navbar({
  onLogin,
  onCreate
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return <header className="landing-page-1">
      <div className="landing-page-2">
        <div className="landing-page-3">
          <div className="landing-page-4">
            <Brain className="landing-page-5" />
          </div>
          <span className="landing-page-6">EduSmart <span className="landing-page-7">AI</span></span>
        </div>

        <div className="landing-page-8">
          <button onClick={onLogin} className="landing-page-9">Login</button>
          <button onClick={onCreate} className="landing-page-10">Get Started</button>
        </div>

        <button className="landing-page-11" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="landing-page-12" /> : <Menu className="landing-page-12" />}
        </button>
      </div>

      {mobileOpen && <div className="landing-page-13">
          <div className="landing-page-14">
            <button onClick={onLogin} className="landing-page-15">Login</button>
            <button onClick={onCreate} className="landing-page-16">Get Started</button>
          </div>
        </div>}
    </header>;
}
function DashboardMockup() {
  const cardRef = useRef(null);

  function handleMouseMove(e) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 -> 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5; // -0.5 -> 0.5
    const rotateY = px * 16; // left/right tilt
    const rotateX = -py * 12; // up/down tilt
    el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.015, 1.015, 1.015)`;
    el.style.setProperty('--rx', px.toFixed(3));
    el.style.setProperty('--ry', py.toFixed(3));
  }

  function handleMouseLeave() {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = 'rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    el.style.setProperty('--rx', 0);
    el.style.setProperty('--ry', 0);
  }

  return <div ref={cardRef} className="landing-page-17 dashboard-mockup-3d" onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
      {/* Mock topbar */}
      <div className="landing-page-18 mockup-layer-sm">
        <div className="landing-page-3">
          <div className="landing-page-19"><Brain className="landing-page-20" /></div>
          <span className="landing-page-21">EduSmart AI — Admin</span>
        </div>
        <div className="landing-page-3">
          <Bell className="landing-page-22" />
          <div className="landing-page-23">R</div>
        </div>
      </div>

      {/* Mock dashboard content */}
      <div className="landing-page-24">
        {/* KPI row */}
        <div className="landing-page-25 mockup-layer-md">
          {[{
          label: 'Students',
          value: '1,500',
          color: 'bg-blue-600'
        }, {
          label: 'Attendance',
          value: '80%',
          color: 'bg-green-500'
        }, {
          label: 'Performance',
          value: '78%',
          color: 'bg-violet-600'
        }, {
          label: 'At-Risk',
          value: '124',
          color: 'bg-amber-500'
        }].map(k => <div key={k.label} className="landing-page-26">
              <div className={`w-4 h-1 ${k.color} rounded mb-1.5`} />
              <div className="landing-page-27">{k.value}</div>
              <div className="landing-page-28">{k.label}</div>
            </div>)}
        </div>

        {/* Chart row */}
        <div className="landing-page-29 mockup-layer-lg">
          <div className="landing-page-30">
            <div className="landing-page-31">Attendance Trend</div>
            <div className="landing-page-32">
              {[65, 72, 68, 80, 75, 83, 79, 87, 82, 85, 81, 80].map((h, i) => <div key={i} className="landing-page-33" style={{
              height: `${h}%`
            }}>
                  {i === 11 && <div className="landing-page-34" />}
                </div>)}
            </div>
          </div>
          <div className="landing-page-35">
            <div className="landing-page-36">Risk Distribution</div>
            <div className="landing-page-37">
              {[{
              label: 'Low',
              pct: 63,
              color: 'bg-green-500'
            }, {
              label: 'Med',
              pct: 25,
              color: 'bg-amber-500'
            }, {
              label: 'High',
              pct: 12,
              color: 'bg-red-500'
            }].map(r => <div key={r.label} className="landing-page-38">
                  <div className="landing-page-39">{r.label}</div>
                  <div className="landing-page-40">
                    <div className={`h-full ${r.color} rounded-full`} style={{
                  width: `${r.pct}%`
                }} />
                  </div>
                </div>)}
            </div>
          </div>
        </div>

        {/* AI Insight */}
        <div className="landing-page-41 mockup-layer-lg">
          <div className="landing-page-42">
            <Sparkles className="landing-page-43" />
          </div>
          <div>
            <div className="landing-page-44">AI Insight: 124 students may require attention</div>
            <div className="landing-page-45">Attendance dropped 4% in CSE Sem 3 · Faculty workload imbalance detected</div>
          </div>
        </div>

        {/* Student table */}
        <div className="landing-page-46 mockup-layer-md">
          <div className="landing-page-47">At-Risk Students</div>
          <div className="landing-page-48">
            {[{
            name: 'Riya Patel',
            dept: 'CSE',
            att: '62%',
            risk: 'High',
            rColor: 'text-red-600 bg-red-50'
          }, {
            name: 'Rahul Verma',
            dept: 'ME',
            att: '55%',
            risk: 'High',
            rColor: 'text-red-600 bg-red-50'
          }, {
            name: 'Arjun Mehta',
            dept: 'ECE',
            att: '78%',
            risk: 'Med',
            rColor: 'text-amber-600 bg-amber-50'
          }].map(s => <div key={s.name} className="landing-page-49">
                <div className="landing-page-50">{s.name[0]}</div>
                <div className="landing-page-51">{s.name}</div>
                <div className="landing-page-52">{s.dept} · {s.att}</div>
                <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded-full ${s.rColor}`}>{s.risk}</span>
              </div>)}
          </div>
        </div>
      </div>
    </div>;
}
const features = [{
  icon: <Brain className="landing-page-12" />,
  title: 'AI Academic Intelligence',
  desc: 'Detects academic risk early and recommends targeted interventions before students fall behind.',
  color: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30'
}, {
  icon: <Activity className="landing-page-12" />,
  title: 'Smart AI Attendance',
  desc: 'AI-assisted facial recognition attendance with full faculty verification and anti-proxy detection.',
  color: 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/30'
}, {
  icon: <BarChart3 className="landing-page-12" />,
  title: 'Institutional Analytics',
  desc: 'Real-time performance dashboards across departments, courses, and semesters with AI-generated insights.',
  color: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md shadow-green-500/30'
}, {
  icon: <BookOpen className="landing-page-12" />,
  title: 'AI Study Assistant',
  desc: 'Course-aware AI that helps students understand concepts, generate quizzes, and create revision notes.',
  color: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md shadow-amber-500/30'
}, {
  icon: <Zap className="landing-page-12" />,
  title: 'Smart Timetable Engine',
  desc: 'Auto-generates conflict-free timetables respecting faculty availability, rooms, and workload balance.',
  color: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/30'
}, {
  icon: <Shield className="landing-page-12" />,
  title: 'Enterprise Security',
  desc: 'Role-based access, 2FA, audit logs, and data isolation ensure institution-grade privacy and compliance.',
  color: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-md shadow-slate-500/30'
}];
const pillars = [{
  icon: <GraduationCap className="landing-page-53" />,
  title: 'Students',
  items: ['Personal academic health score', 'AI study assistant', 'Real-time attendance & performance', 'Personalized intervention recommendations'],
  color: 'border-blue-200 bg-gradient-to-br from-blue-50 to-white',
  iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/30'
}, {
  icon: <Users className="landing-page-53" />,
  title: 'Faculty',
  items: ['AI-assisted attendance', 'Assignment analytics & similarity detection', 'Smart lesson planning', 'Workload optimization insights'],
  color: 'border-violet-200 bg-gradient-to-br from-violet-50 to-white',
  iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/30'
}, {
  icon: <Building2 className="landing-page-53" />,
  title: 'Institution',
  items: ['Institution-wide academic intelligence', 'Multi-department analytics', 'At-risk student identification', 'Smart timetable generation'],
  color: 'border-green-200 bg-gradient-to-br from-green-50 to-white',
  iconBg: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-md shadow-green-500/30'
}];
const institutionTypes = [{
  label: 'Universities',
  icon: '🏛️'
}, {
  label: 'Engineering Colleges',
  icon: '⚙️'
}, {
  label: 'Medical Colleges',
  icon: '🏥'
}, {
  label: 'Coaching Institutes',
  icon: '📚'
}, {
  label: 'Schools',
  icon: '🏫'
}, {
  label: 'Research Institutes',
  icon: '🔬'
}];
export default function LandingPage() {
  const {
    navigate,
    setRole
  } = useNav();
  const rootRef = useRef(null);

  // Scroll-triggered 3D "unfold" reveal — each section down the page tilts
  // in from an angled/edge-on state and unfolds flat as it scrolls into view.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets = rootRef.current ? rootRef.current.querySelectorAll('.scroll-reveal') : [];
    if (prefersReducedMotion) {
      targets.forEach(el => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('is-visible', entry.isIntersecting);
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -10% 0px'
    });

    targets.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  function handleLogin() {
    navigate('auth');
  }
  function handleGetStarted() {
    navigate('institute-creation');
  }
  return <div className="landing-page-54" ref={rootRef}>
      <Navbar onLogin={handleLogin} onCreate={handleGetStarted} />

      {/* Hero */}
      <section className="landing-page-55">
        <div className="landing-page-56">
          <div className="landing-page-57">
            <div className="landing-page-58">
              <div className="landing-page-59">
                <Sparkles className="landing-page-60" />
                AI-Powered Education Intelligence
              </div>
              <h1 className="landing-page-61" style={{
              fontSize: 'clamp(2rem, 4vw, 3rem)'
            }}>
                Education is generating data every day.{' '}
                <span className="landing-page-7">EduSmart turns that data into action.</span>
              </h1>
              <p className="landing-page-62">
                An AI-powered education intelligence platform that helps institutions understand student performance, improve teaching effectiveness and create better learning outcomes.
              </p>
              <div className="landing-page-63">
                <button onClick={handleGetStarted} className="landing-page-64">
                  Get Started <ArrowRight className="landing-page-65" />
                </button>
                <button onClick={handleLogin} className="landing-page-66">
                  Explore Platform
                </button>
              </div>
            </div>

            <div className="landing-page-67 hero-mockup-stage">
              <div className="mockup-idle-float">
                <DashboardMockup />
              </div>

              {/* Floating education stat badges — gentle continuous 3D float */}
              <div className="floating-edu-badge floating-edu-badge--top">
                <GraduationCap className="floating-edu-badge-icon" />
                <div>
                  <div className="floating-edu-badge-value">3,200+</div>
                  <div className="floating-edu-badge-label">Students Graduated</div>
                </div>
              </div>

              <div className="floating-edu-badge floating-edu-badge--bottom">
                <BookOpen className="floating-edu-badge-icon" />
                <div>
                  <div className="floating-edu-badge-value">94%</div>
                  <div className="floating-edu-badge-label">Course Completion</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Data → Action flow */}
      <section className="landing-page-68 scroll-reveal">
        <div className="landing-page-56">
          <div className="landing-page-69">
            <h2 className="landing-page-70">From Data to Action</h2>
            <p className="landing-page-71">Every academic signal feeds into our intelligence engine, turning raw data into precise recommendations.</p>
          </div>

          <div className="landing-page-72">
            {/* Signals */}
            <div className="landing-page-73">
              <div className="landing-page-74">Signals</div>
              <div className="landing-page-75">
                {['Attendance', 'Assignments', 'Test Scores', 'Engagement', 'Course Progress', 'Feedback'].map(s => <div key={s} className="landing-page-76">
                    <div className="landing-page-77" />
                    {s}
                  </div>)}
              </div>
            </div>

            <ChevronRight className="landing-page-78" />

            {/* AI Engine */}
            <div className="landing-page-79">
              <Brain className="landing-page-80" />
              <div className="landing-page-81">AI Intelligence Engine</div>
              <div className="landing-page-82">Pattern detection & analysis</div>
            </div>

            <ChevronRight className="landing-page-78" />

            {/* Outputs */}
            <div className="landing-page-83">
              {[{
              label: 'Insight',
              desc: 'Attendance 12% below threshold',
              color: 'text-amber-400 bg-amber-400/10'
            }, {
              label: 'Recommendation',
              desc: 'Faculty intervention advised',
              color: 'text-violet-400 bg-violet-400/10'
            }, {
              label: 'Action',
              desc: 'Schedule counselling + resources',
              color: 'text-green-400 bg-green-400/10'
            }].map(o => <div key={o.label} className="landing-page-84">
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded ${o.color}`}>{o.label}</div>
                  <div className="landing-page-85">{o.desc}</div>
                </div>)}
            </div>
          </div>

          <div className="landing-page-86">
            <div className="landing-page-87">
              <div className="landing-page-88" />
              MEASURE → UNDERSTAND → RECOMMEND → ACT → IMPROVE
            </div>
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="landing-page-89 scroll-reveal">
        <div className="landing-page-56">
          <div className="landing-page-69">
            <h2 className="landing-page-90">
              Everything your institution needs. One intelligent platform.
            </h2>
            <p className="landing-page-91">Purpose-built portals for every role. Each experience is designed around what matters most to that user.</p>
          </div>

          <div className="landing-page-92">
            {pillars.map(p => <div key={p.title} className={`rounded-xl border p-6 ${p.color}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${p.iconBg}`}>{p.icon}</div>
                <h3 className="landing-page-93">{p.title}</h3>
                <ul className="landing-page-94">
                  {p.items.map(item => <li key={item} className="landing-page-95">
                      <CheckCircle className="landing-page-96" />
                      {item}
                    </li>)}
                </ul>
              </div>)}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="landing-page-97 scroll-reveal">
        <div className="landing-page-56">
          <div className="landing-page-69">
            <h2 className="landing-page-90">Built for modern institutions</h2>
            <p className="landing-page-91">From a single college to a multi-campus university — EduSmart AI scales with your institution.</p>
          </div>
          <div className="landing-page-98">
            {features.map(f => <div key={f.title} className="landing-page-99">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>{f.icon}</div>
                <h3 className="landing-page-100">{f.title}</h3>
                <p className="landing-page-101">{f.desc}</p>
              </div>)}
          </div>
        </div>
      </section>

      {/* Institution types */}
      <section className="landing-page-102 scroll-reveal">
        <div className="landing-page-103">
          <p className="landing-page-104">Trusted by institutions of all sizes</p>
          <div className="landing-page-105">
            {institutionTypes.map(t => <div key={t.label} className="landing-page-106">
                <span>{t.icon}</span>
                {t.label}
              </div>)}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="landing-page-97 scroll-reveal">
        <div className="landing-page-56">
          <div className="landing-page-107">
            <div>
              <div className="landing-page-108">
                <Shield className="landing-page-60" />
                Enterprise Security
              </div>
              <h2 className="landing-page-109">Your data is safe, private and yours.</h2>
              <div className="landing-page-110">
                {[{
                icon: <Lock className="landing-page-65" />,
                title: 'Multi-tenant Isolation',
                desc: 'Each institution operates in a completely isolated environment. Data never crosses institution boundaries.'
              }, {
                icon: <Shield className="landing-page-65" />,
                title: 'Role-based Access Control',
                desc: 'Granular permissions ensure each user sees only what they are authorized to see.'
              }, {
                icon: <Globe className="landing-page-65" />,
                title: 'Audit Logs',
                desc: 'Every action is logged with timestamp, user, device, and IP. Full accountability at all times.'
              }, {
                icon: <CheckCircle className="landing-page-65" />,
                title: 'AI Transparency',
                desc: 'Every AI recommendation includes explainability, confidence scores, and data evidence.'
              }].map(s => <div key={s.title} className="landing-page-111">
                    <div className="landing-page-112">{s.icon}</div>
                    <div>
                      <div className="landing-page-113">{s.title}</div>
                      <div className="landing-page-114">{s.desc}</div>
                    </div>
                  </div>)}
              </div>
            </div>
            <div className="landing-page-115">
              <div className="landing-page-116">
                <div className="landing-page-117">
                  <Shield className="landing-page-118" />
                </div>
                <div className="landing-page-119">Security Status: Secure</div>
              </div>
              <div className="landing-page-120">
                {['2FA Enabled', 'SSL Encryption Active', 'Audit Logs Active', 'RBAC Configured', 'Data Backup: Daily', 'Facial Data: Consent-based'].map(c => <div key={c} className="landing-page-121">
                    <CheckCircle className="landing-page-122" />
                    {c}
                  </div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="landing-page-68 scroll-reveal">
        <div className="landing-page-123">
          <h2 className="landing-page-124">Bring Intelligence to Your Institution</h2>
          <p className="landing-page-125">Join 1,500+ institutions using EduSmart AI to improve academic outcomes through data-driven intelligence.</p>
          <div className="landing-page-126">
            <button onClick={handleGetStarted} className="landing-page-127">
              Create Institution Account <ArrowRight className="landing-page-65" />
            </button>
            <button onClick={handleLogin} className="landing-page-128">
              Login to Existing Account
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-page-129">
        <div className="landing-page-56">
          <div className="landing-page-130">
            <div className="landing-page-3">
              <div className="landing-page-131">
                <Brain className="landing-page-5" />
              </div>
              <span className="landing-page-132">EduSmart AI</span>
            </div>
            <div className="landing-page-133">© 2026 EduSmart AI. Intelligent Education. Better Outcomes.</div>
            <div className="landing-page-134">
              {['Privacy', 'Terms', 'Security', 'Contact'].map(l => <a key={l} href="#" className="landing-page-135">{l}</a>)}
            </div>
          </div>
        </div>
      </footer>
    </div>;
}