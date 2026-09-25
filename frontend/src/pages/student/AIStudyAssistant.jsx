import './AIStudyAssistant.css';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ClipboardList, FileText, HelpCircle, RefreshCw, Send, Sparkles } from 'lucide-react';
import { AIBadge, Card } from '../../components/ui/index';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../lib/api';

const capabilities = [
  { label: 'Explain', icon: <BookOpen className="aistudy-assistant-1" />, prompt: 'Explain ' },
  { label: 'Summarize', icon: <FileText className="aistudy-assistant-1" />, prompt: 'Summarize the topic ' },
  { label: 'Quiz Me', icon: <HelpCircle className="aistudy-assistant-1" />, prompt: 'Give me 5 practice questions on ' },
  { label: 'Revision Notes', icon: <ClipboardList className="aistudy-assistant-1" />, prompt: 'Create revision notes for ' },
  { label: 'Practice Questions', icon: <RefreshCw className="aistudy-assistant-1" />, prompt: 'Generate practice questions for ' },
];

function formatContent(text) {
  return text.split('\n').map((line, index) => {
    if (line.startsWith('**') && line.endsWith('**') && line.length > 4) return <p key={index} className="aistudy-assistant-2">{line.slice(2, -2)}</p>;
    if (/^\d+\./.test(line)) return <p key={index} className="aistudy-assistant-5">{line}</p>;
    if (!line.trim()) return <div key={index} className="aistudy-assistant-6" />;
    return <p key={index} className="aistudy-assistant-7">{line}</p>;
  });
}

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function AIStudyAssistant() {
  const { token } = useAuth();
  const [courses, setCourses] = useState([]);
  const [student, setStudent] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [courseError, setCourseError] = useState('');
  const [chatError, setChatError] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    studentApi.getAiCourses(token)
      .then((data) => {
        if (cancelled) return;
        const nextCourses = data.courses || [];
        setCourses(nextCourses);
        setStudent(data.student || null);
        setSelectedCourse(nextCourses[0]?.id || '');
        setMessages([{ id: 'welcome', role: 'assistant', content: nextCourses.length ? 'Choose one of your enrolled subjects and ask me anything. I will tailor the answer to your current programme and timetable.' : 'Your timetable has no subjects yet. Once your administrator adds your class schedule, I can tailor answers to it.', timestamp: timestamp() }]);
      })
      .catch((err) => !cancelled && setCourseError(err.message || 'Could not load your enrolled subjects.'))
      .finally(() => !cancelled && setLoadingCourses(false));
    return () => { cancelled = true; };
  }, [token]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const activeCourse = courses.find((course) => course.id === selectedCourse);

  async function sendMessage(text) {
    const content = (text ?? input).trim();
    if (!content || isTyping) return;
    const userMessage = { id: `user-${Date.now()}`, role: 'user', content, timestamp: timestamp() };
    const history = messages.slice(-12).map((message) => ({ role: message.role, content: message.content }));
    setMessages((previous) => [...previous, userMessage]);
    setInput('');
    setChatError('');
    setIsTyping(true);
    try {
      const data = await studentApi.chatWithAi(token, { message: content, subject: selectedCourse, history });
      setMessages((previous) => [...previous, { id: `assistant-${Date.now()}`, role: 'assistant', content: data.reply, timestamp: timestamp(), subject: data.subject }]);
    } catch (err) {
      setChatError(err.message || 'The AI assistant could not respond.');
    } finally {
      setIsTyping(false);
    }
  }

  if (loadingCourses) return <div className="aistudy-assistant-8"><p className="aistudy-assistant-7">Loading your enrolled subjects…</p></div>;
  if (courseError) return <div className="aistudy-assistant-8"><p className="aistudy-assistant-7">{courseError}</p></div>;

  return <div className="aistudy-assistant-8">
    <div className="aistudy-assistant-9">
      <div className="aistudy-assistant-10">
        <div className="aistudy-assistant-11"><div className="aistudy-assistant-12"><Sparkles className="aistudy-assistant-13" /></div><div><div className="aistudy-assistant-14"><h2 className="aistudy-assistant-15">EduSmart AI</h2><AIBadge label="Gemini-powered" /></div><p className="aistudy-assistant-16">Study help grounded in your enrolled subjects</p></div></div>
        <div className="aistudy-assistant-17"><div className="aistudy-assistant-18"><BookOpen className="aistudy-assistant-19" /><select value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)} className="aistudy-assistant-20" disabled={!courses.length}>{courses.length ? courses.map((course) => <option key={course.id} value={course.id}>{course.name}{course.faculty ? ` — ${course.faculty}` : ''}</option>) : <option>No subjects in timetable</option>}</select><ChevronDown className="aistudy-assistant-19" /></div></div>
      </div>

      <div className="aistudy-assistant-21">
        {messages.map((message) => <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {message.role === 'assistant' && <div className="aistudy-assistant-22"><Sparkles className="aistudy-assistant-23" /></div>}
          <div className={`max-w-[75%] ${message.role === 'user' ? 'max-w-[60%]' : ''}`}><div className={`rounded-2xl px-4 py-3 text-sm ${message.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 shadow-sm rounded-tl-sm text-slate-800'}`}>{message.role === 'assistant' ? <div className="aistudy-assistant-24">{formatContent(message.content)}</div> : message.content}</div>{message.subject && <p className="text-[10px] mt-1 text-slate-400">Subject: {message.subject}</p>}<p className={`text-[10px] mt-1 ${message.role === 'user' ? 'text-right text-slate-400' : 'text-slate-400'}`}>{message.timestamp}</p></div>
        </div>)}
        {isTyping && <div className="aistudy-assistant-28"><div className="aistudy-assistant-29"><Sparkles className="aistudy-assistant-23" /></div><div className="aistudy-assistant-30">Thinking…</div></div>}
        <div ref={bottomRef} />
      </div>

      {chatError && <p className="px-4 pb-2 text-sm text-red-600">{chatError}</p>}
      <div className="aistudy-assistant-33">{capabilities.map((capability) => <button key={capability.label} onClick={() => setInput(capability.prompt)} className="aistudy-assistant-34" disabled={!courses.length}>{capability.icon}{capability.label}</button>)}</div>
      <div className="aistudy-assistant-35"><div className="aistudy-assistant-36"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder={activeCourse ? `Ask about ${activeCourse.name}…` : 'Ask a study question…'} rows={1} className="aistudy-assistant-38" disabled={!courses.length || isTyping} /><button onClick={() => sendMessage()} disabled={!input.trim() || !courses.length || isTyping} className="aistudy-assistant-41" aria-label="Send message"><Send className="aistudy-assistant-40" /></button></div><p className="aistudy-assistant-42">AI can make mistakes. Verify important information with your faculty.</p></div>
    </div>
    <div className="aistudy-assistant-43"><Card className="p-5"><h3 className="aistudy-assistant-45">Your enrolled subjects</h3><p className="aistudy-assistant-16">{student ? `${student.course} · Year ${student.year}, ${student.section}` : 'From your timetable'}</p><div className="mt-4 space-y-2">{courses.length ? courses.map((course) => <button key={course.id} onClick={() => { setSelectedCourse(course.id); setInput(`Help me study ${course.name}: `); }} className="aistudy-assistant-55">→ {course.name}{course.faculty ? ` (${course.faculty})` : ''}</button>) : <p className="aistudy-assistant-7">No timetable subjects are available yet.</p>}</div></Card></div>
  </div>;
}
