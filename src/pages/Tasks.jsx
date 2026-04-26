import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#94a3b8', icon: '📋' },
  { id: 'in_progress', label: 'In Progress', color: '#3b82f6', icon: '🔄' },
  { id: 'review', label: 'In Review', color: '#f59e0b', icon: '👀' },
  { id: 'done', label: 'Done', color: '#10b981', icon: '✅' },
]

export default function Tasks({ profile }) {
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [comments, setComments] = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [newComment, setNewComment] = useState('')
  const [dragOver, setDragOver] = useState(null)
  const [form, setForm] = useState({
    title: '', description: '', assigned_to: '',
    project: '', priority: 'medium', status: 'todo',
    due_date: '', estimated_hours: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (profile) {
      fetchTasks()
      if (isAdmin || isManager) fetchEmployees()
    }
  }, [profile, filterPriority, filterAssignee])

  useEffect(() => {
    let interval
    if (activeTimer) interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [activeTimer])

  useEffect(() => {
    if (showDetail) {
      fetchComments(showDetail.id)
      fetchTimeLogs(showDetail.id)
    }
  }, [showDetail])

  const fetchTasks = async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select('*, assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name, avatar_url), assigned_by_profile:profiles!tasks_assigned_by_fkey(full_name)')
      .order('created_at', { ascending: false })

    if (filterPriority !== 'all') query = query.eq('priority', filterPriority)
    if (filterAssignee !== 'all') query = query.eq('assigned_to', filterAssignee)
    if (!isAdmin && !isManager) query = query.eq('assigned_to', profile.id)

    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }

  const fetchEmployees = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
    setEmployees(data || [])
  }

  const fetchComments = async (taskId) => {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name, role)')
      .eq('channel_id', taskId)
      .order('created_at', { ascending: true })
    setComments(data || [])
  }

  const fetchTimeLogs = async (taskId) => {
    const { data } = await supabase
      .from('task_time_logs')
      .select('*, profiles(full_name)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false })
    setTimeLogs(data || [])
  }

  const handleSubmit = async () => {
    if (!form.title) { setMessage('❌ Task title is required!'); return }
    const taskData = {
      title: form.title, description: form.description,
      assigned_to: form.assigned_to || null,
      assigned_by: profile.id, project: form.project,
      priority: form.priority, status: form.status,
      due_date: form.due_date || null,
      estimated_hours: parseFloat(form.estimated_hours) || null
    }
    if (editTask) {
      const { error } = await supabase.from('tasks').update(taskData).eq('id', editTask.id)
      if (error) setMessage('❌ ' + error.message)
      else { setMessage('✅ Task updated!'); fetchTasks(); closeModal() }
    } else {
      const { error } = await supabase.from('tasks').insert(taskData)
      if (error) setMessage('❌ ' + error.message)
      else { setMessage('✅ Task created!'); fetchTasks(); closeModal() }
    }
  }

  const updateStatus = async (taskId, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    if (showDetail?.id === taskId) setShowDetail(prev => ({ ...prev, status: newStatus }))
  }

  const startTimer = async (task) => {
    const { data } = await supabase
      .from('task_time_logs')
      .insert({ task_id: task.id, employee_id: profile.id, start_time: new Date().toISOString() })
      .select().single()
    setActiveTimer({ task, logId: data?.id })
    setTimerSeconds(0)
  }

  const stopTimer = async () => {
    if (!activeTimer) return
    const duration = Math.floor(timerSeconds / 60)
    await supabase.from('task_time_logs').update({
      end_time: new Date().toISOString(), duration_minutes: duration
    }).eq('id', activeTimer.logId)
    setMessage(`✅ Timer stopped! ${duration} minutes logged.`)
    setActiveTimer(null)
    setTimerSeconds(0)
    if (showDetail) fetchTimeLogs(showDetail.id)
  }

  const addComment = async (taskId) => {
    if (!newComment.trim()) return
    await supabase.from('messages').insert({
      channel_id: taskId, sender_id: profile.id, content: newComment.trim()
    })
    setNewComment('')
    fetchComments(taskId)
  }

  const deleteTask = async (taskId) => {
    if (!window.confirm('Delete this task?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    fetchTasks()
    setShowDetail(null)
  }

  const handleDragStart = (e, task) => {
    e.dataTransfer.setData('taskId', task.id)
  }

  const handleDrop = (e, columnId) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) updateStatus(taskId, columnId)
    setDragOver(null)
  }

  const openEdit = (task) => {
    setEditTask(task)
    setForm({
      title: task.title, description: task.description || '',
      assigned_to: task.assigned_to || '', project: task.project || '',
      priority: task.priority, status: task.status,
      due_date: task.due_date || '', estimated_hours: task.estimated_hours || ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false); setEditTask(null)
    setForm({ title: '', description: '', assigned_to: '', project: '', priority: 'medium', status: 'todo', due_date: '', estimated_hours: '' })
    setMessage('')
  }

  const formatTimer = (s) => {
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  }

  const formatDuration = (m) => {
    if (!m) return '0m'
    const h = Math.floor(m / 60)
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`
  }

  const getTotalTime = (logs) => logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)

  const priorityConfig = {
    urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: '🔴 Urgent' },
    high: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: '🟡 High' },
    medium: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: '🔵 Medium' },
    low: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: '🟢 Low' },
  }

  const isOverdue = (task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  const filtered = tasks.filter(task => {
    const matchSearch = !search ||
      task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.project?.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  const getColumnTasks = (columnId) => filtered.filter(t => t.status === columnId)

  return (
    <div className="fade-in">
      {/* Active Timer Banner */}
      {activeTimer && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
          borderRadius: '12px', padding: '14px 20px', marginBottom: '20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: '1px solid rgba(59,130,246,0.3)',
          animation: 'glow 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#10b981', animation: 'pulse 1s infinite'
            }} />
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>TIMER RUNNING</div>
              <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>
                {activeTimer.task.title}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              color: '#3b82f6', fontSize: '24px', fontWeight: '700',
              fontFamily: 'monospace', letterSpacing: '0.05em'
            }}>
              {formatTimer(timerSeconds)}
            </div>
            <button onClick={stopTimer} className="btn btn-sm" style={{
              background: 'rgba(239,68,68,0.2)', color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.3)'
            }}>
              ⏹ Stop
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '20px',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '20px', fontWeight: '700' }}>
            Tasks
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
            {filtered.length} tasks · {filtered.filter(t => t.status === 'in_progress').length} in progress
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {[
              { id: 'kanban', icon: '⊞', label: 'Board' },
              { id: 'list', icon: '≡', label: 'List' },
            ].map(v => (
              <button key={v.id} onClick={() => setView(v.id)} style={{
                padding: '7px 14px', border: 'none', cursor: 'pointer',
                background: view === v.id ? 'var(--accent-blue)' : 'transparent',
                color: view === v.id ? 'white' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '5px'
              }}>
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              + New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '20px',
        flexWrap: 'wrap', alignItems: 'center'
      }}>
        <input
          type="text" placeholder="🔍 Search tasks..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '8px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '8px', color: 'var(--text-primary)',
            fontSize: '13px', outline: 'none'
          }}
        />
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          style={{
            padding: '8px 12px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
          }}>
          <option value="all">All Priority</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟡 High</option>
          <option value="medium">🔵 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        {(isAdmin || isManager) && (
          <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
            style={{
              padding: '8px 12px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
            }}>
            <option value="all">All Members</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
          border: `1px solid ${message.includes('❌') ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          color: message.includes('❌') ? '#fca5a5' : '#86efac',
          padding: '10px 14px', borderRadius: '8px',
          marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {loading ? (
        <div style={{ display: 'flex', gap: '16px' }}>
          {COLUMNS.map(col => (
            <div key={col.id} className="skeleton kanban-column" style={{ height: '400px' }} />
          ))}
        </div>
      ) : view === 'kanban' ? (
        /* ===== KANBAN VIEW ===== */
        <div style={{
          display: 'flex', gap: '16px',
          overflowX: 'auto', paddingBottom: '16px',
          minHeight: '500px'
        }}>
          {COLUMNS.map(col => {
            const colTasks = getColumnTasks(col.id)
            return (
              <div
                key={col.id}
                className="kanban-column"
                style={{
                  border: dragOver === col.id
                    ? `2px dashed ${col.color}`
                    : '1px solid var(--border)',
                  background: dragOver === col.id
                    ? `${col.color}08` : 'var(--bg-card)'
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
                onDragLeave={() => setDragOver(null)}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div className="kanban-column-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: col.color
                    }} />
                    <span style={{
                      color: 'var(--text-primary)', fontWeight: '600',
                      fontSize: '13px'
                    }}>
                      {col.label}
                    </span>
                  </div>
                  <div style={{
                    background: `${col.color}20`, color: col.color,
                    borderRadius: '20px', padding: '2px 8px',
                    fontSize: '12px', fontWeight: '700'
                  }}>
                    {colTasks.length}
                  </div>
                </div>

                {/* Cards */}
                <div className="kanban-cards">
                  {colTasks.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '24px 16px',
                      color: 'var(--text-muted)', fontSize: '12px',
                      border: `2px dashed var(--border)`,
                      borderRadius: '8px', margin: '4px'
                    }}>
                      Drop tasks here
                    </div>
                  ) : (
                    colTasks.map(task => (
                      <div
                        key={task.id}
                        className="kanban-card"
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onClick={() => setShowDetail(task)}
                        style={{
                          borderTop: `3px solid ${priorityConfig[task.priority]?.color || '#334155'}`
                        }}
                      >
                        {/* Priority + Overdue */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center', marginBottom: '8px'
                        }}>
                          <span style={{
                            background: priorityConfig[task.priority]?.bg,
                            color: priorityConfig[task.priority]?.color,
                            padding: '2px 8px', borderRadius: '20px',
                            fontSize: '10px', fontWeight: '700'
                          }}>
                            {task.priority?.toUpperCase()}
                          </span>
                          {isOverdue(task) && (
                            <span style={{
                              background: 'rgba(239,68,68,0.15)',
                              color: '#ef4444', padding: '2px 6px',
                              borderRadius: '4px', fontSize: '10px', fontWeight: '700'
                            }}>
                              OVERDUE
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div style={{
                          color: 'var(--text-primary)', fontSize: '13px',
                          fontWeight: '600', marginBottom: '6px',
                          lineHeight: '1.4'
                        }}>
                          {task.title}
                        </div>

                        {/* Description */}
                        {task.description && (
                          <div style={{
                            color: 'var(--text-muted)', fontSize: '11px',
                            marginBottom: '10px', lineHeight: '1.5',
                            overflow: 'hidden', display: '-webkit-box',
                            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                          }}>
                            {task.description}
                          </div>
                        )}

                        {/* Project */}
                        {task.project && (
                          <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            background: 'var(--bg-hover)', padding: '2px 8px',
                            borderRadius: '4px', marginBottom: '10px',
                            color: 'var(--text-muted)', fontSize: '11px'
                          }}>
                            📁 {task.project}
                          </div>
                        )}

                        {/* Footer */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between',
                          alignItems: 'center'
                        }}>
                          {/* Assignee */}
                          {task.assigned_to_profile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div className="avatar" style={{
                                width: '22px', height: '22px',
                                fontSize: '10px', background: 'var(--gradient-blue)'
                              }}>
                                {task.assigned_to_profile.full_name?.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                {task.assigned_to_profile.full_name?.split(' ')[0]}
                              </span>
                            </div>
                          ) : (
                            <div style={{
                              color: 'var(--text-muted)', fontSize: '11px'
                            }}>
                              Unassigned
                            </div>
                          )}

                          {/* Due Date */}
                          {task.due_date && (
                            <div style={{
                              color: isOverdue(task) ? '#ef4444' : 'var(--text-muted)',
                              fontSize: '11px'
                            }}>
                              {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>

                        {/* Timer Button */}
                        {task.assigned_to === profile?.id && task.status === 'in_progress' && (
                          <div style={{ marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => activeTimer?.task.id === task.id ? stopTimer() : startTimer(task)}
                              className="btn btn-sm"
                              style={{
                                width: '100%', justifyContent: 'center',
                                background: activeTimer?.task.id === task.id
                                  ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                                color: activeTimer?.task.id === task.id ? '#ef4444' : '#10b981',
                                border: `1px solid ${activeTimer?.task.id === task.id ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`
                              }}
                            >
                              {activeTimer?.task.id === task.id
                                ? `⏹ ${formatTimer(timerSeconds)}`
                                : '▶ Start Timer'
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}

                  {/* Add Task Button */}
                  {(isAdmin || isManager) && (
                    <button
                      onClick={() => { setForm(f => ({ ...f, status: col.id })); setShowModal(true) }}
                      style={{
                        width: '100%', padding: '8px', background: 'transparent',
                        border: `1px dashed var(--border)`, borderRadius: '8px',
                        color: 'var(--text-muted)', cursor: 'pointer',
                        fontSize: '12px', marginTop: '4px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = col.color
                        e.currentTarget.style.color = col.color
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)'
                        e.currentTarget.style.color = 'var(--text-muted)'
                      }}
                    >
                      + Add task
                    </button>
                  )}
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
                <th>Assignee</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No tasks found
                  </td>
                </tr>
              ) : (
                filtered.map(task => (
                  <tr key={task.id} style={{ cursor: 'pointer' }} onClick={() => setShowDetail(task)}>
                    <td>
                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {task.title}
                      </div>
                      {task.project && (
                        <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>📁 {task.project}</div>
                      )}
                    </td>
                    <td>
                      {task.assigned_to_profile ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div className="avatar avatar-sm">
                            {task.assigned_to_profile.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                            {task.assigned_to_profile.full_name}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: priorityConfig[task.priority]?.bg,
                        color: priorityConfig[task.priority]?.color
                      }}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{
                        background: `${COLUMNS.find(c => c.id === task.status)?.color}20`,
                        color: COLUMNS.find(c => c.id === task.status)?.color
                      }}>
                        {COLUMNS.find(c => c.id === task.status)?.label}
                      </span>
                    </td>
                    <td style={{
                      color: isOverdue(task) ? '#ef4444' : 'var(--text-muted)',
                      fontSize: '13px'
                    }}>
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : '—'
                      }
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      {(isAdmin || isManager) && (
                        <button onClick={() => openEdit(task)} className="btn-icon" style={{ fontSize: '14px' }}>
                          ✏️
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== TASK DETAIL MODAL ===== */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0d1f3c, #1a1040)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, marginRight: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span className="badge" style={{
                      background: priorityConfig[showDetail.priority]?.bg,
                      color: priorityConfig[showDetail.priority]?.color
                    }}>
                      {showDetail.priority}
                    </span>
                    <span className="badge" style={{
                      background: `${COLUMNS.find(c => c.id === showDetail.status)?.color}20`,
                      color: COLUMNS.find(c => c.id === showDetail.status)?.color
                    }}>
                      {COLUMNS.find(c => c.id === showDetail.status)?.label}
                    </span>
                    {isOverdue(showDetail) && (
                      <span className="badge" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <h2 style={{ color: 'white', margin: '0 0 8px', fontSize: '18px', fontWeight: '700' }}>
                    {showDetail.title}
                  </h2>
                  {showDetail.description && (
                    <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px', lineHeight: '1.6' }}>
                      {showDetail.description}
                    </p>
                  )}
                </div>
                <button onClick={() => setShowDetail(null)} className="btn-icon">✕</button>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Info Grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px', marginBottom: '20px'
              }}>
                {[
                  { label: 'Assigned To', value: showDetail.assigned_to_profile?.full_name || 'Unassigned' },
                  { label: 'Project', value: showDetail.project || '—' },
                  { label: 'Due Date', value: showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString() : '—' },
                  { label: 'Est. Hours', value: showDetail.estimated_hours ? `${showDetail.estimated_hours}h` : '—' },
                  { label: 'Time Logged', value: formatDuration(getTotalTime(timeLogs)) },
                  { label: 'Created By', value: showDetail.assigned_by_profile?.full_name || '—' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'var(--bg-hover)', borderRadius: '8px', padding: '10px'
                  }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {item.label}
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Status Pipeline */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Move to
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {COLUMNS.map(col => (
                    <button key={col.id} onClick={() => updateStatus(showDetail.id, col.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '20px', border: 'none',
                        background: showDetail.status === col.id ? col.color : `${col.color}15`,
                        color: showDetail.status === col.id ? 'white' : col.color,
                        cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                        transition: 'all 0.2s'
                      }}>
                      {col.icon} {col.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Timer */}
              {showDetail.assigned_to === profile?.id && showDetail.status === 'in_progress' && (
                <div style={{
                  background: 'var(--bg-hover)', borderRadius: '10px', padding: '16px',
                  marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>
                      TIME TRACKER
                    </div>
                    <div style={{
                      color: 'var(--accent-blue)', fontSize: '24px',
                      fontWeight: '700', fontFamily: 'monospace'
                    }}>
                      {activeTimer?.task.id === showDetail.id ? formatTimer(timerSeconds) : '00:00:00'}
                    </div>
                  </div>
                  <button
                    onClick={() => activeTimer?.task.id === showDetail.id ? stopTimer() : startTimer(showDetail)}
                    className="btn btn-sm"
                    style={{
                      background: activeTimer?.task.id === showDetail.id
                        ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                      color: activeTimer?.task.id === showDetail.id ? '#ef4444' : '#10b981',
                      border: `1px solid ${activeTimer?.task.id === showDetail.id ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      padding: '10px 20px'
                    }}
                  >
                    {activeTimer?.task.id === showDetail.id ? '⏹ Stop' : '▶ Start Timer'}
                  </button>
                </div>
              )}

              {/* Time Logs */}
              {timeLogs.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{
                    color: 'var(--text-muted)', fontSize: '11px',
                    marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.06em'
                  }}>
                    Time Logs — Total: {formatDuration(getTotalTime(timeLogs))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {timeLogs.slice(0, 5).map(log => (
                      <div key={log.id} style={{
                        background: 'var(--bg-hover)', borderRadius: '8px', padding: '10px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div className="avatar avatar-sm">{log.profiles?.full_name?.charAt(0).toUpperCase()}</div>
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600' }}>
                              {log.profiles?.full_name}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                              {new Date(log.start_time).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div style={{
                          color: 'var(--accent-blue)', fontWeight: '700',
                          fontSize: '13px', background: 'rgba(59,130,246,0.1)',
                          padding: '3px 10px', borderRadius: '20px'
                        }}>
                          {formatDuration(log.duration_minutes)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <div style={{
                  color: 'var(--text-muted)', fontSize: '11px',
                  marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em'
                }}>
                  Comments ({comments.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {comments.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                      No comments yet
                    </div>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} style={{
                        background: 'var(--bg-hover)', borderRadius: '10px', padding: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div className="avatar avatar-sm">
                              {comment.profiles?.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <span style={{ color: 'var(--accent-blue)', fontSize: '12px', fontWeight: '700' }}>
                              {comment.profiles?.full_name}
                            </span>
                          </div>
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {new Date(comment.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.5' }}>
                          {comment.content}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text" value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addComment(showDetail.id)}
                    placeholder="Write a comment..."
                    style={{
                      flex: 1, padding: '10px 14px', background: 'var(--bg-hover)',
                      border: '1px solid var(--border)', borderRadius: '8px',
                      color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                    }}
                  />
                  <button onClick={() => addComment(showDetail.id)} className="btn btn-primary btn-sm">
                    Send
                  </button>
                </div>
              </div>

              {/* Admin Actions */}
              {(isAdmin || isManager) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                  <button onClick={() => { openEdit(showDetail); setShowDetail(null) }} className="btn btn-secondary btn-sm">
                    ✏️ Edit Task
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteTask(showDetail.id)} className="btn btn-danger btn-sm">
                      🗑️ Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '17px', fontWeight: '700' }}>
                {editTask ? '✏️ Edit Task' : '+ New Task'}
              </h3>
              <button onClick={closeModal} className="btn-icon">✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{
                  background: message.includes('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                  color: message.includes('❌') ? '#fca5a5' : '#86efac',
                  padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
                }}>{message}</div>
              )}

              {[
                { label: 'Task Title *', key: 'title', type: 'text', placeholder: 'Enter task title...' },
                { label: 'Description', key: 'description', type: 'text', placeholder: 'Add more details...' },
                { label: 'Project', key: 'project', type: 'text', placeholder: 'Project name' },
                { label: 'Due Date', key: 'due_date', type: 'date' },
                { label: 'Estimated Hours', key: 'estimated_hours', type: 'number', placeholder: '8' },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: '14px' }}>
                  <label className="input-label">{field.label}</label>
                  <input type={field.type} value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="input"
                  />
                </div>
              ))}

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Assign To</label>
                <select value={form.assigned_to}
                  onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                  className="input">
                  <option value="">-- Select Member --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <label className="input-label">Priority</label>
                  <select value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="input">
                    <option value="low">🟢 Low</option>
                    <option value="medium">🔵 Medium</option>
                    <option value="high">🟡 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Status</label>
                  <select value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input">
                    {COLUMNS.map(col => (
                      <option key={col.id} value={col.id}>{col.icon} {col.label}</option>
                    ))}
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={closeModal} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  {editTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
