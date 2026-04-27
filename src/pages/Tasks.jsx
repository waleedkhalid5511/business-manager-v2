import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#94a3b8', icon: '📋' },
  { id: 'in_progress', label: 'In Progress', color: '#2563eb', icon: '🔄' },
  { id: 'review', label: 'In Review', color: '#d97706', icon: '👀' },
  { id: 'done', label: 'Done', color: '#16a34a', icon: '✅' },
]

const DEFAULT_PIPELINE_STAGES = [
  'Waiting for client response',
  'Waiting for data',
  'In editing',
  'Revision requested',
  'Ready for delivery',
  'Delivered'
]

export default function Tasks({ profile }) {
  const [tasks, setTasks] = useState([])
  const [archivedTasks, setArchivedTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [clients, setClients] = useState([])
  const [pipelineStages, setPipelineStages] = useState(DEFAULT_PIPELINE_STAGES)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('kanban')
  const [activeTab, setActiveTab] = useState('active')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('details')
  const [editTask, setEditTask] = useState(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [activeTimer, setActiveTimer] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [comments, setComments] = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [newComment, setNewComment] = useState('')
  const [dragOver, setDragOver] = useState(null)
  const [editingTitle, setEditingTitle] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [newClientName, setNewClientName] = useState('')
  const [showNewClient, setShowNewClient] = useState(false)
  const [newStage, setNewStage] = useState('')
  const [showNewStage, setShowNewStage] = useState(false)
  const [pipelineUpdate, setPipelineUpdate] = useState({ stage: '', percent: 0, note: '' })
  const [form, setForm] = useState({
    title: '', description: '', assigned_to: '',
    project: '', priority: 'medium', status: 'todo',
    due_date: '', estimated_hours: '', client_id: '',
    pipeline_stage: '', pipeline_percent: 0, pipeline_note: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAll()

    const sub = supabase
      .channel(`tasks-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchAll())
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile, filterPriority, filterAssignee, filterClient])

  useEffect(() => {
    let interval
    if (activeTimer) interval = setInterval(() => setTimerSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [activeTimer])

  useEffect(() => {
    if (showDetail) {
      fetchComments(showDetail.id)
      fetchTimeLogs(showDetail.id)
      setPipelineUpdate({
        stage: showDetail.pipeline_stage || '',
        percent: showDetail.pipeline_percent || 0,
        note: showDetail.pipeline_note || ''
      })
    }
  }, [showDetail])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchTasks(), fetchArchivedTasks(), fetchEmployees(), fetchClients(), fetchPipelineStages()])
    setLoading(false)
  }

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select(`*, assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name), assigned_by_profile:profiles!tasks_assigned_by_fkey(id, full_name), client:clients(id, name)`)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      if (filterPriority !== 'all') query = query.eq('priority', filterPriority)
      if (filterAssignee !== 'all') query = query.eq('assigned_to', filterAssignee)
      if (filterClient !== 'all') query = query.eq('client_id', filterClient)
      if (!isAdmin && !isManager) query = query.eq('assigned_to', profile.id)

      const { data, error } = await query
      if (error) throw error
      setTasks(data || [])
    } catch (e) { console.error(e) }
  }

  const fetchArchivedTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select(`*, assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name), client:clients(id, name)`)
        .eq('is_archived', true)
        .order('archived_at', { ascending: false })

      if (!isAdmin && !isManager) query = query.eq('assigned_to', profile.id)

      const { data } = await query
      setArchivedTasks(data || [])
    } catch (e) { console.error(e) }
  }

  const fetchEmployees = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name').eq('is_active', true)
    setEmployees(data || [])
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
  }

  const fetchPipelineStages = async () => {
    const { data } = await supabase.from('pipeline_stages').select('*').order('created_at')
    if (data && data.length > 0) setPipelineStages(data.map(s => s.name))
  }

  const fetchComments = async (taskId) => {
    const { data } = await supabase
      .from('messages').select('*, profiles(full_name, role)')
      .eq('channel_id', taskId).order('created_at', { ascending: true })
    setComments(data || [])
  }

  const fetchTimeLogs = async (taskId) => {
    const { data } = await supabase
      .from('task_time_logs').select('*, profiles(full_name)')
      .eq('task_id', taskId).order('created_at', { ascending: false })
    setTimeLogs(data || [])
  }

  const archiveTask = async (task) => {
    const { error } = await supabase.from('tasks').update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: profile.id
    }).eq('id', task.id)

    if (!error) {
      setMessage(`🗄️ "${task.title}" archived!`)
      setShowDetail(null)
      fetchAll()
    }
  }

  const unarchiveTask = async (task) => {
    const { error } = await supabase.from('tasks').update({
      is_archived: false,
      archived_at: null,
      archived_by: null
    }).eq('id', task.id)

    if (!error) {
      setMessage(`✅ "${task.title}" unarchived!`)
      fetchAll()
    }
  }

  const createClient = async () => {
    if (!newClientName.trim()) return
    const { data, error } = await supabase
      .from('clients')
      .insert({ name: newClientName.trim(), created_by: profile.id })
      .select().single()
    if (!error && data) {
      setClients(prev => [...prev, data])
      setForm(f => ({ ...f, client_id: data.id }))
      setNewClientName('')
      setShowNewClient(false)
      setMessage('✅ Client created!')
    }
  }

  const createPipelineStage = async () => {
    if (!newStage.trim()) return
    await supabase.from('pipeline_stages').insert({ name: newStage.trim(), created_by: profile.id })
    setPipelineStages(prev => [...prev, newStage.trim()])
    setNewStage('')
    setShowNewStage(false)
  }

  const savePipeline = async () => {
    if (!showDetail) return
    const { error } = await supabase.from('tasks').update({
      pipeline_stage: pipelineUpdate.stage,
      pipeline_percent: pipelineUpdate.percent,
      pipeline_note: pipelineUpdate.note
    }).eq('id', showDetail.id)

    if (!error) {
      setMessage('✅ Pipeline updated!')
      setShowDetail(prev => ({ ...prev, ...pipelineUpdate }))
      fetchTasks()
    }
  }

  const handleSubmit = async () => {
    if (!form.title) { setMessage('❌ Title required!'); return }
    const taskData = {
      title: form.title, description: form.description,
      assigned_to: form.assigned_to || null,
      assigned_by: profile.id, project: form.project,
      priority: form.priority, status: form.status,
      due_date: form.due_date || null,
      estimated_hours: parseFloat(form.estimated_hours) || null,
      client_id: form.client_id || null,
      pipeline_stage: form.pipeline_stage || null,
      pipeline_percent: parseInt(form.pipeline_percent) || 0,
      pipeline_note: form.pipeline_note || null,
      is_archived: false
    }
    try {
      if (editTask) {
        const { error } = await supabase.from('tasks').update(taskData).eq('id', editTask.id)
        if (error) throw error
        setMessage('✅ Task updated!')
      } else {
        const { error } = await supabase.from('tasks').insert(taskData)
        if (error) throw error
        setMessage('✅ Task created!')
      }
      fetchTasks()
      closeModal()
    } catch (e) { setMessage('❌ ' + e.message) }
  }

  const updateStatus = async (taskId, newStatus) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
    if (showDetail?.id === taskId) setShowDetail(prev => ({ ...prev, status: newStatus }))
  }

  const updateTitle = async () => {
    if (!editTitle.trim() || !showDetail) return
    await supabase.from('tasks').update({ title: editTitle }).eq('id', showDetail.id)
    setShowDetail(prev => ({ ...prev, title: editTitle }))
    setEditingTitle(false)
    fetchTasks()
  }

  const startTimer = async (task) => {
    try {
      if (activeTimer) await stopTimer()
      const { data, error } = await supabase
        .from('task_time_logs')
        .insert({ task_id: task.id, employee_id: profile.id, start_time: new Date().toISOString(), duration_minutes: 0 })
        .select().single()
      if (error) { setMessage('❌ ' + error.message); return }
      setActiveTimer({ task, logId: data.id })
      setTimerSeconds(0)
      setMessage('▶ Timer started: ' + task.title)
    } catch (e) { setMessage('❌ ' + e.message) }
  }

  const stopTimer = async () => {
    if (!activeTimer) return
    try {
      const duration = Math.max(1, Math.floor(timerSeconds / 60))
      await supabase.from('task_time_logs').update({
        end_time: new Date().toISOString(), duration_minutes: duration
      }).eq('id', activeTimer.logId)
      setMessage(`⏹ ${duration} min logged!`)
      const id = activeTimer.task.id
      setActiveTimer(null)
      setTimerSeconds(0)
      if (showDetail?.id === id) fetchTimeLogs(id)
    } catch (e) { setMessage('❌ ' + e.message) }
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
    if (!window.confirm('Delete this task permanently?')) return
    await supabase.from('tasks').delete().eq('id', taskId)
    fetchAll()
    setShowDetail(null)
  }

  const handleDragStart = (e, task) => e.dataTransfer.setData('taskId', task.id)
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
      due_date: task.due_date || '', estimated_hours: task.estimated_hours || '',
      client_id: task.client_id || '',
      pipeline_stage: task.pipeline_stage || '',
      pipeline_percent: task.pipeline_percent || 0,
      pipeline_note: task.pipeline_note || ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false); setEditTask(null)
    setForm({ title: '', description: '', assigned_to: '', project: '', priority: 'medium', status: 'todo', due_date: '', estimated_hours: '', client_id: '', pipeline_stage: '', pipeline_percent: 0, pipeline_note: '' })
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
    urgent: { color: '#d71920', bg: 'rgba(215,25,32,0.08)' },
    high: { color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
    medium: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    low: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  }

  const isOverdue = (task) =>
    task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  const canStartTimer = (task) => {
    if (isAdmin || isManager) return task.status === 'in_progress'
    return task.assigned_to === profile?.id && task.status === 'in_progress'
  }

  const filtered = tasks.filter(task => {
    if (!search) return true
    return task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.project?.toLowerCase().includes(search.toLowerCase()) ||
      task.client?.name?.toLowerCase().includes(search.toLowerCase())
  })

  const filteredArchived = archivedTasks.filter(task => {
    if (!search) return true
    return task.title?.toLowerCase().includes(search.toLowerCase()) ||
      task.project?.toLowerCase().includes(search.toLowerCase()) ||
      task.client?.name?.toLowerCase().includes(search.toLowerCase())
  })

  const getColumnTasks = (columnId) => filtered.filter(t => t.status === columnId)
  const completionRate = tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'done').length / tasks.length) * 100) : 0

  return (
    <div className="fade-in">
      {/* Active Timer Banner */}
      {activeTimer && (
        <div style={{
          background: 'white', borderRadius: '12px', padding: '14px 20px',
          marginBottom: '20px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', border: '1px solid #e5e5e5',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a', animation: 'pulse 1s infinite' }} />
            <div>
              <div style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Timer Running</div>
              <div style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>{activeTimer.task.title}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ color: '#d71920', fontSize: '24px', fontWeight: '800', fontFamily: 'monospace' }}>
              {formatTimer(timerSeconds)}
            </div>
            <button onClick={stopTimer} className="btn btn-danger btn-sm">⏹ Stop</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Tasks</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {filtered.length} active · {archivedTasks.length} archived · {completionRate}% complete
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {activeTab === 'active' && (
            <div style={{ display: 'flex', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
              {[{ id: 'kanban', icon: '⊞', label: 'Board' }, { id: 'list', icon: '≡', label: 'List' }].map(v => (
                <button key={v.id} onClick={() => setView(v.id)} style={{
                  padding: '7px 14px', border: 'none', cursor: 'pointer',
                  background: view === v.id ? '#d71920' : 'transparent',
                  color: view === v.id ? 'white' : '#888',
                  fontSize: '13px', fontWeight: '600',
                  display: 'flex', alignItems: 'center', gap: '5px'
                }}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          )}
          {(isAdmin || isManager) && activeTab === 'active' && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">+ New Task</button>
          )}
        </div>
      </div>

      {/* Main Tabs — Active / Archived */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', marginBottom: '20px', background: 'white', borderRadius: '12px 12px 0 0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {[
          { id: 'active', label: `✅ Active (${tasks.length})` },
          { id: 'archived', label: `🗄️ Archived (${archivedTasks.length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px 20px', border: 'none', background: 'transparent',
            color: activeTab === tab.id ? '#d71920' : '#888',
            fontWeight: activeTab === tab.id ? '700' : '500',
            fontSize: '13px', cursor: 'pointer',
            borderBottom: activeTab === tab.id ? '2px solid #d71920' : '2px solid transparent',
            whiteSpace: 'nowrap'
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats — only for active */}
      {activeTab === 'active' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Total', value: tasks.length, color: '#888' },
            { label: 'In Progress', value: tasks.filter(t => t.status === 'in_progress').length, color: '#2563eb' },
            { label: 'Done', value: tasks.filter(t => t.status === 'done').length, color: '#16a34a' },
            { label: 'Overdue', value: tasks.filter(t => isOverdue(t)).length, color: '#d71920' },
            { label: 'Completion', value: `${completionRate}%`, color: '#7c3aed' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'white', borderRadius: '10px', padding: '14px',
              textAlign: 'center', border: `1px solid ${stat.color}22`,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
            }}>
              <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
              <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Search tasks, clients..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 14px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}
        />
        {activeTab === 'active' && (
          <>
            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
              style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
              <option value="all">All Priority</option>
              <option value="urgent">🔴 Urgent</option>
              <option value="high">🟡 High</option>
              <option value="medium">🔵 Medium</option>
              <option value="low">🟢 Low</option>
            </select>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
              style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {(isAdmin || isManager) && (
              <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)}
                style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
                <option value="all">All Members</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
              </select>
            )}
          </>
        )}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : message.includes('🗄️') ? 'rgba(37,99,235,0.08)' : 'rgba(22,163,74,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' : message.includes('🗄️') ? 'rgba(37,99,235,0.2)' : 'rgba(22,163,74,0.2)'}`,
          color: message.includes('❌') ? '#d71920' : message.includes('🗄️') ? '#2563eb' : '#16a34a',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* ===== ARCHIVED TAB ===== */}
      {activeTab === 'archived' && (
        <div>
          {filteredArchived.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-icon">🗄️</div>
              <div className="empty-title">No archived tasks</div>
              <div className="empty-desc">Archived tasks will appear here</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredArchived.map(task => (
                <div key={task.id} style={{
                  background: 'white', borderRadius: '10px', padding: '14px 16px',
                  border: '1px solid #e5e5e5', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center',
                  opacity: 0.8, gap: '12px'
                }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ color: '#111', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      {task.client && (
                        <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '600' }}>
                          👤 {task.client.name}
                        </span>
                      )}
                      {task.project && (
                        <span style={{ color: '#888', fontSize: '11px' }}>📁 {task.project}</span>
                      )}
                      {task.assigned_to_profile && (
                        <span style={{ color: '#888', fontSize: '11px' }}>
                          👤 {task.assigned_to_profile.full_name}
                        </span>
                      )}
                      {task.archived_at && (
                        <span style={{ color: '#bbb', fontSize: '11px' }}>
                          Archived: {new Date(task.archived_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      background: `${priorityConfig[task.priority]?.bg}`,
                      color: priorityConfig[task.priority]?.color,
                      padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                    }}>
                      {task.priority}
                    </span>
                    <button onClick={() => unarchiveTask(task)} className="btn btn-sm" style={{
                      background: 'rgba(22,163,74,0.08)', color: '#16a34a',
                      border: '1px solid rgba(22,163,74,0.2)'
                    }}>
                      ↩️ Unarchive
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteTask(task.id)} className="btn btn-danger btn-sm">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== ACTIVE TAB ===== */}
      {activeTab === 'active' && (
        <>
          {loading ? (
            <div style={{ display: 'flex', gap: '16px' }}>
              {COLUMNS.map(col => <div key={col.id} className="skeleton" style={{ minWidth: '280px', height: '400px', borderRadius: '12px' }} />)}
            </div>
          ) : view === 'kanban' ? (
            <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px', minHeight: '500px' }}>
              {COLUMNS.map(col => {
                const colTasks = getColumnTasks(col.id)
                return (
                  <div key={col.id} className="kanban-column"
                    style={{
                      border: dragOver === col.id ? `2px dashed ${col.color}` : '1px solid #e5e5e5',
                      background: dragOver === col.id ? `${col.color}08` : 'white'
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(col.id) }}
                    onDragLeave={() => setDragOver(null)}
                    onDrop={(e) => handleDrop(e, col.id)}
                  >
                    <div className="kanban-column-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: col.color }} />
                        <span style={{ color: '#111', fontWeight: '700', fontSize: '13px' }}>{col.label}</span>
                      </div>
                      <div style={{ background: `${col.color}15`, color: col.color, borderRadius: '20px', padding: '2px 8px', fontSize: '12px', fontWeight: '700' }}>
                        {colTasks.length}
                      </div>
                    </div>

                    <div className="kanban-cards">
                      {colTasks.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 16px', color: '#bbb', fontSize: '12px', border: '2px dashed #e5e5e5', borderRadius: '8px', margin: '4px' }}>
                          Drop tasks here
                        </div>
                      ) : (
                        colTasks.map(task => (
                          <div key={task.id} className="kanban-card"
                            draggable onDragStart={(e) => handleDragStart(e, task)}
                            onClick={() => { setShowDetail(task); setDetailTab('details') }}
                            style={{ borderTop: `3px solid ${priorityConfig[task.priority]?.color || '#e5e5e5'}` }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ background: priorityConfig[task.priority]?.bg, color: priorityConfig[task.priority]?.color, padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>
                                {task.priority?.toUpperCase()}
                              </span>
                              {isOverdue(task) && (
                                <span style={{ background: 'rgba(215,25,32,0.1)', color: '#d71920', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700' }}>OVERDUE</span>
                              )}
                            </div>

                            <div style={{ color: '#111', fontSize: '13px', fontWeight: '700', marginBottom: '6px', lineHeight: '1.4' }}>
                              {task.title}
                            </div>

                            {task.client && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(215,25,32,0.06)', padding: '2px 8px', borderRadius: '4px', marginBottom: '6px', color: '#d71920', fontSize: '11px', fontWeight: '600' }}>
                                👤 {task.client.name}
                              </div>
                            )}

                            {task.project && (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px', marginBottom: '8px', color: '#888', fontSize: '11px' }}>
                                📁 {task.project}
                              </div>
                            )}

                            {task.pipeline_percent > 0 && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                                  <span style={{ color: '#888', fontSize: '10px' }}>{task.pipeline_stage || 'In Progress'}</span>
                                  <span style={{ color: '#d71920', fontSize: '10px', fontWeight: '700' }}>{task.pipeline_percent}%</span>
                                </div>
                                <div className="progress-bar" style={{ height: '4px' }}>
                                  <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                                </div>
                              </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              {task.assigned_to_profile ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                  <div className="avatar" style={{ width: '22px', height: '22px', fontSize: '10px' }}>
                                    {task.assigned_to_profile.full_name?.charAt(0).toUpperCase()}
                                  </div>
                                  <span style={{ color: '#888', fontSize: '11px' }}>
                                    {task.assigned_to_profile.full_name?.split(' ')[0]}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: '#bbb', fontSize: '11px' }}>Unassigned</span>
                              )}
                              {task.due_date && (
                                <div style={{ color: isOverdue(task) ? '#d71920' : '#888', fontSize: '11px' }}>
                                  {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </div>
                              )}
                            </div>

                            {canStartTimer(task) && (
                              <div onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => activeTimer?.task.id === task.id ? stopTimer() : startTimer(task)}
                                  className="btn btn-sm"
                                  style={{
                                    width: '100%', justifyContent: 'center',
                                    background: activeTimer?.task.id === task.id ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                                    color: activeTimer?.task.id === task.id ? '#d71920' : '#16a34a',
                                    border: `1px solid ${activeTimer?.task.id === task.id ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`
                                  }}
                                >
                                  {activeTimer?.task.id === task.id ? `⏹ ${formatTimer(timerSeconds)}` : '▶ Start Timer'}
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {(isAdmin || isManager) && (
                        <button
                          onClick={() => { setForm(f => ({ ...f, status: col.id })); setShowModal(true) }}
                          style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px dashed #e5e5e5', borderRadius: '8px', color: '#bbb', cursor: 'pointer', fontSize: '12px', marginTop: '4px', transition: 'all 0.2s' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = col.color; e.currentTarget.style.color = col.color }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e5e5'; e.currentTarget.style.color = '#bbb' }}
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
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Task</th><th>Client</th><th>Assignee</th><th>Priority</th><th>Pipeline</th><th>Status</th><th>Due</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>No tasks found</td></tr>
                  ) : (
                    filtered.map(task => (
                      <tr key={task.id} style={{ cursor: 'pointer' }}
                        onClick={() => { setShowDetail(task); setDetailTab('details') }}>
                        <td>
                          <div style={{ fontWeight: '700', color: '#111' }}>{task.title}</div>
                          {task.project && <div style={{ color: '#888', fontSize: '11px' }}>📁 {task.project}</div>}
                        </td>
                        <td>
                          {task.client ? <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '600' }}>👤 {task.client.name}</span>
                            : <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}
                        </td>
                        <td>
                          {task.assigned_to_profile ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div className="avatar avatar-sm">{task.assigned_to_profile.full_name?.charAt(0).toUpperCase()}</div>
                              <span style={{ color: '#444', fontSize: '13px' }}>{task.assigned_to_profile.full_name}</span>
                            </div>
                          ) : <span style={{ color: '#ccc', fontSize: '12px' }}>Unassigned</span>}
                        </td>
                        <td>
                          <span className="badge" style={{ background: priorityConfig[task.priority]?.bg, color: priorityConfig[task.priority]?.color }}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          {task.pipeline_percent > 0 ? (
                            <div style={{ minWidth: '80px' }}>
                              <div className="progress-bar" style={{ marginBottom: '3px' }}>
                                <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                              </div>
                              <span style={{ color: '#888', fontSize: '11px' }}>{task.pipeline_percent}%</span>
                            </div>
                          ) : <span style={{ color: '#ccc', fontSize: '12px' }}>—</span>}
                        </td>
                        <td>
                          <span className="badge" style={{
                            background: `${COLUMNS.find(c => c.id === task.status)?.color}15`,
                            color: COLUMNS.find(c => c.id === task.status)?.color
                          }}>
                            {COLUMNS.find(c => c.id === task.status)?.label}
                          </span>
                        </td>
                        <td style={{ color: isOverdue(task) ? '#d71920' : '#888', fontSize: '13px' }}>
                          {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        </td>
                        <td onClick={e => e.stopPropagation()}>
                          <button onClick={() => archiveTask(task)} className="btn btn-sm" style={{
                            background: 'rgba(37,99,235,0.08)', color: '#2563eb',
                            border: '1px solid rgba(37,99,235,0.2)', fontSize: '11px'
                          }}>
                            🗄️
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* TASK DETAIL MODAL */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%',
            maxWidth: '700px', maxHeight: '90vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            animation: 'bounceIn 0.3s ease', boxShadow: '0 24px 64px rgba(0,0,0,0.15)'
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #111, #333)', padding: '20px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, marginRight: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ background: priorityConfig[showDetail.priority]?.bg, color: priorityConfig[showDetail.priority]?.color }}>
                      {showDetail.priority}
                    </span>
                    <span className="badge" style={{
                      background: `${COLUMNS.find(c => c.id === showDetail.status)?.color}20`,
                      color: COLUMNS.find(c => c.id === showDetail.status)?.color
                    }}>
                      {COLUMNS.find(c => c.id === showDetail.status)?.label}
                    </span>
                    {showDetail.client && (
                      <span className="badge" style={{ background: 'rgba(215,25,32,0.2)', color: '#ff6b6b' }}>
                        👤 {showDetail.client.name}
                      </span>
                    )}
                    {isOverdue(showDetail) && (
                      <span className="badge" style={{ background: 'rgba(215,25,32,0.2)', color: '#ff6b6b' }}>OVERDUE</span>
                    )}
                  </div>

                  {editingTitle ? (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && updateTitle()}
                        style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'white', fontSize: '16px', fontWeight: '700', outline: 'none' }}
                        autoFocus />
                      <button onClick={updateTitle} className="btn btn-primary btn-sm">Save</button>
                      <button onClick={() => setEditingTitle(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', padding: '5px 10px' }}>✕</button>
                    </div>
                  ) : (
                    <h2 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '800', cursor: 'pointer', lineHeight: '1.3' }}
                      onClick={() => { setEditingTitle(true); setEditTitle(showDetail.title) }}>
                      {showDetail.title}
                      <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>✏️</span>
                    </h2>
                  )}
                </div>
                <button onClick={() => setShowDetail(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e5e5e5', padding: '0 24px', background: 'white', flexShrink: 0, overflowX: 'auto' }}>
              {[
                { id: 'details', label: '📋 Details' },
                { id: 'pipeline', label: '📊 Pipeline' },
                { id: 'timer', label: '⏱ Time' },
                { id: 'comments', label: `💬 Comments (${comments.length})` },
              ].map(tab => (
                <button key={tab.id} onClick={() => setDetailTab(tab.id)} style={{
                  padding: '12px 16px', border: 'none', background: 'transparent',
                  color: detailTab === tab.id ? '#d71920' : '#888',
                  fontWeight: detailTab === tab.id ? '700' : '500',
                  fontSize: '13px', cursor: 'pointer',
                  borderBottom: detailTab === tab.id ? '2px solid #d71920' : '2px solid transparent',
                  marginBottom: '-1px', whiteSpace: 'nowrap'
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

              {/* DETAILS */}
              {detailTab === 'details' && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    {[
                      { label: 'Assigned To', value: showDetail.assigned_to_profile?.full_name || 'Unassigned' },
                      { label: 'Project', value: showDetail.project || '—' },
                      { label: 'Client', value: showDetail.client?.name || '—' },
                      { label: 'Due Date', value: showDetail.due_date ? new Date(showDetail.due_date).toLocaleDateString() : '—' },
                      { label: 'Est. Hours', value: showDetail.estimated_hours ? `${showDetail.estimated_hours}h` : '—' },
                      { label: 'Created By', value: showDetail.assigned_by_profile?.full_name || '—' },
                    ].map(item => (
                      <div key={item.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '10px' }}>
                        <div style={{ color: '#bbb', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
                        <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>

                  {showDetail.description && (
                    <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '16px', marginBottom: '20px', border: '1px solid #e5e5e5' }}>
                      <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Description</div>
                      <div style={{ color: '#333', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{showDetail.description}</div>
                    </div>
                  )}

                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Move To</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {COLUMNS.map(col => (
                        <button key={col.id} onClick={() => updateStatus(showDetail.id, col.id)} style={{
                          padding: '6px 14px', borderRadius: '20px', border: 'none',
                          background: showDetail.status === col.id ? col.color : `${col.color}12`,
                          color: showDetail.status === col.id ? 'white' : col.color,
                          cursor: 'pointer', fontSize: '12px', fontWeight: '700', transition: 'all 0.2s'
                        }}>
                          {col.icon} {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid #e5e5e5', flexWrap: 'wrap' }}>
                    {(isAdmin || isManager) && (
                      <button onClick={() => { openEdit(showDetail); setShowDetail(null) }} className="btn btn-secondary btn-sm">✏️ Edit</button>
                    )}
                    <button onClick={() => archiveTask(showDetail)} className="btn btn-sm" style={{
                      background: 'rgba(37,99,235,0.08)', color: '#2563eb', border: '1px solid rgba(37,99,235,0.2)'
                    }}>
                      🗄️ Archive
                    </button>
                    {isAdmin && (
                      <button onClick={() => deleteTask(showDetail.id)} className="btn btn-danger btn-sm">🗑️ Delete</button>
                    )}
                  </div>
                </div>
              )}

              {/* PIPELINE */}
              {detailTab === 'pipeline' && (
                <div>
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>Current Stage</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                    {pipelineStages.map(stage => (
                      <button key={stage} onClick={() => setPipelineUpdate(prev => ({ ...prev, stage }))} style={{
                        padding: '8px 14px', borderRadius: '20px',
                        border: `1px solid ${pipelineUpdate.stage === stage ? '#d71920' : '#e5e5e5'}`,
                        background: pipelineUpdate.stage === stage ? 'rgba(215,25,32,0.08)' : 'white',
                        color: pipelineUpdate.stage === stage ? '#d71920' : '#666',
                        cursor: 'pointer', fontSize: '13px', fontWeight: pipelineUpdate.stage === stage ? '700' : '500', transition: 'all 0.2s'
                      }}>
                        {pipelineUpdate.stage === stage ? '✓ ' : ''}{stage}
                      </button>
                    ))}
                    {showNewStage ? (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input value={newStage} onChange={(e) => setNewStage(e.target.value)}
                          placeholder="Stage name..." onKeyPress={(e) => e.key === 'Enter' && createPipelineStage()}
                          style={{ padding: '7px 12px', border: '1px solid #e5e5e5', borderRadius: '20px', fontSize: '13px', outline: 'none' }} autoFocus />
                        <button onClick={createPipelineStage} className="btn btn-primary btn-sm">Add</button>
                        <button onClick={() => setShowNewStage(false)} className="btn btn-secondary btn-sm">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewStage(true)} style={{ padding: '8px 14px', borderRadius: '20px', border: '1px dashed #e5e5e5', background: 'white', color: '#bbb', cursor: 'pointer', fontSize: '13px' }}>+ Custom</button>
                    )}
                  </div>

                  <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '1px solid #e5e5e5' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: '#888', fontSize: '13px', fontWeight: '600' }}>Completion</span>
                      <span style={{ color: '#d71920', fontSize: '20px', fontWeight: '800' }}>{pipelineUpdate.percent}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={pipelineUpdate.percent}
                      onChange={(e) => setPipelineUpdate(prev => ({ ...prev, percent: parseInt(e.target.value) }))}
                      style={{ width: '100%', accentColor: '#d71920', marginBottom: '12px', cursor: 'pointer' }} />
                    <div className="progress-bar" style={{ height: '10px' }}>
                      <div className="progress-fill" style={{ width: `${pipelineUpdate.percent}%` }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '12px', flexWrap: 'wrap' }}>
                      {[0, 25, 50, 75, 100].map(p => (
                        <button key={p} onClick={() => setPipelineUpdate(prev => ({ ...prev, percent: p }))} style={{
                          padding: '4px 12px', borderRadius: '6px',
                          border: `1px solid ${pipelineUpdate.percent === p ? '#d71920' : '#e5e5e5'}`,
                          background: pipelineUpdate.percent === p ? 'rgba(215,25,32,0.08)' : 'white',
                          color: pipelineUpdate.percent === p ? '#d71920' : '#888',
                          cursor: 'pointer', fontSize: '12px', fontWeight: '600'
                        }}>{p}%</button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Update / Notes</label>
                    <textarea value={pipelineUpdate.note}
                      onChange={(e) => setPipelineUpdate(prev => ({ ...prev, note: e.target.value }))}
                      placeholder="What's happening? Client feedback? Next steps?..."
                      rows={4}
                      style={{ width: '100%', padding: '12px', border: '1.5px solid #e5e5e5', borderRadius: '10px', fontSize: '14px', outline: 'none', resize: 'vertical', lineHeight: '1.5', boxSizing: 'border-box', fontFamily: 'inherit', color: '#111' }}
                      onFocus={e => e.target.style.borderColor = '#d71920'}
                      onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                    />
                  </div>

                  <button onClick={savePipeline} className="btn btn-primary">💾 Save Pipeline Update</button>

                  {showDetail.pipeline_stage && (
                    <div style={{ background: 'rgba(215,25,32,0.04)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(215,25,32,0.1)', marginTop: '16px' }}>
                      <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Last Saved</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{ color: '#d71920', fontWeight: '700', fontSize: '14px' }}>{showDetail.pipeline_stage}</span>
                        <span style={{ background: '#d71920', color: 'white', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>{showDetail.pipeline_percent}%</span>
                      </div>
                      {showDetail.pipeline_note && <div style={{ color: '#555', fontSize: '13px', lineHeight: '1.6' }}>{showDetail.pipeline_note}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* TIMER */}
              {detailTab === 'timer' && (
                <div>
                  {canStartTimer(showDetail) && (
                    <div style={{ background: '#f9f9f9', borderRadius: '12px', padding: '24px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #e5e5e5' }}>
                      <div>
                        <div style={{ color: '#888', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Time Tracker</div>
                        <div style={{ color: '#d71920', fontSize: '32px', fontWeight: '800', fontFamily: 'monospace' }}>
                          {activeTimer?.task.id === showDetail.id ? formatTimer(timerSeconds) : '00:00:00'}
                        </div>
                        <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>
                          Total: {formatDuration(getTotalTime(timeLogs))}
                        </div>
                      </div>
                      <button onClick={() => activeTimer?.task.id === showDetail.id ? stopTimer() : startTimer(showDetail)}
                        className="btn btn-lg" style={{
                          background: activeTimer?.task.id === showDetail.id ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                          color: activeTimer?.task.id === showDetail.id ? '#d71920' : '#16a34a',
                          border: `1.5px solid ${activeTimer?.task.id === showDetail.id ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
                          fontWeight: '700', fontSize: '15px', padding: '12px 24px'
                        }}>
                        {activeTimer?.task.id === showDetail.id ? '⏹ Stop Timer' : '▶ Start Timer'}
                      </button>
                    </div>
                  )}
                  {timeLogs.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">⏱</div><div className="empty-desc">No time logs yet</div></div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                        Logs — Total: {formatDuration(getTotalTime(timeLogs))}
                      </div>
                      {timeLogs.map(log => (
                        <div key={log.id} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e5e5' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className="avatar avatar-sm">{log.profiles?.full_name?.charAt(0).toUpperCase()}</div>
                            <div>
                              <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{log.profiles?.full_name}</div>
                              <div style={{ color: '#888', fontSize: '11px' }}>
                                {new Date(log.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(log.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                {log.end_time && ' → ' + new Date(log.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                          <div style={{ color: '#d71920', fontWeight: '800', fontSize: '14px', background: 'rgba(215,25,32,0.08)', padding: '4px 12px', borderRadius: '20px' }}>
                            {log.end_time ? formatDuration(log.duration_minutes) : '⏱ Running...'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* COMMENTS */}
              {detailTab === 'comments' && (
                <div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
                    {comments.length === 0 ? (
                      <div className="empty-state" style={{ padding: '30px' }}><div className="empty-icon">💬</div><div className="empty-desc">No comments yet</div></div>
                    ) : (
                      comments.map(comment => (
                        <div key={comment.id} style={{ background: '#f9f9f9', borderRadius: '10px', padding: '14px', border: '1px solid #e5e5e5' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar avatar-sm">{comment.profiles?.full_name?.charAt(0).toUpperCase()}</div>
                              <span style={{ color: '#d71920', fontSize: '13px', fontWeight: '700' }}>{comment.profiles?.full_name}</span>
                            </div>
                            <span style={{ color: '#bbb', fontSize: '11px' }}>
                              {new Date(comment.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div style={{ color: '#333', fontSize: '14px', lineHeight: '1.5' }}>{comment.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="text" value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addComment(showDetail.id)}
                      placeholder="Write a comment..." className="input" />
                    <button onClick={() => addComment(showDetail.id)} className="btn btn-primary btn-sm">Send</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #e5e5e5', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>
                {editTask ? '✏️ Edit Task' : '+ New Task'}
              </h3>
              <button onClick={closeModal} style={{ background: '#f5f5f5', border: 'none', borderRadius: '8px', color: '#888', cursor: 'pointer', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{ background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)', color: message.includes('❌') ? '#d71920' : '#16a34a', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>{message}</div>
              )}

              {[
                { label: 'Task Title *', key: 'title', type: 'text', placeholder: 'Enter task title...' },
                { label: 'Description', key: 'description', type: 'text', placeholder: 'Task details...' },
                { label: 'Project', key: 'project', type: 'text', placeholder: 'Project name' },
                { label: 'Due Date', key: 'due_date', type: 'date' },
                { label: 'Estimated Hours', key: 'estimated_hours', type: 'number', placeholder: '8' },
              ].map(field => (
                <div key={field.key} style={{ marginBottom: '14px' }}>
                  <label className="input-label">{field.label}</label>
                  <input type={field.type} value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder} className="input" />
                </div>
              ))}

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Client</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="input" style={{ flex: 1 }}>
                    <option value="">-- No Client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {showNewClient ? (
                    <>
                      <input value={newClientName} onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Client name..." className="input" style={{ flex: 1 }}
                        onKeyPress={(e) => e.key === 'Enter' && createClient()} autoFocus />
                      <button onClick={createClient} className="btn btn-primary btn-sm">Add</button>
                      <button onClick={() => setShowNewClient(false)} className="btn btn-secondary btn-sm">✕</button>
                    </>
                  ) : (
                    <button onClick={() => setShowNewClient(true)} className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>+ New</button>
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Assign To</label>
                <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="input">
                  <option value="">-- Select Member --</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="input">
                    <option value="low">🟢 Low</option>
                    <option value="medium">🔵 Medium</option>
                    <option value="high">🟡 High</option>
                    <option value="urgent">🔴 Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                    {COLUMNS.map(col => <option key={col.id} value={col.id}>{col.icon} {col.label}</option>)}
                    <option value="cancelled">❌ Cancelled</option>
                  </select>
                </div>
              </div>

              <div style={{ background: '#f9f9f9', borderRadius: '10px', padding: '14px', marginBottom: '20px', border: '1px solid #e5e5e5' }}>
                <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Pipeline (Optional)</div>
                <div style={{ marginBottom: '10px' }}>
                  <label className="input-label">Stage</label>
                  <select value={form.pipeline_stage} onChange={(e) => setForm({ ...form, pipeline_stage: e.target.value })} className="input">
                    <option value="">-- Select Stage --</option>
                    {pipelineStages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="input-label">Completion %: {form.pipeline_percent}%</label>
                  <input type="range" min="0" max="100" value={form.pipeline_percent}
                    onChange={(e) => setForm({ ...form, pipeline_percent: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: '#d71920' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={closeModal} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
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
