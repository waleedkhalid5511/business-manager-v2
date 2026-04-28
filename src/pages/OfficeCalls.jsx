import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function OfficeCalls({ profile }) {
  const [employees, setEmployees] = useState([])
  const [callStatuses, setCallStatuses] = useState({})
  const [ringing, setRinging] = useState({})
  const [message, setMessage] = useState('')

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchEmployees()

    const sub = supabase
      .channel(`calls-admin-${profile.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'office_calls',
        filter: `caller_id=eq.${profile.id}`
      }, (payload) => {
        const call = payload.new
        setCallStatuses(prev => ({ ...prev, [call.receiver_id]: call.status }))
        if (call.status === 'coming') {
          setMessage(`✅ ${getEmployeeName(call.receiver_id)} is coming!`)
          setRinging(prev => ({ ...prev, [call.receiver_id]: false }))
        }
        if (call.status === 'dismissed') {
          setMessage(`❌ ${getEmployeeName(call.receiver_id)} dismissed the call`)
          setRinging(prev => ({ ...prev, [call.receiver_id]: false }))
        }
      })
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, department, is_active')
      .eq('is_active', true)
      .neq('id', profile.id)
      .order('full_name')
    setEmployees(data || [])
  }

  const getEmployeeName = (id) => {
    return employees.find(e => e.id === id)?.full_name || 'Employee'
  }

  const ringEmployee = async (employee) => {
    try {
      setRinging(prev => ({ ...prev, [employee.id]: true }))
      setCallStatuses(prev => ({ ...prev, [employee.id]: 'ringing' }))

      const { error } = await supabase.from('office_calls').insert({
        caller_id: profile.id,
        receiver_id: employee.id,
        status: 'ringing'
      })

      if (error) throw error
      setMessage(`🔔 Ringing ${employee.full_name}...`)

      // Auto stop ringing after 30 seconds
      setTimeout(() => {
        setRinging(prev => ({ ...prev, [employee.id]: false }))
        setCallStatuses(prev => {
          if (prev[employee.id] === 'ringing') {
            return { ...prev, [employee.id]: null }
          }
          return prev
        })
      }, 30000)

    } catch (e) {
      setMessage('❌ ' + e.message)
      setRinging(prev => ({ ...prev, [employee.id]: false }))
    }
  }

  const roleColor = {
    admin: '#d71920', manager: '#d97706', employee: '#2563eb',
    partner: '#7c3aed', junior_editor: '#0891b2',
    senior_editor: '#059669', client_manager: '#d97706', qa_reviewer: '#7c3aed'
  }

  const getStatusDisplay = (empId) => {
    const status = callStatuses[empId]
    if (!status || status === null) return null
    if (status === 'ringing') return { text: 'Ringing...', color: '#d97706', bg: 'rgba(217,119,6,0.1)' }
    if (status === 'coming') return { text: '✅ Coming!', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' }
    if (status === 'dismissed') return { text: '❌ Dismissed', color: '#d71920', bg: 'rgba(215,25,32,0.1)' }
    return null
  }

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>
          🔔 Office Bell
        </h2>
        <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
          Ring an employee to call them to your office
        </p>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' :
            message.includes('✅') ? 'rgba(22,163,74,0.08)' : 'rgba(217,119,6,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' :
            message.includes('✅') ? 'rgba(22,163,74,0.2)' : 'rgba(217,119,6,0.2)'}`,
          color: message.includes('❌') ? '#d71920' :
            message.includes('✅') ? '#16a34a' : '#d97706',
          padding: '12px 16px', borderRadius: '10px',
          marginBottom: '20px', fontSize: '14px', fontWeight: '600'
        }}>
          {message}
        </div>
      )}

      {/* How it works */}
      <div style={{
        background: 'white', borderRadius: '12px', padding: '16px 20px',
        marginBottom: '24px', border: '1px solid #e5e5e5',
        display: 'flex', gap: '24px', flexWrap: 'wrap'
      }}>
        {[
          { icon: '1️⃣', text: 'Click Ring button' },
          { icon: '2️⃣', text: 'Employee sees fullscreen alert' },
          { icon: '3️⃣', text: 'They tap "Coming" or "Dismiss"' },
          { icon: '4️⃣', text: 'You get notified here' },
        ].map(step => (
          <div key={step.icon} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>{step.icon}</span>
            <span style={{ color: '#666', fontSize: '13px' }}>{step.text}</span>
          </div>
        ))}
      </div>

      {/* Employees Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: '14px'
      }}>
        {employees.map(emp => {
          const status = getStatusDisplay(emp.id)
          const isRinging = ringing[emp.id]

          return (
            <div key={emp.id} style={{
              background: 'white', borderRadius: '14px', padding: '20px',
              border: `1px solid ${isRinging ? 'rgba(217,119,6,0.3)' :
                status?.color ? `${status.color}30` : '#e5e5e5'}`,
              boxShadow: isRinging ? '0 4px 20px rgba(217,119,6,0.15)' : '0 1px 4px rgba(0,0,0,0.05)',
              transition: 'all 0.3s'
            }}>
              {/* Employee Info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '14px',
                  background: `${roleColor[emp.role] || '#d71920'}15`,
                  color: roleColor[emp.role] || '#d71920',
                  border: `2px solid ${roleColor[emp.role] || '#d71920'}25`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', fontWeight: '800', flexShrink: 0
                }}>
                  {emp.full_name?.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '3px' }}>
                    {emp.full_name}
                  </div>
                  <div style={{ color: '#888', fontSize: '12px', textTransform: 'capitalize' }}>
                    {emp.role?.replace('_', ' ')} {emp.department ? `· ${emp.department}` : ''}
                  </div>
                </div>
              </div>

              {/* Status */}
              {status && (
                <div style={{
                  background: status.bg, color: status.color,
                  padding: '8px 12px', borderRadius: '8px',
                  fontSize: '13px', fontWeight: '700',
                  textAlign: 'center', marginBottom: '12px',
                  animation: isRinging ? 'pulse 1s infinite' : 'none'
                }}>
                  {status.text}
                </div>
              )}

              {/* Ring Button */}
              <button
                onClick={() => ringEmployee(emp)}
                disabled={isRinging}
                style={{
                  width: '100%', padding: '12px',
                  borderRadius: '10px', border: 'none',
                  background: isRinging
                    ? 'rgba(217,119,6,0.1)'
                    : 'linear-gradient(135deg, #d71920, #b5151b)',
                  color: isRinging ? '#d97706' : 'white',
                  fontSize: '14px', fontWeight: '700',
                  cursor: isRinging ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: isRinging ? 'none' : '0 4px 12px rgba(215,25,32,0.3)'
                }}
                onMouseEnter={e => { if (!isRinging) e.currentTarget.style.transform = 'translateY(-1px)' }}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {isRinging ? (
                  <>
                    <span style={{ animation: 'pulse 0.8s infinite', display: 'inline-block' }}>🔔</span>
                    Ringing...
                  </>
                ) : (
                  <>🔔 Ring</>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {employees.length === 0 && (
        <div className="empty-state card">
          <div className="empty-icon">🔔</div>
          <div className="empty-title">No employees found</div>
          <div className="empty-desc">Add team members to ring them</div>
        </div>
      )}
    </div>
  )
}
