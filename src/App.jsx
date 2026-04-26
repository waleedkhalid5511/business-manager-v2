import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Tasks from './pages/Tasks'
import Payroll from './pages/Payroll'
import Messages from './pages/Messages'
import Settings from './pages/Settings'

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
        display: 'flex', justifyContent: 'center',
        alignItems: 'center', height: '100vh',
        background: '#0f172a', color: 'white', fontSize: '18px'
      }}>
        Loading...
      </div>
    )
  }

  return (
    <div>
      {!session ? <LoginPage /> : <DashboardPage session={session} />}
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
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      display: 'flex', justifyContent: 'center',
      alignItems: 'center', fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#1e293b', padding: '40px',
        borderRadius: '16px', width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            width: '60px', height: '60px', borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: '28px'
          }}>🏢</div>
          <h1 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px' }}>
            Business Manager
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>Login to your account</p>
        </div>

        {error && (
          <div style={{
            background: '#7f1d1d', border: '1px solid #ef4444',
            color: '#fca5a5', padding: '12px', borderRadius: '8px',
            marginBottom: '20px', fontSize: '14px'
          }}>⚠️ {error}</div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              Email
            </label>
            <input
              type="email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required
              style={{
                width: '100%', padding: '12px', background: '#0f172a',
                border: '1px solid #334155', borderRadius: '8px',
                color: 'white', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password" value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required
              style={{
                width: '100%', padding: '12px', background: '#0f172a',
                border: '1px solid #334155', borderRadius: '8px',
                color: 'white', fontSize: '14px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '13px',
            background: loading ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: 'white',
            fontSize: '16px', fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  )
}

function DashboardPage({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(true)

  useEffect(() => { getProfile() }, [])

  const getProfile = async () => {
    const { data } = await supabase
      .from('profiles').select('*')
      .eq('id', session.user.id).single()
    setProfile(data)
    setLoading(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const menuItems = [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'employees', icon: '👥', label: 'Employees' },
    { id: 'attendance', icon: '📅', label: 'Attendance' },
    { id: 'tasks', icon: '✅', label: 'Tasks' },
    { id: 'payroll', icon: '💰', label: 'Payroll' },
    { id: 'messages', icon: '💬', label: 'Messages' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]

  if (loading) return <div style={{ color: 'white', padding: '20px' }}>Loading...</div>

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0f172a', fontFamily: 'sans-serif' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '220px' : '70px',
        background: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', height: '100vh', zIndex: 100,
        transition: 'width 0.3s'
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 16px', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            width: '36px', height: '36px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', flexShrink: 0
          }}>🏢</div>
          {sidebarOpen && (
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap' }}>
              Business Manager
            </span>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                gap: '12px', padding: '11px 12px', marginBottom: '4px',
                borderRadius: '10px', border: 'none',
                background: activeTab === item.id
                  ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                  : 'transparent',
                color: activeTab === item.id ? 'white' : '#94a3b8',
                cursor: 'pointer', fontSize: '14px', textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
            </button>
          ))}
        </nav>

        {/* Profile + Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #334155' }}>
          {profile && sidebarOpen && (
            <div style={{
              padding: '10px 12px', marginBottom: '8px',
              background: '#0f172a', borderRadius: '10px'
            }}>
              <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name}
              </div>
              <div style={{ color: '#3b82f6', fontSize: '11px', textTransform: 'capitalize' }}>
                {profile.role}
              </div>
            </div>
          )}
          <button onClick={handleLogout} style={{
            width: '100%', display: 'flex', alignItems: 'center',
            gap: '12px', padding: '11px 12px', borderRadius: '10px',
            border: 'none', background: 'transparent',
            color: '#ef4444', cursor: 'pointer', fontSize: '14px'
          }}>
            <span style={{ fontSize: '18px', flexShrink: 0 }}>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ marginLeft: sidebarOpen ? '220px' : '70px', flex: 1, transition: 'margin-left 0.3s' }}>
        {/* Top Bar */}
        <div style={{
          background: '#1e293b', borderBottom: '1px solid #334155',
          padding: '14px 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 50
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                background: 'transparent', border: 'none',
                color: '#94a3b8', cursor: 'pointer', fontSize: '20px'
              }}
            >☰</button>
            <h2 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>
              {menuItems.find(m => m.id === activeTab)?.icon}{' '}
              {menuItems.find(m => m.id === activeTab)?.label}
            </h2>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long', year: 'numeric',
              month: 'long', day: 'numeric'
            })}
          </div>
        </div>

        {/* Page Content */}
        <div style={{ padding: '24px' }}>
          {activeTab === 'dashboard' && <Dashboard profile={profile} setActiveTab={setActiveTab} />}
          {activeTab === 'employees' && <Employees profile={profile} />}
          {activeTab === 'attendance' && <Attendance profile={profile} />}
          {activeTab === 'tasks' && <Tasks profile={profile} />}
          {activeTab === 'payroll' && <Payroll profile={profile} />}
          {activeTab === 'messages' && <Messages profile={profile} />}
          {activeTab === 'settings' && <Settings profile={profile} />}
        </div>
      </div>
    </div>
  )
}
