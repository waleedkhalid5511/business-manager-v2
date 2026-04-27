import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Pending', color: '#888', icon: '⏳' },
  { id: 'approved', label: 'Approved', color: '#2563eb', icon: '✅' },
  { id: 'in_progress', label: 'In Progress', color: '#d97706', icon: '🔄' },
  { id: 'delivered', label: 'Delivered', color: '#16a34a', icon: '🚀' },
  { id: 'on_hold', label: 'On Hold', color: '#7c3aed', icon: '⏸️' },
]

export default function Projects({ profile }) {
  const [projects, setProjects] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('board')
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [detailTab, setDetailTab] = useState('overview')
  const [editProject, setEditProject] = useState(null)
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [projectTasks, setProjectTasks] = useState([])
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', client_id: '',
    deadline: '', budget: '', status: 'pending',
    priority: 'medium', notes: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAll()

    // ⚡ Realtime
    const sub1 = supabase
      .channel(`projects-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchProjects())
      .subscribe()

    const sub2 = supabase
      .channel(`clients-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchClients())
      .subscribe()

    return () => {
      sub1.unsubscribe()
      sub2.unsubscribe()
    }
  }, [profile])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  useEffect(() => {
    if (showDetail) fetchProjectTasks(showDetail.name)
  }, [showDetail])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([fetchProjects(), fetchClients()])
    setLoading(false)
  }

  const fetchProjects = async () => {
    try {
      // Get all tasks with project names
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          *,
          profiles!tasks_assigned_to_fkey(full_name),
          client:clients(id, name, status)
        `)
        .not('project', 'is', null)

      if (!tasks) return

      // Group by project
      const projectMap = {}
      tasks.forEach(task => {
        if (!task.project) return
        if (!projectMap[task.project]) {
          projectMap[task.project] = {
            id: task.project,
            name: task.project,
            tasks: [],
            client: task.client || null,
            client_id: task.client_id || null,
            pipeline_percent: 0,
            status: 'in_progress',
            priority: task.priority || 'medium',
          }
        }
        projectMap[task.project].tasks.push(task)
        // Use highest pipeline percent
        if (task.pipeline_percent > projectMap[task.project].pipeline_percent) {
          projectMap[task.project].pipeline_percent = task.pipeline_percent
        }
      })

      // Calculate stats per project
      const projectList = Object.values(projectMap).map(proj => {
        const total = proj.tasks.length
        const done = proj.tasks.filter(t => t.status === 'done').length
        const inProgress = proj.tasks.filter(t => t.status === 'in_progress').length
        const review = proj.tasks.filter(t => t.status === 'review').length
        const overdue = proj.tasks.filter(t =>
          t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
        ).length
        const completion = total > 0 ? Math.round((done / total) * 100) : 0

        // Get unique members
        const members = [...new Set(proj.tasks.map(t => t.assigned_to).filter(Boolean))]
        const memberNames = [...new Set(proj.tasks.map(t => t.profiles?.full_name).filter(Boolean))]

        // Nearest deadline
        const deadlines = proj.tasks.filter(t => t.due_date && t.status !== 'done').map(t => new Date(t.due_date))
        const nearestDeadline = deadlines.length > 0 ? new Date(Math.min(...deadlines)) : null

        return {
          ...proj,
          total, done, inProgress, review, overdue,
          completion, members, memberNames,
          nearestDeadline,
          isAtRisk: overdue > 0 || (nearestDeadline && nearestDeadline < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000))
        }
      })

      setProjects(projectList)
    } catch (e) {
      console.error('fetchProjects error:', e)
    }
  }

  const fetchClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('name')
    setClients(data || [])
  }

  const fetchProjectTasks = async (projectName) => {
    const { data } = await supabase
      .from('tasks')
      .select('*, profiles!tasks_assigned_to_fkey(full_name)')
      .eq('project', projectName)
      .order('created_at', { ascending: false })
    setProjectTasks(data || [])
  }

  const createProject = async () => {
    if (!form.name) { setMessage('❌ Project name required!'); return }

    try {
      // Create a project task to register it
      const { error } = await supabase.from('tasks').insert({
        title: `📁 ${form.name} — Project Initialized`,
        description: form.description,
        project: form.name,
        assigned_by: profile.id,
        priority: form.priority,
        status: 'todo',
        due_date: form.deadline || null,
        client_id: form.client_id || null,
        pipeline_stage: form.status,
        pipeline_percent: 0,
        pipeline_note: form.notes || null
      })

      if (error) throw error
      setMessage('✅ Project created!')
      fetchProjects()
      closeModal()
    } catch (e) {
      setMessage('❌ ' + e.message)
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
      setMessage('✅ Client added!')
    }
  }

  const updateProjectStatus = async (projectName, newStatus) => {
    // Update all tasks in this project with new pipeline stage
    await supabase
      .from('tasks')
      .update({ pipeline_stage: newStatus })
      .eq('project', projectName)
    fetchProjects()
    if (showDetail?.name === projectName) {
      setShowDetail(prev => ({ ...prev, status: newStatus }))
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditProject(null)
    setForm({ name: '', description: '', client_id: '', deadline: '', budget: '', status: 'pending', priority: 'medium', notes: '' })
    setMessage('')
  }

  const priorityConfig = {
    urgent: { color: '#d71920', bg: 'rgba(215,25,32,0.08)' },
    high: { color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
    medium: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    low: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  }

  const taskStatusColor = (s) => ({
    todo: '#888', in_progress: '#2563eb', review: '#d97706', done: '#16a34a', cancelled: '#d71920'
  }[s] || '#888')

  const taskStatusLabel = (s) => ({
    todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Done', cancelled: 'Cancelled'
  }[s] || s)

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.client?.name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    const matchClient = filterClient === 'all' || p.client_id === filterClient
    return matchSearch && matchStatus && matchClient
  })

  // Overall stats
  const totalProjects = projects.length
  const atRiskProjects = projects.filter(p => p.isAtRisk).length
  const completedProjects = projects.filter(p => p.completion === 100).length
  const totalTasks = projects.reduce((sum, p) => sum + p.total, 0)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Projects</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {totalProjects} projects · {totalTasks} total tasks
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
            {[{ id: 'board', icon: '⊞', label: 'Board' }, { id: 'list', icon: '≡', label: 'List' }].map(v => (
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
          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              + New Project
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {[
          { icon: '📁', label: 'Total Projects', value: totalProjects, color: '#2563eb' },
          { icon: '✅', label: 'Completed', value: completedProjects, color: '#16a34a' },
          { icon: '⚠️', label: 'At Risk', value: atRiskProjects, color: '#d71920' },
          { icon: '📋', label: 'Total Tasks', value: totalTasks, color: '#7c3aed' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${stat.color}22`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ color: stat.color, fontSize: '22px', fontWeight: '800' }}>{stat.value}</div>
            <div style={{ color: '#888', fontSize: '11px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Search projects, clients..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 14px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
        </select>
        <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
          color: message.includes('❌') ? '#d71920' : '#16a34a',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '220px', borderRadius: '12px' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📁</div>
          <div className="empty-title">No projects yet</div>
          <div className="empty-desc">Create a project or assign tasks with a project name</div>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
              + Create Project
            </button>
          )}
        </div>
      ) : view === 'board' ? (
        /* BOARD VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map(project => (
            <div key={project.id} className="card card-clickable"
              onClick={() => { setShowDetail(project); setDetailTab('overview') }}
              style={{
                borderTop: `3px solid ${project.isAtRisk ? '#d71920' : priorityConfig[project.priority]?.color || '#2563eb'}`,
                position: 'relative'
              }}
            >
              {/* At Risk Badge */}
              {project.isAtRisk && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: 'rgba(215,25,32,0.1)', color: '#d71920',
                  padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '800'
                }}>
                  ⚠️ AT RISK
                </div>
              )}

              {/* Project Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '12px',
                  background: project.isAtRisk ? 'rgba(215,25,32,0.1)' : `${priorityConfig[project.priority]?.color || '#2563eb'}12`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '22px', flexShrink: 0
                }}>📁</div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <h3 style={{ color: '#111', margin: '0 0 4px', fontSize: '15px', fontWeight: '800', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.name}
                  </h3>
                  {project.client && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '600' }}>
                        👤 {project.client.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#888', fontSize: '12px' }}>Progress</span>
                  <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '800' }}>{project.completion}%</span>
                </div>
                <div className="progress-bar" style={{ height: '8px' }}>
                  <div className="progress-fill" style={{
                    width: `${project.completion}%`,
                    background: project.completion === 100
                      ? 'linear-gradient(90deg, #16a34a, #15803d)'
                      : project.isAtRisk
                        ? 'linear-gradient(90deg, #d71920, #b5151b)'
                        : 'linear-gradient(90deg, #d71920, #b5151b)'
                  }} />
                </div>
              </div>

              {/* Task Stats */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
                {[
                  { label: 'Total', value: project.total, color: '#888' },
                  { label: 'Active', value: project.inProgress, color: '#2563eb' },
                  { label: 'Review', value: project.review, color: '#d97706' },
                  { label: 'Done', value: project.done, color: '#16a34a' },
                ].map(s => (
                  <div key={s.label} style={{
                    flex: 1, background: '#f9f9f9', borderRadius: '8px',
                    padding: '6px 4px', textAlign: 'center'
                  }}>
                    <div style={{ color: s.color, fontSize: '14px', fontWeight: '800' }}>{s.value}</div>
                    <div style={{ color: '#bbb', fontSize: '9px' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Member Avatars */}
                <div style={{ display: 'flex' }}>
                  {project.memberNames.slice(0, 3).map((name, i) => (
                    <div key={i} className="avatar" style={{
                      width: '26px', height: '26px', fontSize: '10px',
                      marginLeft: i > 0 ? '-6px' : 0,
                      border: '2px solid white', zIndex: 3 - i
                    }}>
                      {name?.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {project.memberNames.length > 3 && (
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: '#f5f5f5', border: '2px solid white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', color: '#888', fontWeight: '700', marginLeft: '-6px'
                    }}>
                      +{project.memberNames.length - 3}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {project.overdue > 0 && (
                    <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>
                      ⚠️ {project.overdue} overdue
                    </span>
                  )}
                  {project.nearestDeadline && (
                    <span style={{ color: '#888', fontSize: '11px' }}>
                      📅 {project.nearestDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Client</th>
                <th>Progress</th>
                <th>Tasks</th>
                <th>Team</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(project => (
                <tr key={project.id} style={{ cursor: 'pointer' }}
                  onClick={() => { setShowDetail(project); setDetailTab('overview') }}>
                  <td>
                    <div style={{ fontWeight: '800', color: '#111', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {project.isAtRisk && <span>⚠️</span>}
                      📁 {project.name}
                    </div>
                  </td>
                  <td>
                    {project.client ? (
                      <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '600' }}>
                        👤 {project.client.name}
                      </span>
                    ) : <span style={{ color: '#ccc' }}>—</span>}
                  </td>
                  <td style={{ width: '140px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${project.completion}%` }} />
                      </div>
                      <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                        {project.completion}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span style={{ color: '#888', fontSize: '13px' }}>
                      {project.done}/{project.total}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex' }}>
                      {project.memberNames.slice(0, 3).map((name, i) => (
                        <div key={i} className="avatar" style={{
                          width: '24px', height: '24px', fontSize: '9px',
                          marginLeft: i > 0 ? '-4px' : 0, border: '2px solid white'
                        }}>
                          {name?.charAt(0).toUpperCase()}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td style={{ color: '#888', fontSize: '13px' }}>
                    {project.nearestDeadline
                      ? project.nearestDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : '—'}
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: project.isAtRisk ? 'rgba(215,25,32,0.1)' : 'rgba(22,163,74,0.1)',
                      color: project.isAtRisk ? '#d71920' : '#16a34a'
                    }}>
                      {project.isAtRisk ? 'At Risk' : project.completion === 100 ? 'Complete' : 'Active'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* PROJECT DETAIL MODAL */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div style={{
            background: 'white', borderRadius: '16px', width: '100%',
            maxWidth: '800px', maxHeight: '92vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            animation: 'bounceIn 0.3s ease', boxShadow: '0 24px 64px rgba(0,0,0,0.15)'
          }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{
              background: showDetail.isAtRisk
                ? 'linear-gradient(135deg, #7f0000, #d71920)'
                : 'linear-gradient(135deg, #111, #333)',
              padding: '24px', flexShrink: 0
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <h2 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: '800' }}>
                      📁 {showDetail.name}
                    </h2>
                    {showDetail.isAtRisk && (
                      <span style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>
                        ⚠️ AT RISK
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {showDetail.client && (
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px' }}>
                        👤 {showDetail.client.name}
                      </span>
                    )}
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>
                      {showDetail.total} tasks · {showDetail.completion}% complete
                    </span>
                  </div>
                  {/* Progress */}
                  <div style={{ marginTop: '14px' }}>
                    <div className="progress-bar" style={{ height: '8px', background: 'rgba(255,255,255,0.2)' }}>
                      <div style={{
                        height: '100%', borderRadius: '99px',
                        width: `${showDetail.completion}%`,
                        background: 'white',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(null)} style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '8px',
                  color: 'white', cursor: 'pointer', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>✕</button>
              </div>
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', borderBottom: '1px solid #e5e5e5',
              padding: '0 24px', background: 'white', flexShrink: 0,
              overflowX: 'auto'
            }}>
              {[
                { id: 'overview', label: '📊 Overview' },
                { id: 'tasks', label: `✅ Tasks (${projectTasks.length})` },
                { id: 'pipeline', label: '🔄 Pipeline' },
                { id: 'team', label: '👥 Team' },
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

            {/* Tab Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

              {/* OVERVIEW TAB */}
              {detailTab === 'overview' && (
                <div>
                  {/* Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
                    {[
                      { label: 'Total Tasks', value: showDetail.total, color: '#7c3aed' },
                      { label: 'In Progress', value: showDetail.inProgress, color: '#2563eb' },
                      { label: 'In Review', value: showDetail.review, color: '#d97706' },
                      { label: 'Done', value: showDetail.done, color: '#16a34a' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#f9f9f9', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
                        <div style={{ color: s.color, fontSize: '24px', fontWeight: '800' }}>{s.value}</div>
                        <div style={{ color: '#888', fontSize: '11px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Risk Alert */}
                  {showDetail.isAtRisk && (
                    <div style={{
                      background: 'rgba(215,25,32,0.06)', border: '1px solid rgba(215,25,32,0.2)',
                      borderRadius: '10px', padding: '14px', marginBottom: '20px'
                    }}>
                      <div style={{ color: '#d71920', fontWeight: '700', fontSize: '14px', marginBottom: '4px' }}>
                        ⚠️ Project At Risk
                      </div>
                      <div style={{ color: '#d71920', fontSize: '13px', opacity: 0.8 }}>
                        {showDetail.overdue > 0 && `${showDetail.overdue} overdue tasks. `}
                        {showDetail.nearestDeadline && `Nearest deadline: ${showDetail.nearestDeadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      </div>
                    </div>
                  )}

                  {/* Recent Tasks Preview */}
                  <div>
                    <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                      Recent Tasks
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {projectTasks.slice(0, 5).map(task => (
                        <div key={task.id} style={{
                          background: '#f9f9f9', borderRadius: '8px', padding: '10px 14px',
                          borderLeft: `3px solid ${taskStatusColor(task.status)}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                          <div>
                            <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{task.title}</div>
                            {task.profiles?.full_name && (
                              <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
                                👤 {task.profiles.full_name}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {task.pipeline_percent > 0 && (
                              <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>
                                {task.pipeline_percent}%
                              </span>
                            )}
                            <span style={{
                              background: `${taskStatusColor(task.status)}12`,
                              color: taskStatusColor(task.status),
                              padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                            }}>
                              {taskStatusLabel(task.status)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TASKS TAB */}
              {detailTab === 'tasks' && (
                <div>
                  {projectTasks.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">✅</div>
                      <div className="empty-title">No tasks yet</div>
                      <div className="empty-desc">Create tasks with this project name</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {projectTasks.map(task => (
                        <div key={task.id} style={{
                          background: '#f9f9f9', borderRadius: '10px', padding: '14px',
                          borderLeft: `3px solid ${taskStatusColor(task.status)}`,
                          border: `1px solid #e5e5e5`,
                          borderLeftWidth: '3px',
                          borderLeftColor: taskStatusColor(task.status)
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ color: '#111', fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>
                                {task.title}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {task.profiles?.full_name && (
                                  <span style={{ color: '#888', fontSize: '11px' }}>👤 {task.profiles.full_name}</span>
                                )}
                                {task.due_date && (
                                  <span style={{ color: '#888', fontSize: '11px' }}>
                                    📅 {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                              <span style={{
                                background: `${taskStatusColor(task.status)}12`,
                                color: taskStatusColor(task.status),
                                padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                              }}>
                                {taskStatusLabel(task.status)}
                              </span>
                            </div>
                          </div>
                          {/* Pipeline Progress */}
                          {task.pipeline_percent > 0 && (
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ color: '#888', fontSize: '11px' }}>{task.pipeline_stage || 'In Progress'}</span>
                                <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>{task.pipeline_percent}%</span>
                              </div>
                              <div className="progress-bar" style={{ height: '4px' }}>
                                <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* PIPELINE TAB */}
              {detailTab === 'pipeline' && (
                <div>
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '14px' }}>
                    Project Status
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                    {STATUS_OPTIONS.map(status => (
                      <button key={status.id}
                        onClick={() => updateProjectStatus(showDetail.name, status.id)}
                        style={{
                          padding: '10px 16px', borderRadius: '10px',
                          border: `1px solid ${showDetail.status === status.id ? status.color : '#e5e5e5'}`,
                          background: showDetail.status === status.id ? `${status.color}12` : 'white',
                          color: showDetail.status === status.id ? status.color : '#666',
                          cursor: 'pointer', fontSize: '13px',
                          fontWeight: showDetail.status === status.id ? '700' : '500',
                          transition: 'all 0.2s'
                        }}
                      >
                        {status.icon} {status.label}
                        {showDetail.status === status.id && ' ✓'}
                      </button>
                    ))}
                  </div>

                  {/* Pipeline Overview per task */}
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    Task Pipeline Progress
                  </div>
                  {projectTasks.filter(t => t.pipeline_percent > 0 || t.pipeline_stage).map(task => (
                    <div key={task.id} style={{
                      background: '#f9f9f9', borderRadius: '10px', padding: '14px',
                      marginBottom: '8px', border: '1px solid #e5e5e5'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <div>
                          <div style={{ color: '#111', fontSize: '13px', fontWeight: '700' }}>{task.title}</div>
                          {task.pipeline_stage && (
                            <div style={{ color: '#d71920', fontSize: '11px', marginTop: '2px', fontWeight: '600' }}>
                              Stage: {task.pipeline_stage}
                            </div>
                          )}
                        </div>
                        <span style={{ color: '#d71920', fontWeight: '800', fontSize: '16px' }}>
                          {task.pipeline_percent}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                      </div>
                      {task.pipeline_note && (
                        <div style={{ color: '#666', fontSize: '12px', marginTop: '8px', lineHeight: '1.5' }}>
                          📝 {task.pipeline_note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TEAM TAB */}
              {detailTab === 'team' && (
                <div>
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                    Team Members ({showDetail.memberNames.length})
                  </div>
                  {showDetail.memberNames.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">👥</div>
                      <div className="empty-desc">No team members assigned yet</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {showDetail.memberNames.map((name, i) => {
                        const memberTasks = projectTasks.filter(t => t.profiles?.full_name === name)
                        const doneTasks = memberTasks.filter(t => t.status === 'done').length
                        return (
                          <div key={i} style={{
                            background: '#f9f9f9', borderRadius: '10px', padding: '14px',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            border: '1px solid #e5e5e5'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="avatar avatar-md">{name?.charAt(0).toUpperCase()}</div>
                              <div>
                                <div style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>{name}</div>
                                <div style={{ color: '#888', fontSize: '12px' }}>{memberTasks.length} tasks · {doneTasks} done</div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ color: '#d71920', fontWeight: '800', fontSize: '16px' }}>
                                {memberTasks.length > 0 ? Math.round((doneTasks / memberTasks.length) * 100) : 0}%
                              </div>
                              <div style={{ color: '#888', fontSize: '11px' }}>completion</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE PROJECT MODAL */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>+ New Project</h3>
              <button onClick={closeModal} style={{
                background: '#f5f5f5', border: 'none', borderRadius: '8px',
                color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{
                  background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                  color: message.includes('❌') ? '#d71920' : '#16a34a',
                  padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
                }}>{message}</div>
              )}

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Project Name *</label>
                <input type="text" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Website Redesign" className="input" />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Description</label>
                <textarea value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Project details..."
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e5e5',
                    borderRadius: '10px', fontSize: '14px', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: '#111'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d71920'}
                  onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              {/* Client */}
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Client</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    className="input" style={{ flex: 1 }}>
                    <option value="">-- No Client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {showNewClient ? (
                    <>
                      <input value={newClientName}
                        onChange={(e) => setNewClientName(e.target.value)}
                        placeholder="Client name..." className="input" style={{ flex: 1 }}
                        onKeyPress={(e) => e.key === 'Enter' && createClient()} autoFocus />
                      <button onClick={createClient} className="btn btn-primary btn-sm">Add</button>
                      <button onClick={() => setShowNewClient(false)} className="btn btn-secondary btn-sm">✕</button>
                    </>
                  ) : (
                    <button onClick={() => setShowNewClient(true)} className="btn btn-secondary btn-sm" style={{ whiteSpace: 'nowrap' }}>
                      + New
                    </button>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <div>
                  <label className="input-label">Deadline</label>
                  <input type="date" value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">Budget (PKR)</label>
                  <input type="number" value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="100000" className="input" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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
                  <label className="input-label">Initial Status</label>
                  <select value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="input">
                    {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Notes</label>
                <textarea value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1.5px solid #e5e5e5',
                    borderRadius: '10px', fontSize: '14px', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: '#111'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d71920'}
                  onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={closeModal} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={createProject} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  Create Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
