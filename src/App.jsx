import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { usePermissions } from './hooks/usePermissions'
import { useNotifications } from './hooks/useNotifications'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Tasks from './pages/Tasks'
import Payroll from './pages/Payroll'
import Messages from './pages/Messages'
import Settings from './pages/Settings'
import Projects from './pages/Projects'
import TimeTracking from './pages/TimeTracking'
import ClientTimeTracking from './pages/ClientTimeTracking'
import FileManagement from './pages/FileManagement'
import OfficeCalls from './pages/OfficeCalls'
import Reports from './pages/Reports'
import Announcements from './pages/Announcements'
import OfficeBell from './components/OfficeBell'
import GlobalSearch from './components/GlobalSearch'

const LogoWhite = ({ size = 140 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1171.77 189.84" width={size} height={size * 189.84 / 1171.77}>
    <path fill="#fff" d="M600.65,329.72h36.4v154h72.81v29.45H600.65Z" transform="translate(-429.42 -326.25)"/>
    <path fill="#fff" d="M734.71,329.72h36.4V513.17h-36.4Z" transform="translate(-429.42 -326.25)"/>
    <path fill="#fff" d="M813.31,329.72h62.41a104.13,104.13,0,0,1,26.59,3.33,59.53,59.53,0,0,1,22,10.54,46.85,46.85,0,0,1,14.74,18.78Q944,373.62,944,389.24q0,15.9-4.91,27a49.43,49.43,0,0,1-14.81,18.93,59.45,59.45,0,0,1-22.1,10.26,107.62,107.62,0,0,1-26.44,3.32h-26v64.42H813.31ZM869.66,421a74.9,74.9,0,0,0,15.6-1.31,30,30,0,0,0,11-5.05,26.85,26.85,0,0,0,8.38-10.11q2.88-6.09,2.88-15.32,0-9-2.88-15a26.69,26.69,0,0,0-8.38-10.11,28.91,28.91,0,0,0-10.84-5.21A66.91,66.91,0,0,0,870,357.48H849.7v63.57Z" transform="translate(-429.42 -326.25)"/>
    <path fill="#fff" d="M988.53,508.57q-18.35-7.51-30.48-20.22l18.49-25.43a88.82,88.82,0,0,0,12.14,9.82,81.84,81.84,0,0,0,17.19,9,54.48,54.48,0,0,0,19.79,3.76q16.17,0,24.7-6t8.53-16.71q0-9-6.07-14a56.6,56.6,0,0,0-14.74-8.42c-1.33-.39-3.31-1.12-5.92-2.19s-6-2.38-10.26-3.92q-5.49-2.31-10.54-4.05c-3.38-1.16-6.12-2.22-8.24-3.19q-20.22-8.69-28.89-21.73-7.51-11-7.51-26.07a50.74,50.74,0,0,1,5-22.16A48.48,48.48,0,0,1,986.94,339q17-12.75,45.65-12.74a86,86,0,0,1,25,3.61,96.76,96.76,0,0,1,21.09,8.95,73.18,73.18,0,0,1,14.63,10.84l-15.6,24.85q-7.23-7.8-19.8-13.58a61.18,61.18,0,0,0-25.9-5.76q-14.44,0-22.1,5.39t-7.6,15.28a15.61,15.61,0,0,0,3.41,10.33,27,27,0,0,0,7.66,6.52,88.84,88.84,0,0,0,10,4.63l15,5.8q17.32,6,19.93,7.49,19.35,8.7,28,21.16,8.39,11.88,8.38,28.1a51.75,51.75,0,0,1-3.32,18,52.4,52.4,0,0,1-10,16.51q-8.62,9.78-22.63,15.79t-33.08,5.93A97.21,97.21,0,0,1,988.53,508.57Z" transform="translate(-429.42 -326.25)"/>
    <path fill="#fff" d="M1157,504.93q-19.79-11.16-31.2-32.76T1114.36,421q0-29.28,12.28-50.72t32.5-32.75a89.13,89.13,0,0,1,44.17-11.29q20.81,0,35.54,7.1t22,14.34q7.22,7.24,9.53,11.3l-19.07,24a43.76,43.76,0,0,0-9.82-11.56,56.34,56.34,0,0,0-16-9.58,53.43,53.43,0,0,0-20.37-3.81q-15.88,0-28,7.69a51.41,51.41,0,0,0-18.93,21.92q-6.89,14.2-6.88,32.79t6.65,32.8a51.82,51.82,0,0,0,18.63,22.06q12,7.85,27.88,7.83a53.49,53.49,0,0,0,20.37-3.94,63.09,63.09,0,0,0,16.62-9.74,53.36,53.36,0,0,0,10.69-11.56l18.78,24.56q-4.64,7.83-14.16,15.65a79.13,79.13,0,0,1-23.69,12.9,92.28,92.28,0,0,1-31.21,5.07Q1176.76,516.08,1157,504.93Z" transform="translate(-429.42 -326.25)"/>
    <path fill="#fff" d="M1297,329.72h117.88v28.61h-81.48v44.49h75.7v28.9h-75.7v52h84.08v29.45H1297Z" transform="translate(-429.42 -326.25)"/>
    <path fill="#fff" d="M1449.51,329.72h39L1566.81,456V329.72h34.38V513.17h-35l-82.35-132.9v132.9h-34.33Z" transform="translate(-429.42 -326.25)"/>
    <rect fill="#d71920" y="3.46" width="36.41" height="183.47"/>
    <polygon fill="#d71920" points="138.53 186.93 138.53 186.93 50.52 95.19 138.53 3.46 138.53 3.46 138.53 186.93"/>
  </svg>
)

const LogoDark = ({ size = 140 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1171.77 189.84" width={size} height={size * 189.84 / 1171.77}>
    <path fill="var(--text-primary)" d="M600.65,329.72h36.4v154h72.81v29.45H600.65Z" transform="translate(-429.42 -326.25)"/>
    <path fill="var(--text-primary)" d="M734.71,329.72h36.4V513.17h-36.4Z" transform="translate(-429.42 -326.25)"/>
    <path fill="var(--text-primary)" d="M813.31,329.72h62.41a104.13,104.13,0,0,1,26.59,3.33,59.53,59.53,0,0,1,22,10.54,46.85,46.85,0,0,1,14.74,18.78Q944,373.62,944,389.24q0,15.9-4.91,27a49.43,49.43,0,0,1-14.81,18.93,59.45,59.45,0,0,1-22.1,10.26,107.62,107.62,0,0,1-26.44,3.32h-26v64.42H813.31ZM869.66,421a74.9,74.9,0,0,0,15.6-1.31,30,30,0,0,0,11-5.05,26.85,26.85,0,0,0,8.38-10.11q2.88-6.09,2.88-15.32,0-9-2.88-15a26.69,26.69,0,0,0-8.38-10.11,28.91,28.91,0,0,0-10.84-5.21A66.91,66.91,0,0,0,870,357.48H849.7v63.57Z" transform="translate(-429.42 -326.25)"/>
    <path fill="var(--text-primary)" d="M988.53,508.57q-18.35-7.51-30.48-20.22l18.49-25.43a88.82,88.82,0,0,0,12.14,9.82,81.84,81.84,0,0,0,17.19,9,54.48,54.48,0,0,0,19.79,3.76q16.17,0,24.7-6t8.53-16.71q0-9-6.07-14a56.6,56.6,0,0,0-14.74-8.42c-1.33-.39-3.31-1.12-5.92-2.19s-6-2.38-10.26-3.92q-5.49-2.31-10.54-4.05c-3.38-1.16-6.12-2.22-8.24-3.19q-20.22-8.69-28.89-21.73-7.51-11-7.51-26.07a50.74,50.74,0,0,1,5-22.16A48.48,48.48,0,0,1,986.94,339q17-12.75,45.65-12.74a86,86,0,0,1,25,3.61,96.76,96.76,0,0,1,21.09,8.95,73.18,73.18,0,0,1,14.63,10.84l-15.6,24.85q-7.23-7.8-19.8-13.58a61.18,61.18,0,0,0-25.9-5.76q-14.44,0-22.1,5.39t-7.6,15.28a15.61,15.61,0,0,0,3.41,10.33,27,27,0,0,0,7.66,6.52,88.84,88.84,0,0,0,10,4.63l15,5.8q17.32,6,19.93,7.49,19.35,8.7,28,21.16,8.39,11.88,8.38,28.1a51.75,51.75,0,0,1-3.32,18,52.4,52.4,0,0,1-10,16.51q-8.62,9.78-22.63,15.79t-33.08,5.93A97.21,97.21,0,0,1,988.53,508.57Z" transform="translate(-429.42 -326.25)"/>
    <path fill="var(--text-primary)" d="M1157,504.93q-19.79-11.16-31.2-32.76T1114.36,421q0-29.28,12.28-50.72t32.5-32.75a89.13,89.13,0,0,1,44.17-11.29q20.81,0,35.54,7.1t22,14.34q7.22,7.24,9.53,11.3l-19.07,24a43.76,43.76,0,0,0-9.82-11.56,56.34,56.34,0,0,0-16-9.58,53.43,53.43,0,0,0-20.37-3.81q-15.88,0-28,7.69a51.41,51.41,0,0,0-18.93,21.92q-6.89,14.2-6.88,32.79t6.65,32.8a51.82,51.82,0,0,0,18.63,22.06q12,7.85,27.88,7.83a53.49,53.49,0,0,0,20.37-3.94,63.09,63.09,0,0,0,16.62-9.74,53.36,53.36,0,0,0,10.69-11.56l18.78,24.56q-4.64,7.83-14.16,15.65a79.13,79.13,0,0,1-23.69,12.9,92.28,92.28,0,0,1-31.21,5.07Q1176.76,516.08,1157,504.93Z" transform="translate(-429.42 -326.25)"/>
    <path fill="var(--text-primary)" d="M1297,329.72h117.88v28.61h-81.48v44.49h75.7v28.9h-75.7v52h84.08v29.45H1297Z" transform="translate(-429.42 -326.25)"/>
    <path fill="var(--text-primary)" d="M1449.51,329.72h39L1566.81,456V329.72h34.38V513.17h-35l-82.35-132.9v132.9h-34.33Z" transform="translate(-429.42 -326.25)"/>
    <rect fill="#d71920" y="3.46" width="36.41" height="183.47"/>
    <polygon fill="#d71920" points="138.53 186.93 138.53 186.93 50.52 95.19 138.53 3.46 138.53 3.46 138.53 186.93"/>
  </svg>
)

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Apply saved theme on load
    const saved = localStorage.getItem('theme')
    if (saved) document.documentElement.setAttribute('data-theme', saved)

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #d71920, #8b0000)' }}>
      <div style={{ textAlign: 'center' }}>
        <LogoWhite size={200} />
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '20px', letterSpacing: '2px' }}>LOADING...</div>
      </div>
    </div>
  )

  return !session ? <LoginPage /> : <MainApp session={session} />
}

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'white', fontFamily: 'inherit' }}>
      <div style={{ flex: 1, background: 'linear-gradient(160deg, #d71920 0%, #8b0000 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '60px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
        <div style={{ marginBottom: '32px' }}><LogoWhite size={220} /></div>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', margin: '0 0 48px', textAlign: 'center', fontWeight: '500', letterSpacing: '3px', textTransform: 'uppercase' }}>
          Agency Operations System
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '300px' }}>
          {[
            { icon: '✦', text: 'Projects & Task Management' },
            { icon: '◷', text: 'Smart Attendance Tracking' },
            { icon: '💬', text: 'Real-time Team Messaging' },
            { icon: '⏱', text: 'Time & Client Tracking' },
            { icon: '📎', text: 'File Version Management' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', flexShrink: 0 }}>{f.icon}</div>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '500' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '460px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: 'white' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <div style={{ marginBottom: '36px' }}>
            <h2 style={{ color: '#111', fontSize: '26px', fontWeight: '800', margin: '0 0 8px', letterSpacing: '-0.5px' }}>Welcome back</h2>
            <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Sign in to your account to continue</p>
          </div>
          {error && (
            <div style={{ background: 'rgba(215,25,32,0.08)', border: '1px solid rgba(215,25,32,0.2)', color: '#d71920', padding: '12px 14px', borderRadius: '10px', marginBottom: '20px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span>⚠️</span> {error}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@klipscen.com" required className="input" />
            </div>
            <div style={{ marginBottom: '28px' }}>
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="input" style={{ paddingRight: '44px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '16px', padding: '4px' }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px', background: loading ? '#e5e5e5' : 'linear-gradient(135deg, #d71920, #b5151b)',
              border: 'none', borderRadius: '10px', color: loading ? '#999' : 'white',
              fontSize: '15px', fontWeight: '700', cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 4px 16px rgba(215,25,32,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}>
              {loading ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Signing in...</> : 'Sign In →'}
            </button>
          </form>
          <p style={{ color: '#aaa', fontSize: '12px', textAlign: 'center', marginTop: '24px', lineHeight: '1.6' }}>
            Don't have an account?<br />Contact your administrator
          </p>
        </div>
      </div>
    </div>
  )
}

function MainApp({ session }) {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  const { canAccess, isInSidebar, loading: permLoading, adminVisibleModules, toggleAdminModule, showAllModules, toggleModule, getModulePermission } = usePermissions(profile)
  const { notifications, unreadCount, markAsRead, markAllRead, notificationIcon } = useNotifications(profile)

  const isLoading = profileLoading || permLoading

  useEffect(() => { getProfile() }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(prev => !prev) }
      if (profile?.role === 'admin' && e.ctrlKey && e.shiftKey && e.key === 'A') { e.preventDefault(); setShowAdminPanel(prev => !prev) }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [profile])

  const getProfile = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
    setProfileLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const ALL_NAV_SECTIONS = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
        { id: 'messages', icon: '💬', label: 'Messages' },
        { id: 'announcements', icon: '📢', label: 'Announcements' },
      ]
    },
    {
      title: 'Work',
      items: [
        { id: 'projects', icon: '📁', label: 'Projects' },
        { id: 'tasks', icon: '✦', label: 'Tasks' },
        { id: 'files', icon: '📎', label: 'Files' },
        { id: 'attendance', icon: '◷', label: 'Attendance' },
        { id: 'timetracking', icon: '⏱', label: 'Time Logs' },
        { id: 'clienttime', icon: '👤', label: 'Client Time' },
      ]
    },
    {
      title: 'Management',
      items: [
        { id: 'employees', icon: '⬡', label: 'Employees' },
        { id: 'officecalls', icon: '🔔', label: 'Office Bell' },
        { id: 'reports', icon: '📊', label: 'Reports' },
        { id: 'payroll', icon: '◈', label: 'Payroll' },
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'settings', icon: '⚙', label: 'Settings' },
      ]
    }
  ]

  const filteredNavSections = ALL_NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => isInSidebar(item.id))
  })).filter(section => section.items.length > 0)

  const allItems = ALL_NAV_SECTIONS.flatMap(s => s.items)
  const currentItem = allItems.find(i => i.id === activeTab)

  const roleColor = {
    admin: '#d71920', manager: '#d97706', employee: '#2563eb',
    partner: '#7c3aed', client: '#16a34a', junior_editor: '#0891b2',
    senior_editor: '#059669', client_manager: '#d97706', qa_reviewer: '#7c3aed'
  }

  if (isLoading) return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      <div style={{ width: '220px', background: 'var(--bg-card)', borderRight: '1px solid var(--border)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="skeleton" style={{ height: '40px', borderRadius: '10px', marginBottom: '16px' }} />
        {[1,2,3,4,5,6,7].map(i => <div key={i} className="skeleton" style={{ height: '36px', borderRadius: '8px' }} />)}
      </div>
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ height: '56px', background: 'var(--bg-card)', margin: '-24px -24px 8px', borderBottom: '1px solid var(--border)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />)}
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: '12px' }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <div style={{
        width: sidebarCollapsed ? '64px' : '220px',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0, zIndex: 100, overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)'
      }}>
        {/* Logo */}
        <div style={{ height: '60px', padding: '0 14px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {sidebarCollapsed ? (
            <div style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 190" width="28" height="28">
                <rect fill="#d71920" x="0" y="3.46" width="36.41" height="183.47"/>
                <polygon fill="#d71920" points="138.53 186.93 138.53 186.93 50.52 95.19 138.53 3.46 138.53 3.46 138.53 186.93"/>
              </svg>
            </div>
          ) : (
            <div style={{ overflow: 'hidden', flex: 1, display: 'flex', alignItems: 'center' }}>
              <LogoDark size={130} />
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
          {filteredNavSections.map(section => (
            <div key={section.title} style={{ marginBottom: '8px' }}>
              {!sidebarCollapsed && (
                <div style={{ color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 10px 4px' }}>
                  {section.title}
                </div>
              )}
              {section.items.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  style={{ justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '10px' : '9px 12px' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0, color: activeTab === item.id ? '#d71920' : 'var(--text-muted)' }}>{item.icon}</span>
                  {!sidebarCollapsed && <span style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{item.label}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Profile */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {!sidebarCollapsed && profile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
              borderRadius: '10px', background: 'var(--bg-hover)', marginBottom: '6px',
              cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s'
            }}
              onClick={() => setActiveTab('settings')}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
              onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            >
              <div className="avatar avatar-sm" style={{
                background: `${roleColor[profile.role] || '#d71920'}20`,
                color: roleColor[profile.role] || '#d71920',
                border: `1.5px solid ${roleColor[profile.role] || '#d71920'}40`,
                fontSize: '12px', fontWeight: '800'
              }}>
                {profile.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile.full_name}</div>
                <div style={{ color: roleColor[profile.role] || '#d71920', fontSize: '10px', textTransform: 'capitalize', fontWeight: '600' }}>
                  {profile.role?.replace('_', ' ')}
                </div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="nav-item" style={{
            color: '#d71920', justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: sidebarCollapsed ? '10px' : '9px 12px', fontSize: '13px'
          }}>
            <span style={{ fontSize: '15px' }}>⎋</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="btn-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect y="2" width="16" height="1.5" rx="0.75"/>
                <rect y="7.25" width="16" height="1.5" rx="0.75"/>
                <rect y="12.5" width="16" height="1.5" rx="0.75"/>
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d71920', fontSize: '16px' }}>{currentItem?.icon}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '700' }}>{currentItem?.label}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Search */}
            <button onClick={() => setShowSearch(true)} style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer',
              fontSize: '12px', transition: 'all 0.2s', fontFamily: 'inherit'
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#d71920'; e.currentTarget.style.color = '#d71920' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              🔍 <span style={{ fontWeight: '600' }}>Search</span>
              <span style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', color: 'var(--text-muted)' }}>⌘K</span>
            </button>

            <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '500' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>

            {/* Dark Mode Toggle */}
            <button onClick={() => setDarkMode(!darkMode)} style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: darkMode ? 'rgba(215,25,32,0.1)' : 'var(--bg-hover)',
              border: `1px solid ${darkMode ? 'rgba(215,25,32,0.25)' : 'var(--border)'}`,
              cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              fontFamily: 'inherit', flexShrink: 0
            }}>
              {darkMode ? '☀️' : '🌙'}
            </button>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button className="btn-icon" onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ position: 'relative' }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '0', right: '0', background: '#d71920', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--bg-card)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div style={{ position: 'absolute', top: '48px', right: 0, width: '360px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-lg)', zIndex: 1000, overflow: 'hidden', animation: 'slideDown 0.2s ease' }}>
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>Notifications</span>
                      {unreadCount > 0 && <span style={{ background: '#d71920', color: 'white', borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: '700' }}>{unreadCount}</span>}
                    </div>
                    <button onClick={markAllRead} style={{ background: 'transparent', border: 'none', color: '#d71920', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Mark all read</button>
                  </div>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="empty-state" style={{ padding: '40px' }}>
                        <div className="empty-icon">🔔</div>
                        <div className="empty-desc">No notifications yet</div>
                      </div>
                    ) : (
                      notifications.map(notif => (
                        <div key={notif.id} onClick={() => markAsRead(notif.id)}
                          className={`notification ${!notif.is_read ? 'unread' : ''}`}>
                          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: notif.is_read ? 'var(--bg-hover)' : 'rgba(215,25,32,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                            {notificationIcon(notif.type)}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: notif.is_read ? '400' : '700', marginBottom: '2px' }}>{notif.title}</div>
                            {notif.body && <div style={{ color: 'var(--text-muted)', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.body}</div>}
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '3px' }}>
                              {new Date(notif.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {!notif.is_read && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d71920', flexShrink: 0 }} />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Avatar */}
            <div className="avatar avatar-sm" style={{
              cursor: 'pointer', background: `${roleColor[profile?.role] || '#d71920'}20`,
              color: roleColor[profile?.role] || '#d71920',
              border: `1.5px solid ${roleColor[profile?.role] || '#d71920'}40`,
              fontSize: '12px', fontWeight: '800'
            }} onClick={() => setActiveTab('settings')}>
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }} className="fade-in">
          {!canAccess(activeTab) ? (
            <div className="empty-state card" style={{ height: '60%' }}>
              <div className="empty-icon">🔒</div>
              <div className="empty-title">Access Restricted</div>
              <div className="empty-desc">You don't have permission to view this module</div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard profile={profile} setActiveTab={setActiveTab} />}
              {activeTab === 'employees' && <Employees profile={profile} />}
              {activeTab === 'attendance' && <Attendance profile={profile} />}
              {activeTab === 'tasks' && <Tasks profile={profile} />}
              {activeTab === 'projects' && <Projects profile={profile} />}
              {activeTab === 'payroll' && <Payroll profile={profile} />}
              {activeTab === 'messages' && <Messages profile={profile} />}
              {activeTab === 'timetracking' && <TimeTracking profile={profile} />}
              {activeTab === 'clienttime' && <ClientTimeTracking profile={profile} />}
              {activeTab === 'files' && <FileManagement profile={profile} />}
              {activeTab === 'officecalls' && <OfficeCalls profile={profile} />}
              {activeTab === 'reports' && <Reports profile={profile} />}
              {activeTab === 'announcements' && <Announcements profile={profile} />}
              {activeTab === 'settings' && <Settings profile={profile} />}
            </>
          )}
        </div>
      </div>

      {/* GLOBAL SEARCH */}
      {showSearch && <GlobalSearch profile={profile} setActiveTab={setActiveTab} onClose={() => setShowSearch(false)} />}

      {/* OFFICE BELL */}
      <OfficeBell profile={profile} />

      {/* SECRET ADMIN PANEL */}
      {showAdminPanel && profile?.role === 'admin' && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(6px)' }}
          onClick={() => setShowAdminPanel(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '88vh', overflowY: 'auto', border: '1px solid var(--border)', animation: 'bounceIn 0.3s ease', boxShadow: 'var(--shadow-lg)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg, #d71920, #8b0000)', borderRadius: '20px 20px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '800' }}>Visibility Control</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', margin: '4px 0 0', fontSize: '12px' }}>Ctrl+Shift+A to toggle</p>
              </div>
              <button onClick={() => setShowAdminPanel(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>✕</button>
            </div>

            <div style={{ padding: '24px' }}>
              <div style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>My Sidebar</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>Toggle what YOU see</div>
                  </div>
                  <button onClick={showAllModules} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '5px 12px', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>Reset All</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
                    { id: 'messages', icon: '💬', label: 'Messages' },
                    { id: 'announcements', icon: '📢', label: 'Announcements' },
                    { id: 'projects', icon: '📁', label: 'Projects' },
                    { id: 'tasks', icon: '✅', label: 'Tasks' },
                    { id: 'files', icon: '📎', label: 'Files' },
                    { id: 'attendance', icon: '📅', label: 'Attendance' },
                    { id: 'timetracking', icon: '⏱️', label: 'Time Logs' },
                    { id: 'clienttime', icon: '👤', label: 'Client Time' },
                    { id: 'employees', icon: '👥', label: 'Employees' },
                    { id: 'officecalls', icon: '🔔', label: 'Office Bell' },
                    { id: 'reports', icon: '📊', label: 'Reports' },
                    { id: 'payroll', icon: '💰', label: 'Payroll' },
                    { id: 'settings', icon: '⚙️', label: 'Settings' },
                  ].map(mod => {
                    const isOn = adminVisibleModules.includes(mod.id)
                    return (
                      <div key={mod.id} onClick={() => toggleAdminModule(mod.id)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', background: isOn ? 'rgba(215,25,32,0.06)' : 'var(--bg-card)', border: `1px solid ${isOn ? 'rgba(215,25,32,0.2)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                        <span style={{ fontSize: '13px', color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>{mod.icon} {mod.label}</span>
                        <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: isOn ? '#d71920' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
                          <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: isOn ? '19px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                Partner & Employee Permissions
              </div>

              {['partner', 'employee'].map(role => (
                <div key={role} style={{ background: 'var(--bg-hover)', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{ background: `${{ partner: '#7c3aed', employee: '#2563eb' }[role]}15`, color: { partner: '#7c3aed', employee: '#2563eb' }[role], padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize' }}>{role}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>can see these modules</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '8px' }}>
                    {['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'files', 'attendance', 'timetracking', 'clienttime', 'employees', 'officecalls', 'reports', 'payroll', 'settings'].map(moduleId => (
                      <ModuleToggle key={`${moduleId}-${role}`} moduleId={moduleId} role={role} initialValue={getModulePermission(moduleId, role)} onToggle={toggleModule} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNotifPanel && <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowNotifPanel(false)} />}
    </div>
  )
}

function ModuleToggle({ moduleId, role, onToggle, initialValue }) {
  const [enabled, setEnabled] = useState(initialValue !== false)
  useEffect(() => { setEnabled(initialValue !== false) }, [initialValue])

  const handleToggle = async () => {
    const newVal = !enabled
    setEnabled(newVal)
    await onToggle(moduleId, role, newVal)
  }

  const moduleLabels = {
    dashboard: '🏠 Dashboard', messages: '💬 Messages', projects: '📁 Projects',
    tasks: '✅ Tasks', attendance: '📅 Attendance', employees: '👥 Employees',
    payroll: '💰 Payroll', files: '📎 Files', settings: '⚙️ Settings',
    timetracking: '⏱️ Time Logs', clienttime: '👤 Client Time',
    officecalls: '🔔 Office Bell', reports: '📊 Reports', announcements: '📢 Announcements',
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: enabled ? 'rgba(215,25,32,0.05)' : 'var(--bg-card)', borderRadius: '8px', padding: '8px 10px', border: `1px solid ${enabled ? 'rgba(215,25,32,0.15)' : 'var(--border)'}`, transition: 'all 0.2s', cursor: 'pointer' }}
      onClick={handleToggle}>
      <span style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '12px' }}>{moduleLabels[moduleId] || moduleId}</span>
      <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: enabled ? '#d71920' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
        <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'white', position: 'absolute', top: '3px', left: enabled ? '19px' : '3px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
    </div>
  )
}
