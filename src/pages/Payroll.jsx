import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Payroll({ profile }) {
  const [payrolls, setPayrolls] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [calculating, setCalculating] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (profile) {
      fetchPayroll()
      if (isAdmin) fetchEmployees()
    }
  }, [profile, selectedMonth, selectedYear])

  const fetchPayroll = async () => {
    setLoading(true)
    let query = supabase
      .from('payroll')
      .select('*, profiles(full_name, department, designation)')
      .eq('month', selectedMonth)
      .eq('year', selectedYear)
      .order('created_at', { ascending: false })

    if (!isAdmin && !isManager) query = query.eq('employee_id', profile.id)

    const { data } = await query
    setPayrolls(data || [])
    setLoading(false)
  }

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles').select('*').eq('is_active', true)
    setEmployees(data || [])
  }

  const calculatePayroll = async (emp) => {
    setCalculating(true)
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

    const { data: attData } = await supabase
      .from('attendance').select('*')
      .eq('employee_id', emp.id)
      .gte('date', startDate).lte('date', endDate)

    const { data: leaveData } = await supabase
      .from('leave_requests').select('*')
      .eq('employee_id', emp.id).eq('status', 'approved')
      .gte('start_date', startDate).lte('end_date', endDate)

    const { data: uninformedLeaves } = await supabase
      .from('leave_requests').select('*')
      .eq('employee_id', emp.id).eq('status', 'approved')
      .eq('is_informed', false)
      .gte('start_date', startDate).lte('end_date', endDate)

    // Working days calculate
    let workingDays = 0
    const current = new Date(startDate)
    const end = new Date(endDate)
    while (current <= end) {
      const day = current.getDay()
      if (day !== 0 && day !== 6) workingDays++
      current.setDate(current.getDate() + 1)
    }

    const presentDays = attData?.filter(a => a.status === 'present').length || 0
    const lateDays = attData?.filter(a => a.status === 'late').length || 0
    const totalLateMinutes = attData?.reduce((sum, a) => sum + (a.late_minutes || 0), 0) || 0
    const approvedLeaveDays = leaveData?.reduce((sum, l) => sum + l.total_days, 0) || 0
    const uninformedDays = uninformedLeaves?.reduce((sum, l) => sum + l.total_days, 0) || 0
    const absentDays = Math.max(0, workingDays - presentDays - lateDays - approvedLeaveDays)

    const perDaySalary = emp.base_salary / workingDays
    const perMinuteSalary = emp.base_salary / (workingDays * 8 * 60)
    const lateDeduction = totalLateMinutes * perMinuteSalary
    const absenceDeduction = absentDays * perDaySalary
    const leavePenalty = uninformedDays * 500
    const netSalary = Math.max(0, emp.base_salary - lateDeduction - absenceDeduction - leavePenalty)

    const { error } = await supabase.from('payroll').upsert({
      employee_id: emp.id,
      month: selectedMonth, year: selectedYear,
      base_salary: emp.base_salary,
      working_days: workingDays,
      present_days: presentDays,
      late_days: lateDays,
      absent_days: absentDays,
      approved_leaves: approvedLeaveDays,
      unapproved_leaves: uninformedDays,
      late_deduction: Math.round(lateDeduction),
      absence_deduction: Math.round(absenceDeduction),
      leave_penalty: leavePenalty,
      net_salary: Math.round(netSalary),
      status: 'draft'
    }, { onConflict: 'employee_id,month,year' })

    if (error) setMessage('❌ ' + error.message)
    else setMessage(`✅ ${emp.full_name} ka payroll calculate ho gaya!`)
    setCalculating(false)
    fetchPayroll()
  }

  const calculateAll = async () => {
    setMessage('⏳ Sab ka payroll calculate ho raha hai...')
    for (const emp of employees) {
      await calculatePayroll(emp)
    }
    setMessage('✅ Sab employees ka payroll ho gaya!')
  }

  const updateStatus = async (id, status) => {
    await supabase.from('payroll').update({ status }).eq('id', id)
    fetchPayroll()
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const statusColor = (s) => {
    const c = { draft: '#94a3b8', approved: '#3b82f6', paid: '#10b981' }
    return c[s] || '#94a3b8'
  }

  const totalNet = payrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0)
  const totalDeductions = payrolls.reduce((sum, p) =>
    sum + (p.late_deduction || 0) + (p.absence_deduction || 0) + (p.leave_penalty || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '24px',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: '22px' }}>💰 Payroll</h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>
            {months[selectedMonth - 1]} {selectedYear}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{
              padding: '9px 12px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: '8px',
              color: 'white', fontSize: '13px', outline: 'none'
            }}>
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <select value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              padding: '9px 12px', background: '#1e293b',
              border: '1px solid #334155', borderRadius: '8px',
              color: 'white', fontSize: '13px', outline: 'none'
            }}>
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {isAdmin && (
            <button onClick={calculateAll} disabled={calculating} style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: '8px', padding: '9px 16px',
              color: 'white', cursor: calculating ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold'
            }}>
              {calculating ? '⏳...' : '🔄 Sab Calculate Karo'}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? '#7f1d1d'
            : message.includes('⏳') ? '#1e3a5f' : '#14532d',
          color: message.includes('❌') ? '#fca5a5'
            : message.includes('⏳') ? '#93c5fd' : '#86efac',
          padding: '10px 14px', borderRadius: '8px',
          marginBottom: '16px', fontSize: '13px'
        }}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      {isAdmin && payrolls.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '14px', marginBottom: '24px'
        }}>
          {[
            { label: 'Total Net Salary', value: `PKR ${totalNet.toLocaleString()}`, color: '#10b981', icon: '💰' },
            { label: 'Total Deductions', value: `PKR ${totalDeductions.toLocaleString()}`, color: '#ef4444', icon: '📉' },
            { label: 'Employees', value: payrolls.length, color: '#3b82f6', icon: '👥' },
            { label: 'Paid', value: payrolls.filter(p => p.status === 'paid').length, color: '#8b5cf6', icon: '✅' },
          ].map(card => (
            <div key={card.label} style={{
              background: '#1e293b', borderRadius: '12px',
              padding: '18px', border: `1px solid ${card.color}33`
            }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{card.icon}</div>
              <div style={{ color: card.color, fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>
                {card.value}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Payroll Records */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : payrolls.length === 0 ? (
        <div style={{
          background: '#1e293b', borderRadius: '12px', padding: '40px',
          textAlign: 'center', color: '#94a3b8', border: '1px solid #334155'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
          <p>Is month ka koi payroll nahi.</p>
          {isAdmin && (
            <button onClick={calculateAll} style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              color: 'white', cursor: 'pointer', fontSize: '14px', marginTop: '12px'
            }}>
              🔄 Payroll Calculate Karo
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {payrolls.map(p => (
            <div key={p.id} style={{
              background: '#1e293b', borderRadius: '12px',
              padding: '20px', border: '1px solid #334155'
            }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '16px',
                flexWrap: 'wrap', gap: '10px'
              }}>
                <div>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
                    {p.profiles?.full_name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {p.profiles?.designation} • {p.profiles?.department}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: statusColor(p.status) + '22',
                    color: statusColor(p.status),
                    padding: '3px 12px', borderRadius: '20px',
                    fontSize: '12px', fontWeight: 'bold', textTransform: 'capitalize'
                  }}>
                    {p.status}
                  </span>
                  <div style={{ color: '#10b981', fontSize: '18px', fontWeight: 'bold' }}>
                    PKR {Number(p.net_salary).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '10px', marginBottom: '16px'
              }}>
                {[
                  { label: 'Base Salary', value: `PKR ${Number(p.base_salary).toLocaleString()}`, color: 'white' },
                  { label: 'Working Days', value: p.working_days, color: 'white' },
                  { label: 'Present', value: p.present_days, color: '#10b981' },
                  { label: 'Late Days', value: p.late_days, color: '#f59e0b' },
                  { label: 'Absent', value: p.absent_days, color: '#ef4444' },
                  { label: 'Late Deduction', value: `PKR ${Number(p.late_deduction).toLocaleString()}`, color: '#f59e0b' },
                  { label: 'Absent Deduction', value: `PKR ${Number(p.absence_deduction).toLocaleString()}`, color: '#ef4444' },
                  { label: 'Leave Penalty', value: `PKR ${Number(p.leave_penalty).toLocaleString()}`, color: '#ef4444' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: '#0f172a', borderRadius: '8px', padding: '10px'
                  }}>
                    <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '4px' }}>
                      {item.label}
                    </div>
                    <div style={{ color: item.color, fontSize: '13px', fontWeight: 'bold' }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {p.status === 'draft' && (
                    <button onClick={() => updateStatus(p.id, 'approved')} style={{
                      padding: '8px 14px', background: '#1e3a5f',
                      border: '1px solid #3b82f6', borderRadius: '8px',
                      color: '#3b82f6', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold'
                    }}>✅ Approve</button>
                  )}
                  {p.status === 'approved' && (
                    <button onClick={() => updateStatus(p.id, 'paid')} style={{
                      padding: '8px 14px', background: '#14532d',
                      border: '1px solid #22c55e', borderRadius: '8px',
                      color: '#86efac', cursor: 'pointer',
                      fontSize: '12px', fontWeight: 'bold'
                    }}>💰 Mark as Paid</button>
                  )}
                  <button
                    onClick={() => calculatePayroll(employees.find(e => e.id === p.employee_id))}
                    style={{
                      padding: '8px 14px', background: '#334155',
                      border: 'none', borderRadius: '8px',
                      color: '#94a3b8', cursor: 'pointer', fontSize: '12px'
                    }}>🔄 Recalculate</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
