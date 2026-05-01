import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

function CountUp({ end, duration = 800 }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (end === 0) { setCount(0); return }
    const start = Date.now()
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [end])
  return <span>{count}</span>
}

export default function Dashboard({ profile, setActiveTab }) {
  const [stats, setStats] = useState({
    totalTasks: 0, inProgress: 0, inReview: 0, done: 0, overdue: 0
  })
  const [recentTasks, setRecentTasks] = useState([])
  const [liveTimers, setLiveTimers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchDashboard()

    const sub = supabase.channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchDashboard)
      .subscribe()
    return () => sub.unsubscribe()
  }, [profile])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      let taskQuery = supabase.from('tasks')
        .select('*, assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name)')
        .eq('is_archived', false)

      if (!isAdmin && !isManager) {
        taskQuery = taskQuery.eq('assigned_to', profile.id)
      }

      const [tasksRes, timersRes, announcementsRes] = await Promise.all([
        taskQuery.order('created_at', { ascending: false }),
        supabase.from('task_time_logs').select('*, tasks(title), profiles(full_name)').is('end_time', null).limit(5),
        supabase.from('announcements').select('*, profiles(full_name)').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
      ])

      const tasks = tasksRes.data || []
      const today = new Date()

      setStats({
        totalTasks: tasks.length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        inReview: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done').length,
      })

      setRecentTasks(tasks.slice(0, 8))
      setLiveTimers(timersRes.data || [])
      setAnnouncements(announcementsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const STAT_CARDS = [
    { label: 'Total Tasks', value: stats.totalTasks, color: '#7c3aed', icon: '✦', bg: 'rgba(124,58,237,0.08)', desc: 'All tasks', tab: 'tasks' },
    { label: 'In Progress', value: stats.inProgress, color: '#2563eb', icon: '🔄', bg: 'rgba(37,99,235,0.08)', desc: 'Active work', tab: 'tasks' },
    { label: 'In Review', value: stats.inReview, color: '#d97706', icon: '👀', bg: 'rgba(217,119,6,0.08)', desc: 'Needs review', tab: 'tasks' },
    { label: 'Completed', value: stats.done, color: '#16a34a', icon: '✅', bg: 'rgba(22,163,74,0.08)', desc: `${stats.totalTasks > 0 ? Math.round((stats.done / stats.totalTasks) * 100) : 0}% rate`, tab: 'tasks' },
    { label: 'Overdue', value: stats.overdue, color: '#d71920', icon: '⚠️', bg: 'rgba(215,25,32,0.08)', desc: 'Past deadline', tab: 'tasks' },
  ]

  const statusConfig = {
    todo: { color: '#888', bg: 'rgba(136,136,136,0.1)', label: 'To Do' },
    in_progress: { color: '#2563eb', bg: 'rgba(37,99,235,0.1)', label: 'In Progress' },
    review: { color: '#d97706', bg: 'rgba(217,119,6,0.1)', label: 'In Review' },
    done: { color: '#16a34a', bg: 'rgba(22,163,74,0.1)', label: 'Done' },
  }

  const priorityConfig = {
    low: '#16a34a', medium: '#2563eb', high: '#d97706', urgent: '#d71920'
  }

  const typeColor = { info: '#2563eb', warning: '#d97706', success: '#16a34a', urgent: '#d71920' }
  const typeIcon = { info: 'ℹ️', warning: '⚠️', success: '✅', urgent: '🚨' }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[1,2,3,4,5].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '14px' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
        <div className="skeleton" style={{ height: '300px', borderRadius: '14px' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: '14px' }} />
      </div>
    </div>
  )

  return (
    <div className="fade-in">

      {/* Live Timers Banner */}
      {liveTimers.length > 0 && (
        <div style={{
          background: 'rgba(215,25,32,0.06)', border: '1px solid rgba(215,25,32,0.15)',
          borderRadius: '12px', padding: '10px 16px', marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap'
        }}>
          <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="animate-pulse">⏱</span> LIVE
          </span>
          {liveTimers.map(t => (
            <span key={t.id} style={{ background: 'rgba(215,25,32,0.08)', color: '#d71920', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
              {t.profiles?.full_name} → {t.tasks?.title}
            </span>
          ))}
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {STAT_CARDS.map((stat, i) => (
          <div key={stat.label}
            className="stat-card card-3d"
            onClick={() => setActiveTab(stat.tab)}
            style={{ animation: `fadeIn 0.35s ease ${i * 0.05}s both` }}
          >
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: stat.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '20px', marginBottom: '12px'
            }}>
              {stat.icon}
            </div>
            <div style={{ color: stat.color, fontSize: '30px', fontWeight: '800', lineHeight: 1, marginBottom: '4px' }}>
              <CountUp end={stat.value} />
            </div>
            <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>{stat.label}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{stat.desc}</div>
            <div style={{ position: 'absolute', top: '16px', right: '16px', color: stat.color, fontSize: '13px', opacity: 0.5 }}>↗</div>
          </div>
        ))}
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

        {/* Recent Tasks */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>✦ Recent Tasks</div>
            <button onClick={() => setActiveTab('tasks')} style={{
              background: 'none', border: 'none', color: '#d71920',
              cursor: 'pointer', fontSize: '13px', fontWeight: '700'
            }}>View All →</button>
          </div>

          {recentTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px' }}>
              <div className="empty-icon">✦</div>
              <div className="empty-desc">No tasks yet</div>
            </div>
          ) : (
            <div>
              {recentTasks.map((task, i) => {
                const status = statusConfig[task.status] || statusConfig.todo
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                return (
                  <div key={task.id}
                    onClick={() => setActiveTab('tasks')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '11px 20px', cursor: 'pointer',
                      borderBottom: i < recentTasks.length - 1 ? '1px solid var(--border-light)' : 'none',
                      borderLeft: `3px solid ${priorityConfig[task.priority] || '#888'}`,
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '3px', alignItems: 'center' }}>
                        {task.project && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>📁 {task.project}</span>}
                        {task.assigned_to_profile && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>👤 {task.assigned_to_profile.full_name}</span>}
                        {isOverdue && <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>⚠️ Overdue</span>}
                      </div>
                    </div>
                    <span className="badge" style={{ background: status.bg, color: status.color, flexShrink: 0 }}>
                      {status.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Announcements */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>📢 Announcements</div>
            <button onClick={() => setActiveTab('announcements')} style={{
              background: 'none', border: 'none', color: '#d71920',
              cursor: 'pointer', fontSize: '13px', fontWeight: '700'
            }}>All →</button>
          </div>

          {announcements.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px' }}>
              <div className="empty-icon" style={{ fontSize: '32px' }}>📢</div>
              <div className="empty-desc" style={{ fontSize: '12px' }}>No announcements</div>
            </div>
          ) : (
            <div>
              {announcements.map((ann, i) => (
                <div key={ann.id} style={{
                  padding: '14px 20px',
                  borderBottom: i < announcements.length - 1 ? '1px solid var(--border-light)' : 'none',
                  borderLeft: `3px solid ${typeColor[ann.type] || '#888'}`
                }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '15px', flexShrink: 0 }}>{typeIcon[ann.type] || 'ℹ️'}</span>
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', marginBottom: '3px' }}>{ann.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {ann.body}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '4px' }}>
                        {ann.profiles?.full_name} · {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
