import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Tasks from './pages/Tasks'
import Payroll from './pages/Payroll'
import Messages from './pages/Messages'
import Settings from './pages/Settings'
import Projects from './pages/Projects'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => { setSession(session) }
    )
    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        height: '100vh', background: 'var(--bg-primary)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'var(--gradient-blue)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', margin: '0 auto 16px',
            animation: 'glow 2s infinite'
          }}>🏢</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {!session ? <LoginPage /> : <MainApp session={session} />}
    </div>
  )
}

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', fontFamily: 'inherit',
      position: 'relative', overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute', top: '-20%', left: '-10%',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', bottom: '-20%', right: '-10%',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      {/* Left Panel */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '60px',
        borderRight: '1px solid var(--border)'
      }} className="hide-mobile">
        <div style={{ maxWidth: '480px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'var(--gradient-blue)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', fontSize: '22px'
            }}>🏢</div>
            <div>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '18px' }}>
                Business Manager
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Enterprise Edition</div>
            </div>
          </div>

          <h1 style={{
            color: 'var(--text-primary)', fontSize: '36px',
            fontWeight: '800', margin: '0 0 16px', lineHeight: '1.2'
          }}>
            Manage your business<br />
            <span className="gradient-text">smarter & faster</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', lineHeight: '1.7', margin: '0 0 40px' }}>
            Complete business management with employees, tasks, attendance, payroll, and real-time communication.
          </p>

          {[
            { icon: '👥', text: 'Employee & Role Management' },
            { icon: '📁', text: 'Projects & Kanban Boards' },
            { icon: '📅', text: 'Smart Attendance Tracking' },
            { icon: '💰', text: 'Automated Payroll System' },
            { icon: '💬', text: 'Real-time Team Messaging' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(59,130,246,0.1)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '16px'
              }}>{f.icon}</div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        width: '480px', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '40px'
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>
            Welcome back 👋
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: '0 0 28px', fontSize: '14px' }}>
            Sign in to your account to continue
          </p>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5', padding: '12px 14px', borderRadius: 'var(--radius-md)',
              marginBottom: '20px', fontSize: '13px', display: 'flex', gap: '8px'
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label className="input-label">Email Address</label>
              <input type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com" required className="input" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label className="input-label">Password</label>
              <input type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required className="input" />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary" style={{
              width: '100%', justifyContent: 'center', padding: '13px',
              fontSize: '15px', opacity: loading ? 0.7 : 1
            }}>
              {loading ? '⟳ Signing in...' : 'Sign In →'}
            </button>
          </form>

          <p style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', marginTop: '24px' }}>
            Don't have an account? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  )
}

function MainApp({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)

  useEffect(() => { getProfile() }, [])

  const getProfile = async () => {
    const { data } = await supabase
      .from('profiles').select('*')
      .eq('id', session.user.id).single()
    setProfile(data)
    setLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const navSections = [
    {
      title: 'Main',
      items: [
        { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
        { id: 'messages', icon: '💬', label: 'Messages' },
      ]
    },
    {
      title: 'Work',
      items: [
        { id: 'projects', icon: '📁', label: 'Projects' },
        { id: 'tasks', icon: '✦', label: 'Tasks' },
        { id: 'attendance', icon: '◷', label: 'Attendance' },
      ]
    },
    {
      title: 'Management',
      items: [
        { id: 'employees', icon: '⬡', label: 'People' },
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

  const allItems = navSections.flatMap(s => s.items)

  const roleColor = {
    admin: '#ef4444',
    manager: '#f59e0b',
    employee: '#3b82f6',
    partner: '#8b5cf6'
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <div className="skeleton" style={{ width: '200px', height: '20px' }} />
    </div>
  )

  const currentItem = allItems.find(i => i.id === activeTab)

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarCollapsed ? '64px' : '220px',
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0, zIndex: 100, overflow: 'hidden'
      }}>
        {/* Logo */}
        <div style={{
          height: '56px', padding: '0 14px',
          display: 'flex', alignItems: 'center',
          gap: '10px', borderBottom: '1px solid var(--border)', flexShrink: 0
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '9px',
            background: 'var(--gradient-blue)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', flexShrink: 0
          }}>🏢</div>
          {!sidebarCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap' }}>
                Business Manager
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '10px', whiteSpace: 'nowrap' }}>Enterprise</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
          {navSections.map(section => (
            <div key={section.title} style={{ marginBottom: '8px' }}>
              {!sidebarCollapsed && (
                <div style={{
                  color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '8px 8px 4px'
                }}>
                  {section.title}
                </div>
              )}
              {section.items.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  style={{
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                    padding: sidebarCollapsed ? '10px' : '10px 12px'
                  }}
                  data-tooltip={sidebarCollapsed ? item.label : undefined}
                >
                  <span style={{
                    fontSize: '16px', flexShrink: 0,
                    color: activeTab === item.id ? 'var(--accent-blue)' : 'var(--text-muted)'
                  }}>
                    {item.icon}
                  </span>
                  {!sidebarCollapsed && (
                    <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Profile + Logout */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          {!sidebarCollapsed && profile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-hover)', marginBottom: '6px', cursor: 'pointer'
            }} onClick={() => setActiveTab('settings')}>
              <div className="avatar avatar-sm" style={{
                background: `${roleColor[profile.role] || '#3b82f6'}33`,
                color: roleColor[profile.role] || '#3b82f6',
                border: `1px solid ${roleColor[profile.role] || '#3b82f6'}40`,
                fontSize: '13px'
              }}>
                {profile.full_name?.charAt(0).toUpperCase()}
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{
                  color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {profile.full_name}
                </div>
                <div style={{
                  color: roleColor[profile.role] || 'var(--text-muted)',
                  fontSize: '10px', textTransform: 'capitalize'
                }}>
                  {profile.role}
                </div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="nav-item" style={{
            color: 'var(--accent-red)',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: sidebarCollapsed ? '10px' : '10px 12px'
          }}>
            <span style={{ fontSize: '16px' }}>⎋</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top Bar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="btn-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect y="2" width="16" height="1.5" rx="0.75" />
                <rect y="7.25" width="16" height="1.5" rx="0.75" />
                <rect y="12.5" width="16" height="1.5" rx="0.75" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{currentItem?.icon}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600' }}>
                {currentItem?.label}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            <button className="btn-icon" style={{ position: 'relative' }}
              onClick={() => setShowNotifications(!showNotifications)}>
              🔔
              <span style={{
                position: 'absolute', top: '2px', right: '2px',
                width: '8px', height: '8px', borderRadius: '50%',
                background: 'var(--accent-red)', border: '2px solid var(--bg-secondary)'
              }} />
            </button>
            <div className="avatar avatar-sm" style={{ cursor: 'pointer' }}
              onClick={() => setActiveTab('settings')}>
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }} className="fade-in">
          {activeTab === 'dashboard' && <Dashboard profile={profile} setActiveTab={setActiveTab} />}
          {activeTab === 'employees' && <Employees profile={profile} />}
          {activeTab === 'attendance' && <Attendance profile={profile} />}
          {activeTab === 'tasks' && <Tasks profile={profile} />}
          {activeTab === 'projects' && <Projects profile={profile} />}
          {activeTab === 'payroll' && <Payroll profile={profile} />}
          {activeTab === 'messages' && <Messages profile={profile} />}
          {activeTab === 'settings' && <Settings profile={profile} />}
        </div>
      </div>
    </div>
  )
}
