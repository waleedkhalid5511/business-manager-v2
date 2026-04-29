import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Payroll({ profile }) {
  const [employees, setEmployees] = useState([])
  const [payrollData, setPayrollData] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [message, setMessage] = useState('')
  const [showSlip, setShowSlip] = useState(null)
  const [editPayroll, setEditPayroll] = useState(null)
  const [lateRules, setLateRules] = useState([])
  const [overtimeRules, setOvertimeRules] = useState(null)
  const [leaveRules, setLeaveRules] = useState(null)
  const [generating, setGenerating] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  useEffect(() => {
    if (!profile) return
    fetchAll()
  }, [profile, selectedMonth, selectedYear])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 5000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [empRes, payrollRes, lateRes, overtimeRes, leaveRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
        supabase.from('payroll').select('*, profiles(full_name, designation, department)')
          .eq('month', selectedMonth).eq('year', selectedYear),
        supabase.from('late_rules').select('*').order('min_minutes'),
        supabase.from('overtime_rules').select('*').limit(1),
        supabase.from('leave_rules').select('*').limit(1),
      ])

      setEmployees(empRes.data || [])
      setPayrollData(payrollRes.data || [])
      setLateRules(lateRes.data || [])
      if (overtimeRes.data?.[0]) setOvertimeRules(overtimeRes.data[0])
      if (leaveRes.data?.[0]) setLeaveRules(leaveRes.data[0])
    } catch (e) {
      console.error('Payroll fetchAll:', e)
    } finally {
      setLoading(false)
    }
  }

  const getLateDeduction = (lateMinutes) => {
    if (!lateMinutes || lateMinutes === 0) return 0
    const rule = lateRules.find(r =>
      lateMinutes >= r.min_minutes &&
      (r.max_minutes === null || lateMinutes <= r.max_minutes)
    )
    if (!rule) return 0
    return parseFloat(rule.deduction_amount) || 0
  }

  const generatePayroll = async () => {
    setGenerating(true)
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

      for (const emp of employees) {
        // Check if already exists
        const existing = payrollData.find(p => p.employee_id === emp.id)
        if (existing) continue

        // Get attendance for this month
        const { data: attendance } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', emp.id)
          .gte('date', startDate)
          .lte('date', endDate)

        const att = attendance || []
        const presentDays = att.filter(a => ['present', 'late'].includes(a.status)).length
        const absentDays = att.filter(a => a.status === 'absent').length
        const lateDays = att.filter(a => a.status === 'late')
        const totalLateMinutes = lateDays.reduce((sum, a) => sum + (a.late_minutes || 0), 0)

        // Get overtime from time logs
        const { data: timeLogs } = await supabase
          .from('task_time_logs')
          .select('duration_minutes')
          .eq('employee_id', emp.id)
          .gte('created_at', `${startDate}T00:00:00`)
          .lte('created_at', `${endDate}T23:59:59`)
          .not('end_time', 'is', null)

        // Calculate total hours worked
        const totalMinutes = (timeLogs || []).reduce((sum, l) => sum + (l.duration_minutes || 0), 0)
        const totalHours = totalMinutes / 60
        const workingDays = new Date(selectedYear, selectedMonth, 0).getDate()
        const standardHours = workingDays * 8
        const overtimeHours = Math.max(0, totalHours - standardHours)
        const overtimeAmount = overtimeRules?.is_active ?
          overtimeHours * (parseFloat(overtimeRules?.rate_per_hour) || 0) : 0

        // Calculate deductions
        const baseSalary = parseFloat(emp.base_salary) || 0
        const dailyRate = baseSalary / workingDays
        const absentDeduction = absentDays * dailyRate * (parseFloat(leaveRules?.unauthorized_deduction) > 0 ? 1 : 1)
        const lateDeduction = getLateDeduction(totalLateMinutes)
        const netSalary = Math.max(0, baseSalary - absentDeduction - lateDeduction + overtimeAmount)

        await supabase.from('payroll').upsert({
          employee_id: emp.id,
          month: selectedMonth,
          year: selectedYear,
          base_salary: baseSalary,
          late_deduction: lateDeduction,
          absent_deduction: absentDeduction,
          overtime_amount: overtimeAmount,
          bonus: 0,
          advance: 0,
          tax: 0,
          net_salary: netSalary,
          status: 'pending'
        }, { onConflict: 'employee_id,month,year' })
      }

      setMessage('✅ Payroll generated!')
      fetchAll()
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setGenerating(false)
    }
  }

  const updatePayroll = async (payrollId, updates) => {
    try {
      const record = payrollData.find(p => p.id === payrollId)
      if (!record) return

      const netSalary = Math.max(0,
        parseFloat(updates.base_salary || record.base_salary) +
        parseFloat(updates.bonus || record.bonus || 0) +
        parseFloat(updates.overtime_amount || record.overtime_amount || 0) -
        parseFloat(updates.late_deduction || record.late_deduction || 0) -
        parseFloat(updates.absent_deduction || record.absent_deduction || 0) -
        parseFloat(updates.advance || record.advance || 0) -
        parseFloat(updates.tax || record.tax || 0)
      )

      const { error } = await supabase.from('payroll')
        .update({ ...updates, net_salary: netSalary })
        .eq('id', payrollId)

      if (error) throw error
      setMessage('✅ Payroll updated!')
      fetchAll()
      setEditPayroll(null)
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const markAsPaid = async (payrollId) => {
    const { error } = await supabase.from('payroll').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_by: profile.id
    }).eq('id', payrollId)

    if (!error) {
      setMessage('✅ Marked as paid!')
      fetchAll()
    }
  }

  const printPayslip = (record) => {
    const emp = employees.find(e => e.id === record.employee_id) || record.profiles
    const printWindow = window.open('', '_blank')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payslip — ${emp?.full_name} — ${MONTHS[selectedMonth - 1]} ${selectedYear}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: white; font-size: 13px; }
          .slip { max-width: 700px; margin: 0 auto; padding: 0; }

          .header { background: linear-gradient(135deg, #d71920, #8b0000); color: white; padding: 28px 32px; }
          .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .payslip-label { font-size: 12px; opacity: 0.7; text-align: right; letter-spacing: 2px; text-transform: uppercase; }
          .payslip-period { font-size: 16px; font-weight: 700; text-align: right; margin-top: 4px; }

          .emp-info { background: rgba(255,255,255,0.15); border-radius: 10px; padding: 14px 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .emp-field label { font-size: 10px; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 2px; }
          .emp-field span { font-size: 14px; font-weight: 700; }

          .body { padding: 24px 32px; }

          .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #888; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e5e5e5; }

          .earnings-deductions { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }

          .item-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f5f5f5; font-size: 13px; }
          .item-row:last-child { border-bottom: none; }
          .item-label { color: #444; }
          .item-value { font-weight: 700; }
          .item-value.positive { color: #16a34a; }
          .item-value.negative { color: #d71920; }

          .attendance-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
          .att-box { background: #f9f9f9; border-radius: 8px; padding: 12px; text-align: center; }
          .att-value { font-size: 22px; font-weight: 800; margin-bottom: 2px; }
          .att-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.04em; }

          .net-salary-box { background: linear-gradient(135deg, #d71920, #8b0000); color: white; border-radius: 12px; padding: 20px 28px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .net-label { font-size: 14px; opacity: 0.8; font-weight: 600; }
          .net-amount { font-size: 32px; font-weight: 800; letter-spacing: -1px; }

          .status-box { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; }
          .status-paid { background: rgba(22,163,74,0.15); color: #16a34a; }
          .status-pending { background: rgba(217,119,6,0.15); color: #d97706; }

          .footer { margin-top: 24px; padding-top: 16px; border-top: 2px solid #e5e5e5; display: flex; justify-content: space-between; align-items: center; }
          .footer-note { font-size: 11px; color: #aaa; }
          .signature-line { text-align: center; }
          .signature-line div { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; color: #888; margin-top: 30px; width: 150px; }

          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="slip">
          <!-- Header -->
          <div class="header">
            <div class="header-top">
              <div>
                <div class="company-name">🏢 Klipscen</div>
                <div style="font-size:12px;opacity:0.7;margin-top:2px">Management System</div>
              </div>
              <div>
                <div class="payslip-label">Salary Slip</div>
                <div class="payslip-period">${MONTHS[selectedMonth - 1]} ${selectedYear}</div>
                <span class="status-box ${record.status === 'paid' ? 'status-paid' : 'status-pending'}" style="margin-top:6px;display:inline-block">
                  ${record.status === 'paid' ? '✅ PAID' : '⏳ PENDING'}
                </span>
              </div>
            </div>
            <div class="emp-info">
              <div class="emp-field">
                <label>Employee Name</label>
                <span>${emp?.full_name || '—'}</span>
              </div>
              <div class="emp-field">
                <label>Designation</label>
                <span>${emp?.designation || emp?.role || '—'}</span>
              </div>
              <div class="emp-field">
                <label>Department</label>
                <span>${emp?.department || '—'}</span>
              </div>
            </div>
          </div>

          <!-- Body -->
          <div class="body">

            <!-- Attendance Summary -->
            <div class="section-title">Attendance Summary</div>
            <div class="attendance-grid" style="margin-bottom:20px">
              <div class="att-box">
                <div class="att-value" style="color:#16a34a">${record.present_days || '—'}</div>
                <div class="att-label">Present Days</div>
              </div>
              <div class="att-box">
                <div class="att-value" style="color:#d97706">${record.late_days || '—'}</div>
                <div class="att-label">Late Days</div>
              </div>
              <div class="att-box">
                <div class="att-value" style="color:#d71920">${record.absent_days || '—'}</div>
                <div class="att-label">Absent Days</div>
              </div>
              <div class="att-box">
                <div class="att-value" style="color:#7c3aed">${record.overtime_hours ? record.overtime_hours.toFixed(1) + 'h' : '—'}</div>
                <div class="att-label">Overtime</div>
              </div>
            </div>

            <!-- Earnings & Deductions -->
            <div class="earnings-deductions">
              <!-- Earnings -->
              <div>
                <div class="section-title">Earnings</div>
                <div class="item-row">
                  <span class="item-label">Basic Salary</span>
                  <span class="item-value positive">PKR ${Number(record.base_salary || 0).toLocaleString()}</span>
                </div>
                ${parseFloat(record.overtime_amount) > 0 ? `
                <div class="item-row">
                  <span class="item-label">Overtime</span>
                  <span class="item-value positive">PKR ${Number(record.overtime_amount).toLocaleString()}</span>
                </div>` : ''}
                ${parseFloat(record.bonus) > 0 ? `
                <div class="item-row">
                  <span class="item-label">Bonus</span>
                  <span class="item-value positive">PKR ${Number(record.bonus).toLocaleString()}</span>
                </div>` : ''}
                <div class="item-row" style="border-top:2px solid #e5e5e5;margin-top:6px;padding-top:10px">
                  <span class="item-label" style="font-weight:700">Total Earnings</span>
                  <span class="item-value positive" style="font-size:15px">
                    PKR ${Number((parseFloat(record.base_salary) || 0) + (parseFloat(record.overtime_amount) || 0) + (parseFloat(record.bonus) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <!-- Deductions -->
              <div>
                <div class="section-title">Deductions</div>
                ${parseFloat(record.late_deduction) > 0 ? `
                <div class="item-row">
                  <span class="item-label">Late Deduction</span>
                  <span class="item-value negative">- PKR ${Number(record.late_deduction).toLocaleString()}</span>
                </div>` : ''}
                ${parseFloat(record.absent_deduction) > 0 ? `
                <div class="item-row">
                  <span class="item-label">Absent Deduction</span>
                  <span class="item-value negative">- PKR ${Number(record.absent_deduction).toLocaleString()}</span>
                </div>` : ''}
                ${parseFloat(record.advance) > 0 ? `
                <div class="item-row">
                  <span class="item-label">Advance</span>
                  <span class="item-value negative">- PKR ${Number(record.advance).toLocaleString()}</span>
                </div>` : ''}
                ${parseFloat(record.tax) > 0 ? `
                <div class="item-row">
                  <span class="item-label">Tax</span>
                  <span class="item-value negative">- PKR ${Number(record.tax).toLocaleString()}</span>
                </div>` : ''}
                ${(parseFloat(record.late_deduction) || 0) + (parseFloat(record.absent_deduction) || 0) + (parseFloat(record.advance) || 0) + (parseFloat(record.tax) || 0) === 0 ? `
                <div class="item-row">
                  <span class="item-label" style="color:#888">No deductions</span>
                  <span class="item-value">PKR 0</span>
                </div>` : ''}
                <div class="item-row" style="border-top:2px solid #e5e5e5;margin-top:6px;padding-top:10px">
                  <span class="item-label" style="font-weight:700">Total Deductions</span>
                  <span class="item-value negative" style="font-size:15px">
                    - PKR ${Number((parseFloat(record.late_deduction) || 0) + (parseFloat(record.absent_deduction) || 0) + (parseFloat(record.advance) || 0) + (parseFloat(record.tax) || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <!-- Net Salary -->
            <div class="net-salary-box">
              <div>
                <div class="net-label">Net Salary — ${MONTHS[selectedMonth - 1]} ${selectedYear}</div>
                ${record.status === 'paid' && record.paid_at ? `<div style="font-size:11px;opacity:0.7;margin-top:4px">Paid on: ${new Date(record.paid_at).toLocaleDateString('en-US', {month:'long',day:'numeric',year:'numeric'})}</div>` : ''}
              </div>
              <div class="net-amount">PKR ${Number(record.net_salary || 0).toLocaleString()}</div>
            </div>

            ${record.notes ? `
            <div style="background:#f9f9f9;border-radius:8px;padding:12px 16px;margin-bottom:16px;border-left:3px solid #d71920">
              <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px">Notes</div>
              <div style="color:#444;font-size:13px">${record.notes}</div>
            </div>` : ''}

            <!-- Footer -->
            <div class="footer">
              <div class="footer-note">
                Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<br/>
                This is a computer generated payslip
              </div>
              <div style="display:flex;gap:40px">
                <div class="signature-line">
                  <div>Employee Signature</div>
                </div>
                <div class="signature-line">
                  <div>Authorized By</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.onload = () => printWindow.print()
  }

  const formatPKR = (amount) => `PKR ${Number(amount || 0).toLocaleString()}`

  const totalPayroll = payrollData.reduce((sum, p) => sum + (parseFloat(p.net_salary) || 0), 0)
  const paidCount = payrollData.filter(p => p.status === 'paid').length
  const pendingCount = payrollData.filter(p => p.status === 'pending').length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>💰 Payroll</h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {MONTHS[selectedMonth - 1]} {selectedYear} · {payrollData.length} employees
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Month/Year Selector */}
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ padding: '8px 12px', background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px', color: '#111', fontSize: '13px', outline: 'none' }}>
            {[2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {(isAdmin || isManager) && (
            <button onClick={generatePayroll} disabled={generating} className="btn btn-primary btn-sm">
              {generating ? '⟳ Generating...' : '⚡ Generate Payroll'}
            </button>
          )}
        </div>
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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Total Payroll', value: formatPKR(totalPayroll), color: '#d71920', icon: '💰' },
          { label: 'Employees', value: payrollData.length, color: '#2563eb', icon: '👥' },
          { label: 'Paid', value: paidCount, color: '#16a34a', icon: '✅' },
          { label: 'Pending', value: pendingCount, color: '#d97706', icon: '⏳' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'white', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${stat.color}22`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{stat.icon}</div>
            <div style={{ color: stat.color, fontSize: '18px', fontWeight: '800' }}>{stat.value}</div>
            <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Payroll Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '70px', borderRadius: '10px' }} />)}
        </div>
      ) : payrollData.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">💰</div>
          <div className="empty-title">No payroll for {MONTHS[selectedMonth - 1]} {selectedYear}</div>
          <div className="empty-desc">Click "Generate Payroll" to auto-calculate from attendance</div>
          {(isAdmin || isManager) && (
            <button onClick={generatePayroll} disabled={generating} className="btn btn-primary" style={{ marginTop: '12px' }}>
              {generating ? '⟳ Generating...' : '⚡ Generate Payroll'}
            </button>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Base Salary</th>
                <th>Overtime</th>
                <th>Bonus</th>
                <th>Deductions</th>
                <th>Net Salary</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.map(record => {
                const totalDeductions = (parseFloat(record.late_deduction) || 0) +
                  (parseFloat(record.absent_deduction) || 0) +
                  (parseFloat(record.advance) || 0) +
                  (parseFloat(record.tax) || 0)
                const isEditing = editPayroll?.id === record.id

                return (
                  <tr key={record.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="avatar avatar-sm">
                          {record.profiles?.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '700', color: '#111' }}>{record.profiles?.full_name}</div>
                          <div style={{ color: '#888', fontSize: '11px' }}>{record.profiles?.designation || record.profiles?.department || ''}</div>
                        </div>
                      </div>
                    </td>

                    {/* Editable Fields */}
                    {isEditing ? (
                      <>
                        <td>
                          <input type="number" defaultValue={record.base_salary}
                            onChange={e => setEditPayroll(prev => ({ ...prev, base_salary: e.target.value }))}
                            style={{ width: '90px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '6px', fontSize: '12px' }} />
                        </td>
                        <td>
                          <input type="number" defaultValue={record.overtime_amount}
                            onChange={e => setEditPayroll(prev => ({ ...prev, overtime_amount: e.target.value }))}
                            style={{ width: '80px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '6px', fontSize: '12px' }} />
                        </td>
                        <td>
                          <input type="number" defaultValue={record.bonus}
                            onChange={e => setEditPayroll(prev => ({ ...prev, bonus: e.target.value }))}
                            style={{ width: '80px', padding: '4px 8px', border: '1px solid #e5e5e5', borderRadius: '6px', fontSize: '12px' }} />
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <input type="number" placeholder="Late ded." defaultValue={record.late_deduction}
                              onChange={e => setEditPayroll(prev => ({ ...prev, late_deduction: e.target.value }))}
                              style={{ width: '80px', padding: '3px 6px', border: '1px solid #e5e5e5', borderRadius: '4px', fontSize: '11px' }} />
                            <input type="number" placeholder="Absent ded." defaultValue={record.absent_deduction}
                              onChange={e => setEditPayroll(prev => ({ ...prev, absent_deduction: e.target.value }))}
                              style={{ width: '80px', padding: '3px 6px', border: '1px solid #e5e5e5', borderRadius: '4px', fontSize: '11px' }} />
                            <input type="number" placeholder="Advance" defaultValue={record.advance}
                              onChange={e => setEditPayroll(prev => ({ ...prev, advance: e.target.value }))}
                              style={{ width: '80px', padding: '3px 6px', border: '1px solid #e5e5e5', borderRadius: '4px', fontSize: '11px' }} />
                            <input type="number" placeholder="Tax" defaultValue={record.tax}
                              onChange={e => setEditPayroll(prev => ({ ...prev, tax: e.target.value }))}
                              style={{ width: '80px', padding: '3px 6px', border: '1px solid #e5e5e5', borderRadius: '4px', fontSize: '11px' }} />
                          </div>
                        </td>
                        <td style={{ color: '#d71920', fontWeight: '800', fontSize: '14px' }}>
                          {formatPKR(record.net_salary)}
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ color: '#111', fontWeight: '600' }}>{formatPKR(record.base_salary)}</td>
                        <td style={{ color: parseFloat(record.overtime_amount) > 0 ? '#16a34a' : '#aaa', fontWeight: '600' }}>
                          {parseFloat(record.overtime_amount) > 0 ? `+${formatPKR(record.overtime_amount)}` : '—'}
                        </td>
                        <td style={{ color: parseFloat(record.bonus) > 0 ? '#16a34a' : '#aaa', fontWeight: '600' }}>
                          {parseFloat(record.bonus) > 0 ? `+${formatPKR(record.bonus)}` : '—'}
                        </td>
                        <td>
                          {totalDeductions > 0 ? (
                            <div>
                              <span style={{ color: '#d71920', fontWeight: '600', fontSize: '13px' }}>
                                -{formatPKR(totalDeductions)}
                              </span>
                              <div style={{ color: '#aaa', fontSize: '10px', marginTop: '2px' }}>
                                {parseFloat(record.late_deduction) > 0 && `Late: ${formatPKR(record.late_deduction)} `}
                                {parseFloat(record.absent_deduction) > 0 && `Absent: ${formatPKR(record.absent_deduction)}`}
                              </div>
                            </div>
                          ) : <span style={{ color: '#aaa' }}>—</span>}
                        </td>
                        <td>
                          <div style={{ color: '#d71920', fontWeight: '800', fontSize: '15px' }}>
                            {formatPKR(record.net_salary)}
                          </div>
                        </td>
                      </>
                    )}

                    <td>
                      <span style={{
                        background: record.status === 'paid' ? 'rgba(22,163,74,0.1)' : 'rgba(217,119,6,0.1)',
                        color: record.status === 'paid' ? '#16a34a' : '#d97706',
                        padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700'
                      }}>
                        {record.status === 'paid' ? '✅ Paid' : '⏳ Pending'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {isEditing ? (
                          <>
                            <button onClick={() => updatePayroll(record.id, editPayroll)}
                              className="btn btn-primary btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}>
                              💾 Save
                            </button>
                            <button onClick={() => setEditPayroll(null)}
                              className="btn btn-secondary btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}>
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            {(isAdmin || isManager) && (
                              <button onClick={() => setEditPayroll({ id: record.id, ...record })}
                                className="btn btn-secondary btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                ✏️
                              </button>
                            )}
                            {record.status === 'pending' && (isAdmin || isManager) && (
                              <button onClick={() => markAsPaid(record.id)}
                                className="btn btn-success btn-sm" style={{ fontSize: '11px', padding: '4px 8px' }}>
                                ✅ Pay
                              </button>
                            )}
                            <button onClick={() => printPayslip(record)}
                              className="btn btn-sm" style={{
                                fontSize: '11px', padding: '4px 8px',
                                background: 'rgba(215,25,32,0.08)', color: '#d71920',
                                border: '1px solid rgba(215,25,32,0.2)'
                              }}>
                              🖨️
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Total Row */}
            <tfoot>
              <tr style={{ background: '#f9f9f9' }}>
                <td colSpan={5} style={{ fontWeight: '800', color: '#111', padding: '12px 16px' }}>
                  Total Payroll — {MONTHS[selectedMonth - 1]} {selectedYear}
                </td>
                <td style={{ color: '#d71920', fontWeight: '800', fontSize: '16px', padding: '12px 16px' }}>
                  {formatPKR(totalPayroll)}
                </td>
                <td colSpan={2} style={{ padding: '12px 16px' }}>
                  <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '12px' }}>
                    {paidCount} paid
                  </span>
                  {' · '}
                  <span style={{ color: '#d97706', fontWeight: '700', fontSize: '12px' }}>
                    {pendingCount} pending
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
