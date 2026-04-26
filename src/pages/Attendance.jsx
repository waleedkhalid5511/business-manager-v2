import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Attendance({ profile }) {
  const [todayRecord, setTodayRecord] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [activeSection, setActiveSection] = useState('attendance')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    leave_type: 'annual', reason: '', is_informed: true
  })
  const [manualForm, setManualForm] = useState({
    employee_id: '', date: new Date().toISOString().split('T')[0],
    check_in: '09:00', check_out: '18:00', status: 'present', notes: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (profile) {
      fetchTodayRecord()
      fetchAttendance()
      fetchLeaves()
      if (isAdmin || isManager) fetchEmployees()
    }
  }, [profile, selectedDate])

  const fetchTodayRecord = async () => {
    const { data } = await supabase
      .from('attendance').select('*')
      .eq('employee_id', profile.id).eq('date', today).single()
    setTodayRecord(data)
  }

  const fetchAttendance = async () => {
    setLoading(true)
    let query = supabase
      .from('attendance')
      .select('*, profiles(full_name, department)')
      .eq('date', selectedDate)
      .order('check_in', { ascending: false })
    if (!isAdmin && !isManager) query = query.eq('employee_id', profile.id)
    const { data } = await query
    setAttendance(data || [])
    setLoading(false)
  }

  const fetchLeaves = async () => {
    let query = supabase
      .from('leave_requests')
      .select('*, profiles(full_name)')
      .order('created_at', { ascending: false })
    if (!isAdmin && !isManager) query = query.eq('employee_id', profile.id)
    const { data } = await query
    setLeaves(data || [])
  }

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles').select('id, full_name').eq('is_active', true)
    setEmployees(data || [])
  }

  const handleCheckIn = async () => {
    const now = new Date()
    const workStart = new Date()
    workStart.setHours(9, 0, 0, 0)
    const lateMinutes = Math.max(0, Math.floor((now - workStart) / 60000) - 15)
    const status = lateMinutes > 0 ? 'late' : 'present'

    const { error } = await supabase.from('attendance').insert({
      employee_id: profile.id, date: today,
      check_in: now.toISOString(), status, late_minutes: lateMinutes
    })

    if (error) setMessage('❌ ' + error.message)
    else {
      setMessage(lateMinutes > 0
        ? `⚠️ Check-in! ${lateMinutes} minute late.`
        : '✅ Check-in! Time pe aaye!')
      fetchTodayRecord(); fetchAttendance()
    }
  }

  const handleCheckOut = async () => {
    const now = new Date()
    const workEnd = new Date()
    workEnd.setHours(18, 0, 0, 0)
    const earlyMinutes = Math.max(0, Math.floor((workEnd - now) / 60000))

    const { error } = await supabase.from('attendance')
      .update({ check_out: now.toISOString(), early_leave_minutes: earlyMinutes })
      .eq('id', todayRecord.id)

    if (error) setMessage('❌ ' + error.message)
    else {
      setMessage(earlyMinutes > 0 ? `⚠️ Check-out! ${earlyMinutes} min jaldi.` : '✅ Check-out!')
      fetchTodayRecord(); fetchAttendance()
    }
  }

  const submitLeave = async () => {
    const start = new Date(leaveForm.start_date)
    const end = new Date(leaveForm.end_date)
    const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: profile.id,
      start_date: leaveForm.start_date,
      end_date: leaveForm.end_date,
      total_days: totalDays,
      leave_type: leaveForm.leave_type,
      reason: leaveForm.reason,
      is_informed: leaveForm.is_informed
    })

    if (error) setMessage('❌ ' + error.message)
    else {
      setMessage('✅ Leave request submit ho gaya!')
      setShowLeaveModal(false)
      fetchLeaves()
    }
  }

  const handleLeaveAction = async (id, status) => {
    await supabase.from('leave_requests')
      .update({ status, reviewed_by: profile.id, reviewed_at: new Date().toISOString() })
      .eq('id', id)
    setMessage(`✅ Leave ${status}!`)
    fetchLeaves()
  }

  const submitManualAttendance = async () => {
    if (!manualForm.employee_id) {
      setMessage('❌ Employee select karein!')
      return
    }

    const dateStr = manualForm.date
    const checkIn = new Date(`${dateStr}T${manualForm.check_in}:00`)
    const checkOut = new Date(`${dateStr}T${manualForm.check_out}:00`)
    const workStart = new Date(`${dateStr}T09:00:00`)
    const lateMinutes = Math.max(0, Math.floor((checkIn - workStart) / 60000) - 15)

    const { error } = await supabase.from('attendance').upsert({
      employee_id: manualForm.employee_id,
      date: manualForm.date,
      check_in: checkIn.toISOString(),
      check_out: checkOut.toISOString(),
      status: manualForm.status,
      late_minutes: lateMinutes,
      notes: manualForm.notes
    }, { onConflict: 'employee_id,date' })

    if (error) setMessage('❌ ' + error.message)
    else {
      setMessage('✅ Attendance add ho gaya!')
      setShowManualModal(false)
      fetchAttendance()
    }
  }

  const formatTime = (ts) => {
    if (!ts) return '--:--'
    return new Date(ts).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
  }

  const statusColor = (s) => {
    const c = { present: '#10b981', late: '#f59e0b', absent: '#ef4444', half_day: '#8b5cf6', on_leave: '#3b82f6' }
    return c[s] || '#94a3b8'
  }

  const statusLabel = (s) => {
    const l = { present: '✅ Present', late: '⏰ Late', absent: '❌ Absent', half_day: '🌗 Half Day', on_leave: '🏖️ Leave' }
    return l[s] || s
  }

  const leaveStatusColor = (s) => {
    const c = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' }
    return c[s] || '#94a3b8'
  }

  return (
    <div>
      {/* Today Check-in/out */}
      {activeSection === 'attendance' && selectedDate === today && (
        <div style={{
          background: '#1e293b', borderRadius: '16px',
          padding: '24px', marginBottom: '24px', border: '1px solid #334155'
        }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>
            🕐 Aaj Ki Attendance
          </h3>

          {message && (
            <div style={{
              background: message.includes('❌') ? '#7f1d1d'
                : message.includes('⚠️') ? '#78350f' : '#14532d',
              color: message.includes('❌') ? '#fca5a5'
                : message.includes('⚠️') ? '#fde68a' : '#86efac',
              padding: '10px 14px', borderRadius: '8px',
              marginBottom: '16px', fontSize: '13px'
            }}>{message}</div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '12px', marginBottom: '20px'
          }}>
            {[
              { label: 'CHECK IN', value: formatTime(todayRecord?.check_in), color: '#10b981' },
              { label: 'CHECK OUT', value: formatTime(todayRecord?.check_out), color: '#ef4444' },
              { label: 'STATUS', value: todayRecord ? statusLabel(todayRecord.status) : '—', color: statusColor(todayRecord?.status) },
              { label: 'LATE MIN', value: todayRecord?.late_minutes || 0, color: todayRecord?.late_minutes > 0 ? '#f59e0b' : '#10b981' },
            ].map(card => (
              <div key={card.label} style={{
                background: '#0f172a', borderRadius: '10px',
                padding: '14px', textAlign: 'center'
              }}>
                <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '6px' }}>{card.label}</div>
                <div style={{ color: card.color, fontSize: '16px', fontWeight: 'bold' }}>{card.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={handleCheckIn} disabled={!!todayRecord?.check_in} style={{
              flex: 1, padding: '13px',
              background: todayRecord?.check_in ? '#334155' : 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none', borderRadius: '10px',
              color: todayRecord?.check_in ? '#64748b' : 'white',
              cursor: todayRecord?.check_in ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: 'bold'
            }}>
              {todayRecord?.check_in ? '✅ Check-in Ho Gaya' : '🟢 Check In'}
            </button>
            <button onClick={handleCheckOut}
              disabled={!todayRecord?.check_in || !!todayRecord?.check_out}
              style={{
                flex: 1, padding: '13px',
                background: !todayRecord?.check_in || todayRecord?.check_out
                  ? '#334155' : 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none', borderRadius: '10px',
                color: !todayRecord?.check_in || todayRecord?.check_out ? '#64748b' : 'white',
                cursor: !todayRecord?.check_in || todayRecord?.check_out ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 'bold'
              }}>
              {todayRecord?.check_out ? '✅ Check-out Ho Gaya' : '🔴 Check Out'}
            </button>
          </div>
        </div>
      )}

      {/* Section Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'attendance', label: '📅 Attendance' },
          { id: 'leaves', label: '🏖️ Leave Requests' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveSection(tab.id)} style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            background: activeSection === tab.id
              ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : '#1e293b',
            color: activeSection === tab.id ? 'white' : '#94a3b8',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>{tab.label}</button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button onClick={() => setShowLeaveModal(true)} style={{
            padding: '9px 16px', background: '#14532d',
            border: '1px solid #22c55e', borderRadius: '8px',
            color: '#86efac', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
          }}>
            + Leave Request
          </button>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowManualModal(true)} style={{
              padding: '9px 16px', background: '#1e3a5f',
              border: '1px solid #3b82f6', borderRadius: '8px',
              color: '#93c5fd', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold'
            }}>
              + Manual Entry
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && activeSection === 'leaves' && (
        <div style={{
          background: message.includes('❌') ? '#7f1d1d' : '#14532d',
          color: message.includes('❌') ? '#fca5a5' : '#86efac',
          padding: '10px 14px', borderRadius: '8px',
          marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* Attendance Section */}
      {activeSection === 'attendance' && (
        <div style={{
          background: '#1e293b', borderRadius: '16px',
          padding: '24px', border: '1px solid #334155'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '20px',
            flexWrap: 'wrap', gap: '12px'
          }}>
            <h3 style={{ color: 'white', margin: 0, fontSize: '17px' }}>
              📋 {isAdmin || isManager ? 'Sab Ki Attendance' : 'Meri Attendance'}
            </h3>
            <input type="date" value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                padding: '8px 12px', background: '#0f172a',
                border: '1px solid #334155', borderRadius: '8px',
                color: 'white', fontSize: '13px', outline: 'none'
              }}
            />
          </div>

          {(isAdmin || isManager) && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
              gap: '10px', marginBottom: '20px'
            }}>
              {[
                { label: 'Present', color: '#10b981', status: 'present' },
                { label: 'Late', color: '#f59e0b', status: 'late' },
                { label: 'Absent', color: '#ef4444', status: 'absent' },
                { label: 'Leave', color: '#3b82f6', status: 'on_leave' },
              ].map(s => (
                <div key={s.status} style={{
                  background: '#0f172a', borderRadius: '8px',
                  padding: '10px', textAlign: 'center',
                  border: `1px solid ${s.color}33`
                }}>
                  <div style={{ color: s.color, fontSize: '20px', fontWeight: 'bold' }}>
                    {attendance.filter(a => a.status === s.status).length}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '11px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '30px' }}>Loading...</div>
          ) : attendance.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>📅</div>
              <p>Is date ki koi attendance nahi</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr>
                    {(isAdmin || isManager) && (
                      <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Employee</th>
                    )}
                    <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Check In</th>
                    <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Check Out</th>
                    <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Late</th>
                    <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Status</th>
                    {(isAdmin || isManager) && (
                      <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Notes</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(record => (
                    <tr key={record.id} style={{ borderBottom: '1px solid #1e293b' }}>
                      {(isAdmin || isManager) && (
                        <td style={{ padding: '12px', color: 'white' }}>
                          <div style={{ fontWeight: 'bold' }}>{record.profiles?.full_name}</div>
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>{record.profiles?.department}</div>
                        </td>
                      )}
                      <td style={{ padding: '12px', color: '#10b981' }}>{formatTime(record.check_in)}</td>
                      <td style={{ padding: '12px', color: '#ef4444' }}>{formatTime(record.check_out)}</td>
                      <td style={{ padding: '12px', color: record.late_minutes > 0 ? '#f59e0b' : '#10b981' }}>
                        {record.late_minutes || 0} min
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: statusColor(record.status) + '22',
                          color: statusColor(record.status),
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: 'bold'
                        }}>
                          {statusLabel(record.status)}
                        </span>
                      </td>
                      {(isAdmin || isManager) && (
                        <td style={{ padding: '12px', color: '#94a3b8', fontSize: '12px' }}>
                          {record.notes || '—'}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Leaves Section */}
      {activeSection === 'leaves' && (
        <div style={{
          background: '#1e293b', borderRadius: '16px',
          padding: '24px', border: '1px solid #334155'
        }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>
            🏖️ Leave Requests
          </h3>

          {leaves.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '30px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🏖️</div>
              <p>Koi leave request nahi</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {leaves.map(leave => (
                <div key={leave.id} style={{
                  background: '#0f172a', borderRadius: '10px',
                  padding: '16px', border: '1px solid #334155'
                }}>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: '10px',
                    flexWrap: 'wrap', gap: '8px'
                  }}>
                    <div>
                      {(isAdmin || isManager) && (
                        <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px', marginBottom: '2px' }}>
                          👤 {leave.profiles?.full_name}
                        </div>
                      )}
                      <div style={{ color: '#94a3b8', fontSize: '13px' }}>
                        {new Date(leave.start_date).toLocaleDateString()} → {new Date(leave.end_date).toLocaleDateString()} ({leave.total_days} days)
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        background: '#334155', color: '#94a3b8',
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', textTransform: 'capitalize'
                      }}>
                        {leave.leave_type}
                      </span>
                      <span style={{
                        background: leaveStatusColor(leave.status) + '22',
                        color: leaveStatusColor(leave.status),
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize'
                      }}>
                        {leave.status}
                      </span>
                    </div>
                  </div>

                  {leave.reason && (
                    <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '10px' }}>
                      📝 {leave.reason}
                    </div>
                  )}

                  {leave.status === 'pending' && (isAdmin || isManager) && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleLeaveAction(leave.id, 'approved')} style={{
                        padding: '7px 14px', background: '#14532d',
                        border: '1px solid #22c55e', borderRadius: '8px',
                        color: '#86efac', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                      }}>✅ Approve</button>
                      <button onClick={() => handleLeaveAction(leave.id, 'rejected')} style={{
                        padding: '7px 14px', background: '#7f1d1d',
                        border: '1px solid #ef4444', borderRadius: '8px',
                        color: '#fca5a5', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                      }}>❌ Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '440px', border: '1px solid #334155'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>
              🏖️ Leave Request
            </h3>

            {[
              { label: 'Start Date', key: 'start_date', type: 'date' },
              { label: 'End Date', key: 'end_date', type: 'date' },
              { label: 'Reason', key: 'reason', type: 'text', placeholder: 'Leave ki wajah...' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {field.label}
                </label>
                <input
                  type={field.type} value={leaveForm[field.key]}
                  onChange={(e) => setLeaveForm({ ...leaveForm, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', padding: '10px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '8px',
                    color: 'white', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Leave Type
              </label>
              <select value={leaveForm.leave_type}
                onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                style={{
                  width: '100%', padding: '10px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="emergency">Emergency Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" id="informed"
                checked={leaveForm.is_informed}
                onChange={(e) => setLeaveForm({ ...leaveForm, is_informed: e.target.checked })}
              />
              <label htmlFor="informed" style={{ color: '#94a3b8', fontSize: '13px' }}>
                Manager ko inform kiya hai
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowLeaveModal(false)} style={{
                flex: 1, padding: '11px', background: '#334155',
                border: 'none', borderRadius: '8px',
                color: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancel</button>
              <button onClick={submitLeave} style={{
                flex: 2, padding: '11px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
              }}>Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Attendance Modal */}
      {showManualModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '440px', border: '1px solid #334155'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>
              📝 Manual Attendance
            </h3>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Employee
              </label>
              <select value={manualForm.employee_id}
                onChange={(e) => setManualForm({ ...manualForm, employee_id: e.target.value })}
                style={{
                  width: '100%', padding: '10px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="">-- Employee Select --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            {[
              { label: 'Date', key: 'date', type: 'date' },
              { label: 'Check In Time', key: 'check_in', type: 'time' },
              { label: 'Check Out Time', key: 'check_out', type: 'time' },
              { label: 'Notes', key: 'notes', type: 'text', placeholder: 'Optional notes...' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {field.label}
                </label>
                <input
                  type={field.type} value={manualForm[field.key]}
                  onChange={(e) => setManualForm({ ...manualForm, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', padding: '10px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '8px',
                    color: 'white', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Status
              </label>
              <select value={manualForm.status}
                onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                style={{
                  width: '100%', padding: '10px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="present">✅ Present</option>
                <option value="late">⏰ Late</option>
                <option value="absent">❌ Absent</option>
                <option value="half_day">🌗 Half Day</option>
                <option value="on_leave">🏖️ On Leave</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowManualModal(false)} style={{
                flex: 1, padding: '11px', background: '#334155',
                border: 'none', borderRadius: '8px',
                color: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancel</button>
              <button onClick={submitManualAttendance} style={{
                flex: 2, padding: '11px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
              }}>Add Attendance</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
