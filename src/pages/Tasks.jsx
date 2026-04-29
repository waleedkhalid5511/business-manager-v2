import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#888', bg: 'rgba(136,136,136,0.1)' },
  { id: 'in_progress', label: 'In Progress', color: '#2563eb', bg: 'rgba(37,99,235,0.1)' },
  { id: 'review', label: 'In Review', color: '#d97706', bg: 'rgba(217,119,6,0.1)' },
  { id: 'done', label: 'Done', color: '#16a34a', bg: 'rgba(22,163,74,0.1)' },
]

const PRIORITIES = [
  { id: 'low', label: 'Low', color: '#16a34a' },
  { id: 'medium', label: 'Medium', color: '#2563eb' },
  { id: 'high', label: 'High', color: '#d97706' },
  { id: 'urgent', label: 'Urgent', color: '#d71920' },
]

export default function Tasks({ profile }) {
  const [tasks, setTasks] = useState([])
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [showArchived, setShowArchived] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('details')
  const [editMode, setEditMode] = useState(false)
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(null)
  const [draggingId, setDraggingId] = useState(null)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [timerRunning, setTimerRunning] = useState({})
  const [timerStart, setTimerStart] = useState({})
  const [elapsed, setElapsed] = useState({})
  const timerRef = useRef({})

  const [form, setForm] = useState({
    title: '', description: '', status: 'todo', priority: 'medium',
    assigned_to: '', project: '', due_date: '', client_id: '',
    pipeline_stage: '', pipeline_percent: 0, pipeline_notes: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAll()
    const cleanup = subscribeRealtime()
    return cleanup
  }, [profile, showArchived])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  // Timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newElapsed = {}
      Object.keys(timerRunning).forEach(taskId => {
        if (timerRunning[taskId] && timerStart[taskId]) {
          newElapsed[taskId] = Math.floor((now - timerStart[taskId]) / 1000)
        }
      })
      if (Object.keys(newElapsed).length > 0) {
        setElapsed(prev => ({ ...prev, ...newElapsed }))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [timerRunning, timerStart])

  const fetchAll = async () => {
    setLoading(true)
    try {
      let query = supabase.from('tasks').select(`
        *,
        client:clients(id, name),
        assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name)
      `)
      .eq('is_archived', showArchived)
      .order('created_at', { ascending: false })

      if (!isAdmin && !isManager) {
        query = query.eq('assigned_to', profile.id)
      }

      const [tasksRes, clientsRes, empRes] = await Promise.all([
        query,
        supabase.from('clients').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      ])

      setTasks(tasksRes.data || [])
      setClients(clientsRes.data || [])
      setEmployees(empRes.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const subscribeRealtime = () => {
    const sub = supabase.channel('tasks-live-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchAll()
        } else if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t))
          if (showDetail?.id === payload.new.id) {
            setShowDetail(prev => ({ ...prev, ...payload.new }))
          }
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()
    return () => sub.unsubscribe()
  }

  // ===== SMOOTH DRAG & DROP =====
  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', task.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(task.id)
    setTimeout(() => {
      const el = document.getElementById(`task-${task.id}`)
      if (el) el.classList.add('dragging')
    }, 0)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOver(null)
    document.querySelectorAll('.kanban-card').forEach(el => {
      el.classList.remove('dragging')
    })
  }

  const handleDragOver = (e, colId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(colId)
  }

  const handleDrop = async (e, colId) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (!taskId || !colId) return

    setDragOver(null)
    setDraggingId(null)

    // Remove dragging class
    const dragEl = document.getElementById(`task-${taskId}`)
    if (dragEl) dragEl.classList.remove('dragging')

    // Check if same column
    const task = tasks.find(t => t.id === taskId)
    if (!task || task.status === colId) return

    // ✅ Optimistic update — NO page refresh!
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, status: colId } : t
    ))

    // Drop animation
    setTimeout(() => {
      const el = document.getElementById(`task-${taskId}`)
      if (el) {
        el.classList.add('dropped')
        setTimeout(() => el.classList.remove('dropped'), 400)
      }
    }, 50)

    // DB update in background
    try {
      await supabase.from('tasks').update({ status: colId }).eq('id', taskId)
    } catch (e) {
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: task.status } : t
      ))
      setMessage('❌ Failed to update task status')
    }
  }

  const createTask = async () => {
    if (!form.title.trim()) { setMessage('❌ Title required!'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('tasks').insert({
        title: form.title.trim(),
        description: form.description,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        project: form.project || null,
        due_date: form.due_date || null,
        client_id: form.client_id || null,
        pipeline_stage: form.pipeline_stage || null,
        pipeline_percent: parseInt(form.pipeline_percent) || 0,
        pipeline_notes: form.pipeline_notes || null,
        created_by: profile.id,
        is_archived: false,
      })
      if (error) throw error
      setMessage('✅ Task created!')
      setShowModal(false)
      resetForm()
      fetchAll()
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const updateTask = async () => {
    if (!showDetail) return
    setSaving(true)
    try {
      const { error } = await supabase.from('tasks').update({
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        assigned_to: form.assigned_to || null,
        project: form.project || null,
        due_date: form.due_date || null,
        client_id: form.client_id || null,
        pipeline_stage: form.pipeline_stage || null,
        pipeline_percent: parseInt(form.pipeline_percent) || 0,
        pipeline_notes: form.pipeline_notes || null,
      }).eq('id', showDetail.id)
      if (error) throw error
      setMessage('✅ Task updated!')
      setEditMode(false)
      fetchAll()
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const archiveTask = async (taskId, archive = true) => {
    await supabase.from('tasks').update({
      is_archived: archive,
      archived_at: archive ? new Date().toISOString() : null,
      archived_by: archive ? profile.id : null
    }).eq('id', taskId)
    setShowDetail(null)
    setMessage(archive ? '✅ Task archived!' : '✅ Task restored!')
    fetchAll()
  }

  const deleteTask = async (taskId) => {
    if (!window.confirm('Delete this task permanently?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    setShowDetail(null)
    setMessage('✅ Task deleted!')
    fetchAll()
  }

  const fetchComments = async (taskId) => {
    const { data } = await supabase.from('task_comments').select('*, profiles(full_name)').eq('task_id', taskId).order('created_at')
    setComments(data || [])
  }

  const addComment = async () => {
    if (!comment.trim() || !showDetail) return
    await supabase.from('task_comments').insert({ task_id: showDetail.id, user_id: profile.id, content: comment.trim() })
    setComment('')
    fetchComments(showDetail.id)
  }

  const fetchTimeLogs = async (taskId) => {
    const { data } = await supabase.from('task_time_logs').select('*, profiles(full_name)').eq('task_id', taskId).order('created_at', { ascending: false })
    setTimeLogs(data || [])
  }

  const startTimer = (taskId) => {
    setTimerRunning(prev => ({ ...prev, [taskId]: true }))
    setTimerStart(prev => ({ ...prev, [taskId]: Date.now() }))
    setElapsed(prev => ({ ...prev, [taskId]: 0 }))
  }

  const stopTimer = async (taskId) => {
    const durationSecs = elapsed[taskId] || 0
    if (durationSecs < 10) { setMessage('❌ Min 10 seconds to log time'); setTimerRunning(prev => ({ ...prev, [taskId]: false })); return }
    const durationMins = Math.ceil(durationSecs / 60)
    setTimerRunning(prev => ({ ...prev, [taskId]: false }))

    await supabase.from('task_time_logs').insert({
      task_id: taskId, employee_id: profile.id,
      start_time: new Date(timerStart[taskId]).toISOString(),
      end_time: new Date().toISOString(),
      duration_minutes: durationMins,
    })
    setMessage(`✅ ${durationMins} min logged!`)
    fetchTimeLogs(taskId)
  }

  const formatTimer = (secs) => {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const formatDuration = (mins) => {
    if (!mins) return '0m'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const openDetail = (task) => {
    setShowDetail(task)
    setDetailTab('details')
    setEditMode(false)
    fetchComments(task.id)
    fetchTimeLogs(task.id)
    setForm({
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      assigned_to: task.assigned_to || '',
      project: task.project || '',
      due_date: task.due_date?.split('T')[0] || '',
      client_id: task.client_id || '',
      pipeline_stage: task.pipeline_stage || '',
      pipeline_percent: task.pipeline_percent || 0,
      pipeline_notes: task.pipeline_notes || ''
    })
  }

  const resetForm = () => {
    setForm({ title: '', description: '', status: 'todo', priority: 'medium', assigned_to: '', project: '', due_date: '', client_id: '', pipeline_stage: '', pipeline_percent: 0, pipeline_notes: '' })
  }

  const getPriorityConfig = (priority) => PRIORITIES.find(p => p.id === priority) || { color: '#888', label: priority }
  const getColumnConfig = (status) => COLUMNS.find(c => c.id === status) || { color: '#888', label: status }

  const activeTasks = tasks.filter(t => !t.is_archived)
  const archivedTasks = tasks.filter(t => t.is_archived)
  const displayTasks = showArchived ? archivedTasks : activeTasks

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Tasks</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
            {activeTasks.length} active · {archivedTasks.length} archived
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Archive Toggle */}
          <button onClick={() => setShowArchived(!showArchived)} style={{
            padding: '7px 12px', borderRadius: '8px',
            border: `1px solid ${showArchived ? '#d71920' : 'var(--border)'}`,
            background: showArchived ? 'rgba(215,25,32,0.06)' : 'var(--bg-card)',
            color: showArchived ? '#d71920' : 'var(--text-muted)',
            cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s'
          }}>
            {showArchived ? '📦 Archived' : '📦 Archive'}
          </button>

          {/* View Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { id: 'kanban', icon: '⊞', label: 'Board' },
              { id: 'list', icon: '≡', label: 'List' },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer',
                background: view === v.id ? '#d71920' : 'transparent',
                color: view === v.id ? 'white' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: '700', transition: 'all 0.2s'
              }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {(isAdmin || isManager) && (
            <button onClick={() => { setShowModal(true); resetForm() }} className="btn btn-primary btn-sm">
              + New Task
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
          color: message.includes('❌') ? '#d71920' : '#16a34a',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px',
          animation: 'slideDown 0.2s ease'
        }}>{message}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: '14px' }}>
          {COLUMNS.map(col => (
            <div key={col.id} style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '40px', borderRadius: '8px', marginBottom: '10px' }} />
              {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '10px', marginBottom: '8px' }} />)}
            </div>
          ))}
        </div>
      ) : view === 'kanban' ? (
        /* ===== KANBAN VIEW ===== */
        <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '16px', alignItems: 'flex-start' }}>
          {COLUMNS.map(col => {
            const colTasks = displayTasks.filter(t => t.status === col.id)
            const isDragOver = dragOver === col.id

            return (
              <div key={col.id}
                className={`kanban-column ${isDragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setDragOver(null)
                  }
                }}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="kanban-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '14px' }}>{col.label}</span>
                    <span style={{ background: col.bg, color: col.color, padding: '1px 7px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                      {colTasks.length}
                    </span>
                  </div>
                  {(isAdmin || isManager) && (
                    <button onClick={() => { setShowModal(true); setForm(prev => ({ ...prev, status: col.id })) }}
                      className="btn-icon" style={{ fontSize: '18px', width: '24px', height: '24px', color: col.color }}>
                      +
                    </button>
                  )}
                </div>

                {/* Cards */}
                <div className="kanban-cards">
                  {colTasks.length === 0 && (
                    <div style={{
                      padding: '20px', textAlign: 'center',
                      color: 'var(--text-muted)', fontSize: '12px',
                      border: `2px dashed var(--border)`, borderRadius: '8px',
                      opacity: isDragOver ? 0 : 0.6
                    }}>
                      Drop here
                    </div>
                  )}
                  {colTasks.map(task => {
                    const priority = getPriorityConfig(task.priority)
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
                    const isTimerOn = timerRunning[task.id]

                    return (
                      <div
                        key={task.id}
                        id={`task-${task.id}`}
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openDetail(task)}
                        style={{ borderLeft: `3px solid ${priority.color}` }}
                      >
                        {/* Priority + Client */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ background: `${priority.color}15`, color: priority.color, padding: '2px 7px', borderRadius: '4px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase' }}>
                            {priority.label}
                          </span>
                          {task.client && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '10px', background: 'var(--bg-hover)', padding: '2px 6px', borderRadius: '4px' }}>
                              👤 {task.client.name}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', marginBottom: '8px', lineHeight: '1.4' }}>
                          {task.title}
                        </div>

                        {/* Project */}
                        {task.project && (
                          <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '8px' }}>
                            📁 {task.project}
                          </div>
                        )}

                        {/* Pipeline */}
                        {task.pipeline_percent > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                              <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{task.pipeline_stage || 'Pipeline'}</span>
                              <span style={{ color: '#d71920', fontSize: '10px', fontWeight: '700' }}>{task.pipeline_percent}%</span>
                            </div>
                            <div className="progress-bar" style={{ height: '4px' }}>
                              <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                            </div>
                          </div>
                        )}

                        {/* Footer */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {task.assigned_to_profile && (
                              <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '9px', background: '#d71920' }}>
                                {task.assigned_to_profile.full_name?.charAt(0).toUpperCase()}
                              </div>
                            )}
                            {task.due_date && (
                              <span style={{ color: isOverdue ? '#d71920' : 'var(--text-muted)', fontSize: '10px', fontWeight: isOverdue ? '700' : '400' }}>
                                {isOverdue ? '⚠️ ' : '📅 '}
                                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                          {isTimerOn && (
                            <span style={{ color: '#d71920', fontSize: '10px', fontWeight: '800', animation: 'pulse 1s infinite' }}>
                              ⏱ {formatTimer(elapsed[task.id] || 0)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ===== LIST VIEW ===== */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Client</th>
                <th>Pipeline</th>
                <th>Due Date</th>
              </tr>
            </thead>
            <tbody>
              {displayTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No tasks found
                  </td>
                </tr>
              ) : (
                displayTasks.map(task => {
                  const priority = getPriorityConfig(task.priority)
                  const col = getColumnConfig(task.status)
                  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

                  return (
                    <tr key={task.id} onClick={() => openDetail(task)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '2px' }}>{task.title}</div>
                        {task.project && <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>📁 {task.project}</div>}
                      </td>
                      <td>
                        <span className="badge" style={{ background: col.bg, color: col.color }}>
                          {col.label}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: `${priority.color}15`, color: priority.color }}>
                          {priority.label}
                        </span>
                      </td>
                      <td>
                        {task.assigned_to_profile ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="avatar" style={{ width: '24px', height: '24px', fontSize: '10px', background: '#d71920' }}>
                              {task.assigned_to_profile.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{task.assigned_to_profile.full_name}</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{task.client?.name || '—'}</td>
                      <td>
                        {task.pipeline_percent > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div className="progress-bar" style={{ width: '60px' }}>
                              <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                            </div>
                            <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>{task.pipeline_percent}%</span>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ color: isOverdue ? '#d71920' : 'var(--text-secondary)', fontSize: '12px', fontWeight: isOverdue ? '700' : '400' }}>
                        {task.due_date ? `${isOverdue ? '⚠️ ' : ''}${new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== CREATE TASK MODAL ===== */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '17px', fontWeight: '800' }}>+ New Task</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{ background: 'rgba(215,25,32,0.08)', color: '#d71920', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{message}</div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Task title..." className="input" autoFocus />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Task details..." rows={3}
                  style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#d71920'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                    {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
                    {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Assign To</label>
                  <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input">
                    <option value="">-- Select --</option>
                    {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Client</label>
                  <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="input">
                    <option value="">-- No Client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Project</label>
                  <input type="text" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })}
                    placeholder="Project name..." className="input" />
                </div>
                <div>
                  <label className="input-label">Due Date</label>
                  <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
                </div>
              </div>

              {/* Pipeline */}
              <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '14px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px', marginBottom: '12px' }}>📊 Pipeline</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label className="input-label">Stage</label>
                    <input type="text" value={form.pipeline_stage} onChange={(e) => setForm({ ...form, pipeline_stage: e.target.value })}
                      placeholder="e.g. Editing" className="input" />
                  </div>
                  <div>
                    <label className="input-label">Progress % ({form.pipeline_percent}%)</label>
                    <input type="range" min="0" max="100" value={form.pipeline_percent}
                      onChange={(e) => setForm({ ...form, pipeline_percent: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: '#d71920', cursor: 'pointer', marginTop: '8px' }} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Notes</label>
                  <input type="text" value={form.pipeline_notes} onChange={(e) => setForm({ ...form, pipeline_notes: e.target.value })}
                    placeholder="Pipeline notes..." className="input" />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button onClick={createTask} disabled={saving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
                  {saving ? '⟳ Creating...' : '+ Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== TASK DETAIL MODAL ===== */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => { setShowDetail(null); setEditMode(false) }}>
          <div className="modal" style={{ maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 10 }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                {['details', 'pipeline', 'time', 'comments'].map(tab => (
                  <button key={tab} onClick={() => setDetailTab(tab)} style={{
                    padding: '5px 12px', border: 'none', borderRadius: '6px',
                    background: detailTab === tab ? '#d71920' : 'var(--bg-hover)',
                    color: detailTab === tab ? 'white' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: '700', textTransform: 'capitalize', transition: 'all 0.2s'
                  }}>{tab}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(isAdmin || isManager) && !editMode && (
                  <button onClick={() => setEditMode(true)} className="btn btn-secondary btn-sm">✏️ Edit</button>
                )}
                {!showDetail.is_archived ? (
                  <button onClick={() => archiveTask(showDetail.id, true)} className="btn btn-sm" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer' }}>📦</button>
                ) : (
                  <button onClick={() => archiveTask(showDetail.id, false)} className="btn btn-sm" style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.2)', color: '#16a34a', cursor: 'pointer' }}>↩️</button>
                )}
                {isAdmin && (
                  <button onClick={() => deleteTask(showDetail.id)} className="btn btn-danger btn-sm">🗑️</button>
                )}
                <button onClick={() => { setShowDetail(null); setEditMode(false) }} style={{ background: 'var(--bg-hover)', border: 'none', borderRadius: '8px', color: 'var(--text-muted)', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{ background: 'rgba(22,163,74,0.08)', color: '#16a34a', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{message}</div>
              )}

              {/* ===== DETAILS TAB ===== */}
              {detailTab === 'details' && (
                <div>
                  {editMode ? (
                    <div>
                      <div style={{ marginBottom: '14px' }}>
                        <label className="input-label">Title</label>
                        <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input" />
                      </div>
                      <div style={{ marginBottom: '14px' }}>
                        <label className="input-label">Description</label>
                        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                          style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = '#d71920'}
                          onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                          <label className="input-label">Status</label>
                          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                            {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Priority</label>
                          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
                            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Assign To</label>
                          <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input">
                            <option value="">-- Unassigned --</option>
                            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Client</label>
                          <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="input">
                            <option value="">-- No Client --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="input-label">Project</label>
                          <input type="text" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} className="input" />
                        </div>
                        <div>
                          <label className="input-label">Due Date</label>
                          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="input" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => setEditMode(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                        <button onClick={updateTask} disabled={saving} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1 }}>
                          {saving ? '⟳ Saving...' : '💾 Save Changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Title */}
                      <h2 style={{ color: 'var(--text-primary)', margin: '0 0 8px', fontSize: '22px', fontWeight: '800', lineHeight: '1.3' }}>
                        {showDetail.title}
                      </h2>

                      {/* Badges */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: `${getPriorityConfig(showDetail.priority).color}15`, color: getPriorityConfig(showDetail.priority).color }}>
                          {getPriorityConfig(showDetail.priority).label} Priority
                        </span>
                        <span className="badge" style={{ background: getColumnConfig(showDetail.status).bg, color: getColumnConfig(showDetail.status).color }}>
                          {getColumnConfig(showDetail.status).label}
                        </span>
                        {showDetail.is_archived && <span className="badge" style={{ background: 'rgba(215,25,32,0.1)', color: '#d71920' }}>Archived</span>}
                      </div>

                      {/* Description */}
                      {showDetail.description && (
                        <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '14px', marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', border: '1px solid var(--border)' }}>
                          {showDetail.description}
                        </div>
                      )}

                      {/* Info Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                        {[
                          { label: 'Assigned To', value: showDetail.assigned_to_profile?.full_name || 'Unassigned', icon: '👤' },
                          { label: 'Client', value: showDetail.client?.name || '—', icon: '🏢' },
                          { label: 'Project', value: showDetail.project || '—', icon: '📁' },
                          { label: 'Due Date', value: showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—', icon: '📅' },
                        ].map(item => (
                          <div key={item.label} style={{ background: 'var(--bg-hover)', borderRadius: '8px', padding: '12px', border: '1px solid var(--border)' }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{item.label}</div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>{item.icon} {item.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Timer */}
                      <div style={{ background: timerRunning[showDetail.id] ? 'rgba(215,25,32,0.06)' : 'var(--bg-hover)', borderRadius: '10px', padding: '14px', border: `1px solid ${timerRunning[showDetail.id] ? 'rgba(215,25,32,0.2)' : 'var(--border)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '14px' }}>⏱ Time Tracker</div>
                          <div style={{ color: timerRunning[showDetail.id] ? '#d71920' : 'var(--text-muted)', fontSize: '22px', fontWeight: '800', marginTop: '4px', fontVariantNumeric: 'tabular-nums', animation: timerRunning[showDetail.id] ? 'pulse 1s infinite' : 'none' }}>
                            {formatTimer(elapsed[showDetail.id] || 0)}
                          </div>
                        </div>
                        <button
                          onClick={() => timerRunning[showDetail.id] ? stopTimer(showDetail.id) : startTimer(showDetail.id)}
                          className="btn"
                          style={{
                            background: timerRunning[showDetail.id] ? 'var(--gradient-red)' : 'rgba(22,163,74,0.1)',
                            color: timerRunning[showDetail.id] ? 'white' : '#16a34a',
                            border: timerRunning[showDetail.id] ? 'none' : '1px solid rgba(22,163,74,0.2)',
                            padding: '10px 20px'
                          }}
                        >
                          {timerRunning[showDetail.id] ? '⏹ Stop & Log' : '▶ Start Timer'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== PIPELINE TAB ===== */}
              {detailTab === 'pipeline' && (
                <div>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>
                        {showDetail.pipeline_stage || 'Pipeline Progress'}
                      </span>
                      <span style={{ color: '#d71920', fontWeight: '800', fontSize: '20px' }}>
                        {showDetail.pipeline_percent || 0}%
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: '12px' }}>
                      <div className="progress-fill" style={{ width: `${showDetail.pipeline_percent || 0}%`, transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                    </div>
                  </div>

                  {showDetail.pipeline_notes && (
                    <div style={{ background: 'var(--bg-hover)', borderRadius: '10px', padding: '14px', marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', border: '1px solid var(--border)' }}>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Notes</div>
                      {showDetail.pipeline_notes}
                    </div>
                  )}

                  {editMode && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                        <div>
                          <label className="input-label">Stage</label>
                          <input type="text" value={form.pipeline_stage} onChange={(e) => setForm({ ...form, pipeline_stage: e.target.value })} className="input" placeholder="e.g. Editing" />
                        </div>
                        <div>
                          <label className="input-label">Progress: {form.pipeline_percent}%</label>
                          <input type="range" min="0" max="100" value={form.pipeline_percent} onChange={(e) => setForm({ ...form, pipeline_percent: parseInt(e.target.value) })}
                            style={{ width: '100%', accentColor: '#d71920', cursor: 'pointer', marginTop: '10px' }} />
                        </div>
                      </div>
                      <div style={{ marginBottom: '14px' }}>
                        <label className="input-label">Notes</label>
                        <textarea value={form.pipeline_notes} onChange={(e) => setForm({ ...form, pipeline_notes: e.target.value })} rows={3}
                          style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = '#d71920'}
                          onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                      </div>
                      <button onClick={updateTask} disabled={saving} className="btn btn-primary">
                        {saving ? '⟳ Saving...' : '💾 Save Pipeline'}
                      </button>
                    </div>
                  )}

                  {!editMode && (isAdmin || isManager) && (
                    <button onClick={() => setEditMode(true)} className="btn btn-secondary">✏️ Edit Pipeline</button>
                  )}
                </div>
              )}

              {/* ===== TIME TAB ===== */}
              {detailTab === 'time' && (
                <div>
                  {/* Timer */}
                  <div style={{ background: timerRunning[showDetail.id] ? 'rgba(215,25,32,0.06)' : 'var(--bg-hover)', borderRadius: '12px', padding: '20px', marginBottom: '20px', border: `1px solid ${timerRunning[showDetail.id] ? 'rgba(215,25,32,0.2)' : 'var(--border)'}`, textAlign: 'center' }}>
                    <div style={{ color: timerRunning[showDetail.id] ? '#d71920' : 'var(--text-primary)', fontSize: '40px', fontWeight: '800', fontVariantNumeric: 'tabular-nums', marginBottom: '12px', animation: timerRunning[showDetail.id] ? 'pulse 1.5s infinite' : 'none' }}>
                      {formatTimer(elapsed[showDetail.id] || 0)}
                    </div>
                    <button onClick={() => timerRunning[showDetail.id] ? stopTimer(showDetail.id) : startTimer(showDetail.id)}
                      className="btn" style={{
                        background: timerRunning[showDetail.id] ? 'var(--gradient-red)' : 'var(--gradient-green)',
                        color: 'white', padding: '12px 32px', fontSize: '15px'
                      }}>
                      {timerRunning[showDetail.id] ? '⏹ Stop & Log Time' : '▶ Start Timer'}
                    </button>
                  </div>

                  {/* Time Logs */}
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Time Logs ({timeLogs.length})
                  </div>
                  {timeLogs.length === 0 ? (
                    <div className="empty-state" style={{ padding: '30px' }}>
                      <div className="empty-icon">⏱</div>
                      <div className="empty-desc">No time logged yet</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {timeLogs.map(log => (
                        <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover)', borderRadius: '8px', padding: '10px 14px', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '13px' }}>{log.profiles?.full_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                              {new Date(log.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <span style={{ color: '#7c3aed', fontWeight: '800', fontSize: '14px' }}>
                            {formatDuration(log.duration_minutes)}
                          </span>
                        </div>
                      ))}
                      <div style={{ background: 'rgba(215,25,32,0.06)', borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(215,25,32,0.15)', display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: '700' }}>Total</span>
                        <span style={{ color: '#d71920', fontWeight: '800', fontSize: '16px' }}>
                          {formatDuration(timeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== COMMENTS TAB ===== */}
              {detailTab === 'comments' && (
                <div>
                  {/* Add Comment */}
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <div className="avatar avatar-sm" style={{ background: '#d71920', flexShrink: 0, marginTop: '2px' }}>
                      {profile?.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment..." rows={2}
                        style={{ width: '100%', padding: '10px 14px', background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#d71920'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment() } }}
                      />
                      <button onClick={addComment} disabled={!comment.trim()} className="btn btn-primary btn-sm" style={{ marginTop: '8px', opacity: comment.trim() ? 1 : 0.5 }}>
                        Send
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  {comments.length === 0 ? (
                    <div className="empty-state" style={{ padding: '30px' }}>
                      <div className="empty-icon">💬</div>
                      <div className="empty-desc">No comments yet</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {comments.map(c => (
                        <div key={c.id} style={{ display: 'flex', gap: '10px', animation: 'fadeIn 0.2s ease' }}>
                          <div className="avatar avatar-sm" style={{ background: '#d71920', flexShrink: 0 }}>
                            {c.profiles?.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '13px' }}>{c.profiles?.full_name}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ background: 'var(--bg-hover)', borderRadius: '0 10px 10px 10px', padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', border: '1px solid var(--border)' }}>
                              {c.content}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
