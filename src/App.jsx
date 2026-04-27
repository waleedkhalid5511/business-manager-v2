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

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: '#f5f5f5'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '16px',
          background: 'linear-gradient(135deg, #d71920, #b5151b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '26px', margin: '0 auto 14px',
          boxShadow: '0 4px 16px rgba(215,25,32,0.3)'
        }}>🏢</div>
        <div style={{ color: '#888', fontSize: '13px' }}>Loading...</div>
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
      {/* Left Panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(160deg, #d71920 0%, #8b0000 100%)',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '60px', position: 'relative', overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{
          width: '80px', height: '80px', borderRadius: '22px',
          background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '40px', marginBottom: '28px',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
        }}>🏢</div>

        <h1 style={{ color: 'white', fontSize: '32px', fontWeight: '800', margin: '0 0 10px', textAlign: 'center', letterSpacing: '-0.5px' }}>
          Business Manager
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '15px', margin: '0 0 48px', textAlign: 'center', fontWeight: '500' }}>
          Smart Agency Operations System
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '320px' }}>
          {[
            { icon: '✦', text: 'Projects & Task Management' },
            { icon: '◷', text: 'Smart Attendance Tracking' },
            { icon: '💬', text: 'Real-time Team Messaging' },
            { icon: '⏱', text: 'Time & Client Tracking' },
            { icon: '📊', text: 'Performance Analytics' },
          ].map(f => (
            <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: '14px', flexShrink: 0
              }}>{f.icon}</div>
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', fontWeight: '500' }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{ width: '460px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', background: 'white' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <div style={{ marginBottom: '36px' }}>
            <h2 style={{ color: '#111', fontSize: '26px', fontWeight: '800', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
              Welcome back
            </h2>
            <p style={{ color: '#888', margin: 0, fontSize: '14px' }}>Sign in to your account to continue</p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(215,25,32,0.08)', border: '1px solid rgba(215,25,32,0.2)',
              color: '#d71920', padding: '12px 14px', borderRadius: '10px',
              marginBottom: '20px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center'
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
            <div style={{ marginBottom: '28px' }}>
              <label className="input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" required className="input"
                  style={{ paddingRight: '44px' }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '16px', padding: '4px'
                }}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '13px',
              background: loading ? '#e5e5e5' : 'linear-gradient(135deg, #d71920, #b5151b)',
              border: 'none', borderRadius: '10px',
              color: loading ? '#999' : 'white',
              fontSize: '15px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(215,25,32,0.3)',
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

  const {
    canAccess, isInSidebar, loading: permLoading,
    adminVisibleModules, toggleAdminModule, showAllModules,
    toggleModule, getModulePermission
  } = usePermissions(profile)

  const {
    notifications, unreadCount,
    markAsRead, markAllRead, notificationIcon
  } = useNotifications(profile)

  // Overall loading — wait for both profile AND permissions
  const isLoading = profileLoading || permLoading

  useEffect(() => { getProfile() }, [])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (profile?.role !== 'admin') return
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        setShowAdminPanel(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [profile])

  const getProfile = async () => {
    const { data } = await supabase
      .from('profiles').select('*')
      .eq('id', session.user.id).single()
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
      ]
    },
    {
      title: 'Work',
      items: [
        { id: 'projects', icon: '📁', label: 'Projects' },
        { id: 'tasks', icon: '✦', label: 'Tasks' },
        { id: 'attendance', icon: '◷', label: 'Attendance' },
        { id: 'timetracking', icon: '⏱', label: 'Time Logs' },
        { id: 'clienttime', icon: '👤', label: 'Client Time' },
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

  const filteredNavSections = ALL_NAV_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => isInSidebar(item.id))
  })).filter(section => section.items.length > 0)

  const allItems = ALL_NAV_SECTIONS.flatMap(s => s.items)
  const currentItem = allItems.find(i => i.id === activeTab)

  const roleColor = {
    admin: '#d71920', manager: '#d97706',
    employee: '#2563eb', partner: '#7c3aed', client: '#16a34a',
    junior_editor: '#0891b2', senior_editor: '#059669',
    client_manager: '#d97706', qa_reviewer: '#7c3aed'
  }

  // Full page loading screen
  if (isLoading) return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5', overflow: 'hidden' }}>
      {/* Sidebar Skeleton */}
      <div style={{
        width: '220px', background: 'white',
        borderRight: '1px solid #e5e5e5', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: '8px'
      }}>
        <div className="skeleton" style={{ height: '40px', borderRadius: '10px', marginBottom: '16px' }} />
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="skeleton" style={{ height: '36px', borderRadius: '8px' }} />
        ))}
      </div>
      {/* Content Skeleton */}
      <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ height: '56px', background: 'white', borderRadius: '0', marginTop: '-24px', marginLeft: '-24px', marginRight: '-24px', marginBottom: '8px', borderBottom: '1px solid #e5e5e5' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: '200px', borderRadius: '12px' }} />
        <div className="skeleton" style={{ height: '160px', borderRadius: '12px' }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f5f5', overflow: 'hidden' }}>

      {/* SIDEBAR */}
      <div style={{
        width: sidebarCollapsed ? '64px' : '220px',
        background: 'white',
        borderRight: '1px solid #e5e5e5',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0, zIndex: 100, overflow: 'hidden',
        boxShadow: '2px 0 8px rgba(0,0,0,0.04)'
      }}>
        {/* Logo */}
        <div style={{
          height: '60px', padding: '0 14px',
          display: 'flex', alignItems: 'center',
          gap: '10px', borderBottom: '1px solid #e5e5e5', flexShrink: 0
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #d71920, #b5151b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '17px', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(215,25,32,0.3)'
          }}>🏢</div>
          {!sidebarCollapsed && (
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#111', fontWeight: '800', fontSize: '14px', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
                Business Manager
              </div>
              <div style={{ color: '#d71920', fontSize: '10px', fontWeight: '600', whiteSpace: 'nowrap' }}>Enterprise</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 8px' }}>
          {filteredNavSections.map(section => (
            <div key={section.title} style={{ marginBottom: '8px' }}>
              {!sidebarCollapsed && (
                <div style={{
                  color: '#bbb', fontSize: '10px', fontWeight: '700',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '8px 10px 4px'
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
                    padding: sidebarCollapsed ? '10px' : '9px 12px'
                  }}
                >
                  <span style={{
                    fontSize: '16px', flexShrink: 0,
                    color: activeTab === item.id ? '#d71920' : '#999'
                  }}>{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>{item.label}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Profile + Logout */}
        <div style={{ padding: '10px 8px', borderTop: '1px solid #e5e5e5', flexShrink: 0 }}>
          {!sidebarCollapsed && profile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '10px',
              background: '#f9f9f9', marginBottom: '6px',
              cursor: 'pointer', border: '1px solid #e5e5e5',
              transition: 'all 0.2s'
            }}
              onClick={() => setActiveTab('settings')}
              onMouseEnter={e => e.currentTarget.style.background = '#f0f0f0'}
              onMouseLeave={e => e.currentTarget.style.background = '#f9f9f9'}
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
                <div style={{ color: '#111', fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {profile.full_name}
                </div>
                <div style={{ color: roleColor[profile.role] || '#d71920', fontSize: '10px', textTransform: 'capitalize', fontWeight: '600' }}>
                  {profile.role?.replace('_', ' ')}
                </div>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="nav-item" style={{
            color: '#d71920',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            padding: sidebarCollapsed ? '10px' : '9px 12px', fontSize: '13px'
          }}>
            <span style={{ fontSize: '15px' }}>⎋</span>
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Topbar */}
        <div className="topbar" style={{ background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="btn-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="#888">
                <rect y="2" width="16" height="1.5" rx="0.75" />
                <rect y="7.25" width="16" height="1.5" rx="0.75" />
                <rect y="12.5" width="16" height="1.5" rx="0.75" />
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d71920', fontSize: '16px' }}>{currentItem?.icon}</span>
              <span style={{ color: '#111', fontSize: '15px', fontWeight: '700' }}>{currentItem?.label}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ color: '#aaa', fontSize: '12px', fontWeight: '500' }}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button className="btn-icon" onClick={() => setShowNotifPanel(!showNotifPanel)} style={{ position: 'relative', color: '#666' }}>
                🔔
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: '0', right: '0',
                    background: '#d71920', color: 'white',
                    borderRadius: '50%', width: '16px', height: '16px',
                    fontSize: '9px', fontWeight: '800',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid white'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifPanel && (
                <div style={{
                  position: 'absolute', top: '48px', right: 0,
                  width: '360px', background: 'white',
                  border: '1px solid #e5e5e5', borderRadius: '16px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 1000,
                  overflow: 'hidden', animation: 'slideDown 0.2s ease'
                }}>
                  <div style={{
                    padding: '14px 16px', borderBottom: '1px solid #e5e5e5',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#111', fontWeight: '700', fontSize: '15px' }}>Notifications</span>
                      {unreadCount > 0 && (
                        <span style={{ background: '#d71920', color: 'white', borderRadius: '20px', padding: '1px 7px', fontSize: '11px', fontWeight: '700' }}>
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <button onClick={markAllRead} style={{ background: 'transparent', border: 'none', color: '#d71920', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>
                      Mark all read
                    </button>
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
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px',
                            background: notif.is_read ? '#f5f5f5' : 'rgba(215,25,32,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '18px', flexShrink: 0
                          }}>
                            {notificationIcon(notif.type)}
                          </div>
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{ color: '#111', fontSize: '13px', fontWeight: notif.is_read ? '400' : '700', marginBottom: '2px' }}>
                              {notif.title}
                            </div>
                            {notif.body && (
                              <div style={{ color: '#888', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {notif.body}
                              </div>
                            )}
                            <div style={{ color: '#bbb', fontSize: '11px', marginTop: '3px' }}>
                              {new Date(notif.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          {!notif.is_read && (
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#d71920', flexShrink: 0 }} />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="avatar avatar-sm" style={{
              cursor: 'pointer',
              background: `${roleColor[profile?.role] || '#d71920'}20`,
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
              {activeTab === 'settings' && <Settings profile={profile} />}
            </>
          )}
        </div>
      </div>

      {/* SECRET ADMIN PANEL */}
      {showAdminPanel && profile?.role === 'admin' && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 9999, display: 'flex', justifyContent: 'center',
          alignItems: 'center', padding: '20px', backdropFilter: 'blur(6px)'
        }} onClick={() => setShowAdminPanel(false)}>
          <div style={{
            background: 'white', borderRadius: '20px',
            width: '100%', maxWidth: '680px', maxHeight: '88vh',
            overflowY: 'auto', border: '1px solid #e5e5e5',
            animation: 'bounceIn 0.3s ease',
            boxShadow: '0 24px 64px rgba(0,0,0,0.15)'
          }} onClick={e => e.stopPropagation()}>

            <div style={{
              padding: '20px 24px', borderBottom: '1px solid #e5e5e5',
              background: 'linear-gradient(135deg, #d71920, #8b0000)',
              borderRadius: '20px 20px 0 0',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div>
                <h2 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '800' }}>Visibility Control</h2>
                <p style={{ color: 'rgba(255,255,255,0.7)', margin: '4px 0 0', fontSize: '12px' }}>Ctrl+Shift+A to open/close</p>
              </div>
              <button onClick={() => setShowAdminPanel(false)} style={{
                background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
                color: 'white', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
              }}>✕</button>
            </div>

            <div style={{ padding: '24px' }}>
              {/* My Sidebar */}
              <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #e5e5e5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <div style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>My Sidebar</div>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>Toggle what YOU see — perfect for screen sharing</div>
                  </div>
                  <button onClick={showAllModules} style={{
                    background: 'white', border: '1px solid #e5e5e5', borderRadius: '6px',
                    padding: '5px 12px', color: '#666', cursor: 'pointer', fontSize: '11px', fontWeight: '600'
                  }}>Reset All</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '8px' }}>
                  {[
                    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
                    { id: 'messages', icon: '💬', label: 'Messages' },
                    { id: 'projects', icon: '📁', label: 'Projects' },
                    { id: 'tasks', icon: '✅', label: 'Tasks' },
                    { id: 'attendance', icon: '📅', label: 'Attendance' },
                    { id: 'timetracking', icon: '⏱️', label: 'Time Logs' },
                    { id: 'clienttime', icon: '👤', label: 'Client Time' },
                    { id: 'employees', icon: '👥', label: 'People' },
                    { id: 'payroll', icon: '💰', label: 'Payroll' },
                    { id: 'settings', icon: '⚙️', label: 'Settings' },
                  ].map(mod => {
                    const isOn = adminVisibleModules.includes(mod.id)
                    return (
                      <div key={mod.id} onClick={() => toggleAdminModule(mod.id)} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: isOn ? 'rgba(215,25,32,0.06)' : 'white',
                        border: `1px solid ${isOn ? 'rgba(215,25,32,0.2)' : '#e5e5e5'}`,
                        transition: 'all 0.2s'
                      }}>
                        <span style={{ fontSize: '13px', color: isOn ? '#111' : '#999' }}>
                          {mod.icon} {mod.label}
                        </span>
                        <div style={{
                          width: '36px', height: '20px', borderRadius: '10px',
                          background: isOn ? '#d71920' : '#e5e5e5',
                          position: 'relative', flexShrink: 0, transition: 'background 0.2s'
                        }}>
                          <div style={{
                            width: '14px', height: '14px', borderRadius: '50%',
                            background: 'white', position: 'absolute', top: '3px',
                            left: isOn ? '19px' : '3px', transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Partner & Employee */}
              <div style={{ color: '#bbb', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                Partner & Employee Permissions
              </div>

              {['partner', 'employee'].map(role => (
                <div key={role} style={{ background: '#f9f9f9', borderRadius: '12px', padding: '16px', marginBottom: '12px', border: '1px solid #e5e5e5' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <span style={{
                      background: `${{ partner: '#7c3aed', employee: '#2563eb' }[role]}15`,
                      color: { partner: '#7c3aed', employee: '#2563eb' }[role],
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize'
                    }}>{role}</span>
                    <span style={{ color: '#888', fontSize: '12px' }}>can see these modules</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(145px, 1fr))', gap: '8px' }}>
                    {['dashboard', 'messages', 'projects', 'tasks', 'attendance', 'timetracking', 'clienttime', 'employees', 'payroll', 'settings'].map(moduleId => (
                      <ModuleToggle
                        key={`${moduleId}-${role}`}
                        moduleId={moduleId}
                        role={role}
                        initialValue={getModulePermission(moduleId, role)}
                        onToggle={toggleModule}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showNotifPanel && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999 }}
          onClick={() => setShowNotifPanel(false)} />
      )}
    </div>
  )
}

function ModuleToggle({ moduleId, role, onToggle, initialValue }) {
  const [enabled, setEnabled] = useState(initialValue !== false)

  useEffect(() => {
    setEnabled(initialValue !== false)
  }, [initialValue])

  const handleToggle = async () => {
    const newVal = !enabled
    setEnabled(newVal)
    await onToggle(moduleId, role, newVal)
  }

  const moduleLabels = {
    dashboard: '🏠 Dashboard', messages: '💬 Messages',
    projects: '📁 Projects', tasks: '✅ Tasks',
    attendance: '📅 Attendance', employees: '👥 People',
    payroll: '💰 Payroll', files: '📁 Files',
    settings: '⚙️ Settings', timetracking: '⏱️ Time Logs',
    clienttime: '👤 Client Time',
  }

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      background: enabled ? 'rgba(215,25,32,0.05)' : 'white',
      borderRadius: '8px', padding: '8px 10px',
      border: `1px solid ${enabled ? 'rgba(215,25,32,0.15)' : '#e5e5e5'}`,
      transition: 'all 0.2s', cursor: 'pointer'
    }} onClick={handleToggle}>
      <span style={{ color: enabled ? '#111' : '#999', fontSize: '12px' }}>
        {moduleLabels[moduleId] || moduleId}
      </span>
      <div style={{
        width: '36px', height: '20px', borderRadius: '10px',
        background: enabled ? '#d71920' : '#e5e5e5',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s'
      }}>
        <div style={{
          width: '14px', height: '14px', borderRadius: '50%',
          background: 'white', position: 'absolute', top: '3px',
          left: enabled ? '19px' : '3px', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
        }} />
      </div>
    </div>
  )
}
