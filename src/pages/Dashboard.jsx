import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Dashboard({ profile, setActiveTab }) {
  const [stats, setStats] = useState({
    totalTasks: 0, inProgressTasks: 0, doneTasks: 0, overdueTasks: 0,
    totalProjects: 0, presentToday: 0, totalEmployees: 0, pendingReviews: 0
  })
  const [recentTasks, setRecentTasks] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [activeTimers, setActiveTimers] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!profile) return
    fetchStats()

    const sub1 = supabase
      .channel(`dash-tasks-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchStats())
      .subscribe()

    const sub2 = supabase
      .channel(`dash-att-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => fetchStats())
      .subscribe()

    const sub3 = supabase
      .channel(`dash-timers-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_time_logs' }, () => fetchStats())
      .subscribe()

    return () => {
      sub1.unsubscribe()
      sub2.unsubscribe()
      sub3.unsubscribe()
    }
  }, [profile])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const [taskRes, attRes, empRes, timerRes, recentTaskRes, todayAttRes] = await Promise.all([
        supabase.from('tasks').select('id, status, due_date, title, priority, assigned_to, project, client_id, pipeline_percent, profiles!tasks_assigned_to_fkey(full_name), client:clients(name)'),
        supabase.from('attendance').select('status, profiles(full_name)').eq('date', today),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('task_time_logs').select('*, tasks(title), profiles(full_name)').is('end_time', null).limit(5),
        supabase.from('tasks')
          .select('*, profiles!tasks_assigned_to_fkey(full_name), client:clients(name)')
          .order('created_at', { ascending: false }).limit(6),
        supabase.from('attendance')
          .select('*, profiles(full_name)')
          .eq('date', today)
          .order('check_in', { ascending: false }).limit(6)
      ])

      const tasks = taskRes.data || []
      const now = new Date()
      const overdue = tasks.filter(t =>
        t.due_date && new Date(t.due_date) < now && t.status !== 'done'
      )
      const attendance = attRes.data || []

      setStats({
        totalTasks: tasks.length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        doneTasks: tasks.filter(t => t.status === 'done').length,
        overdueTasks: overdue.length,
        pendingReviews: tasks.filter(t => t.status === 'review').length,
        presentToday: attendance.filter(a => a.status === 'present').length,
        totalEmployees: empRes.count || 0,
        completionRate: tasks.length > 0
          ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100)
          : 0
      })

      setActiveTimers(timerRes.data || [])
      setRecentTasks(recentTaskRes.data || [])
      setTodayAttendance(todayAttRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const priorityColor = (p) => ({
    urgent: '#d71920', high: '#d97706', medium: '#2563eb', low: '#16a34a'
  }[p] || '#888')

  const statusColor = (s) => ({
    present: '#16a34a', late: '#d97706', absent: '#d71920', on_leave: '#2563eb'
  }[s] || '#888')

  const statusLabel = (s) => ({
    present: 'Present', late: 'Late', absent: 'Absent', on_leave: 'On Leave'
  }[s] || s)

  const taskStatusColor = (s) => ({
    todo: '#888', in_progress: '#2563eb', review: '#d97706', done: '#16a34a'
  }[s] || '#888')

  const taskStatusLabel = (s) => ({
    todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done'
  }[s] || s)

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="skeleton" style={{ height: '90px', borderRadius: '12px' }} />
        ))}
      </div>
    </div>
  )

  const statCards = [
    { icon: '✦', label: 'Total Tasks', value: stats.totalTasks, color: '#7c3aed', tab: 'tasks', sub: 'All tasks' },
    { icon: '🔄', label: 'In Progress', value: stats.inProgressTasks, color: '#2563eb', tab: 'tasks', sub: 'Active work' },
    { icon: '👀', label: 'In Review', value: stats.pendingReviews, color: '#d97706', tab: 'tasks', sub: 'Needs review' },
    { icon: '✅', label: 'Completed', value: stats.doneTasks, color: '#16a34a', tab: 'tasks', sub: `${stats.completionRate}% rate` },
    { icon: '⚠️', label: 'Overdue', value: stats.overdueTasks, color: '#d71920', tab: 'tasks', sub: 'Past deadline' },
    { icon: '📅', label: 'Present Today', value: `${stats.presentToday}/${stats.totalEmployees}`, color: '#0891b2', tab: 'attendance', sub: 'Attendance' },
  ]

  return (
    <div className="fade-in">
      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
        gap: '12px', marginBottom: '24px'
      }}>
        {statCards.map(card => (
          <div key={card.label} className="stat-card" onClick={() => setActiveTab(card.tab)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: `${card.color}12`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '18px'
              }}>{card.icon}</div>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 12L12 2M12 2H5M12 2V9" stroke={card.color} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div style={{ color: card.color, fontSize: '26px', fontWeight: '800', marginBottom: '4px', lineHeight: 1 }}>
              {card.value}
            </div>
            <div style={{ color: '#333', fontSize: '13px', fontWeight: '600', marginBottom: '2px' }}>{card.label}</div>
            <div style={{ color: '#aaa', fontSize: '11px' }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Active Timers Banner */}
      {activeTimers.length > 0 && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '16px 20px',
          marginBottom: '20px', border: '1px solid #e5e5e5',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16a34a', animation: 'pulse 1s infinite' }} />
            <span style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>
              Live Timers — {activeTimers.length} running
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {activeTimers.map(timer => (
              <div key={timer.id} style={{
                background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)',
                borderRadius: '8px', padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>
                  {timer.profiles?.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: '#111', fontSize: '12px', fontWeight: '600' }}>
                    {timer.profiles?.full_name?.split(' ')[0]}
                  </div>
                  <div style={{ color: '#888', fontSize: '11px' }}>
                    {timer.tasks?.title?.substring(0, 30)}...
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px', marginBottom: '16px' }}>

        {/* Recent Tasks */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d71920', fontSize: '16px' }}>✦</span>
              <span style={{ color: '#111', fontWeight: '700', fontSize: '15px' }}>Recent Tasks</span>
            </div>
            <button onClick={() => setActiveTab('tasks')} style={{
              background: 'transparent', border: 'none',
              color: '#d71920', cursor: 'pointer', fontSize: '12px', fontWeight: '700'
            }}>View All →</button>
          </div>

          {recentTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-icon" style={{ fontSize: '28px' }}>✦</div>
              <div className="empty-desc">No tasks yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentTasks.map(task => (
                <div key={task.id} style={{
                  padding: '10px 12px', borderRadius: '8px',
                  background: '#f9f9f9', border: '1px solid #f0f0f0',
                  borderLeft: `3px solid ${priorityColor(task.priority)}`,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
                  onClick={() => setActiveTab('tasks')}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background = '#f9f9f9'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{
                      color: '#111', fontSize: '13px', fontWeight: '700',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      flex: 1, marginRight: '8px'
                    }}>{task.title}</div>
                    <span style={{
                      background: `${taskStatusColor(task.status)}12`,
                      color: taskStatusColor(task.status),
                      padding: '2px 8px', borderRadius: '20px',
                      fontSize: '10px', fontWeight: '700', flexShrink: 0
                    }}>
                      {taskStatusLabel(task.status)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {task.client && (
                      <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '600' }}>
                        👤 {task.client.name}
                      </span>
                    )}
                    {task.profiles?.full_name && (
                      <span style={{ color: '#888', fontSize: '11px' }}>
                        · {task.profiles.full_name}
                      </span>
                    )}
                    {task.pipeline_percent > 0 && (
                      <span style={{ color: '#aaa', fontSize: '11px', marginLeft: 'auto' }}>
                        {task.pipeline_percent}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's Attendance */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#d71920', fontSize: '16px' }}>◷</span>
              <span style={{ color: '#111', fontWeight: '700', fontSize: '15px' }}>Today's Attendance</span>
            </div>
            <button onClick={() => setActiveTab('attendance')} style={{
              background: 'transparent', border: 'none',
              color: '#d71920', cursor: 'pointer', fontSize: '12px', fontWeight: '700'
            }}>View All →</button>
          </div>

          {todayAttendance.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div className="empty-icon" style={{ fontSize: '28px' }}>◷</div>
              <div className="empty-desc">No check-ins yet today</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {todayAttendance.map(att => (
                <div key={att.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px', borderRadius: '8px', background: '#f9f9f9',
                  border: '1px solid #f0f0f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar avatar-sm">
                      {att.profiles?.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>
                        {att.profiles?.full_name}
                      </div>
                      <div style={{ color: '#aaa', fontSize: '11px' }}>
                        {att.check_in
                          ? new Date(att.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                          : '--:--'}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    background: `${statusColor(att.status)}12`,
                    color: statusColor(att.status),
                    padding: '3px 10px', borderRadius: '20px',
                    fontSize: '11px', fontWeight: '700'
                  }}>
                    {statusLabel(att.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions — Work Only */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <span style={{ color: '#d71920', fontSize: '16px' }}>⚡</span>
          <span style={{ color: '#111', fontWeight: '700', fontSize: '15px' }}>Quick Actions</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
          {[
            { icon: '✦', label: 'Create Task', tab: 'tasks', color: '#7c3aed' },
            { icon: '📁', label: 'Projects', tab: 'projects', color: '#2563eb' },
            { icon: '💬', label: 'Messages', tab: 'messages', color: '#0891b2' },
            { icon: '⏱', label: 'Time Logs', tab: 'timetracking', color: '#16a34a' },
            { icon: '👤', label: 'Client Time', tab: 'clienttime', color: '#d71920' },
            { icon: '◷', label: 'Attendance', tab: 'attendance', color: '#d97706' },
          ].map(action => (
            <button key={action.label} onClick={() => setActiveTab(action.tab)} style={{
              background: `${action.color}08`,
              border: `1px solid ${action.color}20`,
              borderRadius: '12px', padding: '16px 12px',
              color: '#111', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600', textAlign: 'center',
              transition: 'all 0.2s'
            }}
              onMouseEnter={e => {
                e.currentTarget.style.background = `${action.color}15`
                e.currentTarget.style.borderColor = `${action.color}40`
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = `0 4px 12px ${action.color}20`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = `${action.color}08`
                e.currentTarget.style.borderColor = `${action.color}20`
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: '24px', marginBottom: '8px', color: action.color }}>
                {action.icon}
              </div>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
