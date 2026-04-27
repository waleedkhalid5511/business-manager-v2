import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Attendance({ profile }) {
  const [attendance, setAttendance] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [employees, setEmployees] = useState([])
  const [settings, setSettings] = useState({ work_start_time: '09:00', late_grace_minutes: 15 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('today')
  const [message, setMessage] = useState('')
  const [todayRecord, setTodayRecord] = useState(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '' })
  const [manualForm, setManualForm] = useState({ employee_id: '', date: '', check_in: '', check_out: '', status: 'present' })
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0])
  const [checkingIn, setCheckingIn] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!profile) return
    fetchAll()

    // ⚡ Realtime
    const sub1 = supabase
      .channel(`attendance-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        fetchAttendance()
        fetchTodayRecord()
      })
      .subscribe()

    const sub2 = supabase
      .channel(`leaves-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchLeaves())
      .subscribe()

    return () => {
      sub1.unsubscribe()
      sub2.unsubscribe()
    }
  }, [profile])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  useEffect(() => {
    fetchAttendance()
  }, [filterDate])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([
      fetchAttendance(),
      fetchTodayRecord(),
      fetchLeaves(),
      fetchSettings(),
      fetchEmployees(),
    ])
    setLoading(false)
  }

  const fetchAttendance = async () => {
    try {
      let query = supabase
        .from('attendance')
        .select('*, profiles(full_name, department, designation)')
        .eq('date', filterDate)
        .order('check_in', { ascending: false })

      if (!isAdmin && !isManager) {
        query = query.eq('employee_id', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setAttendance(data || [])
    } catch (e) {
      console.error('fetchAttendance error:', e)
    }
  }

  const fetchTodayRecord = async () => {
    try {
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', profile.id)
        .eq('date', today)
        .maybeSingle()
      setTodayRecord(data || null)
    } catch (e) {
      console.error('fetchTodayRecord error:', e)
    }
  }

  const fetchLeaves = async () => {
    try {
      let query = supabase
        .from('leave_requests')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })

      if (!isAdmin && !isManager) {
        query = query.eq('employee_id', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setLeaveRequests(data || [])
    } catch (e) {
      console.error('fetchLeaves error:', e)
    }
  }

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('company_settings').select('*').single()
      if (data) setSettings({
        work_start_time: data.work_start_time?.slice(0, 5) || '09:00',
        late_grace_minutes: data.late_grace_minutes || 15
      })
    } catch (e) {}
  }

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
      setEmployees(data || [])
    } catch (e) {}
  }

  const checkIn = async () => {
    if (todayRecord) { setMessage('❌ Already checked in today!'); return }
    setCheckingIn(true)
    try {
      const now = new Date()
      const timeStr = now.toTimeString().slice(0, 5)
      const [startH, startM] = settings.work_start_time.split(':').map(Number)
      const [nowH, nowM] = timeStr.split(':').map(Number)
      const startMins = startH * 60 + startM + settings.late_grace_minutes
      const nowMins = nowH * 60 + nowM
      const isLate = nowMins > startMins
      const lateMinutes = isLate ? nowMins - (startH * 60 + startM) : 0

      const { data, error } = await supabase.from('attendance').insert({
        employee_id: profile.id,
        date: today,
        check_in: now.toISOString(),
        status: isLate ? 'late' : 'present',
        late_minutes: lateMinutes
      }).select().single()

      if (error) throw error
      setTodayRecord(data)
      setMessage(isLate
        ? `⚠️ Checked in late by ${lateMinutes} minutes`
        : '✅ Checked in successfully!'
      )
      fetchAttendance()
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setCheckingIn(false)
    }
  }

  const checkOut = async () => {
    if (!todayRecord) { setMessage('❌ No check-in record found!'); return }
    if (todayRecord.check_out) { setMessage('❌ Already checked out!'); return }

    setCheckingIn(true)
    try {
      const { data, error } = await supabase
        .from('attendance')
        .update({ check_out: new Date().toISOString() })
        .eq('id', todayRecord.id)
        .select()
        .single()

      if (error) throw error
      setTodayRecord(data)
      setMessage('✅ Checked out successfully!')
      fetchAttendance()
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setCheckingIn(false)
    }
  }

  const requestLeave = async () => {
    if (!leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      setMessage('❌ All fields required!')
      return
    }
    try {
      const start = new Date(leaveForm.start_date)
      const end = new Date(leaveForm.end_date)
      const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1

      const { error } = await supabase.from('leave_requests').insert({
        employee_id: profile.id,
        type: leaveForm.type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        total_days: totalDays,
        reason: leaveForm.reason,
        status: 'pending'
      })

      if (error) throw error
      setMessage('✅ Leave request submitted!')
      setLeaveForm({ type: 'annual', start_date: '', end_date: '', reason: '' })
      setShowLeaveModal(false)
      fetchLeaves()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const updateLeaveStatus = async (id, status) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, approved_by: profile.id })
        .eq('id', id)

      if (error) throw error
      setMessage(`✅ Leave ${status}!`)
      fetchLeaves()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const addManualAttendance = async () => {
    if (!manualForm.employee_id || !manualForm.date) {
      setMessage('❌ Employee and date required!')
      return
    }
    try {
      const { error } = await supabase.from('attendance').upsert({
        employee_id: manualForm.employee_id,
        date: manualForm.date,
        check_in: manualForm.check_in ? new Date(`${manualForm.date}T${manualForm.check_in}`).toISOString() : null,
        check_out: manualForm.check_out ? new Date(`${manualForm.date}T${manualForm.check_out}`).toISOString() : null,
        status: manualForm.status,
        late_minutes: 0
      }, { onConflict: 'employee_id,date' })

      if (error) throw error
      setMessage('✅ Attendance added!')
      setManualForm({ employee_id: '', date: '', check_in: '', check_out: '', status: 'present' })
      setShowManualModal(false)
      fetchAttendance()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const formatTime = (ts) => {
    if (!ts) return '--:--'
    return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  const getDuration = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '--'
    const diff = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60)
    const h = Math.floor(diff / 60)
    const m = Math.floor(diff % 60)
    return `${h}h ${m}m`
  }

  const statusConfig = {
    present: { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', label: 'Present' },
    late: { color: '#d97706', bg: 'rgba(217,119,6,0.1)', label: 'Late' },
    absent: { color: '#d71920', bg: 'rgba(215,25,32,0.1)', label: 'Absent' },
    on_leave: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)', label: 'On Leave' },
  }

  const leaveStatusConfig = {
    pending: { color: '#d97706', bg: 'rgba(217,119,6,0.1)', label: 'Pending' },
    approved: { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', label: 'Approved' },
    rejected: { color: '#d71920', bg: 'rgba(215,25,32,0.1)', label: 'Rejected' },
  }

  // Stats
  const presentCount = attendance.filter(a => a.status === 'present').length
  const lateCount = attendance.filter(a => a.status === 'late').length
  const absentCount = attendance.filter(a => a.status === 'absent').length
  const pendingLeaves = leaveRequests.filter(l => l.status === 'pending').length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Attendance</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowManualModal(true)} className="btn btn-secondary btn-sm">
              ✏️ Manual Entry
            </button>
          )}
          <button onClick={() => setShowLeaveModal(true)} className="btn btn-secondary btn-sm">
            🏖️ Request Leave
          </button>
        </div>
      </div>

      {/* Check In/Out Card */}
      <div style={{
        background: 'white', borderRadius: '16px', padding: '24px',
        marginBottom: '20px', border: '1px solid #e5e5e5',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <div style={{ color: '#888', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
            Today's Status
          </div>
          {todayRecord ? (
            <div>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '8px' }}>
                <div>
                  <div style={{ color: '#bbb', fontSize: '11px', marginBottom: '2px' }}>Check In</div>
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '18px' }}>{formatTime(todayRecord.check_in)}</div>
                </div>
                {todayRecord.check_out && (
                  <div>
                    <div style={{ color: '#bbb', fontSize: '11px', marginBottom: '2px' }}>Check Out</div>
                    <div style={{ color: '#111', fontWeight: '800', fontSize: '18px' }}>{formatTime(todayRecord.check_out)}</div>
                  </div>
                )}
                {todayRecord.check_out && (
                  <div>
                    <div style={{ color: '#bbb', fontSize: '11px', marginBottom: '2px' }}>Duration</div>
                    <div style={{ color: '#d71920', fontWeight: '800', fontSize: '18px' }}>
                      {getDuration(todayRecord.check_in, todayRecord.check_out)}
                    </div>
                  </div>
                )}
              </div>
              <span style={{
                background: statusConfig[todayRecord.status]?.bg,
                color: statusConfig[todayRecord.status]?.color,
                padding: '3px 12px', borderRadius: '20px',
                fontSize: '12px', fontWeight: '700'
              }}>
                {statusConfig[todayRecord.status]?.label}
                {todayRecord.late_minutes > 0 && ` — ${todayRecord.late_minutes} min late`}
              </span>
            </div>
          ) : (
            <div style={{ color: '#888', fontSize: '14px' }}>Not checked in yet</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!todayRecord ? (
            <button
              onClick={checkIn}
              disabled={checkingIn}
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '15px', opacity: checkingIn ? 0.7 : 1 }}
            >
              {checkingIn ? '⟳ Processing...' : '✅ Check In'}
            </button>
          ) : !todayRecord.check_out ? (
            <button
              onClick={checkOut}
              disabled={checkingIn}
              className="btn btn-sm"
              style={{
                padding: '12px 28px', fontSize: '15px',
                background: 'rgba(215,25,32,0.08)',
                color: '#d71920',
                border: '1px solid rgba(215,25,32,0.2)',
                opacity: checkingIn ? 0.7 : 1
              }}
            >
              {checkingIn ? '⟳ Processing...' : '🔴 Check Out'}
            </button>
          ) : (
            <div style={{
              background: 'rgba(22,163,74,0.1)', color: '#16a34a',
              padding: '12px 24px', borderRadius: '10px',
              fontSize: '14px', fontWeight: '700'
            }}>
              ✅ Day Complete!
            </div>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : message.includes('⚠️') ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' : message.includes('⚠️') ? 'rgba(217,119,6,0.2)' : 'rgba(22,163,74,0.2)'}`,
          color: message.includes('❌') ? '#d71920' : message.includes('⚠️') ? '#d97706' : '#16a34a',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Present', value: presentCount, color: '#16a34a' },
          { label: 'Late', value: lateCount, color: '#d97706' },
          { label: 'Absent', value: absentCount, color: '#d71920' },
          { label: 'Pending Leaves', value: pendingLeaves, color: '#2563eb' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${stat.color}22`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
            <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', marginBottom: '20px', background: 'white', borderRadius: '12px 12px 0 0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {[
          { id: 'today', label: '📅 Today' },
          { id: 'history', label: '📊 History' },
          { id: 'leaves', label: `🏖️ Leaves ${pendingLeaves > 0 ? `(${pendingLeaves})` : ''}` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px 20px', border: 'none', background: 'transparent',
            color: activeTab === tab.id ? '#d71920' : '#888',
            fontWeight: activeTab === tab.id ? '700' : '500',
            fontSize: '13px', cursor: 'pointer',
            borderBottom: activeTab === tab.id ? '2px solid #d71920' : '2px solid transparent',
            whiteSpace: 'nowrap'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Today Tab */}
      {activeTab === 'today' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                    No attendance records for today
                  </td>
                </tr>
              ) : (
                attendance.map(att => (
                  <tr key={att.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="avatar avatar-sm">
                          {att.profiles?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#111' }}>{att.profiles?.full_name}</div>
                          <div style={{ color: '#888', fontSize: '11px' }}>{att.profiles?.designation || att.profiles?.department}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: '#111', fontWeight: '600' }}>{formatTime(att.check_in)}</td>
                    <td style={{ color: att.check_out ? '#111' : '#bbb', fontWeight: att.check_out ? '600' : '400' }}>
                      {att.check_out ? formatTime(att.check_out) : 'Not yet'}
                    </td>
                    <td style={{ color: '#888' }}>{getDuration(att.check_in, att.check_out)}</td>
                    <td>
                      <span style={{
                        background: statusConfig[att.status]?.bg,
                        color: statusConfig[att.status]?.color,
                        padding: '3px 10px', borderRadius: '20px',
                        fontSize: '11px', fontWeight: '700'
                      }}>
                        {statusConfig[att.status]?.label}
                        {att.late_minutes > 0 && ` (${att.late_minutes}m)`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <input type="date" value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{
                padding: '8px 12px', background: 'white',
                border: '1px solid #e5e5e5', borderRadius: '8px',
                color: '#111', fontSize: '13px', outline: 'none'
              }}
            />
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                      No records for this date
                    </td>
                  </tr>
                ) : (
                  attendance.map(att => (
                    <tr key={att.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar avatar-sm">{att.profiles?.full_name?.charAt(0).toUpperCase()}</div>
                          <span style={{ fontWeight: '600', color: '#111' }}>{att.profiles?.full_name}</span>
                        </div>
                      </td>
                      <td style={{ color: '#888' }}>{att.date}</td>
                      <td style={{ fontWeight: '600' }}>{formatTime(att.check_in)}</td>
                      <td style={{ color: att.check_out ? '#111' : '#bbb' }}>
                        {att.check_out ? formatTime(att.check_out) : 'Not yet'}
                      </td>
                      <td style={{ color: '#888' }}>{getDuration(att.check_in, att.check_out)}</td>
                      <td>
                        <span style={{
                          background: statusConfig[att.status]?.bg,
                          color: statusConfig[att.status]?.color,
                          padding: '3px 10px', borderRadius: '20px',
                          fontSize: '11px', fontWeight: '700'
                        }}>
                          {statusConfig[att.status]?.label}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leaves Tab */}
      {activeTab === 'leaves' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ color: '#111', fontWeight: '700', fontSize: '15px' }}>
              Leave Requests
            </span>
            <button onClick={() => setShowLeaveModal(true)} className="btn btn-primary btn-sm">
              + Request Leave
            </button>
          </div>

          {leaveRequests.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">🏖️</div>
              <div className="empty-title">No leave requests</div>
              <div className="empty-desc">Submit a leave request when needed</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {leaveRequests.map(leave => (
                <div key={leave.id} style={{
                  background: 'white', borderRadius: '12px', padding: '16px',
                  border: '1px solid #e5e5e5', boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      {(isAdmin || isManager) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <div className="avatar avatar-sm">{leave.profiles?.full_name?.charAt(0).toUpperCase()}</div>
                          <span style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>{leave.profiles?.full_name}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ color: '#bbb', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</div>
                          <div style={{ color: '#111', fontWeight: '600', fontSize: '13px', textTransform: 'capitalize' }}>{leave.type} Leave</div>
                        </div>
                        <div>
                          <div style={{ color: '#bbb', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Duration</div>
                          <div style={{ color: '#111', fontWeight: '600', fontSize: '13px' }}>
                            {leave.start_date} → {leave.end_date} ({leave.total_days} days)
                          </div>
                        </div>
                      </div>
                      {leave.reason && (
                        <div style={{ color: '#666', fontSize: '13px', marginTop: '8px' }}>
                          📝 {leave.reason}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <span style={{
                        background: leaveStatusConfig[leave.status]?.bg,
                        color: leaveStatusConfig[leave.status]?.color,
                        padding: '4px 12px', borderRadius: '20px',
                        fontSize: '12px', fontWeight: '700'
                      }}>
                        {leaveStatusConfig[leave.status]?.label}
                      </span>

                      {(isAdmin || isManager) && leave.status === 'pending' && (
                        <>
                          <button onClick={() => updateLeaveStatus(leave.id, 'approved')}
                            className="btn btn-success btn-sm">
                            ✅ Approve
                          </button>
                          <button onClick={() => updateLeaveStatus(leave.id, 'rejected')}
                            className="btn btn-danger btn-sm">
                            ❌ Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>🏖️ Request Leave</h3>
              <button onClick={() => setShowLeaveModal(false)} style={{
                background: '#f5f5f5', border: 'none', borderRadius: '8px',
                color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{
                  background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                  color: message.includes('❌') ? '#d71920' : '#16a34a',
                  padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
                }}>{message}</div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Leave Type</label>
                <select value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="input">
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="casual">Casual Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Start Date</label>
                  <input type="date" value={leaveForm.start_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">End Date</label>
                  <input type="date" value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    className="input" />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Reason</label>
                <textarea value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Why do you need leave?"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px',
                    border: '1.5px solid #e5e5e5', borderRadius: '10px',
                    fontSize: '14px', outline: 'none', resize: 'vertical',
                    fontFamily: 'inherit', boxSizing: 'border-box', color: '#111'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d71920'}
                  onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowLeaveModal(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={requestLeave} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual Attendance Modal */}
      {showManualModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>✏️ Manual Entry</h3>
              <button onClick={() => setShowManualModal(false)} style={{
                background: '#f5f5f5', border: 'none', borderRadius: '8px',
                color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Employee</label>
                <select value={manualForm.employee_id}
                  onChange={(e) => setManualForm({ ...manualForm, employee_id: e.target.value })}
                  className="input">
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Date</label>
                <input type="date" value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                  className="input" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Check In</label>
                  <input type="time" value={manualForm.check_in}
                    onChange={(e) => setManualForm({ ...manualForm, check_in: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">Check Out</label>
                  <input type="time" value={manualForm.check_out}
                    onChange={(e) => setManualForm({ ...manualForm, check_out: e.target.value })}
                    className="input" />
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Status</label>
                <select value={manualForm.status}
                  onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                  className="input">
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowManualModal(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={addManualAttendance} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  Save Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
