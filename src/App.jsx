import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: '#0f172a',
        color: 'white',
        fontSize: '18px'
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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        background: '#1e293b',
        padding: '40px',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            width: '60px',
            height: '60px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
            fontSize: '28px'
          }}>
            🏢
          </div>
          <h1 style={{
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '0 0 8px'
          }}>
            Business Manager
          </h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            Login Karein
          </p>
        </div>

        {error && (
          <div style={{
            background: '#7f1d1d',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              color: '#94a3b8',
              fontSize: '13px',
              display: 'block',
              marginBottom: '6px'
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="apni email"
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              color: '#94a3b8',
              fontSize: '13px',
              display: 'block',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%',
                padding: '12px',
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading
                ? '#334155'
                : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Login ho raha hai...' : 'Login Karein'}
          </button>
        </form>
      </div>
    </div>
  )
}

function DashboardPage({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getProfile()
  }, [])

  const getProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setProfile(data)
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div style={{ color: 'white', padding: '20px' }}>Loading...</div>
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f172a',
      color: 'white',
      padding: '20px',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '40px',
          paddingBottom: '20px',
          borderBottom: '1px solid #334155'
        }}>
          <div>
            <h1 style={{ margin: '0 0 8px', fontSize: '28px' }}>
              🏢 Business Manager
            </h1>
            <p style={{ margin: 0, color: '#94a3b8' }}>
              Welcome, {profile?.full_name}!
            </p>
          </div>
          <button
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Logout
          </button>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #312e81)',
          borderRadius: '16px',
          padding: '40px',
          border: '1px solid #334155'
        }}>
          <h2 style={{ margin: '0 0 20px', fontSize: '24px' }}>
            ✅ App Successfully Live!
          </h2>
          <p style={{ margin: '0 0 20px', color: '#cbd5e1', lineHeight: '1.6' }}>
            Congrats! Aapka Business Manager app successfully deploy ho gaya! 🎉
          </p>

          <div style={{
            background: '#0f172a',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px', fontSize: '16px' }}>
              👤 Your Profile
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '15px'
            }}>
              <div>
                <p style={{ margin: '0 0 5px', color: '#94a3b8', fontSize: '12px' }}>
                  Name
                </p>
                <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  {profile?.full_name}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px', color: '#94a3b8', fontSize: '12px' }}>
                  Email
                </p>
                <p style={{ margin: 0, fontSize: '16px' }}>
                  {profile?.email}
                </p>
              </div>
              <div>
                <p style={{ margin: '0 0 5px', color: '#94a3b8', fontSize: '12px' }}>
                  Role
                </p>
                <p style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: profile?.role === 'admin' ? '#10b981' : '#3b82f6'
                }}>
                  {profile?.role?.toUpperCase()}
                </p>
              </div>
            </div>
          </div>

          <p style={{
            margin: '20px 0 0',
            color: '#94a3b8',
            fontSize: '13px'
          }}>
            ✨ Next: Employees, Tasks, Payroll pages add karenge!
          </p>
        </div>
      </div>
    </div>
  )
}
