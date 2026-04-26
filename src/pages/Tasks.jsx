import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Tasks({ profile }) {
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editTask, setEditTask] = useState(null)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPriority, setFilterPriority] = useState('all')
  const [search, setSearch] = useState('')
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [timeLogs, setTimeLogs] = useState([])
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
  }, [profile, filterStatus, filterPriority])

  useEffect(() => {
    let interval
    if (activeTimer) {
      interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    }
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
      .select('*, assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name), assigned_by_profile:profiles!tasks_assigned_by_fkey(full_name)')
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)
    if (filterPriority !== 'all') query = query.eq('priority', filterPriority)
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
      else { setMessage('✅ Task added!'); fetchTasks(); closeModal() }
    }
  }

  const updateStatus = async (taskId, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    fetchTasks()
    if (showDetail) setShowDetail({ ...showDetail, status: newStatus })
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
      channel_id: taskId,
      sender_id: profile.id,
      content: newComment.trim()
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

  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const formatDuration = (minutes) => {
    if (!minutes) return '0m'
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const getTotalTime = (logs) => {
    return logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0)
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

  const priorityColor = (p) => ({ low: '#10b981', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }[p] || '#94a3b8')
  const statusColor = (s) => ({ todo: '#94a3b8', in_progress: '#3b82f6', review: '#f59e0b', done: '#10b981', cancelled: '#ef4444' }[s] || '#94a3b8')
  const statusLabel = (s) => ({ todo: '📋 Todo', in_progress: '🔄 In Progress', review: '👀 Review', done: '✅ Done', cancelled: '❌ Cancelled' }[s] || s)
  const nextStatus = (s) => ({ todo: 'in_progress', in_progress: 'review', review: 'done' }[s])

  const isOverdue = (task) => task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  const filtered = tasks.filter(task => {
    const matchSearch = task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.description?.toLowerCase().includes(search.toLowerCase()) ||
      task.project?.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  return (
    <div>
      {/* Active Timer Banner */}
      {activeTimer && (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #312e81)',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '20px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          border: '1px solid #3b82f6'
        }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>Timer running</div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>⏱️ {activeTimer.task.title}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#3b82f6', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {formatTimer(timerSeconds)}
            </div>
            <button onClick={stopTimer} style={{
              background: '#ef4444', border: 'none', borderRadius: '8px',
              padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 'bold'
            }}>⏹ Stop</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: '22px' }}>✅ Tasks</h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>{filtered.length} tasks</p>
        </div>
        {(isAdmin || isManager) && (
          <button onClick={() => setShowModal(true)} style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', padding: '10px 20px',
            color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>+ Add Task</button>
        )}
      </div>

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="🔍 Search tasks..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '10px 14px',
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none'
          }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Status</option>
          <option value="todo">Todo</option>
          <option value="in_progress">In Progress</option>
          <option value="review">Review</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
          style={{ padding: '10px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Priority</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟡 High</option>
          <option value="medium">🔵 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Todo', value: tasks.filter(t => t.status === 'todo').length, color: '#94a3b8' },
          { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#3b82f6' },
          { label: 'Review', value: tasks.filter(t => t.status === 'review').length, color: '#f59e0b' },
          { label: 'Done', value: tasks.filter(t => t.status === 'done').length, color: '#10b981' },
          { label: 'Overdue', value: tasks.filter(t => isOverdue(t)).length, color: '#ef4444' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#1e293b', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${stat.color}33`
          }}>
            <div style={{ color: stat.color, fontSize: '22px', fontWeight: 'bold' }}>{stat.value}</div>
            <div style={{ color: '#94a3b8', fontSize: '11px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? '#7f1d1d' : '#14532d',
          color: message.includes('❌') ? '#fca5a5' : '#86efac',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* Tasks Grid */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <p>No tasks found!</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map(task => (
            <div key={task.id}
              onClick={() => setShowDetail(task)}
              style={{
                background: '#1e293b', borderRadius: '12px', padding: '18px',
                border: `1px solid ${isOverdue(task) ? '#ef444466' : '#334155'}`,
                borderLeft: `4px solid ${priorityColor(task.priority)}`,
                cursor: 'pointer'
              }}>
              {/* Priority + Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{
                  background: priorityColor(task.priority) + '22',
                  color: priorityColor(task.priority),
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize'
                }}>{task.priority}</span>
                <span style={{
                  background: statusColor(task.status) + '22',
                  color: statusColor(task.status),
                  padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold'
                }}>{statusLabel(task.status)}</span>
              </div>

              <h4 style={{ color: 'white', margin: '0 0 6px', fontSize: '15px' }}>{task.title}</h4>

              {task.description && (
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 12px', lineHeight: '1.5',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.description}
                </p>
              )}

              <div style={{ marginBottom: '12px' }}>
                {task.assigned_to_profile && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                    👤 {task.assigned_to_profile.full_name}
                  </div>
                )}
                {task.project && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>📁 {task.project}</div>
                )}
                {task.due_date && (
                  <div style={{ color: isOverdue(task) ? '#ef4444' : '#94a3b8', fontSize: '12px' }}>
                    📅 {isOverdue(task) ? '⚠️ Overdue: ' : 'Due: '}
                    {new Date(task.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}
                onClick={(e) => e.stopPropagation()}>
                {nextStatus(task.status) && (
                  <button onClick={() => updateStatus(task.id, nextStatus(task.status))} style={{
                    flex: 1, padding: '7px', background: '#334155', border: 'none',
                    borderRadius: '7px', color: '#3b82f6', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
                  }}>▶ Move Forward</button>
                )}
                {task.assigned_to === profile?.id && task.status === 'in_progress' && (
                  <button onClick={() => activeTimer?.task.id === task.id ? stopTimer() : startTimer(task)} style={{
                    flex: 1, padding: '7px',
                    background: activeTimer?.task.id === task.id ? '#7f1d1d' : '#14532d',
                    border: 'none', borderRadius: '7px',
                    color: activeTimer?.task.id === task.id ? '#fca5a5' : '#86efac',
                    cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
                  }}>
                    {activeTimer?.task.id === task.id ? '⏹ Stop' : '⏱ Timer'}
                  </button>
                )}
                {(isAdmin || isManager) && (
                  <button onClick={() => openEdit(task)} style={{
                    padding: '7px 10px', background: '#334155', border: 'none',
                    borderRadius: '7px', color: '#94a3b8', cursor: 'pointer', fontSize: '11px'
                  }}>✏️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Task Detail Modal */}
      {showDetail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }} onClick={() => setShowDetail(null)}>
          <div style={{
            background: '#1e293b', borderRadius: '20px',
            width: '100%', maxWidth: '600px', maxHeight: '90vh',
            overflowY: 'auto', border: '1px solid #334155'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Detail Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a5f, #312e81)',
              padding: '24px', borderRadius: '20px 20px 0 0'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <span style={{
                      background: priorityColor(showDetail.priority) + '33',
                      color: priorityColor(showDetail.priority),
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                    }}>{showDetail.priority}</span>
                    <span style={{
                      background: statusColor(showDetail.status) + '33',
                      color: statusColor(showDetail.status),
                      padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold'
                    }}>{statusLabel(showDetail.status)}</span>
                  </div>
                  <h2 style={{ color: 'white', margin: '0 0 8px', fontSize: '20px' }}>{showDetail.title}</h2>
                  {showDetail.description && (
                    <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px', lineHeight: '1.6' }}>
                      {showDetail.description}
                    </p>
                  )}
                </div>
                <button onClick={() => setShowDetail(null)} style={{
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', fontSize: '20px', marginLeft: '12px'
                }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '24px' }}>
              {/* Task Info */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '12px', marginBottom: '20px'
              }}>
                {[
                  { label: 'Assigned To', value: showDetail.assigned_to_profile?.full_name || 'Unassigned' },
                  { label: 'Assigned By', value: showDetail.assigned_by_profile?.full_name || '—' },
                  { label: 'Project', value: showDetail.project || '—' },
                  { label: 'Due Date', value: showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString() : '—' },
                  { label: 'Est. Hours', value: showDetail.estimated_hours ? `${showDetail.estimated_hours}h` : '—' },
                  { label: 'Time Logged', value: formatDuration(getTotalTime(timeLogs)) },
                ].map(item => (
                  <div key={item.label} style={{
                    background: '#0f172a', borderRadius: '8px', padding: '12px'
                  }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '4px' }}>{item.label}</div>
                    <div style={{ color: 'white', fontSize: '13px', fontWeight: 'bold' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Status Actions */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {['todo', 'in_progress', 'review', 'done'].map(s => (
                  <button key={s} onClick={() => updateStatus(showDetail.id, s)} style={{
                    padding: '8px 14px', borderRadius: '8px', border: 'none',
                    background: showDetail.status === s ? statusColor(s) + '33' : '#334155',
                    color: showDetail.status === s ? statusColor(s) : '#94a3b8',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                  }}>{statusLabel(s)}</button>
                ))}
              </div>

              {/* Timer */}
              {showDetail.assigned_to === profile?.id && showDetail.status === 'in_progress' && (
                <div style={{
                  background: '#0f172a', borderRadius: '10px', padding: '16px',
                  marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>Time Tracker</div>
                    <div style={{ color: '#3b82f6', fontSize: '24px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                      {activeTimer?.task.id === showDetail.id ? formatTimer(timerSeconds) : '00:00:00'}
                    </div>
                  </div>
                  <button
                    onClick={() => activeTimer?.task.id === showDetail.id ? stopTimer() : startTimer(showDetail)}
                    style={{
                      padding: '10px 20px', border: 'none', borderRadius: '8px',
                      background: activeTimer?.task.id === showDetail.id ? '#ef4444' : '#10b981',
                      color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
                    }}>
                    {activeTimer?.task.id === showDetail.id ? '⏹ Stop' : '▶ Start'}
                  </button>
                </div>
              )}

              {/* Time Logs */}
              {timeLogs.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ color: 'white', margin: '0 0 12px', fontSize: '14px' }}>
                    ⏱️ Time Logs — Total: {formatDuration(getTotalTime(timeLogs))}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {timeLogs.map(log => (
                      <div key={log.id} style={{
                        background: '#0f172a', borderRadius: '8px', padding: '10px',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div>
                          <div style={{ color: 'white', fontSize: '13px' }}>{log.profiles?.full_name}</div>
                          <div style={{ color: '#94a3b8', fontSize: '11px' }}>
                            {new Date(log.start_time).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '13px' }}>
                          {formatDuration(log.duration_minutes)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              <div>
                <h4 style={{ color: 'white', margin: '0 0 12px', fontSize: '14px' }}>
                  💬 Comments ({comments.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {comments.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                      No comments yet
                    </div>
                  ) : (
                    comments.map(comment => (
                      <div key={comment.id} style={{
                        background: '#0f172a', borderRadius: '10px', padding: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 'bold' }}>
                            {comment.profiles?.full_name}
                          </span>
                          <span style={{ color: '#475569', fontSize: '11px' }}>
                            {new Date(comment.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ color: 'white', fontSize: '13px', lineHeight: '1.5' }}>
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
                    placeholder="Add a comment..."
                    style={{
                      flex: 1, padding: '10px', background: '#0f172a',
                      border: '1px solid #334155', borderRadius: '8px',
                      color: 'white', fontSize: '13px', outline: 'none'
                    }}
                  />
                  <button onClick={() => addComment(showDetail.id)} style={{
                    padding: '10px 16px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    border: 'none', borderRadius: '8px', color: 'white',
                    cursor: 'pointer', fontSize: '14px'
                  }}>➤</button>
                </div>
              </div>

              {/* Admin Actions */}
              {(isAdmin || isManager) && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
                  <button onClick={() => { openEdit(showDetail); setShowDetail(null) }} style={{
                    flex: 1, padding: '10px', background: '#334155', border: 'none',
                    borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '13px'
                  }}>✏️ Edit Task</button>
                  {isAdmin && (
                    <button onClick={() => deleteTask(showDetail.id)} style={{
                      padding: '10px 16px', background: '#7f1d1d', border: 'none',
                      borderRadius: '8px', color: '#fca5a5', cursor: 'pointer', fontSize: '13px'
                    }}>🗑️ Delete</button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '500px', maxHeight: '90vh',
            overflowY: 'auto', border: '1px solid #334155'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>
              {editTask ? '✏️ Edit Task' : '+ New Task'}
            </h3>

            {message && (
              <div style={{
                background: message.includes('❌') ? '#7f1d1d' : '#14532d',
                color: message.includes('❌') ? '#fca5a5' : '#86efac',
                padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
              }}>{message}</div>
            )}

            {[
              { label: 'Task Title *', key: 'title', type: 'text', placeholder: 'Task title...' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Details...' },
              { label: 'Project', key: 'project', type: 'text', placeholder: 'Project name' },
              { label: 'Due Date', key: 'due_date', type: 'date' },
              { label: 'Estimated Hours', key: 'estimated_hours', type: 'number', placeholder: '8' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>{field.label}</label>
                <input type={field.type} value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', padding: '9px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '8px',
                    color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Assign To</label>
              <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
                <option value="">-- Select Employee --</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
                style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
                <option value="low">🟢 Low</option>
                <option value="medium">🔵 Medium</option>
                <option value="high">🟡 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', padding: '9px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
                <option value="todo">📋 Todo</option>
                <option value="in_progress">🔄 In Progress</option>
                <option value="review">👀 Review</option>
                <option value="done">✅ Done</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={closeModal} style={{
                flex: 1, padding: '11px', background: '#334155', border: 'none',
                borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancel</button>
              <button onClick={handleSubmit} style={{
                flex: 2, padding: '11px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
              }}>{editTask ? 'Update Task' : 'Add Task'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
