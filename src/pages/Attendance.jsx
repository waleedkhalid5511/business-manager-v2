import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Attendance({ profile }) {
  const [todayRecord, setTodayRecord] = useState(null)
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (profile) {
      fetchTodayRecord()
      fetchAttendance()
    }
  }, [profile, selectedDate])

  const fetchTodayRecord = async () => {
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('date', today)
      .single()
    setTodayRecord(data)
  }

  const fetchAttendance = async () => {
    setLoading(true)
    let query = supabase
      .from('attendance')
      .select('*, profiles(full_name, department)')
      .eq('date', selectedDate)
      .order('check_in', { ascending: false })

    if (!isAdmin && !isManager) {
      query = query.eq('employee_id', profile.id)
    }

    const { data } = await query
    setAttendance(data || [])
    setLoading(false)
  }

  const handleCheckIn = async () => {
    const now = new Date()
    const workStart = new Date()
    workStart.setHours(9, 0, 0, 0)
    const lateMinutes = Math.max(0, Math.floor((now - workStart) / 60000) - 15)
    const status = lateMinutes > 0 ? 'late' : 'present'

    const { error } = await supabase.from('attendance').insert({
      employee_id: profile.id,
      date: today,
      check_in: now.toISOString(),
      status,
      late_minutes: lateMinutes
    })

    if (error) {
      setMessage('❌ Error: ' + error.message)
    } else {
      setMessage(lateMinutes > 0
        ? `⚠️ Check-in! Aap ${lateMinutes} minute late hain.`
        : '✅ Check-in ho gaya! Time pe aaye!'
      )
      fetchTodayRecord()
      fetchAttendance()
    }
  }

  const handleCheckOut = async () => {
    const now = new Date()
    const workEnd = new Date()
    workEnd.setHours(18, 0, 0, 0)
    const earlyMinutes = Math.max(0, Math.floor((workEnd - now) / 60000))

    const { error } = await supabase
      .from('attendance')
      .update({
        check_out: now.toISOString(),
        early_leave_minutes: earlyMinutes
      })
      .eq('id', todayRecord.id)

    if (error) {
      setMessage('❌ Error: ' + error.message)
    } else {
      setMessage(earlyMinutes > 0
        ? `⚠️ Check-out! Aap ${earlyMinutes} minute jaldi gaye.`
        : '✅ Check-out ho gaya!'
      )
      fetchTodayRecord()
      fetchAttendance()
    }
  }

  const formatTime = (ts) => {
    if (!ts) return '--:--'
    return new Date(ts).toLocaleTimeString('en-PK', {
      hour: '2-digit', minute: '2-digit'
    })
  }

  const statusColor = (s) => {
    const c = {
      present: '#10b981', late: '#f59e0b',
      absent: '#ef4444', half_day: '#8b5cf6', on_leave: '#3b82f6'
    }
    return c[s] || '#94a3b8'
  }

  const statusLabel = (s) => {
    const l = {
      present: '✅ Present', late: '⏰ Late',
      absent: '❌ Absent', half_day: '🌗 Half Day', on_leave: '🏖️ On Leave'
    }
    return l[s] || s
  }

  return (
    <div>
      {/* Today Check-in/out */}
      {selectedDate === today && (
        <div style={{
          background: '#1e293b', borderRadius: '16px',
          padding: '24px', marginBottom: '24px',
          border: '1px solid #334155'
        }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>
            🕐 Aaj Ki Attendance
          </h3>

          {message && (
            <div style={{
              background: message.includes('❌') ? '#7f1d1d'
                : message.includes('⚠️') ? '#78350f' : '#14532d',
              border: `1px solid ${message.includes('❌') ? '#ef4444'
                : message.includes('⚠️') ? '#f59e0b' : '#22c55e'}`,
              color: message.includes('❌') ? '#fca5a5'
                : message.includes('⚠️') ? '#fde68a' : '#86efac',
              padding: '10px 14px', borderRadius: '8px',
              marginBottom: '16px', fontSize: '13px'
            }}>
              {message}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: '14px', marginBottom: '20px'
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
                <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '6px' }}>
                  {card.label}
                </div>
                <div style={{ color: card.color, fontSize: '18px', fontWeight: 'bold' }}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleCheckIn}
              disabled={!!todayRecord?.check_in}
              style={{
                flex: 1, padding: '13px',
                background: todayRecord?.check_in
                  ? '#334155'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none', borderRadius: '10px',
                color: todayRecord?.check_in ? '#64748b' : 'white',
                cursor: todayRecord?.check_in ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: 'bold'
              }}
            >
              {todayRecord?.check_in ? '✅ Check-in Ho Gaya' : '🟢 Check In'}
            </button>
            <button
              onClick={handleCheckOut}
              disabled={!todayRecord?.check_in || !!todayRecord?.check_out}
              style={{
                flex: 1, padding: '13px',
                background: !todayRecord?.check_in || todayRecord?.check_out
                  ? '#334155'
                  : 'linear-gradient(135deg, #ef4444, #dc2626)',
                border: 'none', borderRadius: '10px',
                color: !todayRecord?.check_in || todayRecord?.check_out ? '#64748b' : 'white',
                cursor: !todayRecord?.check_in || todayRecord?.check_out ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: 'bold'
              }}
            >
              {todayRecord?.check_out ? '✅ Check-out Ho Gaya' : '🔴 Check Out'}
            </button>
          </div>
        </div>
      )}

      {/* Attendance List */}
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
          <input
            type="date" value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              padding: '8px 12px', background: '#0f172a',
              border: '1px solid #334155', borderRadius: '8px',
              color: 'white', fontSize: '13px', outline: 'none'
            }}
          />
        </div>

        {/* Stats — Admin Only */}
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
              { label: 'On Leave', color: '#3b82f6', status: 'on_leave' },
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

        {/* Table */}
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
                    <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>
                      Employee
                    </th>
                  )}
                  <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Check In</th>
                  <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Check Out</th>
                  <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Late</th>
                  <th style={{ color: '#94a3b8', textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid #334155' }}>Status</th>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
