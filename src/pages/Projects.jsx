import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const STATUS_COLUMNS = [
  { id: 'pending', label: 'Pending', color: '#94a3b8', icon: '⏳' },
  { id: 'approved', label: 'Approved', color: '#3b82f6', icon: '✅' },
  { id: 'in_progress', label: 'In Progress', color: '#f59e0b', icon: '🔄' },
  { id: 'delivered', label: 'Delivered', color: '#10b981', icon: '🚀' },
]

export default function Projects({ profile }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editProject, setEditProject] = useState(null)
  const [message, setMessage] = useState('')
  const [view, setView] = useState('board')
  const [search, setSearch] = useState('')
  const [employees, setEmployees] = useState([])
  const [projectTasks, setProjectTasks] = useState([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    client_name: '',
    client_email: '',
    deadline: '',
    budget: '',
    status: 'pending',
    priority: 'medium'
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (profile) {
      fetchProjects()
      fetchEmployees()
    }
  }, [profile])

  useEffect(() => {
    if (showDetail) fetchProjectTasks(showDetail.name)
  }, [showDetail])

  const fetchProjects = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('project')
      .not('project', 'is', null)
    
    // Get unique projects from tasks
    const uniqueProjects = [...new Set((data || []).map(t => t.project).filter(Boolean))]
    
    // Get project stats
    const projectsWithStats = await Promise.all(uniqueProjects.map(async (projectName) => {
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('project', projectName)

      return {
        id: projectName,
        name: projectName,
        tasks: tasks || [],
        totalTasks: tasks?.length || 0,
        doneTasks: tasks?.filter(t => t.status === 'done').length || 0,
        status: 'in_progress',
        priority: 'medium'
      }
    }))

    setProjects(projectsWithStats)
    setLoading(false)
  }

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles').select('id, full_name').eq('is_active', true)
    setEmployees(data || [])
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
    if (!form.name) { setMessage('❌ Project name is required!'); return }
    
    // Create a placeholder task to register the project
    const { error } = await supabase.from('tasks').insert({
      title: `${form.name} — Project Created`,
      description: form.description,
      project: form.name,
      assigned_by: profile.id,
      priority: form.priority,
      status: 'todo'
    })

    if (error) setMessage('❌ ' + error.message)
    else {
      setMessage('✅ Project created!')
      fetchProjects()
      closeModal()
    }
  }

  const closeModal = () => {
    setShowModal(false)
    setEditProject(null)
    setForm({ name: '', description: '', client_name: '', client_email: '', deadline: '', budget: '', status: 'pending', priority: 'medium' })
    setMessage('')
  }

  const getProgress = (project) => {
    if (!project.totalTasks) return 0
    return Math.round((project.doneTasks / project.totalTasks) * 100)
  }

  const priorityConfig = {
    urgent: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    high: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    medium: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    low: { color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  }

  const taskStatusColor = (s) => ({
    todo: '#94a3b8', in_progress: '#3b82f6',
    review: '#f59e0b', done: '#10b981', cancelled: '#ef4444'
  }[s] || '#94a3b8')

  const filtered = projects.filter(p =>
    !search || p.name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '20px',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h2 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '20px', fontWeight: '700' }}>
            Projects
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
            {projects.length} projects · {projects.reduce((sum, p) => sum + p.totalTasks, 0)} total tasks
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden'
          }}>
            {[
              { id: 'board', icon: '⊞', label: 'Board' },
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
              + New Project
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text" placeholder="🔍 Search projects..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: '400px', padding: '8px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '8px', color: 'var(--text-primary)',
            fontSize: '13px', outline: 'none', boxSizing: 'border-box'
          }}
        />
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

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px', marginBottom: '24px'
      }}>
        {[
          { label: 'Total Projects', value: projects.length, color: '#3b82f6', icon: '📁' },
          { label: 'Total Tasks', value: projects.reduce((s, p) => s + p.totalTasks, 0), color: '#8b5cf6', icon: '✅' },
          { label: 'Completed', value: projects.reduce((s, p) => s + p.doneTasks, 0), color: '#10b981', icon: '🎯' },
          { label: 'In Progress', value: projects.filter(p => p.tasks?.some(t => t.status === 'in_progress')).length, color: '#f59e0b', icon: '🔄' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-card)', borderRadius: '12px',
            padding: '16px', border: `1px solid ${stat.color}22`
          }}>
            <div style={{ fontSize: '20px', marginBottom: '6px' }}>{stat.icon}</div>
            <div style={{ color: stat.color, fontSize: '22px', fontWeight: '700', marginBottom: '2px' }}>
              {stat.value}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '200px', borderRadius: '12px' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📁</div>
          <div className="empty-title">No Projects Yet</div>
          <div className="empty-desc">Create your first project or add tasks with a project name</div>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
              + Create Project
            </button>
          )}
        </div>
      ) : view === 'board' ? (
        /* Board View */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {filtered.map(project => (
            <div
              key={project.id}
              className="card card-clickable"
              onClick={() => setShowDetail(project)}
              style={{ borderTop: `3px solid ${priorityConfig[project.priority]?.color || '#3b82f6'}` }}
            >
              {/* Project Header */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', marginBottom: '8px'
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: `${priorityConfig[project.priority]?.color || '#3b82f6'}18`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', flexShrink: 0
                  }}>
                    📁
                  </div>
                  <span className="badge" style={{
                    background: `${priorityConfig[project.priority]?.color || '#3b82f6'}18`,
                    color: priorityConfig[project.priority]?.color || '#3b82f6'
                  }}>
                    {project.priority}
                  </span>
                </div>
                <h3 style={{
                  color: 'var(--text-primary)', margin: '0 0 6px',
                  fontSize: '15px', fontWeight: '700'
                }}>
                  {project.name}
                </h3>
                {project.description && (
                  <p style={{
                    color: 'var(--text-muted)', margin: 0,
                    fontSize: '12px', lineHeight: '1.5',
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                  }}>
                    {project.description}
                  </p>
                )}
              </div>

              {/* Progress */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  marginBottom: '6px'
                }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Progress</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '11px', fontWeight: '700' }}>
                    {getProgress(project)}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{
                    width: `${getProgress(project)}%`,
                    background: getProgress(project) === 100
                      ? 'var(--gradient-green)' : 'var(--gradient-blue)'
                  }} />
                </div>
              </div>

              {/* Task Stats */}
              <div style={{
                display: 'flex', gap: '8px', marginBottom: '14px'
              }}>
                {[
                  { label: 'Total', value: project.totalTasks, color: 'var(--text-muted)' },
                  { label: 'Done', value: project.doneTasks, color: '#10b981' },
                  { label: 'Pending', value: project.totalTasks - project.doneTasks, color: '#f59e0b' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    flex: 1, background: 'var(--bg-hover)',
                    borderRadius: '8px', padding: '8px',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: stat.color, fontSize: '16px', fontWeight: '700' }}>
                      {stat.value}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Members */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '-4px' }}>
                  {[...new Set(project.tasks?.map(t => t.assigned_to).filter(Boolean))].slice(0, 4).map((userId, i) => (
                    <div key={userId} className="avatar" style={{
                      width: '24px', height: '24px', fontSize: '10px',
                      marginLeft: i > 0 ? '-6px' : 0,
                      border: '2px solid var(--bg-card)',
                      zIndex: 4 - i
                    }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                  {project.tasks?.length} tasks
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Tasks</th>
                <th>Progress</th>
                <th>Priority</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(project => (
                <tr key={project.id} style={{ cursor: 'pointer' }}
                  onClick={() => setShowDetail(project)}>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      📁 {project.name}
                    </div>
                  </td>
                  <td>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {project.doneTasks}/{project.totalTasks}
                    </span>
                  </td>
                  <td style={{ width: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="progress-bar" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${getProgress(project)}%` }} />
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {getProgress(project)}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: priorityConfig[project.priority]?.bg,
                      color: priorityConfig[project.priority]?.color
                    }}>
                      {project.priority}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{
                      background: 'rgba(59,130,246,0.1)',
                      color: '#3b82f6'
                    }}>
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Project Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0d1f3c, #1a1040)',
              padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: 'rgba(59,130,246,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '22px'
                    }}>📁</div>
                    <div>
                      <h2 style={{ color: 'white', margin: 0, fontSize: '20px', fontWeight: '700' }}>
                        {showDetail.name}
                      </h2>
                      <div style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
                        {showDetail.totalTasks} tasks · {getProgress(showDetail)}% complete
                      </div>
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(null)} className="btn-icon">✕</button>
              </div>

              {/* Progress */}
              <div style={{ marginTop: '16px' }}>
                <div className="progress-bar" style={{ height: '8px' }}>
                  <div className="progress-fill" style={{
                    width: `${getProgress(showDetail)}%`,
                    background: getProgress(showDetail) === 100
                      ? 'var(--gradient-green)' : 'var(--gradient-blue)'
                  }} />
                </div>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Task Stats */}
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '10px', marginBottom: '20px'
              }}>
                {[
                  { label: 'Total', value: showDetail.totalTasks, color: 'var(--text-primary)' },
                  { label: 'In Progress', value: showDetail.tasks?.filter(t => t.status === 'in_progress').length || 0, color: '#3b82f6' },
                  { label: 'Review', value: showDetail.tasks?.filter(t => t.status === 'review').length || 0, color: '#f59e0b' },
                  { label: 'Done', value: showDetail.doneTasks, color: '#10b981' },
                ].map(stat => (
                  <div key={stat.label} style={{
                    background: 'var(--bg-hover)', borderRadius: '8px', padding: '12px',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '700', marginBottom: '2px' }}>
                      {stat.value}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Tasks List */}
              <div>
                <div style={{
                  color: 'var(--text-muted)', fontSize: '11px',
                  fontWeight: '700', textTransform: 'uppercase',
                  letterSpacing: '0.06em', marginBottom: '12px'
                }}>
                  Tasks
                </div>
                {projectTasks.length === 0 ? (
                  <div className="empty-state" style={{ padding: '30px' }}>
                    <div className="empty-desc">No tasks in this project yet</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {projectTasks.map(task => (
                      <div key={task.id} style={{
                        background: 'var(--bg-hover)', borderRadius: '8px',
                        padding: '12px 14px',
                        borderLeft: `3px solid ${taskStatusColor(task.status)}`,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{
                            color: 'var(--text-primary)', fontSize: '13px',
                            fontWeight: '600', marginBottom: '4px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                          }}>
                            {task.title}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {task.profiles && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                <div className="avatar" style={{ width: '18px', height: '18px', fontSize: '9px' }}>
                                  {task.profiles.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                  {task.profiles.full_name}
                                </span>
                              </div>
                            )}
                            {task.due_date && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                · 📅 {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span className="badge" style={{
                            background: `${taskStatusColor(task.status)}18`,
                            color: taskStatusColor(task.status),
                            fontSize: '10px'
                          }}>
                            {task.status?.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div style={{
              padding: '20px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '17px', fontWeight: '700' }}>
                + New Project
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
                { label: 'Project Name *', key: 'name', type: 'text', placeholder: 'Website Redesign' },
                { label: 'Description', key: 'description', type: 'text', placeholder: 'Project details...' },
                { label: 'Client Name', key: 'client_name', type: 'text', placeholder: 'Client Company' },
                { label: 'Client Email', key: 'client_email', type: 'email', placeholder: 'client@company.com' },
                { label: 'Deadline', key: 'deadline', type: 'date' },
                { label: 'Budget (PKR)', key: 'budget', type: 'number', placeholder: '100000' },
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

              <div style={{ marginBottom: '20px' }}>
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
