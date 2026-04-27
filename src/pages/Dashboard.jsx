import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Dashboard({ profile, setActiveTab }) {
  const [stats, setStats] = useState({
    totalEmployees: 0, presentToday: 0, lateToday: 0, absentToday: 0,
    pendingTasks: 0, inProgressTasks: 0, pendingLeaves: 0, thisMonthPayroll: 0
  })
  const [recentTasks, setRecentTasks] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!profile) return
    fetchStats()

    // ⚡ REALTIME
    const sub1 = supabase
      .channel(`dash-att-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchStats())
      .subscribe()

    const sub2 = supabase
      .channel(`dash-tasks-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchStats())
      .subscribe()

    const sub3 = supabase
      .channel(`dash-leaves-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, () => fetchStats())
      .subscribe()

    return () => {
      sub1.unsubscribe()
      sub2.unsubscribe()
      sub3.unsubscribe()
    }
  }, [profile])

  const fetchStats = async () => {
    setLoading(true)
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()

    const [empRes, attRes, taskRes, leaveRes, payrollRes, recentTaskRes, todayAttRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('attendance').select('status').eq('date', today),
      supabase.from('tasks').select('id, status'),
      supabase.from('leave_requests').select('id', { count: 'exact' }).eq('status', 'pending'),
      supabase.from('payroll').select('net_salary').eq('month', currentMonth).eq('year', currentYear),
      supabase.from('tasks')
        .select('*, profiles!tasks_assigned_to_fkey(full_name)')
        .order('created_at', { ascending: false }).limit(5),
      supabase.from('attendance')
        .select('*, profiles(full_name)')
        .eq('date', today)
        .order('check_in', { ascending: false }).limit(8)
    ])

    const attendance = attRes.data || []
    const totalPayroll = payrollRes.data?.reduce((sum, p) => sum + (p.net_salary || 0), 0) || 0
    const tasks = taskRes.data || []

    setStats({
      totalEmployees: empRes.count || 0,
      presentToday: attendance.filter(a => a.status === 'present').length,
      lateToday: attendance.filter(a => a.status === 'late').length,
      absentToday: attendance.filter(a => a.status === 'absent').length,
      pendingTasks: tasks.filter(t => t.status === 'todo').length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      pendingLeaves: leaveRes.count || 0,
      thisMonthPayroll: totalPayroll
    })

    setRecentTasks(recentTaskRes.data || [])
    setTodayAttendance(todayAttRes.data || [])
    setLoading(false)
  }

  const priorityColor = (p) => ({ low: '#10b981', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }[p] || '#94a3b8')
  const statusColor = (s) => ({ present: '#10b981', late: '#f59e0b', absent: '#ef4444', on_leave: '#3b82f6' }[s] || '#94a3b8')
  const statusLabel = (s) => ({ present: 'Present', late: 'Late', absent: 'Absent', on_leave: 'On Leave' }[s] || s)
  const taskStatusColor = (s) => ({ todo: '#94a3b8', in_progress: '#3b82f6', review: '#f59e0b', done: '#10b981' }[s] || '#94a3b8')
  const taskStatusLabel = (s) => ({ todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done' }[s] || s)

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />)}
    </div>
  )

  const statCards = [
    { icon: '👥', label: 'Total Employees', value: stats.totalEmployees, color: '#3b82f6', tab: 'employees', trend: 'Active employees' },
    { icon: '✅', label: 'Present Today', value: stats.presentToday, color: '#10b981', tab: 'attendance', trend: `${Math.round((stats.presentToday / Math.max(stats.totalEmployees, 1)) * 100)}% attendance` },
    { icon: '⏰', label: 'Late Today', value: stats.lateToday, color: '#f59e0b', tab: 'attendance', trend: 'Check details' },
    { icon: '❌', label: 'Absent Today', value: stats.absentToday, color: '#ef4444', tab: 'attendance', trend: 'Mark attendance' },
    { icon: '📋', label: 'Pending Tasks', value: stats.pendingTasks, color: '#8b5cf6', tab: 'tasks', trend: 'Needs assignment' },
    { icon: '🔄', label: 'In Progress', value: stats.inProgressTasks, color: '#06b6d4', tab: 'tasks', trend: 'Active work' },
    { icon: '🏖️', label: 'Pending Leaves', value: stats.pendingLeaves, color: '#f97316', tab: 'attendance', trend: 'Needs approval' },
    { icon: '💰', label: 'Month Payroll', value: `PKR ${stats.thisMonthPayroll.toLocaleString()}`, color: '#10b981', tab: 'payroll', trend: 'This month total' },
  ]

  return (
    <div className="fade-in">
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0d1f3c 0%, #1a1040 50%, #0d1f3c 100%)',
        borderRadius: '16px', padding: '28px 32px', marginBottom: '24px',
        border: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: '16px',
        position: 'relative', overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute', top: '-40px', right: '10%',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '28px' }}>👋</span>
            <h2 style={{ color: 'white', margin: 0, fontSize: '24px', fontWeight: '700' }}>
              Welcome back, {profile?.full_name?.split(' ')[0]}!
            </h2>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '14px' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
          padding: '14px 20px', textAlign: 'center',
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your Role</div>
          <div style={{ color: 'white', fontWeight: '700', fontSize: '16px', textTransform: 'capitalize' }}>{profile?.role}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        {statCards.map(card => (
          <div key={card.label} className="stat-card" onClick={() => setActiveTab(card.tab)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: `${card.color}18`, display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '18px'
              }}>{card.icon}</div>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 12L12 2M12 2H5M12 2V9" stroke={card.color} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ color: card.color, fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>{card.value}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', marginBottom: '4px' }}>{card.label}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{card.trend}</div>
          </div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Today's Attendance */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>📅</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>Today's Attendance</span>
            </div>
            <button onClick={() => setActiveTab('attendance')} style={{
              background: 'transparent', border: 'none', color: 'var(--accent-blue)',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600'
            }}>View All →</button>
          </div>
          {todayAttendance.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <span className="empty-icon" style={{ fontSize: '32px' }}>📅</span>
              <span className="empty-desc">No attendance records yet today</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayAttendance.map(att => (
                <div key={att.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-hover)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar avatar-sm">{att.profiles?.full_name?.charAt(0).toUpperCase()}</div>
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>{att.profiles?.full_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {att.check_in ? new Date(att.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                      </div>
                    </div>
                  </div>
                  <span className="badge" style={{ background: `${statusColor(att.status)}18`, color: statusColor(att.status) }}>
                    {statusLabel(att.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>✅</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>Recent Tasks</span>
            </div>
            <button onClick={() => setActiveTab('tasks')} style={{
              background: 'transparent', border: 'none', color: 'var(--accent-blue)',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600'
            }}>View All →</button>
          </div>
          {recentTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 20px' }}>
              <span className="empty-icon" style={{ fontSize: '32px' }}>✅</span>
              <span className="empty-desc">No tasks yet. Create your first task!</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentTasks.map(task => (
                <div key={task.id} style={{
                  padding: '10px 12px', borderRadius: '8px',
                  background: 'var(--bg-hover)',
                  borderLeft: `3px solid ${priorityColor(task.priority)}`
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{
                      color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      flex: 1, marginRight: '8px'
                    }}>{task.title}</div>
                    <span className="badge" style={{
                      background: `${taskStatusColor(task.status)}18`,
                      color: taskStatusColor(task.status), flexShrink: 0
                    }}>{taskStatusLabel(task.status)}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                    <span>👤 {task.profiles?.full_name || 'Unassigned'}</span>
                    {task.due_date && <span>· 📅 {new Date(task.due_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span>⚡</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>Quick Actions</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          {[
            { icon: '👤', label: 'Add Employee', tab: 'employees', color: '#3b82f6' },
            { icon: '✅', label: 'Create Task', tab: 'tasks', color: '#8b5cf6' },
            { icon: '📅', label: 'Attendance', tab: 'attendance', color: '#10b981' },
            { icon: '💰', label: 'Payroll', tab: 'payroll', color: '#f59e0b' },
            { icon: '💬', label: 'Messages', tab: 'messages', color: '#06b6d4' },
            { icon: '⚙️', label: 'Settings', tab: 'settings', color: '#94a3b8' },
          ].map(action => (
            <button key={action.label} onClick={() => setActiveTab(action.tab)} style={{
              background: `${action.color}0d`, border: `1px solid ${action.color}25`,
              borderRadius: '10px', padding: '16px 12px',
              color: 'var(--text-primary)', cursor: 'pointer',
              fontSize: '13px', fontWeight: '500', textAlign: 'center', transition: 'all 0.2s'
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${action.color}18`
                e.currentTarget.style.borderColor = `${action.color}50`
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${action.color}0d`
                e.currentTarget.style.borderColor = `${action.color}25`
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>{action.icon}</div>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
