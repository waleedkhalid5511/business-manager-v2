import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TABS = [
  { id: 'client', icon: '👤', label: 'Client Reports' },
  { id: 'employee', icon: '👥', label: 'Employee Reports' },
  { id: 'project', icon: '📁', label: 'Project Reports' },
  { id: 'time', icon: '⏱', label: 'Time Reports' },
  { id: 'attendance', icon: '📅', label: 'Attendance Reports' },
]

export default function Reports({ profile }) {
  const [activeTab, setActiveTab] = useState('client')
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  // Data states
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [timeLogs, setTimeLogs] = useState([])
  const [attendance, setAttendance] = useState([])
  const [projects, setProjects] = useState([])

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAll()
  }, [profile, dateRange, customStart, customEnd])

  const getDateRange = () => {
    const now = new Date()
    let start, end
    end = now.toISOString()

    if (dateRange === 'week') {
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    } else if (dateRange === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    } else if (dateRange === 'quarter') {
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    } else if (dateRange === 'year') {
      start = new Date(now.getFullYear(), 0, 1).toISOString()
    } else if (dateRange === 'custom' && customStart && customEnd) {
      start = new Date(customStart).toISOString()
      end = new Date(customEnd).toISOString()
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    }

    return { start, end }
  }

  const fetchAll = async () => {
    setLoading(true)
    const { start, end } = getDateRange()

    try {
      const [
        clientsRes, employeesRes, tasksRes,
        timeLogsRes, attendanceRes
      ] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
        supabase.from('tasks').select(`
          *, 
          client:clients(id, name),
          assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name)
        `).gte('created_at', start).lte('created_at', end),
        supabase.from('task_time_logs').select(`
          *, 
          task:tasks(id, title, project, client_id),
          profiles(id, full_name)
        `).gte('created_at', start).lte('created_at', end),
        supabase.from('attendance').select(`
          *, profiles(id, full_name, department)
        `).gte('date', start.split('T')[0]).lte('date', end.split('T')[0])
      ])

      setClients(clientsRes.data || [])
      setEmployees(employeesRes.data || [])
      setTasks(tasksRes.data || [])
      setTimeLogs(timeLogsRes.data || [])
      setAttendance(attendanceRes.data || [])

      // Build projects from tasks
      const projectMap = {}
      ;(tasksRes.data || []).forEach(task => {
        if (!task.project) return
        if (!projectMap[task.project]) {
          projectMap[task.project] = {
            name: task.project, tasks: [],
            client: task.client || null
          }
        }
        projectMap[task.project].tasks.push(task)
      })
      setProjects(Object.values(projectMap))

    } catch (e) {
      console.error('Reports fetchAll error:', e)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (mins) => {
    if (!mins) return '0m'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const formatDate = (d) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getClientStats = (clientId) => {
    const clientTasks = tasks.filter(t => t.client_id === clientId)
    const clientTimeLogs = timeLogs.filter(l => l.task?.client_id === clientId)
    const totalTime = clientTimeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
    const done = clientTasks.filter(t => t.status === 'done').length
    const completion = clientTasks.length > 0 ? Math.round((done / clientTasks.length) * 100) : 0
    const overdue = clientTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
    const avgPipeline = clientTasks.length > 0
      ? Math.round(clientTasks.reduce((sum, t) => sum + (t.pipeline_percent || 0), 0) / clientTasks.length)
      : 0

    return { total: clientTasks.length, done, completion, overdue, totalTime, avgPipeline }
  }

  const getEmployeeStats = (empId) => {
    const empTasks = tasks.filter(t => t.assigned_to === empId)
    const empTimeLogs = timeLogs.filter(l => l.profiles?.id === empId)
    const empAttendance = attendance.filter(a => a.employee_id === empId)
    const totalTime = empTimeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
    const done = empTasks.filter(t => t.status === 'done').length
    const completion = empTasks.length > 0 ? Math.round((done / empTasks.length) * 100) : 0
    const presentDays = empAttendance.filter(a => ['present', 'late'].includes(a.status)).length
    const lateDays = empAttendance.filter(a => a.status === 'late').length
    const absentDays = empAttendance.filter(a => a.status === 'absent').length
    const lateMinutes = empAttendance.reduce((sum, a) => sum + (a.late_minutes || 0), 0)

    return {
      total: empTasks.length, done, completion,
      totalTime, presentDays, lateDays, absentDays, lateMinutes,
      inProgress: empTasks.filter(t => t.status === 'in_progress').length
    }
  }

  const getProjectStats = (project) => {
    const projectTimeLogs = timeLogs.filter(l => l.task?.project === project.name)
    const totalTime = projectTimeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
    const done = project.tasks.filter(t => t.status === 'done').length
    const completion = project.tasks.length > 0 ? Math.round((done / project.tasks.length) * 100) : 0
    const overdue = project.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
    const members = [...new Set(project.tasks.map(t => t.assigned_to_profile?.full_name).filter(Boolean))]

    return { done, completion, overdue, totalTime, members }
  }

  // ===== TIME REPORT DATA =====
  const getTimeByEmployee = () => {
    const map = {}
    timeLogs.forEach(log => {
      const id = log.profiles?.id
      const name = log.profiles?.full_name || 'Unknown'
      if (!id) return
      if (!map[id]) map[id] = { name, total: 0, taskCount: new Set() }
      map[id].total += log.duration_minutes || 0
      if (log.task?.id) map[id].taskCount.add(log.task.id)
    })
    return Object.values(map).map(e => ({ ...e, taskCount: e.taskCount.size }))
      .sort((a, b) => b.total - a.total)
  }

  const getTimeByClient = () => {
    const map = {}
    timeLogs.forEach(log => {
      const clientId = log.task?.client_id
      if (!clientId) return
      const client = clients.find(c => c.id === clientId)
      const name = client?.name || 'No Client'
      if (!map[clientId]) map[clientId] = { name, total: 0 }
      map[clientId].total += log.duration_minutes || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  const getTimeByProject = () => {
    const map = {}
    timeLogs.forEach(log => {
      const project = log.task?.project || 'No Project'
      if (!map[project]) map[project] = { name: project, total: 0 }
      map[project].total += log.duration_minutes || 0
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }

  // ===== ATTENDANCE REPORT DATA =====
  const getAttendanceSummary = () => {
    return employees.map(emp => {
      const empAtt = attendance.filter(a => a.employee_id === emp.id)
      const present = empAtt.filter(a => a.status === 'present').length
      const late = empAtt.filter(a => a.status === 'late').length
      const absent = empAtt.filter(a => a.status === 'absent').length
      const onLeave = empAtt.filter(a => a.status === 'on_leave').length
      const totalDays = present + late + absent + onLeave
      const attendanceRate = totalDays > 0 ? Math.round(((present + late) / totalDays) * 100) : 0
      const lateMinutes = empAtt.reduce((sum, a) => sum + (a.late_minutes || 0), 0)

      return {
        id: emp.id, name: emp.full_name, role: emp.role,
        department: emp.department,
        present, late, absent, onLeave,
        totalDays, attendanceRate, lateMinutes
      }
    }).filter(e => e.totalDays > 0)
  }

  const totalTimeLogged = timeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Reports</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {tasks.length} tasks · {formatDuration(totalTimeLogged)} logged · {clients.length} clients
          </p>
        </div>

        {/* Date Range */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', overflow: 'hidden' }}>
            {[
              { id: 'week', label: '7D' },
              { id: 'month', label: '30D' },
              { id: 'quarter', label: '90D' },
              { id: 'year', label: 'Year' },
              { id: 'custom', label: 'Custom' },
            ].map(r => (
              <button key={r.id} onClick={() => setDateRange(r.id)} style={{
                padding: '7px 12px', border: 'none', cursor: 'pointer',
                background: dateRange === r.id ? '#d71920' : 'transparent',
                color: dateRange === r.id ? 'white' : '#888',
                fontSize: '12px', fontWeight: '700'
              }}>
                {r.label}
              </button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '12px', outline: 'none' }} />
              <input type="date" value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '12px', outline: 'none' }} />
            </>
          )}
        </div>
      </div>

      {/* Report Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'white', padding: '6px', borderRadius: '12px', border: '1px solid #e5e5e5', overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '8px 16px', border: 'none', borderRadius: '8px',
            background: activeTab === tab.id ? '#d71920' : 'transparent',
            color: activeTab === tab.id ? 'white' : '#888',
            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
            whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.2s'
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '100px', borderRadius: '12px' }} />)}
        </div>
      ) : (
        <>
          {/* ===== CLIENT REPORTS ===== */}
          {activeTab === 'client' && (
            <div>
              {/* Overall Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Clients', value: clients.length, color: '#2563eb' },
                  { label: 'Active Tasks', value: tasks.filter(t => t.status !== 'done').length, color: '#d97706' },
                  { label: 'Completed Tasks', value: tasks.filter(t => t.status === 'done').length, color: '#16a34a' },
                  { label: 'Time Logged', value: formatDuration(totalTimeLogged), color: '#7c3aed' },
                  { label: 'Overdue', value: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length, color: '#d71920' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Per Client */}
              {clients.length === 0 ? (
                <div className="empty-state card">
                  <div className="empty-icon">👤</div>
                  <div className="empty-title">No clients yet</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {clients.map(client => {
                    const stats = getClientStats(client.id)
                    return (
                      <div key={client.id} style={{
                        background: 'white', borderRadius: '14px', padding: '20px',
                        border: '1px solid #e5e5e5', boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '44px', height: '44px', borderRadius: '12px',
                              background: 'linear-gradient(135deg, #d71920, #b5151b)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontWeight: '800', fontSize: '18px'
                            }}>
                              {client.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: '#111', fontWeight: '800', fontSize: '16px' }}>{client.name}</div>
                              {client.email && <div style={{ color: '#888', fontSize: '12px' }}>{client.email}</div>}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                              {stats.completion}% Complete
                            </span>
                            {stats.overdue > 0 && (
                              <span style={{ background: 'rgba(215,25,32,0.1)', color: '#d71920', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700' }}>
                                ⚠️ {stats.overdue} Overdue
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '16px' }}>
                          {[
                            { label: 'Total Tasks', value: stats.total, color: '#888' },
                            { label: 'Completed', value: stats.done, color: '#16a34a' },
                            { label: 'In Progress', value: stats.total - stats.done - stats.overdue, color: '#2563eb' },
                            { label: 'Time Logged', value: formatDuration(stats.totalTime), color: '#7c3aed' },
                            { label: 'Avg Pipeline', value: `${stats.avgPipeline}%`, color: '#d97706' },
                          ].map(s => (
                            <div key={s.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                              <div style={{ color: s.color, fontSize: '16px', fontWeight: '800' }}>{s.value}</div>
                              <div style={{ color: '#aaa', fontSize: '10px', marginTop: '2px' }}>{s.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Progress Bar */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: '#888', fontSize: '12px' }}>Overall Progress</span>
                            <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '700' }}>{stats.completion}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: '8px' }}>
                            <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
                          </div>
                        </div>

                        {/* Recent Tasks for this client */}
                        {tasks.filter(t => t.client_id === client.id).length > 0 && (
                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f0f0f0' }}>
                            <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                              Tasks
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {tasks.filter(t => t.client_id === client.id).slice(0, 4).map(task => (
                                <div key={task.id} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '8px 12px', background: '#f9f9f9', borderRadius: '8px',
                                  borderLeft: `3px solid ${task.status === 'done' ? '#16a34a' : task.status === 'in_progress' ? '#2563eb' : '#888'}`
                                }}>
                                  <div>
                                    <div style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{task.title}</div>
                                    {task.assigned_to_profile && (
                                      <div style={{ color: '#888', fontSize: '11px' }}>👤 {task.assigned_to_profile.full_name}</div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    {task.pipeline_percent > 0 && (
                                      <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>{task.pipeline_percent}%</span>
                                    )}
                                    <span style={{
                                      background: task.status === 'done' ? 'rgba(22,163,74,0.1)' : task.status === 'in_progress' ? 'rgba(37,99,235,0.1)' : '#f5f5f5',
                                      color: task.status === 'done' ? '#16a34a' : task.status === 'in_progress' ? '#2563eb' : '#888',
                                      padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700'
                                    }}>
                                      {task.status?.replace('_', ' ')}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ===== EMPLOYEE REPORTS ===== */}
          {activeTab === 'employee' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Members', value: employees.length, color: '#2563eb' },
                  { label: 'Tasks Done', value: tasks.filter(t => t.status === 'done').length, color: '#16a34a' },
                  { label: 'Hours Logged', value: formatDuration(totalTimeLogged), color: '#7c3aed' },
                 { label: 'Avg Completion', value: `${employees.length > 0 ? Math.round(employees.reduce((sum, emp) => sum + getEmployeeStats(emp.id).completion, 0) / employees.length) : 0}%`, color: '#d97706' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {employees.map(emp => {
                  const stats = getEmployeeStats(emp.id)
                  const roleColor = { admin: '#d71920', manager: '#d97706', employee: '#2563eb', partner: '#7c3aed', junior_editor: '#0891b2', senior_editor: '#059669', client_manager: '#d97706', qa_reviewer: '#7c3aed' }
                  const color = roleColor[emp.role] || '#888'

                  return (
                    <div key={emp.id} style={{
                      background: 'white', borderRadius: '14px', padding: '20px',
                      border: '1px solid #e5e5e5', borderTop: `3px solid ${color}`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '12px',
                            background: `${color}18`, color,
                            border: `2px solid ${color}25`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '800', fontSize: '18px'
                          }}>
                            {emp.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ color: '#111', fontWeight: '800', fontSize: '15px' }}>{emp.full_name}</div>
                            <div style={{ color: '#888', fontSize: '12px', textTransform: 'capitalize' }}>
                              {emp.role?.replace('_', ' ')} {emp.department ? `· ${emp.department}` : ''}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          background: `${color}12`, color,
                          padding: '4px 12px', borderRadius: '20px',
                          fontSize: '12px', fontWeight: '700'
                        }}>
                          {stats.completion}% completion
                        </span>
                      </div>

                      {/* Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { label: 'Tasks', value: stats.total, color: '#888' },
                          { label: 'Done', value: stats.done, color: '#16a34a' },
                          { label: 'Active', value: stats.inProgress, color: '#2563eb' },
                          { label: 'Time', value: formatDuration(stats.totalTime), color: '#7c3aed' },
                          { label: 'Present', value: stats.presentDays, color: '#16a34a' },
                          { label: 'Late', value: stats.lateDays, color: '#d97706' },
                          { label: 'Absent', value: stats.absentDays, color: '#d71920' },
                        ].map(s => (
                          <div key={s.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                            <div style={{ color: s.color, fontSize: '15px', fontWeight: '800' }}>{s.value}</div>
                            <div style={{ color: '#aaa', fontSize: '10px' }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Completion Bar */}
                      <div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
                        </div>
                      </div>

                      {/* Late minutes */}
                      {stats.lateMinutes > 0 && (
                        <div style={{ marginTop: '10px', color: '#d97706', fontSize: '12px', fontWeight: '600' }}>
                          ⚠️ Total late: {formatDuration(stats.lateMinutes)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ===== PROJECT REPORTS ===== */}
          {activeTab === 'project' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Projects', value: projects.length, color: '#2563eb' },
                  { label: 'Completed', value: projects.filter(p => getProjectStats(p).completion === 100).length, color: '#16a34a' },
                  { label: 'At Risk', value: projects.filter(p => getProjectStats(p).overdue > 0).length, color: '#d71920' },
                  { label: 'Time Logged', value: formatDuration(totalTimeLogged), color: '#7c3aed' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {projects.length === 0 ? (
                <div className="empty-state card">
                  <div className="empty-icon">📁</div>
                  <div className="empty-title">No projects in this period</div>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Project</th>
                        <th>Client</th>
                        <th>Tasks</th>
                        <th>Progress</th>
                        <th>Time</th>
                        <th>Team</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map(project => {
                        const stats = getProjectStats(project)
                        return (
                          <tr key={project.name}>
                            <td>
                              <div style={{ fontWeight: '700', color: '#111' }}>📁 {project.name}</div>
                            </td>
                            <td>
                              {project.client ? (
                                <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '600' }}>
                                  👤 {project.client.name}
                                </span>
                              ) : <span style={{ color: '#ccc' }}>—</span>}
                            </td>
                            <td>
                              <span style={{ color: '#888' }}>{stats.done}/{project.tasks.length}</span>
                            </td>
                            <td style={{ width: '150px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="progress-bar" style={{ flex: 1 }}>
                                  <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
                                </div>
                                <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>
                                  {stats.completion}%
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ color: '#7c3aed', fontWeight: '600', fontSize: '13px' }}>
                                {formatDuration(stats.totalTime)}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '-4px' }}>
                                {stats.members.slice(0, 3).map((name, i) => (
                                  <div key={i} className="avatar" style={{
                                    width: '24px', height: '24px', fontSize: '10px',
                                    marginLeft: i > 0 ? '-6px' : 0, border: '2px solid white'
                                  }}>
                                    {name?.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td>
                              <span className="badge" style={{
                                background: stats.overdue > 0 ? 'rgba(215,25,32,0.1)' : stats.completion === 100 ? 'rgba(22,163,74,0.1)' : 'rgba(37,99,235,0.1)',
                                color: stats.overdue > 0 ? '#d71920' : stats.completion === 100 ? '#16a34a' : '#2563eb'
                              }}>
                                {stats.overdue > 0 ? '⚠️ At Risk' : stats.completion === 100 ? '✅ Done' : '🔄 Active'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===== TIME REPORTS ===== */}
          {activeTab === 'time' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '24px' }}>
                {[
                  { label: 'Total Time', value: formatDuration(totalTimeLogged), color: '#7c3aed' },
                  { label: 'Total Logs', value: timeLogs.length, color: '#2563eb' },
                  { label: 'Tasks Worked', value: new Set(timeLogs.map(l => l.task?.id).filter(Boolean)).size, color: '#16a34a' },
                  { label: 'Avg Per Log', value: timeLogs.length > 0 ? formatDuration(Math.round(totalTimeLogged / timeLogs.length)) : '0m', color: '#d97706' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {/* By Employee */}
                <div className="card">
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👥 By Employee
                  </div>
                  {getTimeByEmployee().length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>No time logs</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {getTimeByEmployee().map(emp => {
                        const pct = totalTimeLogged > 0 ? Math.round((emp.total / totalTimeLogged) * 100) : 0
                        return (
                          <div key={emp.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{emp.name}</span>
                              <span style={{ color: '#7c3aed', fontSize: '13px', fontWeight: '700' }}>{formatDuration(emp.total)}</span>
                            </div>
                            <div className="progress-bar">
                              <div style={{
                                height: '100%', borderRadius: '99px', width: `${pct}%`,
                                background: 'linear-gradient(90deg, #7c3aed, #6d28d9)'
                              }} />
                            </div>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>{emp.taskCount} tasks · {pct}% of total</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* By Client */}
                <div className="card">
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    👤 By Client
                  </div>
                  {getTimeByClient().length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>No client time logs</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {getTimeByClient().map(c => {
                        const pct = totalTimeLogged > 0 ? Math.round((c.total / totalTimeLogged) * 100) : 0
                        return (
                          <div key={c.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{c.name}</span>
                              <span style={{ color: '#d71920', fontSize: '13px', fontWeight: '700' }}>{formatDuration(c.total)}</span>
                            </div>
                            <div className="progress-bar">
                              <div className="progress-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>{pct}% of total</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* By Project */}
                <div className="card">
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📁 By Project
                  </div>
                  {getTimeByProject().length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>No project time logs</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {getTimeByProject().map(p => {
                        const pct = totalTimeLogged > 0 ? Math.round((p.total / totalTimeLogged) * 100) : 0
                        return (
                          <div key={p.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{p.name}</span>
                              <span style={{ color: '#2563eb', fontSize: '13px', fontWeight: '700' }}>{formatDuration(p.total)}</span>
                            </div>
                            <div className="progress-bar">
                              <div style={{
                                height: '100%', borderRadius: '99px', width: `${pct}%`,
                                background: 'linear-gradient(90deg, #2563eb, #1d4ed8)'
                              }} />
                            </div>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>{pct}% of total</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ===== ATTENDANCE REPORTS ===== */}
          {activeTab === 'attendance' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Records', value: attendance.length, color: '#2563eb' },
                  { label: 'Present', value: attendance.filter(a => a.status === 'present').length, color: '#16a34a' },
                  { label: 'Late', value: attendance.filter(a => a.status === 'late').length, color: '#d97706' },
                  { label: 'Absent', value: attendance.filter(a => a.status === 'absent').length, color: '#d71920' },
                  { label: 'On Leave', value: attendance.filter(a => a.status === 'on_leave').length, color: '#7c3aed' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {getAttendanceSummary().length === 0 ? (
                <div className="empty-state card">
                  <div className="empty-icon">📅</div>
                  <div className="empty-title">No attendance records</div>
                </div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Present</th>
                        <th>Late</th>
                        <th>Absent</th>
                        <th>On Leave</th>
                        <th>Late Time</th>
                        <th>Attendance Rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getAttendanceSummary().map(emp => (
                        <tr key={emp.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar avatar-sm">{emp.name?.charAt(0).toUpperCase()}</div>
                              <div>
                                <div style={{ fontWeight: '700', color: '#111' }}>{emp.name}</div>
                                <div style={{ color: '#888', fontSize: '11px', textTransform: 'capitalize' }}>
                                  {emp.role?.replace('_', ' ')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td><span style={{ color: '#16a34a', fontWeight: '700' }}>{emp.present}</span></td>
                          <td><span style={{ color: '#d97706', fontWeight: '700' }}>{emp.late}</span></td>
                          <td><span style={{ color: '#d71920', fontWeight: '700' }}>{emp.absent}</span></td>
                          <td><span style={{ color: '#7c3aed', fontWeight: '700' }}>{emp.onLeave}</span></td>
                          <td>
                            <span style={{ color: emp.lateMinutes > 0 ? '#d97706' : '#888', fontWeight: emp.lateMinutes > 0 ? '700' : '400', fontSize: '13px' }}>
                              {emp.lateMinutes > 0 ? formatDuration(emp.lateMinutes) : '—'}
                            </span>
                          </td>
                          <td style={{ width: '160px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="progress-bar" style={{ flex: 1 }}>
                                <div className="progress-fill" style={{
                                  width: `${emp.attendanceRate}%`,
                                  background: emp.attendanceRate >= 80 ? 'linear-gradient(90deg, #16a34a, #15803d)' : emp.attendanceRate >= 60 ? 'linear-gradient(90deg, #d97706, #b45309)' : 'linear-gradient(90deg, #d71920, #b5151b)'
                                }} />
                              </div>
                              <span style={{
                                color: emp.attendanceRate >= 80 ? '#16a34a' : emp.attendanceRate >= 60 ? '#d97706' : '#d71920',
                                fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap'
                              }}>
                                {emp.attendanceRate}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
