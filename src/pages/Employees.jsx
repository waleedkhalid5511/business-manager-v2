import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ROLES = [
  { id: 'admin', label: 'Admin', color: '#d71920' },
  { id: 'manager', label: 'Manager', color: '#d97706' },
  { id: 'employee', label: 'Employee', color: '#2563eb' },
  { id: 'partner', label: 'Partner', color: '#7c3aed' },
  { id: 'junior_editor', label: 'Junior Editor', color: '#0891b2' },
  { id: 'senior_editor', label: 'Senior Editor', color: '#059669' },
  { id: 'client_manager', label: 'Client Manager', color: '#d97706' },
  { id: 'qa_reviewer', label: 'QA Reviewer', color: '#7c3aed' },
]

const DEPARTMENTS = [
  'Video Editing', 'Motion Graphics', 'Content Creation',
  'Client Management', 'Quality Assurance', 'Management', 'Other'
]

const ALL_MODULES = [
  { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
  { id: 'messages', icon: '💬', label: 'Messages' },
  { id: 'announcements', icon: '📢', label: 'Announcements' },
  { id: 'projects', icon: '📁', label: 'Projects' },
  { id: 'tasks', icon: '✅', label: 'Tasks' },
  { id: 'files', icon: '📎', label: 'Files' },
  { id: 'attendance', icon: '📅', label: 'Attendance' },
  { id: 'timetracking', icon: '⏱️', label: 'Time Logs' },
  { id: 'clienttime', icon: '👤', label: 'Client Time' },
  { id: 'employees', icon: '👥', label: 'Employees' },
  { id: 'officecalls', icon: '🔔', label: 'Office Bell' },
  { id: 'reports', icon: '📊', label: 'Reports' },
  { id: 'payroll', icon: '💰', label: 'Payroll' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

const ROLE_DEFAULT_MODULES = {
  admin: ALL_MODULES.map(m => m.id),
  manager: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'files', 'attendance', 'timetracking', 'clienttime', 'employees', 'officecalls', 'reports'],
  employee: ['dashboard', 'messages', 'announcements', 'tasks', 'attendance', 'timetracking', 'settings'],
  partner: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'clienttime', 'files'],
  junior_editor: ['dashboard', 'messages', 'announcements', 'tasks', 'timetracking', 'settings'],
  senior_editor: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'timetracking', 'clienttime', 'files', 'settings'],
  client_manager: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'clienttime', 'employees', 'settings'],
  qa_reviewer: ['dashboard', 'messages', 'announcements', 'tasks', 'projects', 'settings'],
}

