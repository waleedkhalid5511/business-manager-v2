import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function GlobalSearch({ profile, setActiveTab, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ tasks: [], clients: [], files: [], employees: [] })
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('all')
  const inputRef = useRef(null)
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults({ tasks: [], clients: [], files: [], employees: [] })
      return
    }
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  const search = async (q) => {
    setLoading(true)
    try {
      const term = q.trim().toLowerCase()

      const [tasksRes, clientsRes, filesRes, employeesRes] = await Promise.all([
        // Tasks
        supabase.from('tasks')
          .select('id, title, status, priority, project, client:clients(name)')
          .or(`title.ilike.%${term}%,project.ilike.%${term}%,description.ilike.%${term}%`)
          .eq('is_archived', false)
          .limit(5),

        // Clients
        supabase.from('clients')
          .select('id, name, email, status')
          .or(`name.ilike.%${term}%,email.ilike.%${term}%,company.ilike.%${term}%`)
          .limit(5),

        // Files
        supabase.from('files')
          .select('id, name, original_name, version_label, is_final, client:clients(name), project_name')
          .or(`name.ilike.%${term}%,original_name.ilike.%${term}%,project_name.ilike.%${term}%`)
          .limit(5),

        // Employees (admin/manager only)
        (isAdmin || isManager)
          ? supabase.from('profiles')
              .select('id, full_name, email, role, department')
              .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,department.ilike.%${term}%`)
              .eq('is_active', true)
              .limit(5)
          : Promise.resolve({ data: [] })
      ])

      setResults({
        tasks: tasksRes.data || [],
        clients: clientsRes.data || [],
        files: filesRes.data || [],
        employees: employeesRes.data || []
      })
    } catch (e) {
      console.error('Search error:', e)
    } finally {
      setLoading(false)
    }
  }

  const totalResults = results.tasks.length + results.clients.length +
    results.files.length + results.employees.length

  const priorityConfig = {
    urgent: { color: '#d71920', bg: 'rgba(215,25,32,0.08)' },
    high: { color: '#d97706', bg: 'rgba(217,119,6,0.08)' },
    medium: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)' },
    low: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)' },
  }

  const statusColors = {
    todo: '#888', in_progress: '#2563eb', review: '#d97706', done: '#16a34a'
  }

  const handleNavigate = (tab) => {
    setActiveTab(tab)
    onClose()
  }

  const sections = [
    { id: 'all', label: 'All', count: totalResults },
    { id: 'tasks', label: 'Tasks', count: results.tasks.length },
    { id: 'clients', label: 'Clients', count: results.clients.length },
    { id: 'files', label: 'Files', count: results.files.length },
    ...(isAdmin || isManager ? [{ id: 'employees', label: 'People', count: results.employees.length }] : [])
  ]

  const getFileIcon = (name) => {
    if (!name) return '📄'
    const ext = name.split('.').pop()?.toLowerCase()
    if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return '🎬'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️'
    if (ext === 'pdf') return '📕'
    if (['zip', 'rar'].includes(ext)) return '🗜️'
    return '📄'
  }

  const showTasks = (activeSection === 'all' || activeSection === 'tasks') && results.tasks.length > 0
  const showClients = (activeSection === 'all' || activeSection === 'clients') && results.clients.length > 0
  const showFiles = (activeSection === 'all' || activeSection === 'files') && results.files.length > 0
  const showEmployees = (activeSection === 'all' || activeSection === 'employees') && results.employees.length > 0

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      zIndex: 9999, display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '80px 20px 20px',
      backdropFilter: 'blur(4px)'
    }} onClick={onClose}>
      <div style={{
        background: 'white', borderRadius: '16px',
        width: '100%', maxWidth: '640px',
        maxHeight: '75vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.2)',
        animation: 'bounceIn 0.25s ease'
      }} onClick={e => e.stopPropagation()}>

        {/* Search Input */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          <span style={{ fontSize: '18px', flexShrink: 0 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tasks, clients, files, people..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: '16px', color: '#111',
              background: 'transparent', fontFamily: 'inherit'
            }}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
          {loading && (
            <span style={{ color: '#888', fontSize: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
          )}
          {query && (
            <button onClick={() => setQuery('')} style={{
              background: '#f5f5f5', border: 'none', borderRadius: '6px',
              color: '#888', cursor: 'pointer', padding: '4px 8px', fontSize: '12px'
            }}>Clear</button>
          )}
          <button onClick={onClose} style={{
            background: '#f5f5f5', border: 'none', borderRadius: '6px',
            color: '#888', cursor: 'pointer', padding: '4px 8px', fontSize: '12px',
            flexShrink: 0
          }}>ESC</button>
        </div>

        {/* Filter Tabs */}
        {query && totalResults > 0 && (
          <div style={{
            display: 'flex', gap: '4px', padding: '10px 16px',
            borderBottom: '1px solid #e5e5e5', overflowX: 'auto'
          }}>
            {sections.map(s => (
              <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
                padding: '4px 12px', borderRadius: '20px', border: 'none',
                background: activeSection === s.id ? '#d71920' : '#f5f5f5',
                color: activeSection === s.id ? 'white' : '#666',
                cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px'
              }}>
                {s.label}
                {s.count > 0 && (
                  <span style={{
                    background: activeSection === s.id ? 'rgba(255,255,255,0.3)' : '#e5e5e5',
                    borderRadius: '10px', padding: '0 5px', fontSize: '10px'
                  }}>
                    {s.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>

          {/* Empty State */}
          {!query && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
              <div style={{ color: '#111', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                Search Everything
              </div>
              <div style={{ color: '#888', fontSize: '13px' }}>
                Tasks, clients, files, projects, people
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
                {['Tasks', 'Clients', 'Files', 'Projects'].map(hint => (
                  <span key={hint} onClick={() => setQuery(hint.toLowerCase())} style={{
                    background: '#f5f5f5', border: '1px solid #e5e5e5',
                    borderRadius: '20px', padding: '4px 12px',
                    color: '#888', fontSize: '12px', cursor: 'pointer'
                  }}>
                    {hint}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {query && !loading && totalResults === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>😕</div>
              <div style={{ color: '#111', fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>
                No results for "{query}"
              </div>
              <div style={{ color: '#888', fontSize: '13px' }}>
                Try different keywords
              </div>
            </div>
          )}

          {/* Tasks */}
          {showTasks && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                color: '#bbb', fontSize: '10px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between'
              }}>
                <span>Tasks</span>
                <span>{results.tasks.length} results</span>
              </div>
              {results.tasks.map(task => (
                <div key={task.id}
                  onClick={() => handleNavigate('tasks')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: priorityConfig[task.priority]?.bg || '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '16px', flexShrink: 0
                  }}>✦</div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      color: '#111', fontSize: '14px', fontWeight: '600',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {task.title}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      {task.project && <span style={{ color: '#888', fontSize: '11px' }}>📁 {task.project}</span>}
                      {task.client && <span style={{ color: '#d71920', fontSize: '11px' }}>👤 {task.client.name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      background: priorityConfig[task.priority]?.bg,
                      color: priorityConfig[task.priority]?.color,
                      padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700'
                    }}>
                      {task.priority}
                    </span>
                    <span style={{
                      background: `${statusColors[task.status]}15`,
                      color: statusColors[task.status],
                      padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700'
                    }}>
                      {task.status?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clients */}
          {showClients && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                color: '#bbb', fontSize: '10px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between'
              }}>
                <span>Clients</span>
                <span>{results.clients.length} results</span>
              </div>
              {results.clients.map(client => (
                <div key={client.id}
                  onClick={() => handleNavigate('tasks')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: 'linear-gradient(135deg, #d71920, #b5151b)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: '800', fontSize: '16px', flexShrink: 0
                  }}>
                    {client.name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#111', fontSize: '14px', fontWeight: '600' }}>{client.name}</div>
                    {client.email && <div style={{ color: '#888', fontSize: '11px' }}>{client.email}</div>}
                  </div>
                  <span style={{
                    background: 'rgba(22,163,74,0.1)', color: '#16a34a',
                    padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700'
                  }}>
                    {client.status || 'active'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Files */}
          {showFiles && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                color: '#bbb', fontSize: '10px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between'
              }}>
                <span>Files</span>
                <span>{results.files.length} results</span>
              </div>
              {results.files.map(file => (
                <div key={file.id}
                  onClick={() => handleNavigate('files')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: file.is_final ? 'rgba(22,163,74,0.1)' : '#f5f5f5',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', flexShrink: 0
                  }}>
                    {getFileIcon(file.original_name || file.name)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      color: '#111', fontSize: '14px', fontWeight: '600',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {file.original_name || file.name}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                      {file.client && <span style={{ color: '#d71920', fontSize: '11px' }}>👤 {file.client.name}</span>}
                      {file.project_name && <span style={{ color: '#888', fontSize: '11px' }}>📁 {file.project_name}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      background: file.is_final ? 'rgba(22,163,74,0.1)' : '#f5f5f5',
                      color: file.is_final ? '#16a34a' : '#888',
                      padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700'
                    }}>
                      {file.is_final ? 'FINAL' : file.version_label || 'v1'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Employees */}
          {showEmployees && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{
                color: '#bbb', fontSize: '10px', fontWeight: '700',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                padding: '8px 12px 4px', display: 'flex', justifyContent: 'space-between'
              }}>
                <span>People</span>
                <span>{results.employees.length} results</span>
              </div>
              {results.employees.map(emp => (
                <div key={emp.id}
                  onClick={() => handleNavigate('employees')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '8px',
                    cursor: 'pointer', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #d71920, #b5151b)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: '800', fontSize: '16px', flexShrink: 0
                  }}>
                    {emp.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#111', fontSize: '14px', fontWeight: '600' }}>{emp.full_name}</div>
                    <div style={{ color: '#888', fontSize: '11px' }}>{emp.email}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      background: '#f5f5f5', color: '#666',
                      padding: '2px 8px', borderRadius: '20px',
                      fontSize: '10px', fontWeight: '700', textTransform: 'capitalize'
                    }}>
                      {emp.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '10px 16px', borderTop: '1px solid #e5e5e5',
          display: 'flex', gap: '16px', color: '#bbb', fontSize: '11px'
        }}>
          <span>↵ Navigate</span>
          <span>ESC Close</span>
          {query && totalResults > 0 && <span style={{ marginLeft: 'auto' }}>{totalResults} results</span>}
        </div>
      </div>
    </div>
  )
}
