import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Dashboard({ profile, setActiveTab }) {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    lateToday: 0,
    absentToday: 0,
    pendingTasks: 0,
    inProgressTasks: 0,
    pendingLeaves: 0,
    thisMonthPayroll: 0
  })
  const [recentTasks, setRecentTasks] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (profile) fetchStats()
  }, [profile])

  const fetchStats = async () => {
    setLoading(true)
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const [empRes, attRes, taskRes, leaveRes, payrollRes, recentTaskRes, todayAttRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('attendance').select('status').eq('date', today),
      supabase.from('tasks').select('id, status', { count: 'exact' }).in('status', ['todo', 'in_progress']),
      supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('payroll').select('net_salary').eq('month', currentMonth).eq('year', currentYear),
      supabase.from('tasks').select('*, profiles!tasks_assigned_to_fkey(full_name)').order('created_at', { ascending: false }).limit(5),
      supabase.from('attendance').select('*, profiles(full_name)').eq('date', today).order('check_in', { ascending: false }).limit(8)
    ])

    const attendance = attRes.data || []
    const totalPayroll = payrollRes.data?.reduce((sum, p) => sum + (p.net_salary || 0), 0) || 0

    setStats({
      totalEmployees: empRes.count || 0,
      presentToday: attendance.filter(a => a.status === 'present').length,
      lateToday: attendance.filter(a => a.status === 'late').length,
      absentToday: attendance.filter(a => a.status === 'absent').length,
      pendingTasks: taskRes.data?.filter(t => t.status === 'todo').length || 0,
      inProgressTasks: taskRes.data?.filter(t => t.status === 'in_progress').length || 0,
      pendingLeaves: leaveRes.count || 0,
      thisMonthPayroll: totalPayroll
    })

    setRecentTasks(recentTaskRes.data || [])
    setTodayAttendance(todayAttRes.data || [])
    setLoading(false)
  }

  const priorityColor = (p) => {
    const c = { low: '#10b981', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }
    return c[p] || '#94a3b8'
  }

  const statusColor = (s) => {
    const c = { present: '#10b981', late: '#f59e0b', absent: '#ef4444', on_leave: '#3b82f6' }
    return c[s] || '#94a3b8'
  }

  const statusLabel = (s) => {
    const l = { present: '✅ Present', late: '⏰ Late', absent: '❌ Absent', on_leave: '🏖️ Leave' }
    return l[s] || s
  }

  if (loading) return (
    <div style={{ color: '#94a3b8', textAlign: 'center', padding: '60px', fontSize: '16px' }}>
      Loading...
    </div>
  )

  return (
    <div>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f, #312e81)',
        borderRadius: '16px', padding: '28px',
        marginBottom: '24px', border: '1px solid #334155',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '16px'
      }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 8px', fontSize: '24px' }}>
            👋 Welcome back, {profile?.full_name}!
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
            {new Date().toLocaleDateString('en-PK', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        </div>
        <div style={{
          background: '#0f172a', borderRadius: '12px',
          padding: '12px 20px', textAlign: 'center'
        }}>
          <div style={{ color: '#3b82f6', fontSize: '11px', marginBottom: '4px' }}>YOUR ROLE</div>
          <div style={{ color: 'white', fontWeight: 'bold', textTransform: 'capitalize', fontSize: '16px' }}>
            {profile?.role}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '14px', marginBottom: '24px'
      }}>
        {[
          { icon: '👥', label: 'Total Employees', value: stats.totalEmployees, color: '#3b82f6', tab: 'employees' },
          { icon: '✅', label: 'Present Today', value: stats.presentToday, color: '#10b981', tab: 'attendance' },
          { icon: '⏰', label: 'Late Today', value: stats.lateToday, color: '#f59e0b', tab: 'attendance' },
          { icon: '❌', label: 'Absent Today', value: stats.absentToday, color: '#ef4444', tab: 'attendance' },
          { icon: '📋', label: 'Pending Tasks', value: stats.pendingTasks, color: '#8b5cf6', tab: 'tasks' },
          { icon: '🔄', label: 'In Progress', value: stats.inProgressTasks, color: '#06b6d4', tab: 'tasks' },
          { icon: '🏖️', label: 'Pending Leaves', value: stats.pendingLeaves, color: '#f97316', tab: 'attendance' },
          { icon: '💰', label: 'Month Payroll', value: `PKR ${stats.thisMonthPayroll.toLocaleString()}`, color: '#10b981', tab: 'payroll' },
        ].map(card => (
          <div
            key={card.label}
            onClick={() => setActiveTab(card.tab)}
            style={{
              background: '#1e293b', borderRadius: '12px',
              padding: '18px', border: `1px solid ${card.color}33`,
              cursor: 'pointer', transition: 'transform 0.2s'
            }}
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>{card.icon}</div>
            <div style={{ color: card.color, fontSize: '22px', fontWeight: 'bold', marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Bottom 2 Sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px'
      }}>
        {/* Today's Attendance */}
        <div style={{
          background: '#1e293b', borderRadius: '12px',
          padding: '20px', border: '1px solid #334155'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '16px'
          }}>
            <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>
              📅 Aaj Ki Attendance
            </h3>
            <button
              onClick={() => setActiveTab('attendance')}
              style={{
                background: 'transparent', border: 'none',
                color: '#3b82f6', cursor: 'pointer', fontSize: '12px'
              }}
            >
              Sab Dekho →
            </button>
          </div>

          {todayAttendance.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
              Aaj koi attendance nahi
            </div>
          ) : (
            todayAttendance.map(att => (
              <div key={att.id} style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '10px 0',
                borderBottom: '1px solid #334155'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: '13px', fontWeight: 'bold'
                  }}>
                    {att.profiles?.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
                      {att.profiles?.full_name}
                    </div>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                      {att.check_in ? new Date(att.check_in).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </div>
                  </div>
                </div>
                <span style={{
                  background: statusColor(att.status) + '22',
                  color: statusColor(att.status),
                  padding: '3px 10px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: 'bold'
                }}>
                  {statusLabel(att.status)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Recent Tasks */}
        <div style={{
          background: '#1e293b', borderRadius: '12px',
          padding: '20px', border: '1px solid #334155'
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginBottom: '16px'
          }}>
            <h3 style={{ color: 'white', margin: 0, fontSize: '16px' }}>
              ✅ Recent Tasks
            </h3>
            <button
              onClick={() => setActiveTab('tasks')}
              style={{
                background: 'transparent', border: 'none',
                color: '#3b82f6', cursor: 'pointer', fontSize: '12px'
              }}
            >
              Sab Dekho →
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '20px', fontSize: '13px' }}>
              Koi task nahi
            </div>
          ) : (
            recentTasks.map(task => (
              <div key={task.id} style={{
                padding: '10px 0', borderBottom: '1px solid #334155'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
                    {task.title}
                  </div>
                  <span style={{
                    background: priorityColor(task.priority) + '22',
                    color: priorityColor(task.priority),
                    padding: '1px 8px', borderRadius: '20px',
                    fontSize: '10px', fontWeight: 'bold'
                  }}>
                    {task.priority}
                  </span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                  👤 {task.profiles?.full_name || 'Unassigned'} •{' '}
                  {task.due_date ? `📅 ${new Date(task.due_date).toLocaleDateString()}` : 'No deadline'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{
        background: '#1e293b', borderRadius: '12px',
        padding: '20px', border: '1px solid #334155',
        marginTop: '20px'
      }}>
        <h3 style={{ color: 'white', margin: '0 0 16px', fontSize: '16px' }}>
          ⚡ Quick Actions
        </h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px'
        }}>
          {[
            { icon: '👤', label: 'Employee Add', tab: 'employees' },
            { icon: '📋', label: 'Task Assign', tab: 'tasks' },
            { icon: '📅', label: 'Attendance', tab: 'attendance' },
            { icon: '💰', label: 'Payroll', tab: 'payroll' },
            { icon: '💬', label: 'Messages', tab: 'messages' },
            { icon: '⚙️', label: 'Settings', tab: 'settings' },
          ].map(action => (
            <button
              key={action.label}
              onClick={() => setActiveTab(action.tab)}
              style={{
                background: '#0f172a', border: '1px solid #334155',
                borderRadius: '10px', padding: '16px',
                color: 'white', cursor: 'pointer',
                fontSize: '13px', textAlign: 'center',
                transition: 'border-color 0.2s'
              }}
            >
              <div style={{ fontSize: '26px', marginBottom: '8px' }}>{action.icon}</div>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
