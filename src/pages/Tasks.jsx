import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Tasks({ profile }) {
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [message, setMessage] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
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
  }, [profile, filterStatus])

  useEffect(() => {
    let interval
    if (activeTimer) {
      interval = setInterval(() => {
        setTimerSeconds(s => s + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const fetchTasks = async () => {
    setLoading(true)
    let query = supabase
      .from('tasks')
      .select(`
        *,
        assigned_to_profile:profiles!tasks_assigned_to_fkey(full_name),
        assigned_by_profile:profiles!tasks_assigned_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false })

    if (filterStatus !== 'all') query = query.eq('status', filterStatus)
    if (!isAdmin && !isManager) query = query.eq('assigned_to', profile.id)

    const { data } = await query
    setTasks(data || [])
    setLoading(false)
  }

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles').select('id, full_name').eq('is_active', true)
    setEmployees(data || [])
  }

  const handleSubmit = async () => {
    if (!form.title) { setMessage('❌ Task title zaroori hai!'); return }

    const taskData = {
      title: form.title, description: form.description,
      assigned_to: form.assigned_to || null,
      assigned_by: profile.id,
      project: form.project, priority: form.priority,
      status: form.status, due_date: form.due_date || null,
      estimated_hours: parseFloat(form.estimated_hours) || null
    }

    if (editTask) {
      const { error } = await supabase.from('tasks').update(taskData).eq('id', editTask.id)
      if (error) setMessage('❌ ' + error.message)
      else { setMessage('✅ Task update ho gaya!'); fetchTasks(); closeModal() }
    } else {
      const { error } = await supabase.from('tasks').insert(taskData)
      if (error) setMessage('❌ ' + error.message)
      else { setMessage('✅ Task add ho gaya!'); fetchTasks(); closeModal() }
    }
  }

  const updateStatus = async (taskId, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    fetchTasks()
  }

  const startTimer = async (task) => {
    const { data } = await supabase
      .from('task_time_logs')
      .insert({
        task_id: task.id,
        employee_id: profile.id,
        start_time: new Date().toISOString()
      })
      .select().single()
    setActiveTimer({ task, logId: data?.id })
    setTimerSeconds(0)
  }

  const stopTimer = async () => {
    if (!activeTimer) return
    const duration = Math.floor(timerSeconds / 60)
    await supabase.from('task_time_logs').update({
      end_time: new Date().toISOString(),
      duration_minutes: duration
    }).eq('id', activeTimer.logId)
    setMessage(`✅ Timer stop! ${duration} minute log ho gaye.`)
    setActiveTimer(null)
    setTimerSeconds(0)
  }

  const formatTimer = (seconds) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
    setForm({
      title: '', description: '', assigned_to: '',
      project: '', priority: 'medium', status: 'todo',
      due_date: '', estimated_hours: ''
    })
    setMessage('')
  }

  const priorityColor = (p) => {
    const c = { low: '#10b981', medium: '#3b82f6', high: '#f59e0b', urgent: '#ef4444' }
    return c[p] || '#94a3b8'
  }

  const statusColor = (s) => {
    const c = { todo: '#94a3b8', in_progress: '#3b82f6', review: '#f59e0b', done: '#10b981', cancelled: '#ef4444' }
    return c[s] || '#94a3b8'
  }

  const statusLabel = (s) => {
    const l = { todo: '📋 Todo', in_progress: '🔄 In Progress', review: '👀 Review', done: '✅ Done', cancelled: '❌ Cancelled' }
    return l[s] || s
  }

  const nextStatus = (s) => {
    const flow = { todo: 'in_progress', in_progress: 'review', review: 'done' }
    return flow[s]
  }

  return (
    <div>
      {/* Active Timer Banner */}
      {activeTimer && (
        <div style={{
          background: 'linear-gradient(135deg, #1e3a5f, #312e81)',
          borderRadius: '12px', padding: '16px 20px',
          marginBottom: '20px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          border: '1px solid #3b82f6'
        }}>
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>Timer chal raha hai</div>
            <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
              ⏱️ {activeTimer.task.title}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#3b82f6', fontSize: '28px', fontWeight: 'bold', fontFamily: 'monospace' }}>
              {formatTimer(timerSeconds)}
            </div>
            <button onClick={stopTimer} style={{
              background: '#ef4444', border: 'none', borderRadius: '8px',
              padding: '8px 16px', color: 'white', cursor: 'pointer', fontWeight: 'bold'
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
          <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: '22px' }}>✅ Tasks</h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>{tasks.length} tasks</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '9px 12px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: '8px',
              color: 'white', fontSize: '13px', outline: 'none'
            }}
          >
            <option value="all">Sab Tasks</option>
            <option value="todo">Todo</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: '8px', padding: '9px 18px',
              color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
            }}>
              + Task Add
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? '#7f1d1d' : '#14532d',
          color: message.includes('❌') ? '#fca5a5' : '#86efac',
          padding: '10px 14px', borderRadius: '8px',
          marginBottom: '16px', fontSize: '13px'
        }}>
          {message}
        </div>
      )}

      {/* Tasks Grid */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : tasks.length === 0 ? (
        <div style={{
          background: '#1e293b', borderRadius: '12px',
          padding: '40px', textAlign: 'center', color: '#94a3b8'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
          <p>Koi task nahi mila!</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {tasks.map(task => (
            <div key={task.id} style={{
              background: '#1e293b', borderRadius: '12px',
              padding: '18px', border: '1px solid #334155',
              borderLeft: `4px solid ${priorityColor(task.priority)}`
            }}>
              {/* Priority + Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{
                  background: priorityColor(task.priority) + '22',
                  color: priorityColor(task.priority),
                  padding: '2px 8px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize'
                }}>
                  {task.priority}
                </span>
                <span style={{
                  background: statusColor(task.status) + '22',
                  color: statusColor(task.status),
                  padding: '2px 8px', borderRadius: '20px',
                  fontSize: '11px', fontWeight: 'bold'
                }}>
                  {statusLabel(task.status)}
                </span>
              </div>

              {/* Title */}
              <h4 style={{ color: 'white', margin: '0 0 6px', fontSize: '15px' }}>
                {task.title}
              </h4>

              {/* Description */}
              {task.description && (
                <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 12px', lineHeight: '1.5' }}>
                  {task.description}
                </p>
              )}

              {/* Meta */}
              <div style={{ marginBottom: '14px' }}>
                {task.assigned_to_profile && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                    👤 {task.assigned_to_profile.full_name}
                  </div>
                )}
                {task.project && (
                  <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>
                    📁 {task.project}
                  </div>
                )}
                {task.due_date && (
                  <div style={{
                    color: new Date(task.due_date) < new Date() ? '#ef4444' : '#94a3b8',
                    fontSize: '12px'
                  }}>
                    📅 Due: {new Date(task.due_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {nextStatus(task.status) && (
                  <button
                    onClick={() => updateStatus(task.id, nextStatus(task.status))}
                    style={{
                      flex: 1, padding: '7px', background: '#334155',
                      border: 'none', borderRadius: '7px',
                      color: '#3b82f6', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 'bold'
                    }}
                  >
                    ▶ Move Forward
                  </button>
                )}

                {/* Timer Button */}
                {task.assigned_to === profile?.id && task.status === 'in_progress' && (
                  <button
                    onClick={() => activeTimer?.task.id === task.id ? stopTimer() : startTimer(task)}
                    style={{
                      flex: 1, padding: '7px',
                      background: activeTimer?.task.id === task.id ? '#7f1d1d' : '#14532d',
                      border: 'none', borderRadius: '7px',
                      color: activeTimer?.task.id === task.id ? '#fca5a5' : '#86efac',
                      cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
                    }}
                  >
                    {activeTimer?.task.id === task.id ? '⏹ Stop' : '⏱ Timer'}
                  </button>
                )}

                {(isAdmin || isManager) && (
                  <button onClick={() => openEdit(task)} style={{
                    padding: '7px 10px', background: '#334155',
                    border: 'none', borderRadius: '7px',
                    color: '#94a3b8', cursor: 'pointer', fontSize: '11px'
                  }}>✏️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '500px',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>
              {editTask ? '✏️ Task Edit' : '+ Naya Task'}
            </h3>

            {message && (
              <div style={{
                background: message.includes('❌') ? '#7f1d1d' : '#14532d',
                color: message.includes('❌') ? '#fca5a5' : '#86efac',
                padding: '10px', borderRadius: '8px',
                marginBottom: '16px', fontSize: '13px'
              }}>{message}</div>
            )}

            {[
              { label: 'Task Title *', key: 'title', type: 'text', placeholder: 'Website design karna hai' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Details...' },
              { label: 'Project', key: 'project', type: 'text', placeholder: 'Project Alpha' },
              { label: 'Due Date', key: 'due_date', type: 'date' },
              { label: 'Estimated Hours', key: 'estimated_hours', type: 'number', placeholder: '8' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {field.label}
                </label>
                <input
                  type={field.type} value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{
                    width: '100%', padding: '9px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '8px',
                    color: 'white', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Assign To
              </label>
              <select value={form.assigned_to}
                onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                style={{
                  width: '100%', padding: '9px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="">-- Employee Select Karein --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Priority</label>
              <select value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                style={{
                  width: '100%', padding: '9px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="low">🟢 Low</option>
                <option value="medium">🔵 Medium</option>
                <option value="high">🟡 High</option>
                <option value="urgent">🔴 Urgent</option>
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Status</label>
              <select value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{
                  width: '100%', padding: '9px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="todo">📋 Todo</option>
                <option value="in_progress">🔄 In Progress</option>
                <option value="review">👀 Review</option>
                <option value="done">✅ Done</option>
                <option value="cancelled">❌ Cancelled</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={closeModal} style={{
                flex: 1, padding: '11px', background: '#334155',
                border: 'none', borderRadius: '8px',
                color: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancel</button>
              <button onClick={handleSubmit} style={{
                flex: 2, padding: '11px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
              }}>{editTask ? 'Update Karein' : 'Task Add Karein'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
