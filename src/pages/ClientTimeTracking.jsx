import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function ClientTimeTracking({ profile }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('monthly')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (profile) fetchLogs()
  }, [profile, viewMode, selectedDate])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('task_time_logs')
        .select(`
          *,
          profiles(full_name),
          tasks(title, project, priority)
        `)
        .not('end_time', 'is', null)
        .order('start_time', { ascending: false })

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

      const { data, error } = await query
      if (error) throw error
      setLogs(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
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

  const formatDate = (ts) => new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric'
  })

  const priorityColor = (p) => ({
    urgent: '#ef4444', high: '#f59e0b',
    medium: '#3b82f6', low: '#10b981'
  }[p] || '#94a3b8')

  // Group by project (client)
  const groupedByClient = logs.reduce((groups, log) => {
    const client = log.tasks?.project || 'No Project / Direct Work'
    if (!groups[client]) groups[client] = []
    groups[client].push(log)
    return groups
  }, {})

  // Filter by search
  const filteredClients = Object.entries(groupedByClient).filter(([client]) =>
    !search || client.toLowerCase().includes(search.toLowerCase())
  )

  // Total stats
  const totalMinutes = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
  const totalClients = Object.keys(groupedByClient).length
  const totalSessions = logs.length

  // Most worked client
  const topClient = filteredClients.sort((a, b) => {
    const aTotal = a[1].reduce((s, l) => s + (l.duration_minutes || 0), 0)
    const bTotal = b[1].reduce((s, l) => s + (l.duration_minutes || 0), 0)
    return bTotal - aTotal
  })[0]

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ color: 'var(--text-primary)', margin: '0 0 4px', fontSize: '20px', fontWeight: '700' }}>
          👤 Client Time Tracking
        </h2>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '13px' }}>
          Time spent per client / project
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

        <input
          type="text" placeholder="🔍 Search client / project..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '8px 14px',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '8px', color: 'var(--text-primary)',
            fontSize: '13px', outline: 'none'
          }}
        />
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px', marginBottom: '24px'
      }}>
        {[
          { icon: '⏱️', label: 'Total Time', value: formatDuration(totalMinutes), color: '#3b82f6' },
          { icon: '👤', label: 'Total Clients', value: totalClients, color: '#8b5cf6' },
          { icon: '🔄', label: 'Total Sessions', value: totalSessions, color: '#f59e0b' },
          {
            icon: '🏆', label: 'Most Time',
            value: topClient ? topClient[0].split(' ')[0] : '—',
            color: '#10b981'
          },
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
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '12px' }} />
          ))}
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">👤</div>
          <div className="empty-title">No client time logs found</div>
          <div className="empty-desc">
            Assign tasks to projects/clients and start timers to see data here
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredClients
            .sort((a, b) => {
              const aTotal = a[1].reduce((s, l) => s + (l.duration_minutes || 0), 0)
              const bTotal = b[1].reduce((s, l) => s + (l.duration_minutes || 0), 0)
              return bTotal - aTotal
            })
            .map(([clientName, clientLogs]) => {
              const totalMins = clientLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
              const percentage = totalMinutes > 0 ? Math.round((totalMins / totalMinutes) * 100) : 0

              // Group by employee within client
              const byEmployee = clientLogs.reduce((g, log) => {
                const name = log.profiles?.full_name || 'Unknown'
                if (!g[name]) g[name] = 0
                g[name] += log.duration_minutes || 0
                return g
              }, {})

              // Unique tasks
              const uniqueTasks = [...new Set(clientLogs.map(l => l.tasks?.title).filter(Boolean))]

              return (
                <div key={clientName} className="card">
                  {/* Client Header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', marginBottom: '16px',
                    flexWrap: 'wrap', gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '20px', fontWeight: '700', flexShrink: 0
                      }}>
                        {clientName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '16px' }}>
                          {clientName}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
                          {clientLogs.length} sessions · {uniqueTasks.length} tasks
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{
                        color: 'var(--accent-blue)', fontSize: '22px',
                        fontWeight: '700'
                      }}>
                        {formatDuration(totalMins)}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {percentage}% of total time
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="progress-bar" style={{ marginBottom: '16px' }}>
                    <div className="progress-fill" style={{ width: `${percentage}%` }} />
                  </div>

                  {/* Employee breakdown */}
                  <div style={{
                    display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px'
                  }}>
                    {Object.entries(byEmployee).map(([empName, mins]) => (
                      <div key={empName} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'var(--bg-hover)', padding: '5px 10px',
                        borderRadius: '20px', border: '1px solid var(--border)'
                      }}>
                        <div className="avatar" style={{
                          width: '20px', height: '20px', fontSize: '9px'
                        }}>
                          {empName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          {empName.split(' ')[0]}
                        </span>
                        <span style={{
                          color: 'var(--accent-blue)', fontSize: '11px', fontWeight: '700'
                        }}>
                          {formatDuration(mins)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Task Logs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {clientLogs.slice(0, 5).map(log => (
                      <div key={log.id} style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', padding: '9px 12px',
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
                          <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                            <span>👤 {log.profiles?.full_name?.split(' ')[0]}</span>
                            <span>📅 {formatDate(log.start_time)}</span>
                            <span>
                              {formatTime(log.start_time)}
                              {log.end_time && ' → ' + formatTime(log.end_time)}
                            </span>
                          </div>
                        </div>
                        <div style={{
                          color: 'var(--accent-blue)', fontWeight: '700',
                          fontSize: '13px', background: 'rgba(59,130,246,0.1)',
                          padding: '3px 10px', borderRadius: '20px',
                          flexShrink: 0, marginLeft: '10px'
                        }}>
                          {formatDuration(log.duration_minutes)}
                        </div>
                      </div>
                    ))}
                    {clientLogs.length > 5 && (
                      <div style={{
                        color: 'var(--text-muted)', fontSize: '12px',
                        textAlign: 'center', padding: '8px'
                      }}>
                        +{clientLogs.length - 5} more sessions
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
