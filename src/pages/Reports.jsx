import { useState, useEffect, useRef } from 'react'
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
  const printRef = useRef(null)

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
    if (dateRange === 'week') start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    else if (dateRange === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    else if (dateRange === 'quarter') start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    else if (dateRange === 'year') start = new Date(now.getFullYear(), 0, 1).toISOString()
    else if (dateRange === 'custom' && customStart && customEnd) {
      start = new Date(customStart).toISOString()
      end = new Date(customEnd).toISOString()
    } else start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    return { start, end }
  }

  const fetchAll = async () => {
    setLoading(true)
    const { start, end } = getDateRange()
    try {
      const [clientsRes, employeesRes, tasksRes, timeLogsRes, attendanceRes] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
        supabase.from('tasks').select(`*, client:clients(id, name), assigned_to_profile:profiles!tasks_assigned_to_fkey(id, full_name)`).gte('created_at', start).lte('created_at', end),
        supabase.from('task_time_logs').select(`*, task:tasks(id, title, project, client_id), profiles(id, full_name)`).gte('created_at', start).lte('created_at', end),
        supabase.from('attendance').select(`*, profiles(id, full_name, department, role)`).gte('date', start.split('T')[0]).lte('date', end.split('T')[0])
      ])

      setClients(clientsRes.data || [])
      setEmployees(employeesRes.data || [])
      setTasks(tasksRes.data || [])
      setTimeLogs(timeLogsRes.data || [])
      setAttendance(attendanceRes.data || [])

      const projectMap = {}
      ;(tasksRes.data || []).forEach(task => {
        if (!task.project) return
        if (!projectMap[task.project]) projectMap[task.project] = { name: task.project, tasks: [], client: task.client || null }
        projectMap[task.project].tasks.push(task)
      })
      setProjects(Object.values(projectMap))
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const handlePrint = () => {
    const currentTab = TABS.find(t => t.id === activeTab)
    const printWindow = window.open('', '_blank')
    const content = printRef.current?.innerHTML || ''
    const dateLabel = dateRange === 'custom' ? `${customStart} to ${customEnd}` : dateRange === 'week' ? 'Last 7 Days' : dateRange === 'month' ? 'This Month' : dateRange === 'quarter' ? 'Last 90 Days' : 'This Year'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Klipscen — ${currentTab?.label} — ${dateLabel}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: white; font-size: 13px; }
          .print-header { background: linear-gradient(135deg, #d71920, #8b0000); color: white; padding: 24px 32px; display: flex; justify-content: space-between; align-items: center; }
          .print-header h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
          .print-header p { font-size: 13px; opacity: 0.8; margin-top: 4px; }
          .print-header .date { font-size: 12px; opacity: 0.7; text-align: right; }
          .print-body { padding: 24px 32px; }
          .section { margin-bottom: 28px; break-inside: avoid; }
          .section-title { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 2px solid #d71920; display: flex; align-items: center; gap: 8px; }
          .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
          .stat-box { background: #f9f9f9; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #e5e5e5; }
          .stat-value { font-size: 20px; font-weight: 800; }
          .stat-label { font-size: 10px; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.04em; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead tr { background: #f5f5f5; }
          th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #666; border-bottom: 1px solid #e5e5e5; }
          td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
          tr:last-child td { border-bottom: none; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
          .badge-green { background: rgba(22,163,74,0.1); color: #16a34a; }
          .badge-red { background: rgba(215,25,32,0.1); color: #d71920; }
          .badge-blue { background: rgba(37,99,235,0.1); color: #2563eb; }
          .badge-yellow { background: rgba(217,119,6,0.1); color: #d97706; }
          .progress-bar { height: 6px; background: #e5e5e5; border-radius: 99px; overflow: hidden; margin-top: 4px; }
          .progress-fill { height: 100%; background: #d71920; border-radius: 99px; }
          .client-card { background: #f9f9f9; border-radius: 10px; padding: 16px; margin-bottom: 12px; border: 1px solid #e5e5e5; border-left: 4px solid #d71920; break-inside: avoid; }
          .client-name { font-size: 16px; font-weight: 800; color: #111; margin-bottom: 4px; }
          .client-meta { font-size: 11px; color: #888; margin-bottom: 12px; }
          .mini-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 12px; }
          .mini-stat { background: white; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid #e5e5e5; }
          .mini-value { font-size: 16px; font-weight: 800; }
          .mini-label { font-size: 9px; color: #aaa; text-transform: uppercase; }
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between; color: #aaa; font-size: 11px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>Klipscen Management</h1>
            <p>${currentTab?.label} — ${dateLabel}</p>
          </div>
          <div class="date">
            Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br/>
            ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div class="print-body">
          ${generatePrintContent()}
          <div class="footer">
            <span>Klipscen Management System</span>
            <span>Confidential — Internal Use Only</span>
            <span>Page 1</span>
          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.print()
    }
  }

  const generatePrintContent = () => {
    const totalTime = timeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)

    if (activeTab === 'client') {
      return `
        <div class="section">
          <div class="section-title">📊 Overall Summary</div>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-value" style="color:#2563eb">${clients.length}</div><div class="stat-label">Total Clients</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d97706">${tasks.filter(t => t.status !== 'done').length}</div><div class="stat-label">Active Tasks</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#16a34a">${tasks.filter(t => t.status === 'done').length}</div><div class="stat-label">Completed</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${formatDuration(totalTime)}</div><div class="stat-label">Time Logged</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d71920">${tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length}</div><div class="stat-label">Overdue</div></div>
          </div>
        </div>
        ${clients.map(client => {
          const stats = getClientStats(client.id)
          const clientTasks = tasks.filter(t => t.client_id === client.id)
          return `
          <div class="client-card">
            <div class="client-name">👤 ${client.name}</div>
            <div class="client-meta">${client.email || ''} ${client.phone ? '· ' + client.phone : ''}</div>
            <div class="mini-stats">
              <div class="mini-stat"><div class="mini-value" style="color:#888">${stats.total}</div><div class="mini-label">Tasks</div></div>
              <div class="mini-stat"><div class="mini-value" style="color:#16a34a">${stats.done}</div><div class="mini-label">Done</div></div>
              <div class="mini-stat"><div class="mini-value" style="color:#2563eb">${stats.total - stats.done}</div><div class="mini-label">Active</div></div>
              <div class="mini-stat"><div class="mini-value" style="color:#7c3aed">${formatDuration(stats.totalTime)}</div><div class="mini-label">Time</div></div>
              <div class="mini-stat"><div class="mini-value" style="color:#d71920">${stats.overdue}</div><div class="mini-label">Overdue</div></div>
            </div>
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:11px;color:#666;margin-bottom:3px">
                <span>Overall Progress</span><span style="color:#d71920;font-weight:700">${stats.completion}%</span>
              </div>
              <div class="progress-bar"><div class="progress-fill" style="width:${stats.completion}%"></div></div>
            </div>
            ${clientTasks.length > 0 ? `
            <table>
              <thead><tr><th>Task</th><th>Assigned To</th><th>Pipeline</th><th>Status</th><th>Due Date</th></tr></thead>
              <tbody>
                ${clientTasks.map(task => `
                  <tr>
                    <td><strong>${task.title}</strong>${task.project ? `<br><span style="color:#888;font-size:10px">📁 ${task.project}</span>` : ''}</td>
                    <td>${task.assigned_to_profile?.full_name || '—'}</td>
                    <td>${task.pipeline_percent > 0 ? `<div class="progress-bar" style="width:80px"><div class="progress-fill" style="width:${task.pipeline_percent}%"></div></div><span style="font-size:10px;color:#d71920">${task.pipeline_percent}%</span>` : '—'}</td>
                    <td><span class="badge ${task.status === 'done' ? 'badge-green' : task.status === 'in_progress' ? 'badge-blue' : 'badge-yellow'}">${task.status?.replace('_',' ')}</span></td>
                    <td style="color:${task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done' ? '#d71920' : '#666'}">${task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'}) : '—'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>` : '<p style="color:#888;font-size:12px;margin-top:8px">No tasks in this period</p>'}
          </div>`
        }).join('')}
      `
    }

    if (activeTab === 'employee') {
      return `
        <div class="section">
          <div class="section-title">👥 Employee Performance Report</div>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-value" style="color:#2563eb">${employees.length}</div><div class="stat-label">Total Members</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#16a34a">${tasks.filter(t=>t.status==='done').length}</div><div class="stat-label">Tasks Done</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${formatDuration(totalTime)}</div><div class="stat-label">Hours Logged</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d97706">${attendance.filter(a=>a.status==='late').length}</div><div class="stat-label">Late Days</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d71920">${attendance.filter(a=>a.status==='absent').length}</div><div class="stat-label">Absent Days</div></div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Tasks Total</th>
              <th>Done</th>
              <th>Completion</th>
              <th>Time Logged</th>
              <th>Present</th>
              <th>Late</th>
              <th>Absent</th>
              <th>Late Time</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => {
              const stats = getEmployeeStats(emp.id)
              return `
              <tr>
                <td><strong>${emp.full_name}</strong><br><span style="color:#888;font-size:10px">${emp.department || ''}</span></td>
                <td><span class="badge badge-blue" style="text-transform:capitalize">${emp.role?.replace('_',' ')}</span></td>
                <td style="text-align:center">${stats.total}</td>
                <td style="text-align:center;color:#16a34a;font-weight:700">${stats.done}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${stats.completion}%"></div></div>
                    <span style="color:#d71920;font-weight:700;font-size:11px">${stats.completion}%</span>
                  </div>
                </td>
                <td style="color:#7c3aed;font-weight:600">${formatDuration(stats.totalTime)}</td>
                <td style="text-align:center;color:#16a34a;font-weight:700">${stats.presentDays}</td>
                <td style="text-align:center;color:#d97706;font-weight:700">${stats.lateDays}</td>
                <td style="text-align:center;color:#d71920;font-weight:700">${stats.absentDays}</td>
                <td style="color:#d97706">${stats.lateMinutes > 0 ? formatDuration(stats.lateMinutes) : '—'}</td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      `
    }

    if (activeTab === 'project') {
      return `
        <div class="section">
          <div class="section-title">📁 Project Status Report</div>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-value" style="color:#2563eb">${projects.length}</div><div class="stat-label">Projects</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#16a34a">${projects.filter(p=>getProjectStats(p).completion===100).length}</div><div class="stat-label">Completed</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d71920">${projects.filter(p=>getProjectStats(p).overdue>0).length}</div><div class="stat-label">At Risk</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${formatDuration(totalTime)}</div><div class="stat-label">Time Logged</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d97706">${tasks.length}</div><div class="stat-label">Total Tasks</div></div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Project</th><th>Client</th><th>Total Tasks</th><th>Done</th><th>Progress</th><th>Time</th><th>Team</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${projects.map(p => {
              const stats = getProjectStats(p)
              return `
              <tr>
                <td><strong>📁 ${p.name}</strong></td>
                <td>${p.client ? `<span style="color:#d71920">👤 ${p.client.name}</span>` : '—'}</td>
                <td style="text-align:center">${p.tasks.length}</td>
                <td style="text-align:center;color:#16a34a;font-weight:700">${stats.done}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="progress-bar" style="flex:1"><div class="progress-fill" style="width:${stats.completion}%"></div></div>
                    <span style="color:#d71920;font-weight:700;font-size:11px">${stats.completion}%</span>
                  </div>
                </td>
                <td style="color:#7c3aed;font-weight:600">${formatDuration(stats.totalTime)}</td>
                <td>${stats.members.slice(0,3).join(', ')}${stats.members.length > 3 ? ` +${stats.members.length-3}` : ''}</td>
                <td><span class="badge ${stats.overdue > 0 ? 'badge-red' : stats.completion === 100 ? 'badge-green' : 'badge-blue'}">${stats.overdue > 0 ? '⚠️ At Risk' : stats.completion === 100 ? '✅ Done' : '🔄 Active'}</span></td>
              </tr>`
            }).join('')}
          </tbody>
        </table>
      `
    }

    if (activeTab === 'time') {
      const byEmployee = getTimeByEmployee()
      const byClient = getTimeByClient()
      const byProject = getTimeByProject()
      return `
        <div class="section">
          <div class="section-title">⏱ Time Tracking Report</div>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${formatDuration(totalTime)}</div><div class="stat-label">Total Time</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#2563eb">${timeLogs.length}</div><div class="stat-label">Total Logs</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#16a34a">${new Set(timeLogs.map(l=>l.task?.id).filter(Boolean)).size}</div><div class="stat-label">Tasks Worked</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d97706">${byEmployee.length > 0 ? byEmployee[0].name.split(' ')[0] : '—'}</div><div class="stat-label">Top Worker</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d71920">${timeLogs.length > 0 ? formatDuration(Math.round(totalTime/timeLogs.length)) : '0m'}</div><div class="stat-label">Avg Per Log</div></div>
          </div>
        </div>

        <div class="section">
          <div class="section-title">👥 Time by Employee</div>
          <table>
            <thead><tr><th>Employee</th><th>Time Logged</th><th>Tasks</th><th>% of Total</th><th>Distribution</th></tr></thead>
            <tbody>
              ${byEmployee.map(e => `
              <tr>
                <td><strong>${e.name}</strong></td>
                <td style="color:#7c3aed;font-weight:700">${formatDuration(e.total)}</td>
                <td style="text-align:center">${e.taskCount}</td>
                <td style="color:#d71920;font-weight:700">${totalTime > 0 ? Math.round((e.total/totalTime)*100) : 0}%</td>
                <td style="width:120px">
                  <div class="progress-bar"><div class="progress-fill" style="width:${totalTime > 0 ? Math.round((e.total/totalTime)*100) : 0}%;background:#7c3aed"></div></div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">👤 Time by Client</div>
          <table>
            <thead><tr><th>Client</th><th>Time Logged</th><th>% of Total</th><th>Distribution</th></tr></thead>
            <tbody>
              ${byClient.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td style="color:#d71920;font-weight:700">${formatDuration(c.total)}</td>
                <td>${totalTime > 0 ? Math.round((c.total/totalTime)*100) : 0}%</td>
                <td style="width:120px">
                  <div class="progress-bar"><div class="progress-fill" style="width:${totalTime > 0 ? Math.round((c.total/totalTime)*100) : 0}%"></div></div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <div class="section-title">📁 Time by Project</div>
          <table>
            <thead><tr><th>Project</th><th>Time Logged</th><th>% of Total</th></tr></thead>
            <tbody>
              ${byProject.map(p => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td style="color:#2563eb;font-weight:700">${formatDuration(p.total)}</td>
                <td>${totalTime > 0 ? Math.round((p.total/totalTime)*100) : 0}%</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      `
    }

    if (activeTab === 'attendance') {
      const summary = getAttendanceSummary()
      return `
        <div class="section">
          <div class="section-title">📅 Attendance Report</div>
          <div class="stats-grid">
            <div class="stat-box"><div class="stat-value" style="color:#2563eb">${attendance.length}</div><div class="stat-label">Records</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#16a34a">${attendance.filter(a=>a.status==='present').length}</div><div class="stat-label">Present</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d97706">${attendance.filter(a=>a.status==='late').length}</div><div class="stat-label">Late</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#d71920">${attendance.filter(a=>a.status==='absent').length}</div><div class="stat-label">Absent</div></div>
            <div class="stat-box"><div class="stat-value" style="color:#7c3aed">${attendance.filter(a=>a.status==='on_leave').length}</div><div class="stat-label">On Leave</div></div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Employee</th><th>Department</th><th>Present</th><th>Late</th><th>Absent</th><th>On Leave</th><th>Late Time</th><th>Rate</th></tr>
          </thead>
          <tbody>
            ${summary.map(emp => `
            <tr>
              <td><strong>${emp.name}</strong></td>
              <td style="color:#888">${emp.department || '—'}</td>
              <td style="text-align:center;color:#16a34a;font-weight:700">${emp.present}</td>
              <td style="text-align:center;color:#d97706;font-weight:700">${emp.late}</td>
              <td style="text-align:center;color:#d71920;font-weight:700">${emp.absent}</td>
              <td style="text-align:center;color:#7c3aed;font-weight:700">${emp.onLeave}</td>
              <td style="color:${emp.lateMinutes > 0 ? '#d97706' : '#888'}">${emp.lateMinutes > 0 ? formatDuration(emp.lateMinutes) : '—'}</td>
              <td>
                <div style="display:flex;align-items:center;gap:6px">
                  <div class="progress-bar" style="width:60px"><div class="progress-fill" style="width:${emp.attendanceRate}%;background:${emp.attendanceRate>=80?'#16a34a':emp.attendanceRate>=60?'#d97706':'#d71920'}"></div></div>
                  <span style="font-weight:700;font-size:11px;color:${emp.attendanceRate>=80?'#16a34a':emp.attendanceRate>=60?'#d97706':'#d71920'}">${emp.attendanceRate}%</span>
                </div>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      `
    }
    return ''
  }

  const formatDuration = (mins) => {
    if (!mins) return '0m'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const getClientStats = (clientId) => {
    const clientTasks = tasks.filter(t => t.client_id === clientId)
    const clientTimeLogs = timeLogs.filter(l => l.task?.client_id === clientId)
    const totalTime = clientTimeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
    const done = clientTasks.filter(t => t.status === 'done').length
    const completion = clientTasks.length > 0 ? Math.round((done / clientTasks.length) * 100) : 0
    const overdue = clientTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
    const avgPipeline = clientTasks.length > 0 ? Math.round(clientTasks.reduce((sum, t) => sum + (t.pipeline_percent || 0), 0) / clientTasks.length) : 0
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
    return { total: empTasks.length, done, completion, totalTime, presentDays, lateDays, absentDays, lateMinutes, inProgress: empTasks.filter(t => t.status === 'in_progress').length }
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
    return Object.values(map).map(e => ({ ...e, taskCount: e.taskCount.size })).sort((a, b) => b.total - a.total)
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
      return { id: emp.id, name: emp.full_name, role: emp.role, department: emp.department, present, late, absent, onLeave, totalDays, attendanceRate, lateMinutes }
    }).filter(e => e.totalDays > 0)
  }

  const totalTimeLogged = timeLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
  const dateLabel = dateRange === 'custom' ? `${customStart} → ${customEnd}` : dateRange === 'week' ? 'Last 7 Days' : dateRange === 'month' ? 'This Month' : dateRange === 'quarter' ? 'Last 90 Days' : 'This Year'

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Reports</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {tasks.length} tasks · {formatDuration(totalTimeLogged)} logged · {dateLabel}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Date Range */}
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
              }}>{r.label}</button>
            ))}
          </div>

          {dateRange === 'custom' && (
            <>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '12px', outline: 'none' }} />
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                style={{ padding: '7px 10px', border: '1px solid #e5e5e5', borderRadius: '8px', fontSize: '12px', outline: 'none' }} />
            </>
          )}

          {/* Print Button */}
          <button onClick={handlePrint} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 16px', background: 'linear-gradient(135deg, #d71920, #b5151b)',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: 'pointer', fontSize: '13px', fontWeight: '700',
            boxShadow: '0 2px 8px rgba(215,25,32,0.3)'
          }}>
            🖨️ Print Report
          </button>
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
        <div ref={printRef}>

          {/* ===== CLIENT REPORTS ===== */}
          {activeTab === 'client' && (
            <div>
              {/* Summary Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Clients', value: clients.length, color: '#2563eb', icon: '👤' },
                  { label: 'Active Tasks', value: tasks.filter(t => t.status !== 'done').length, color: '#d97706', icon: '🔄' },
                  { label: 'Completed', value: tasks.filter(t => t.status === 'done').length, color: '#16a34a', icon: '✅' },
                  { label: 'Time Logged', value: formatDuration(totalTimeLogged), color: '#7c3aed', icon: '⏱' },
                  { label: 'Overdue', value: tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length, color: '#d71920', icon: '⚠️' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {clients.length === 0 ? (
                <div className="empty-state card"><div className="empty-icon">👤</div><div className="empty-title">No clients yet</div></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {clients.map(client => {
                    const stats = getClientStats(client.id)
                    const clientTasks = tasks.filter(t => t.client_id === client.id)
                    return (
                      <div key={client.id} style={{
                        background: 'white', borderRadius: '14px', padding: '20px',
                        border: '1px solid #e5e5e5', borderLeft: '4px solid #d71920',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                      }}>
                        {/* Client Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #d71920, #b5151b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '20px' }}>
                              {client.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: '#111', fontWeight: '800', fontSize: '17px' }}>{client.name}</div>
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

                        {/* Mini Stats */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', marginBottom: '14px' }}>
                          {[
                            { label: 'Total Tasks', value: stats.total, color: '#888' },
                            { label: 'Completed', value: stats.done, color: '#16a34a' },
                            { label: 'Active', value: stats.total - stats.done, color: '#2563eb' },
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
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ color: '#888', fontSize: '12px', fontWeight: '600' }}>Overall Progress</span>
                            <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '800' }}>{stats.completion}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: '8px' }}>
                            <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
                          </div>
                        </div>

                        {/* Tasks Table */}
                        {clientTasks.length > 0 && (
                          <div>
                            <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Tasks</div>
                            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                              <table className="table">
                                <thead>
                                  <tr>
                                    <th>Task</th>
                                    <th>Assigned To</th>
                                    <th>Pipeline</th>
                                    <th>Status</th>
                                    <th>Due Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clientTasks.map(task => (
                                    <tr key={task.id}>
                                      <td>
                                        <div style={{ fontWeight: '600', color: '#111' }}>{task.title}</div>
                                        {task.project && <div style={{ color: '#888', fontSize: '11px' }}>📁 {task.project}</div>}
                                      </td>
                                      <td style={{ color: '#444', fontSize: '13px' }}>{task.assigned_to_profile?.full_name || '—'}</td>
                                      <td>
                                        {task.pipeline_percent > 0 ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <div className="progress-bar" style={{ width: '60px' }}>
                                              <div className="progress-fill" style={{ width: `${task.pipeline_percent}%` }} />
                                            </div>
                                            <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>{task.pipeline_percent}%</span>
                                          </div>
                                        ) : '—'}
                                      </td>
                                      <td>
                                        <span className="badge" style={{
                                          background: task.status === 'done' ? 'rgba(22,163,74,0.1)' : task.status === 'in_progress' ? 'rgba(37,99,235,0.1)' : '#f5f5f5',
                                          color: task.status === 'done' ? '#16a34a' : task.status === 'in_progress' ? '#2563eb' : '#888'
                                        }}>
                                          {task.status?.replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td style={{ color: task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done' ? '#d71920' : '#888', fontSize: '12px' }}>
                                        {task.due_date ? new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Members', value: employees.length, color: '#2563eb', icon: '👥' },
                  { label: 'Tasks Done', value: tasks.filter(t => t.status === 'done').length, color: '#16a34a', icon: '✅' },
                  { label: 'Hours Logged', value: formatDuration(totalTimeLogged), color: '#7c3aed', icon: '⏱' },
                  { label: 'Late Days', value: attendance.filter(a => a.status === 'late').length, color: '#d97706', icon: '⚠️' },
                  { label: 'Absent Days', value: attendance.filter(a => a.status === 'absent').length, color: '#d71920', icon: '❌' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Tasks</th>
                      <th>Done</th>
                      <th>Completion</th>
                      <th>Time</th>
                      <th>Present</th>
                      <th>Late</th>
                      <th>Absent</th>
                      <th>Late Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(emp => {
                      const stats = getEmployeeStats(emp.id)
                      const roleColor = { admin: '#d71920', manager: '#d97706', employee: '#2563eb', partner: '#7c3aed', junior_editor: '#0891b2', senior_editor: '#059669', client_manager: '#d97706', qa_reviewer: '#7c3aed' }
                      const color = roleColor[emp.role] || '#888'
                      return (
                        <tr key={emp.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="avatar avatar-sm" style={{ background: `${color}15`, color, border: `1.5px solid ${color}25` }}>
                                {emp.full_name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: '700', color: '#111' }}>{emp.full_name}</div>
                                <div style={{ color: '#888', fontSize: '11px' }}>{emp.department || ''}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge" style={{ background: `${color}12`, color, textTransform: 'capitalize' }}>
                              {emp.role?.replace('_', ' ')}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', color: '#888' }}>{stats.total}</td>
                          <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{stats.done}</td>
                          <td style={{ width: '120px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <div className="progress-bar" style={{ flex: 1 }}>
                                <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
                              </div>
                              <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap' }}>{stats.completion}%</span>
                            </div>
                          </td>
                          <td style={{ color: '#7c3aed', fontWeight: '600' }}>{formatDuration(stats.totalTime)}</td>
                          <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{stats.presentDays}</td>
                          <td style={{ textAlign: 'center', color: '#d97706', fontWeight: '700' }}>{stats.lateDays}</td>
                          <td style={{ textAlign: 'center', color: '#d71920', fontWeight: '700' }}>{stats.absentDays}</td>
                          <td style={{ color: stats.lateMinutes > 0 ? '#d97706' : '#aaa' }}>
                            {stats.lateMinutes > 0 ? formatDuration(stats.lateMinutes) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===== PROJECT REPORTS ===== */}
          {activeTab === 'project' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Projects', value: projects.length, color: '#2563eb', icon: '📁' },
                  { label: 'Completed', value: projects.filter(p => getProjectStats(p).completion === 100).length, color: '#16a34a', icon: '✅' },
                  { label: 'At Risk', value: projects.filter(p => getProjectStats(p).overdue > 0).length, color: '#d71920', icon: '⚠️' },
                  { label: 'Total Tasks', value: tasks.length, color: '#d97706', icon: '📋' },
                  { label: 'Time Logged', value: formatDuration(totalTimeLogged), color: '#7c3aed', icon: '⏱' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {projects.length === 0 ? (
                <div className="empty-state card"><div className="empty-icon">📁</div><div className="empty-title">No projects in this period</div></div>
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
                            <td><div style={{ fontWeight: '800', color: '#111' }}>📁 {project.name}</div></td>
                            <td>{project.client ? <span style={{ color: '#d71920', fontSize: '12px', fontWeight: '600' }}>👤 {project.client.name}</span> : <span style={{ color: '#ccc' }}>—</span>}</td>
                            <td style={{ textAlign: 'center' }}><span style={{ color: '#888' }}>{stats.done}/{project.tasks.length}</span></td>
                            <td style={{ width: '140px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <div className="progress-bar" style={{ flex: 1 }}>
                                  <div className="progress-fill" style={{ width: `${stats.completion}%` }} />
                                </div>
                                <span style={{ color: '#d71920', fontSize: '11px', fontWeight: '700' }}>{stats.completion}%</span>
                              </div>
                            </td>
                            <td><span style={{ color: '#7c3aed', fontWeight: '600' }}>{formatDuration(stats.totalTime)}</span></td>
                            <td>
                              <div style={{ display: 'flex' }}>
                                {stats.members.slice(0, 3).map((name, i) => (
                                  <div key={i} className="avatar" style={{ width: '24px', height: '24px', fontSize: '10px', marginLeft: i > 0 ? '-4px' : 0, border: '2px solid white' }}>
                                    {name?.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {stats.members.length > 3 && <span style={{ color: '#888', fontSize: '11px', marginLeft: '4px' }}>+{stats.members.length - 3}</span>}
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Time', value: formatDuration(totalTimeLogged), color: '#7c3aed', icon: '⏱' },
                  { label: 'Total Logs', value: timeLogs.length, color: '#2563eb', icon: '📋' },
                  { label: 'Tasks Worked', value: new Set(timeLogs.map(l => l.task?.id).filter(Boolean)).size, color: '#16a34a', icon: '✅' },
                  { label: 'Top Worker', value: getTimeByEmployee()[0]?.name?.split(' ')[0] || '—', color: '#d71920', icon: '🏆' },
                  { label: 'Avg Per Log', value: timeLogs.length > 0 ? formatDuration(Math.round(totalTimeLogged / timeLogs.length)) : '0m', color: '#d97706', icon: '📊' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
                    <div style={{ color: stat.color, fontSize: '18px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                {/* By Employee */}
                <div className="card">
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '16px' }}>👥 By Employee</div>
                  {getTimeByEmployee().length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>No time logs</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {getTimeByEmployee().map(emp => {
                        const pct = totalTimeLogged > 0 ? Math.round((emp.total / totalTimeLogged) * 100) : 0
                        return (
                          <div key={emp.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{emp.name}</span>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ color: '#888', fontSize: '11px' }}>{emp.taskCount} tasks</span>
                                <span style={{ color: '#7c3aed', fontSize: '13px', fontWeight: '700' }}>{formatDuration(emp.total)}</span>
                              </div>
                            </div>
                            <div className="progress-bar">
                              <div style={{ height: '100%', borderRadius: '99px', width: `${pct}%`, background: 'linear-gradient(90deg, #7c3aed, #6d28d9)' }} />
                            </div>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>{pct}% of total</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* By Client */}
                <div className="card">
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '16px' }}>👤 By Client</div>
                  {getTimeByClient().length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>No client logs</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {getTimeByClient().map(c => {
                        const pct = totalTimeLogged > 0 ? Math.round((c.total / totalTimeLogged) * 100) : 0
                        return (
                          <div key={c.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{c.name}</span>
                              <span style={{ color: '#d71920', fontSize: '13px', fontWeight: '700' }}>{formatDuration(c.total)}</span>
                            </div>
                            <div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div>
                            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '2px' }}>{pct}% of total</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* By Project */}
                <div className="card">
                  <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '16px' }}>📁 By Project</div>
                  {getTimeByProject().length === 0 ? (
                    <div style={{ color: '#888', textAlign: 'center', padding: '20px', fontSize: '13px' }}>No project logs</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {getTimeByProject().map(p => {
                        const pct = totalTimeLogged > 0 ? Math.round((p.total / totalTimeLogged) * 100) : 0
                        return (
                          <div key={p.name}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ color: '#111', fontSize: '13px', fontWeight: '600' }}>{p.name}</span>
                              <span style={{ color: '#2563eb', fontSize: '13px', fontWeight: '700' }}>{formatDuration(p.total)}</span>
                            </div>
                            <div className="progress-bar">
                              <div style={{ height: '100%', borderRadius: '99px', width: `${pct}%`, background: 'linear-gradient(90deg, #2563eb, #1d4ed8)' }} />
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
                {[
                  { label: 'Total Records', value: attendance.length, color: '#2563eb', icon: '📋' },
                  { label: 'Present', value: attendance.filter(a => a.status === 'present').length, color: '#16a34a', icon: '✅' },
                  { label: 'Late', value: attendance.filter(a => a.status === 'late').length, color: '#d97706', icon: '⚠️' },
                  { label: 'Absent', value: attendance.filter(a => a.status === 'absent').length, color: '#d71920', icon: '❌' },
                  { label: 'On Leave', value: attendance.filter(a => a.status === 'on_leave').length, color: '#7c3aed', icon: '🏖️' },
                ].map(stat => (
                  <div key={stat.label} style={{ background: 'white', borderRadius: '10px', padding: '14px', textAlign: 'center', border: `1px solid ${stat.color}22` }}>
                    <div style={{ fontSize: '18px', marginBottom: '4px' }}>{stat.icon}</div>
                    <div style={{ color: stat.color, fontSize: '20px', fontWeight: '800' }}>{stat.value}</div>
                    <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {getAttendanceSummary().length === 0 ? (
                <div className="empty-state card"><div className="empty-icon">📅</div><div className="empty-title">No attendance records</div></div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
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
                              <div style={{ fontWeight: '700', color: '#111' }}>{emp.name}</div>
                            </div>
                          </td>
                          <td style={{ color: '#888', fontSize: '12px' }}>{emp.department || '—'}</td>
                          <td style={{ textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{emp.present}</td>
                          <td style={{ textAlign: 'center', color: '#d97706', fontWeight: '700' }}>{emp.late}</td>
                          <td style={{ textAlign: 'center', color: '#d71920', fontWeight: '700' }}>{emp.absent}</td>
                          <td style={{ textAlign: 'center', color: '#7c3aed', fontWeight: '700' }}>{emp.onLeave}</td>
                          <td style={{ color: emp.lateMinutes > 0 ? '#d97706' : '#aaa', fontWeight: emp.lateMinutes > 0 ? '700' : '400' }}>
                            {emp.lateMinutes > 0 ? formatDuration(emp.lateMinutes) : '—'}
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

        </div>
      )}
    </div>
  )
}
