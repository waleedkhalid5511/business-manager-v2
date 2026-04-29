import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

function CountUp({ end, duration = 1000 }) {
  const [count, setCount] = useState(0)
  const startRef = useRef(null)

  useEffect(() => {
    if (end === 0) { setCount(0); return }
    const start = Date.now()
    startRef.current = start
    const step = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * end))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [end, duration])

  return <span>{count}</span>
}

export default function Dashboard({ profile, setActiveTab }) {
  const [stats, setStats] = useState({
    totalTasks: 0, inProgress: 0, inReview: 0,
    done: 0, overdue: 0, presentToday: 0, totalEmployees: 0
  })
  const [recentTasks, setRecentTasks] = useState([])
  const [liveTimers, setLiveTimers] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchDashboard()
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [profile])

  const fetchDashboard = async () => {
    setLoading(true)
    try {
      let taskQuery = supabase.from('tasks')
        .select(`*, assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name)`)
        .eq('is_archived', false)

      if (!isAdmin && !isManager) {
        taskQuery = taskQuery.eq('assigned_to', profile.id)
      }

      const [tasksRes, attendanceRes, timersRes, announcementsRes] = await Promise.all([
        taskQuery.order('created_at', { ascending: false }),
        supabase.from('attendance').select('*').eq('date', new Date().toISOString().split('T')[0]),
        supabase.from('task_time_logs').select('*, tasks(title), profiles(full_name)').is('end_time', null).limit(5),
        supabase.from('announcements').select('*, profiles(full_name)').eq('is_active', true).order('created_at', { ascending: false }).limit(3),
      ])

      const tasks = tasksRes.data || []
      const attendance = attendanceRes.data || []
      const today = new Date()

      setStats({
        totalTasks: tasks.length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        inReview: tasks.filter(t => t.status === 'review').length,
        done: tasks.filter(t => t.status === 'done').length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < today && t.status !== 'done').length,
        presentToday: attendance.filter(a => ['present', 'late'].includes(a.status)).length,
        totalEmployees: isAdmin ? attendance.length : 0,
      })

      setRecentTasks(tasks.slice(0, 6))
      setLiveTimers(timersRes.data || [])
      setAnnouncements(announcementsRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const greeting = () => {
    const h = currentTime.getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const STAT_CARDS = [
    { label: 'Total Tasks', value: stats.totalTasks, color: '#7c3aed', icon: '✦', bg: 'rgba(124,58,237,0.08)', tab: 'tasks', desc: 'All tasks' },
    { label: 'In Progress', value: stats.inProgress, color: '#2563eb', icon: '🔄', bg: 'rgba(37,99,235,0.08)', tab: 'tasks', desc: 'Active work' },
    { label: 'In Review', value: stats.inReview, color: '#d97706', icon: '👀', bg: 'rgba(217,119,6,0.08)', tab: 'tasks', desc: 'Needs review' },
    { label: 'Completed', value: stats.done, color: '#16a34a', icon: '✅', bg: 'rgba(22,163,74,0.08)', tab: 'tasks', desc: `${stats.totalTasks > 0 ? Math.round((stats.done / stats.totalTasks) * 100) : 0}% rate` },
    { label: 'Overdue', value: stats.overdue, color: '#d71920', icon: '⚠️', bg: 'rgba(215,25,32,0.08)', tab: 'tasks', desc: 'Past deadline' },
    { label: 'Present Today', value: stats.presentToday, color: '#0891b2', icon: '📅', bg: 'rgba(8,145,178,0.08)', tab: 'attendance', desc: 'Attendance' },
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

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="skeleton" style={{ height: '80px', borderRadius: '16px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '14px' }} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="skeleton" style={{ height: '300px', borderRadius: '14px' }} />
        <div className="skeleton" style={{ height: '300px', borderRadius: '14px' }} />
      </div>
    </div>
  )

  return (
    <div className="fade-in">

      {/* ===== GREETING HERO ===== */}
      <div style={{
        background: 'linear-gradient(135deg, #d71920 0%, #8b0000 100%)',
        borderRadius: '20px',
        padding: '28px 32px',
        marginBottom: '20px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(215,25,32,0.3)'
      }}>
        {/* Background decoration */}
        <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '40%', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: '600', letterSpacing: '0.05em', marginBottom: '6px' }}>
              {greeting()} 👋
            </div>
            <h1 style={{ color: 'white', margin: '0 0 6px', fontSize: '26px', fontWeight: '800', letterSpacing: '-0.5px' }}>
              {profile?.full_name}
            </h1>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', textTransform: 'capitalize' }}>
              {profile?.role?.replace('_', ' ')} · Klipscen Management
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'white', fontSize: '32px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px' }}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginTop: '4px' }}>
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Completion Progress */}
        {stats.totalTasks > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', fontWeight: '600' }}>Overall Progress</span>
              <span style={{ color: 'white', fontSize: '13px', fontWeight: '800' }}>
                {Math.round((stats.done / stats.totalTasks) * 100)}%
              </span>
            </div>
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '99px',
                background: 'rgba(255,255,255,0.9)',
                width: `${Math.round((stats.done / stats.totalTasks) * 100)}%`,
                transition: 'width 1s cubic-bezier(0.4,0,0.2,1)'
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ===== LIVE TIMERS BANNER ===== */}
      {liveTimers.length > 0 && (
        <div style={{
          background: 'rgba(215,25,32,0.06)',
          border: '1px solid rgba(215,25,32,0.2)',
          borderRadius: '12px', padding: '12px 16px',
          marginBottom: '16px', display: 'flex',
          alignItems: 'center', gap: '12px', flexWrap: 'wrap'
        }}>
          <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '800', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ animation: 'pulse 1s infinite', display: 'inline-block' }}>⏱</span>
            LIVE TIMERS
          </span>
          {liveTimers.map(t => (
            <span key={t.id} style={{ background: 'rgba(215,25,32,0.1)', color: '#d71920', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
              {t.profiles?.full_name} → {t.tasks?.title}
            </span>
          ))}
        </div>
      )}

      {/* ===== STAT CARDS ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {STAT_CARDS.map((stat, i) => (
          <div key={stat.label}
            className="stat-card card-3d"
            onClick={() => setActiveTab(stat.tab)}
            style={{
              animationDelay: `${i * 0.06}s`,
              animation: `fadeIn 0.4s ease ${i * 0.06}s both`
            }}
          >
            {/* Icon */}
            <div style={{
              width: '40px', height: '40px', borderRadius: '12px',
              background: stat.bg, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '20px', marginBottom: '12px',
              transition: 'transform 0.3s ease'
            }}>
              {stat.icon}
            </div>

            {/* Value with count-up */}
            <div style={{ color: stat.color, fontSize: '28px', fontWeight: '800', lineHeight: 1, marginBottom: '4px' }}>
              <CountUp end={stat.value} duration={800} />
            </div>

            <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '700', marginBottom: '2px' }}>
              {stat.label}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
              {stat.desc}
            </div>

            {/* Arrow */}
            <div style={{
              position: 'absolute', top: '16px', right: '16px',
              color: stat.color, fontSize: '14px', opacity: 0.6,
              transition: 'all 0.2s'
            }}>↗</div>
          </div>
        ))}
      </div>

      {/* ===== BOTTOM GRID ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>

        {/* Recent Tasks */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✦ Recent Tasks
            </div>
            <button onClick={() => setActiveTab('tasks')} style={{
              background: 'none', border: 'none', color: '#d71920', cursor: 'pointer',
              fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px'
            }}>
              View All →
            </button>
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
                      padding: '12px 20px', cursor: 'pointer',
                      borderBottom: i < recentTasks.length - 1 ? '1px solid var(--border-light)' : 'none',
                      transition: 'background 0.15s',
                      borderLeft: `3px solid ${priorityConfig[task.priority] || '#888'}`
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
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

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Announcements */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', flex: 1 }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '14px' }}>📢 Announcements</div>
              <button onClick={() => setActiveTab('announcements')} style={{ background: 'none', border: 'none', color: '#d71920', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>All →</button>
            </div>
            {announcements.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-icon" style={{ fontSize: '28px' }}>📢</div>
                <div className="empty-desc" style={{ fontSize: '12px' }}>No announcements</div>
              </div>
            ) : (
              <div>
                {announcements.map(ann => {
                  const typeColor = { info: '#2563eb', warning: '#d97706', success: '#16a34a', urgent: '#d71920' }
                  const typeIcon = { info: 'ℹ️', warning: '⚠️', success: '✅', urgent: '🚨' }
                  return (
                    <div key={ann.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)', borderLeft: `3px solid ${typeColor[ann.type] || '#888'}` }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '14px', flexShrink: 0 }}>{typeIcon[ann.type] || 'ℹ️'}</span>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '12px', marginBottom: '2px' }}>{ann.title}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {ann.body}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '14px', marginBottom: '12px' }}>⚡ Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { icon: '✦', label: 'New Task', tab: 'tasks', color: '#7c3aed' },
                { icon: '📁', label: 'Projects', tab: 'projects', color: '#2563eb' },
                { icon: '◷', label: 'Attendance', tab: 'attendance', color: '#16a34a' },
                { icon: '📊', label: 'Reports', tab: 'reports', color: '#d71920' },
              ].map(action => (
                <button key={action.tab} onClick={() => setActiveTab(action.tab)} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '8px',
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  cursor: 'pointer', transition: 'all 0.2s', width: '100%', textAlign: 'left',
                  fontFamily: 'inherit'
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${action.color}10`; e.currentTarget.style.borderColor = `${action.color}30` }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: action.color }}>
                    {action.icon}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontWeight: '600' }}>{action.label}</span>
                  <span style={{ marginLeft: 'auto', color: action.color, fontSize: '12px' }}>→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