export default function Employees({ profile }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterDept, setFilterDept] = useState('all')
  const [showInactive, setShowInactive] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [editEmployee, setEditEmployee] = useState(null)
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)
  const [taskStats, setTaskStats] = useState({})
  const [selectedModules, setSelectedModules] = useState([])
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    department: '', designation: '', role: 'employee',
    base_salary: '', password: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchEmployees()

    const sub = supabase
      .channel(`employees-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchEmployees())
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile, filterRole, filterDept, showInactive])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(t)
    }
  }, [message])

  useEffect(() => {
    const defaults = ROLE_DEFAULT_MODULES[form.role] || ['dashboard', 'messages', 'tasks']
    setSelectedModules(defaults)
  }, [form.role])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true })

      if (filterRole !== 'all') query = query.eq('role', filterRole)
      if (filterDept !== 'all') query = query.eq('department', filterDept)
      if (!showInactive) query = query.eq('is_active', true)

      const { data, error } = await query
      if (error) throw error
      setEmployees(data || [])

      if (data && data.length > 0) {
        const { data: tasks } = await supabase.from('tasks').select('assigned_to, status')
        if (tasks) {
          const stats = {}
          data.forEach(emp => {
            const empTasks = tasks.filter(t => t.assigned_to === emp.id)
            stats[emp.id] = {
              total: empTasks.length,
              done: empTasks.filter(t => t.status === 'done').length,
              inProgress: empTasks.filter(t => t.status === 'in_progress').length,
            }
          })
          setTaskStats(stats)
        }
      }
    } catch (e) {
      console.error('fetchEmployees error:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) {
      setMessage('❌ Name and email required!')
      return
    }
    setCreating(true)
    try {
      if (editEmployee) {
        const { error } = await supabase.from('profiles').update({
          full_name: form.full_name,
          phone: form.phone,
          department: form.department,
          designation: form.designation,
          role: form.role,
          base_salary: parseFloat(form.base_salary) || 0,
        }).eq('id', editEmployee.id)
        if (error) throw error

        await saveModuleVisibility(editEmployee.id)
        setMessage('✅ Employee updated!')
        fetchEmployees()
        closeModal()
      } else {
        if (!form.password || form.password.length < 6) {
          setMessage('❌ Password must be at least 6 characters!')
          setCreating(false)
          return
        }

        const moduleVisibility = ALL_MODULES.map(m => ({
          module_id: m.id,
          is_visible: selectedModules.includes(m.id)
        }))

        const { data, error } = await supabase.functions.invoke('create-user', {
          body: {
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone,
            department: form.department,
            designation: form.designation,
            role: form.role,
            base_salary: form.base_salary,
            module_visibility: moduleVisibility
          }
        })

        if (error) throw error
        if (data?.error) throw new Error(data.error)

        setMessage('✅ Employee created! They can now login.')
        fetchEmployees()
        closeModal()
      }
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setCreating(false)
    }
  }

  const saveModuleVisibility = async (userId) => {
    const visibilityData = ALL_MODULES.map(m => ({
      user_id: userId,
      module_id: m.id,
      is_visible: selectedModules.includes(m.id)
    }))
    await supabase.from('user_module_visibility')
      .upsert(visibilityData, { onConflict: 'user_id,module_id' })
  }

  const fetchEmployeeModules = async (emp) => {
    const { data } = await supabase
      .from('user_module_visibility')
      .select('*')
      .eq('user_id', emp.id)

    if (data && data.length > 0) {
      setSelectedModules(data.filter(d => d.is_visible).map(d => d.module_id))
    } else {
      setSelectedModules(ROLE_DEFAULT_MODULES[emp.role] || ['dashboard', 'messages', 'tasks'])
    }
  }

  const toggleActive = async (emp) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !emp.is_active })
        .eq('id', emp.id)

      if (error) throw error
      setMessage(`✅ ${emp.full_name} ${!emp.is_active ? 'activated' : 'deactivated'}!`)
      fetchEmployees()
      if (showDetail?.id === emp.id) {
        setShowDetail(prev => ({ ...prev, is_active: !emp.is_active }))
      }
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const deleteEmployee = async (emp) => {
    if (!window.confirm(`Delete ${emp.full_name}? Their past data will be kept but they will be removed from the system.`)) return
    try {
      // Soft delete — deactivate + clear sensitive info
      const { error } = await supabase.from('profiles').update({
        is_active: false,
        email: `deleted_${emp.id}@deleted.com`,
      }).eq('id', emp.id)

      if (error) throw error

      // Remove module visibility
      await supabase.from('user_module_visibility').delete().eq('user_id', emp.id)

      setMessage(`✅ ${emp.full_name} removed from system!`)
      setShowDetail(null)
      fetchEmployees()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const openEdit = async (emp) => {
    setEditEmployee(emp)
    setForm({
      full_name: emp.full_name || '',
      email: emp.email || '',
      phone: emp.phone || '',
      department: emp.department || '',
      designation: emp.designation || '',
      role: emp.role || 'employee',
      base_salary: emp.base_salary || '',
      password: ''
    })
    await fetchEmployeeModules(emp)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditEmployee(null)
    setForm({ full_name: '', email: '', phone: '', department: '', designation: '', role: 'employee', base_salary: '', password: '' })
    setSelectedModules(ROLE_DEFAULT_MODULES['employee'])
    setMessage('')
  }

  const toggleModule = (moduleId) => {
    setSelectedModules(prev =>
      prev.includes(moduleId)
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
    )
  }

  const getRoleConfig = (role) => ROLES.find(r => r.id === role) || { label: role, color: '#888' }

  const filtered = employees.filter(emp => {
    if (!search) return true
    return emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.department?.toLowerCase().includes(search.toLowerCase())
  })

  const activeCount = employees.filter(e => e.is_active).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Employees</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {activeCount} active · {employees.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Show Inactive Toggle */}
          <button
            onClick={() => setShowInactive(!showInactive)}
            style={{
              padding: '7px 12px', borderRadius: '8px',
              border: `1px solid ${showInactive ? '#d71920' : '#e5e5e5'}`,
              background: showInactive ? 'rgba(215,25,32,0.06)' : 'white',
              color: showInactive ? '#d71920' : '#888',
              cursor: 'pointer', fontSize: '12px', fontWeight: '600'
            }}
          >
            {showInactive ? '👁️ Showing All' : '👁️ Show Inactive'}
          </button>
          {isAdmin && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
              + Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Role Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {ROLES.filter(r => employees.some(e => e.role === r.id)).map(role => (
          <div key={role.id} style={{
            background: 'white', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${role.color}22`,
            cursor: 'pointer', transition: 'all 0.2s'
          }} onClick={() => setFilterRole(filterRole === role.id ? 'all' : role.id)}>
            <div style={{ color: role.color, fontSize: '20px', fontWeight: '800' }}>
              {employees.filter(e => e.role === role.id).length}
            </div>
            <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{role.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="🔍 Search name, email..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '200px', padding: '8px 14px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}
        />
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
          <option value="all">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
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

      {/* Employee Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '180px', borderRadius: '12px' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">👥</div>
          <div className="empty-title">No employees found</div>
          <div className="empty-desc">Add team members to get started</div>
          {isAdmin && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
              + Add Employee
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map(emp => {
            const roleConfig = getRoleConfig(emp.role)
            const stats = taskStats[emp.id] || { total: 0, done: 0, inProgress: 0 }
            const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

            return (
              <div key={emp.id}
                className="card card-clickable"
                onClick={() => setShowDetail(emp)}
                style={{
                  opacity: emp.is_active ? 1 : 0.5,
                  borderTop: `3px solid ${roleConfig.color}`,
                  position: 'relative'
                }}
              >
                {/* Inactive Badge */}
                {!emp.is_active && (
                  <div style={{
                    position: 'absolute', top: '12px', right: '12px',
                    background: 'rgba(215,25,32,0.1)', color: '#d71920',
                    padding: '2px 8px', borderRadius: '20px',
                    fontSize: '10px', fontWeight: '800'
                  }}>
                    INACTIVE
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div className="avatar avatar-lg" style={{
                    background: `${roleConfig.color}15`,
                    color: roleConfig.color,
                    border: `2px solid ${roleConfig.color}25`,
                    fontSize: '20px', fontWeight: '800'
                  }}>
                    {emp.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: '#111', fontWeight: '800', fontSize: '15px' }}>{emp.full_name}</div>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>
                      {emp.designation || emp.department || 'No designation'}
                    </div>
                    <span style={{
                      background: `${roleConfig.color}12`, color: roleConfig.color,
                      padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                    }}>
                      {roleConfig.label}
                    </span>
                  </div>
                </div>

                {/* Task Stats */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  {[
                    { label: 'Tasks', value: stats.total, color: '#888' },
                    { label: 'Active', value: stats.inProgress, color: '#2563eb' },
                    { label: 'Done', value: stats.done, color: '#16a34a' },
                  ].map(s => (
                    <div key={s.label} style={{ flex: 1, background: '#f9f9f9', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                      <div style={{ color: s.color, fontSize: '16px', fontWeight: '800' }}>{s.value}</div>
                      <div style={{ color: '#aaa', fontSize: '10px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {stats.total > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: '#aaa', fontSize: '11px' }}>Completion</span>
                      <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>{completionRate}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${completionRate}%` }} />
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div className={`status-dot ${emp.is_active ? 'online' : 'offline'}`} />
                    <span style={{ color: '#aaa', fontSize: '11px' }}>{emp.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  {emp.department && (
                    <span style={{ color: '#888', fontSize: '11px', background: '#f5f5f5', padding: '2px 8px', borderRadius: '4px' }}>
                      {emp.department}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Employee Detail Modal */}
      {showDetail && (
        <div className="modal-overlay" onClick={() => setShowDetail(null)}>
          <div className="modal" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>

            <div style={{
              background: `linear-gradient(135deg, ${getRoleConfig(showDetail.role).color}18, white)`,
              padding: '24px', borderBottom: '1px solid #e5e5e5'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="avatar avatar-xl" style={{
                    background: `${getRoleConfig(showDetail.role).color}15`,
                    color: getRoleConfig(showDetail.role).color,
                    border: `2px solid ${getRoleConfig(showDetail.role).color}25`,
                    fontSize: '28px', fontWeight: '800'
                  }}>
                    {showDetail.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>
                      {showDetail.full_name}
                    </h2>
                    <div style={{ color: '#888', fontSize: '13px', marginBottom: '6px' }}>
                      {showDetail.designation || 'No designation'} · {showDetail.department || 'No department'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{
                        background: `${getRoleConfig(showDetail.role).color}12`,
                        color: getRoleConfig(showDetail.role).color,
                        padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700'
                      }}>
                        {getRoleConfig(showDetail.role).label}
                      </span>
                      {!showDetail.is_active && (
                        <span style={{ background: 'rgba(215,25,32,0.1)', color: '#d71920', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                          INACTIVE
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowDetail(null)} style={{
                  background: '#f5f5f5', border: 'none', borderRadius: '8px',
                  color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>✕</button>
              </div>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Info */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Email', value: showDetail.email || '—', icon: '📧' },
                  { label: 'Phone', value: showDetail.phone || '—', icon: '📱' },
                  { label: 'Department', value: showDetail.department || '—', icon: '🏢' },
                  { label: 'Status', value: showDetail.is_active ? 'Active' : 'Inactive', icon: showDetail.is_active ? '🟢' : '🔴' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ color: '#bbb', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                      {item.label}
                    </div>
                    <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>
                      {item.icon} {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Task Performance */}
              {taskStats[showDetail.id] && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                    Task Performance
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                    {[
                      { label: 'Total', value: taskStats[showDetail.id].total, color: '#7c3aed' },
                      { label: 'Active', value: taskStats[showDetail.id].inProgress, color: '#2563eb' },
                      { label: 'Done', value: taskStats[showDetail.id].done, color: '#16a34a' },
                    ].map(s => (
                      <div key={s.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                        <div style={{ color: s.color, fontSize: '22px', fontWeight: '800' }}>{s.value}</div>
                        <div style={{ color: '#888', fontSize: '11px' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Admin Actions */}
              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', paddingTop: '16px', borderTop: '1px solid #e5e5e5', flexWrap: 'wrap' }}>
                  <button onClick={() => { openEdit(showDetail); setShowDetail(null) }} className="btn btn-secondary btn-sm">
                    ✏️ Edit & Permissions
                  </button>
                  <button onClick={() => toggleActive(showDetail)} className="btn btn-sm" style={{
                    background: showDetail.is_active ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                    color: showDetail.is_active ? '#d71920' : '#16a34a',
                    border: `1px solid ${showDetail.is_active ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
                  }}>
                    {showDetail.is_active ? '🔒 Deactivate' : '✅ Activate'}
                  </button>
                  <button onClick={() => deleteEmployee(showDetail)} className="btn btn-danger btn-sm">
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '580px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, background: 'white', zIndex: 10
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>
                {editEmployee ? '✏️ Edit Employee' : '+ Add New Employee'}
              </h3>
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

              {/* Basic Info */}
              <div style={{ color: '#bbb', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Basic Info
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                {[
                  { label: 'Full Name *', key: 'full_name', type: 'text', placeholder: 'John Doe' },
                  { label: 'Email *', key: 'email', type: 'email', placeholder: 'john@klipscen.com', disabled: !!editEmployee },
                  { label: 'Phone', key: 'phone', type: 'text', placeholder: '03xx-xxxxxxx' },
                  { label: 'Designation', key: 'designation', type: 'text', placeholder: 'Video Editor' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="input-label">{field.label}</label>
                    <input type={field.type} value={form[field.key]}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      disabled={field.disabled}
                      className="input"
                      style={field.disabled ? { background: '#f5f5f5', color: '#999' } : {}}
                    />
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Department</label>
                <select value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="input">
                  <option value="">-- Select Department --</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {!editEmployee && (
                <div style={{ marginBottom: '14px' }}>
                  <label className="input-label">Password *</label>
                  <input type="password" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Min 6 characters" className="input" />
                </div>
              )}

              {/* Role */}
              <div style={{ color: '#bbb', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '20px 0 12px' }}>
                Role
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' }}>
                {ROLES.map(role => (
                  <div key={role.id}
                    onClick={() => setForm({ ...form, role: role.id })}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                      border: `1px solid ${form.role === role.id ? role.color : '#e5e5e5'}`,
                      background: form.role === role.id ? `${role.color}10` : 'white',
                      display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s'
                    }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: role.color, flexShrink: 0 }} />
                    <span style={{ color: form.role === role.id ? role.color : '#666', fontSize: '13px', fontWeight: form.role === role.id ? '700' : '500' }}>
                      {role.label}
                    </span>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div style={{ marginBottom: '14px' }}>
                  <label className="input-label">Base Salary (PKR)</label>
                  <input type="number" value={form.base_salary}
                    onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                    placeholder="50000" className="input" />
                </div>
              )}

              {/* App Permissions */}
              <div style={{
                background: '#f9f9f9', borderRadius: '12px', padding: '16px',
                marginBottom: '20px', border: '1px solid #e5e5e5'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>App Permissions</div>
                    <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>Choose what this employee can see</div>
                  </div>
                  <button type="button"
                    onClick={() => setSelectedModules(ROLE_DEFAULT_MODULES[form.role] || [])}
                    style={{ background: 'white', border: '1px solid #e5e5e5', borderRadius: '6px', padding: '4px 10px', color: '#888', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                  >
                    Reset to Default
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                  {ALL_MODULES.map(mod => {
                    const isOn = selectedModules.includes(mod.id)
                    return (
                      <div key={mod.id} onClick={() => toggleModule(mod.id)} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: isOn ? 'rgba(215,25,32,0.05)' : 'white',
                        border: `1px solid ${isOn ? 'rgba(215,25,32,0.15)' : '#e5e5e5'}`,
                        transition: 'all 0.15s'
                      }}>
                        <span style={{ color: isOn ? '#111' : '#aaa', fontSize: '13px' }}>
                          {mod.icon} {mod.label}
                        </span>
                        <div style={{
                          width: '34px', height: '19px', borderRadius: '10px',
                          background: isOn ? '#d71920' : '#e5e5e5',
                          position: 'relative', flexShrink: 0, transition: 'background 0.2s'
                        }}>
                          <div style={{
                            width: '13px', height: '13px', borderRadius: '50%',
                            background: 'white', position: 'absolute', top: '3px',
                            left: isOn ? '18px' : '3px', transition: 'left 0.2s',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }} />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ color: '#888', fontSize: '12px', marginTop: '10px', textAlign: 'center' }}>
                  {selectedModules.length} of {ALL_MODULES.length} modules enabled
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={closeModal} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={creating} className="btn btn-primary" style={{
                  flex: 2, justifyContent: 'center', opacity: creating ? 0.7 : 1
                }}>
                  {creating ? '⟳ Saving...' : editEmployee ? 'Update Employee' : 'Create Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
