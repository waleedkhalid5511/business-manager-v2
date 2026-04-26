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
  const [showDetail, setShowDetail] = useState(null)
  const [showBonusModal, setShowBonusModal] = useState(null)
  const [bonusForm, setBonusForm] = useState({ bonus: '', notes: '' })

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
      .select('*, profiles(full_name, department, designation, base_salary, avatar_url)')
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
    if (!emp) return
    setCalculating(true)
    const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
    const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0]

    const [attData, leaveData, uninformedLeaves] = await Promise.all([
      supabase.from('attendance').select('*').eq('employee_id', emp.id).gte('date', startDate).lte('date', endDate),
      supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').gte('start_date', startDate).lte('end_date', endDate),
      supabase.from('leave_requests').select('*').eq('employee_id', emp.id).eq('status', 'approved').eq('is_informed', false).gte('start_date', startDate).lte('end_date', endDate)
    ])

    let workingDays = 0
    const current = new Date(startDate)
    const end = new Date(endDate)
    while (current <= end) {
      const day = current.getDay()
      if (day !== 0 && day !== 6) workingDays++
      current.setDate(current.getDate() + 1)
    }

    const att = attData.data || []
    const presentDays = att.filter(a => a.status === 'present').length
    const lateDays = att.filter(a => a.status === 'late').length
    const totalLateMinutes = att.reduce((sum, a) => sum + (a.late_minutes || 0), 0)
    const approvedLeaveDays = (leaveData.data || []).reduce((sum, l) => sum + l.total_days, 0)
    const uninformedDays = (uninformedLeaves.data || []).reduce((sum, l) => sum + l.total_days, 0)
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
    else setMessage(`✅ ${emp.full_name} payroll calculated!`)
    setCalculating(false)
    fetchPayroll()
  }

  const calculateAll = async () => {
    setMessage('⏳ Calculating all payrolls...')
    for (const emp of employees) {
      await calculatePayroll(emp)
    }
    setMessage('✅ All payrolls calculated!')
  }

  const updateStatus = async (id, status) => {
    await supabase.from('payroll').update({ status }).eq('id', id)
    fetchPayroll()
    if (showDetail) setShowDetail({ ...showDetail, status })
  }

  const addBonus = async () => {
    if (!showBonusModal) return
    const payroll = payrolls.find(p => p.id === showBonusModal)
    if (!payroll) return

    const bonus = parseFloat(bonusForm.bonus) || 0
    const newNet = payroll.net_salary + bonus

    await supabase.from('payroll').update({
      bonus, net_salary: newNet, notes: bonusForm.notes
    }).eq('id', showBonusModal)

    setMessage(`✅ Bonus of PKR ${bonus.toLocaleString()} added!`)
    setShowBonusModal(null)
    setBonusForm({ bonus: '', notes: '' })
    fetchPayroll()
  }

  const generateSlip = (p) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December']

    const slipContent = `
SALARY SLIP
===========
Company: Business Manager
Period: ${months[selectedMonth - 1]} ${selectedYear}
Generated: ${new Date().toLocaleDateString()}

EMPLOYEE DETAILS
----------------
Name: ${p.profiles?.full_name}
Designation: ${p.profiles?.designation || 'N/A'}
Department: ${p.profiles?.department || 'N/A'}

ATTENDANCE SUMMARY
------------------
Working Days: ${p.working_days}
Present Days: ${p.present_days}
Late Days: ${p.late_days}
Absent Days: ${p.absent_days}
Approved Leaves: ${p.approved_leaves}

SALARY CALCULATION
------------------
Base Salary:        PKR ${Number(p.base_salary).toLocaleString()}
Late Deduction:    -PKR ${Number(p.late_deduction).toLocaleString()}
Absence Deduction: -PKR ${Number(p.absence_deduction).toLocaleString()}
Leave Penalty:     -PKR ${Number(p.leave_penalty).toLocaleString()}
Bonus:             +PKR ${Number(p.bonus || 0).toLocaleString()}
                   ─────────────────────
NET SALARY:         PKR ${Number(p.net_salary).toLocaleString()}

Status: ${p.status.toUpperCase()}
    `

    const blob = new Blob([slipContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `salary-slip-${p.profiles?.full_name}-${months[selectedMonth - 1]}-${selectedYear}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']

  const statusColor = (s) => ({ draft: '#94a3b8', approved: '#3b82f6', paid: '#10b981' }[s] || '#94a3b8')

  const totalNet = payrolls.reduce((sum, p) => sum + (p.net_salary || 0), 0)
  const totalDeductions = payrolls.reduce((sum, p) =>
    sum + (p.late_deduction || 0) + (p.absence_deduction || 0) + (p.leave_penalty || 0), 0)
  const totalBonus = payrolls.reduce((sum, p) => sum + (p.bonus || 0), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: '22px' }}>💰 Payroll</h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>{months[selectedMonth - 1]} {selectedYear}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{ padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
            {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{ padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none' }}>
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {isAdmin && (
            <button onClick={calculateAll} disabled={calculating} style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: '8px', padding: '9px 16px',
              color: 'white', cursor: calculating ? 'not-allowed' : 'pointer',
              fontSize: '13px', fontWeight: 'bold'
            }}>
              {calculating ? '⏳ Calculating...' : '🔄 Calculate All'}
            </button>
          )}
        </div>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? '#7f1d1d' : message.includes('⏳') ? '#1e3a5f' : '#14532d',
          color: message.includes('❌') ? '#fca5a5' : message.includes('⏳') ? '#93c5fd' : '#86efac',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* Summary Cards */}
      {isAdmin && payrolls.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Net Salary', value: `PKR ${totalNet.toLocaleString()}`, color: '#10b981', icon: '💰' },
            { label: 'Total Deductions', value: `PKR ${totalDeductions.toLocaleString()}`, color: '#ef4444', icon: '📉' },
            { label: 'Total Bonus', value: `PKR ${totalBonus.toLocaleString()}`, color: '#f59e0b', icon: '🎁' },
            { label: 'Employees', value: payrolls.length, color: '#3b82f6', icon: '👥' },
            { label: 'Paid', value: payrolls.filter(p => p.status === 'paid').length, color: '#8b5cf6', icon: '✅' },
          ].map(card => (
            <div key={card.label} style={{ background: '#1e293b', borderRadius: '12px', padding: '18px', border: `1px solid ${card.color}33` }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>{card.icon}</div>
              <div style={{ color: card.color, fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' }}>{card.value}</div>
              <div style={{ color: '#94a3b8', fontSize: '12px' }}>{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Payroll Records */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : payrolls.length === 0 ? (
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '40px', textAlign: 'center', color: '#94a3b8', border: '1px solid #334155' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
          <p>No payroll records for this month.</p>
          {isAdmin && (
            <button onClick={calculateAll} style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none', borderRadius: '8px', padding: '10px 20px',
              color: 'white', cursor: 'pointer', fontSize: '14px', marginTop: '12px'
            }}>🔄 Calculate Payroll</button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {payrolls.map(p => (
            <div key={p.id}
              onClick={() => setShowDetail(p)}
              style={{ background: '#1e293b', borderRadius: '12px', padding: '20px', border: '1px solid #334155', cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontWeight: 'bold', fontSize: '18px', flexShrink: 0
                  }}>
                    {p.profiles?.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>{p.profiles?.full_name}</div>
                    <div style={{ color: '#94a3b8', fontSize: '12px' }}>{p.profiles?.designation} • {p.profiles?.department}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{
                    background: statusColor(p.status) + '22', color: statusColor(p.status),
                    padding: '3px 12px', borderRadius: '20px', fontSize: '12px',
                    fontWeight: 'bold', textTransform: 'capitalize'
                  }}>{p.status}</span>
                  <div style={{ color: '#10b981', fontSize: '20px', fontWeight: 'bold' }}>
                    PKR {Number(p.net_salary).toLocaleString()}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                {[
                  { label: 'Base', value: `PKR ${Number(p.base_salary).toLocaleString()}`, color: 'white' },
                  { label: 'Present', value: p.present_days, color: '#10b981' },
                  { label: 'Late', value: p.late_days, color: '#f59e0b' },
                  { label: 'Absent', value: p.absent_days, color: '#ef4444' },
                  { label: 'Deductions', value: `PKR ${(Number(p.late_deduction) + Number(p.absence_deduction) + Number(p.leave_penalty)).toLocaleString()}`, color: '#ef4444' },
                  { label: 'Bonus', value: `PKR ${Number(p.bonus || 0).toLocaleString()}`, color: '#f59e0b' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#0f172a', borderRadius: '8px', padding: '8px' }}>
                    <div style={{ color: '#94a3b8', fontSize: '10px', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ color: item.color, fontSize: '12px', fontWeight: 'bold' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {isAdmin && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
                  onClick={(e) => e.stopPropagation()}>
                  {p.status === 'draft' && (
                    <button onClick={() => updateStatus(p.id, 'approved')} style={{
                      padding: '7px 12px', background: '#1e3a5f', border: '1px solid #3b82f6',
                      borderRadius: '8px', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                    }}>✅ Approve</button>
                  )}
                  {p.status === 'approved' && (
                    <button onClick={() => updateStatus(p.id, 'paid')} style={{
                      padding: '7px 12px', background: '#14532d', border: '1px solid #22c55e',
                      borderRadius: '8px', color: '#86efac', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                    }}>💰 Mark Paid</button>
                  )}
                  <button onClick={() => { setShowBonusModal(p.id); setBonusForm({ bonus: p.bonus || '', notes: p.notes || '' }) }} style={{
                    padding: '7px 12px', background: '#78350f', border: '1px solid #f59e0b',
                    borderRadius: '8px', color: '#fde68a', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold'
                  }}>🎁 Add Bonus</button>
                  <button onClick={() => generateSlip(p)} style={{
                    padding: '7px 12px', background: '#334155', border: 'none',
                    borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px'
                  }}>📄 Download Slip</button>
                  <button onClick={() => calculatePayroll(employees.find(e => e.id === p.employee_id))} style={{
                    padding: '7px 12px', background: '#334155', border: 'none',
                    borderRadius: '8px', color: '#94a3b8', cursor: 'pointer', fontSize: '12px'
                  }}>🔄 Recalculate</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bonus Modal */}
      {showBonusModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', border: '1px solid #334155' }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>🎁 Add Bonus</h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Bonus Amount (PKR)</label>
              <input type="number" value={bonusForm.bonus}
                onChange={(e) => setBonusForm({ ...bonusForm, bonus: e.target.value })}
                placeholder="5000"
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Notes (Optional)</label>
              <input type="text" value={bonusForm.notes}
                onChange={(e) => setBonusForm({ ...bonusForm, notes: e.target.value })}
                placeholder="Performance bonus..."
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowBonusModal(null)} style={{ flex: 1, padding: '11px', background: '#334155', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={addBonus} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Add Bonus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
