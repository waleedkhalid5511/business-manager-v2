import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function TimeTracking({ profile }) {
  const [logs, setLogs] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [viewMode, setViewMode] = useState('daily')
  const [stats, setStats] = useState({
    totalMinutes: 0,
    totalTasks: 0,
    avgPerTask: 0,
    topWorker: null
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (profile) {
      fetchLogs()
      if (isAdmin || isManager) fetchEmployees()
    }
  }, [profile, selectedEmployee, selectedDate, viewMode])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('task_time_logs')
        .select(`
          *,
          profiles(full_name, avatar_url),
          tasks(title, project, priority)
        `)
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false })

      // Date filter
      if (viewMode === 'daily') {
        query = query
          .gte('start_time', `${selectedDate}T00:00:00`)
          .lte('start_time', `${selectedDate}T23:59:59`)
      } else if (viewMode === 'weekly') {
        const weekStart = getWeekStart(selectedDate)
        const weekEnd = getWeekEnd(selectedDate)
        query = query
          .gte('start_time', `${weekStart}T00:00:00`)
          .lte('start_time', `${weekEnd}T23:59:59`)
      } else if (viewMode === 'monthly') {
        const month = selectedDate.substring(0, 7)
        query = query
          .gte('start_time', `${month}-01T00:00:00`)
          .lte('start_time', `${month}-31T23:59:59`)
      }

      if (selectedEmployee !== 'all') {
        query = query.eq('employee_id', selectedEmployee)
      } else if (!isAdmin && !isManager) {
        query = query.eq('employee_id', profile.id)
      }

      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
      calculateStats(data || [])
    } catch (e) {
      console.error('fetchLogs error:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles').select('id, full_name').eq('is_active', true)
    setEmployees(data || [])
  }

  const calculateStats = (data) => {
    const totalMinutes = data.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
    const uniqueTasks = new Set(data.map(l => l.task_id)).size

    // Top worker
    const workerMap = {}
    data.forEach(l => {
      const name = l.profiles?.full_name || 'Unknown'
      workerMap[name] = (workerMap[name] || 0) + (l.duration_minutes || 0)
    })
    const topWorker = Object.entries(workerMap).sort((a, b) => b[1] - a[1])[0]

    setStats({
      totalMinutes,
      totalTasks: uniqueTasks,
      avgPerTask: uniqueTasks > 0 ? Math.round(totalMinutes / uniqueTasks) : 0,
      topWorker: topWorker ? { name: topWorker[0], minutes: topWorker[1] } : null
    })
  }

  const getWeekStart = (dateStr) => {
    const date = new Date(dateStr)
    const day = date.getDay()
    const diff = date.getDate() - day + (day === 0 ? -6 : 1)
    return new Date(date.setDate(diff)).toISOString().split('T')[0]
  }

  const getWeekEnd = (dateStr) => {
    const start = new Date(getWeekStart(dateStr))
    start.setDate(start.getDate() + 6)
    return start.toISOString().split('T')[0]
  }

  const formatDuration = (m) => {
    if (!m) return '0m'
    const h = Math.floor(m / 60)
    const min = m % 60
    return h > 0 ? `${h}h ${min}m` : `${min}m`
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  })

  // Group logs by employee
  const groupedByEmployee = logs.reduce((groups, log) => {
    const name = log.profiles?.full_name || 'Unknown'
    if (!groups[name]) groups[name] = []
    groups[name].push(log)
    return groups
  }, {})

  const priorityColor = (p) => ({
    urgent: '#ef4444', high: '#f59e0b',
    medium: '#3b82f6', low: '#10b981'
  }[p] || '#94a3b8')

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '20px', fontWeight: '700' }}>
          ⏱️ Time Tracking
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
          Track work hours per task and employee
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {/* View Mode */}
        <div style={{
          display: 'flex', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden'
        }}>
          {[
            { id: 'daily', label: 'Day' },
            { id: 'weekly', label: 'Week' },
            { id: 'monthly', label: 'Month' },
          ].map(v => (
            <button key={v.id} onClick={() => setViewMode(v.id)} style={{
              padding: '7px 16px', border: 'none', cursor: 'pointer',
              background: viewMode === v.id ? 'var(--accent-blue)' : 'transparent',
              color: viewMode === v.id ? 'white' : 'var(--text-muted)',
              fontSize: '13px', fontWeight: '600'
            }}>
              {v.label}
            </button>
          ))}
        </div>

        <input
          type="date" value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{
            padding: '8px 12px', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
          }}
        />

        {(isAdmin || isManager) && (
          <select value={selectedEmployee}
            onChange={(e) => setSelectedEmployee(e.target.value)}
            style={{
              padding: '8px 12px', background: 'var(--bg-card)',
              border: '1px solid var(--border)', borderRadius: '8px',
              color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
            }}>
            <option value="all">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.full_name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '24px'
      }}>
        {[
          { icon: '⏱️', label: 'Total Time', value: formatDuration(stats.totalMinutes), color: '#3b82f6' },
          { icon: '✅', label: 'Tasks Worked', value: stats.totalTasks, color: '#10b981' },
          { icon: '📊', label: 'Avg Per Task', value: formatDuration(stats.avgPerTask), color: '#f59e0b' },
          { icon: '🏆', label: 'Top Worker', value: stats.topWorker?.name?.split(' ')[0] || '—', color: '#8b5cf6' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--bg-card)', borderRadius: '12px',
            padding: '18px', border: `1px solid ${card.color}22`
          }}>
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>{card.icon}</div>
            <div style={{ color: card.color, fontSize: '20px', fontWeight: '700', marginBottom: '4px' }}>
              {card.value}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">⏱️</div>
          <div className="empty-title">No time logs found</div>
          <div className="empty-desc">
            Start a task timer to see logs here
          </div>
        </div>
      ) : (isAdmin || isManager) && selectedEmployee === 'all' ? (
        /* Group by Employee View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(groupedByEmployee).map(([empName, empLogs]) => {
            const totalMins = empLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
            return (
              <div key={empName} className="card">
                {/* Employee Header */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar avatar-md">
                      {empName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>
                        {empName}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                        {empLogs.length} sessions
                      </div>
                    </div>
                  </div>
                  <div style={{
                    background: 'rgba(59,130,246,0.1)',
                    color: 'var(--accent-blue)',
                    padding: '6px 14px', borderRadius: '20px',
                    fontSize: '14px', fontWeight: '700'
                  }}>
                    {formatDuration(totalMins)}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar" style={{ marginBottom: '14px' }}>
                  <div className="progress-fill" style={{
                    width: `${Math.min(100, (totalMins / 480) * 100)}%`
                  }} />
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '14px' }}>
                  {Math.round((totalMins / 480) * 100)}% of 8h workday
                </div>

                {/* Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {empLogs.map(log => (
                    <div key={log.id} style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', padding: '10px 12px',
                      background: 'var(--bg-hover)', borderRadius: '8px',
                      borderLeft: `3px solid ${priorityColor(log.tasks?.priority)}`
                    }}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{
                          color: 'var(--text-primary)', fontSize: '13px',
                          fontWeight: '600', marginBottom: '2px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {log.tasks?.title || 'Unknown Task'}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {log.tasks?.project && (
                            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                              📁 {log.tasks.project}
                            </span>
                          )}
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                            {formatTime(log.start_time)}
                            {log.end_time && ' → ' + formatTime(log.end_time)}
                          </span>
                        </div>
                      </div>
                      <div style={{
                        color: 'var(--accent-blue)', fontWeight: '700',
                        fontSize: '13px', background: 'rgba(59,130,246,0.1)',
                        padding: '3px 10px', borderRadius: '20px',
                        flexShrink: 0, marginLeft: '12px'
                      }}>
                        {formatDuration(log.duration_minutes)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Single Employee / Own Logs View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>
              Time Logs — {formatDuration(stats.totalMinutes)} total
            </div>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project</th>
                <th>Start</th>
                <th>End</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {log.tasks?.title || '—'}
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {log.tasks?.project || '—'}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {formatTime(log.start_time)}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                    {log.end_time ? formatTime(log.end_time) : (
                      <span style={{ color: '#10b981', fontWeight: '600' }}>Running...</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      color: 'var(--accent-blue)', fontWeight: '700',
                      background: 'rgba(59,130,246,0.1)',
                      padding: '3px 10px', borderRadius: '20px', fontSize: '13px'
                    }}>
                      {log.end_time ? formatDuration(log.duration_minutes) : '⏱ Live'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
