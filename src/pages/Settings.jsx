import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TABS = [
  { id: 'company', icon: '🏢', label: 'Company' },
  { id: 'profile', icon: '👤', label: 'My Profile' },
  { id: 'shifts', icon: '🕐', label: 'Shifts' },
  { id: 'rules', icon: '📋', label: 'Rules' },
]

export default function Settings({ profile }) {
  const [activeTab, setActiveTab] = useState('company')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  // Company
  const [company, setCompany] = useState({ company_name: '', company_email: '', company_phone: '', company_address: '', work_start_time: '09:00', late_grace_minutes: 15 })
  const [savingCompany, setSavingCompany] = useState(false)

  // Profile
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', designation: '', department: '' })
  const [savingProfile, setSavingProfile] = useState(false)

  // Password
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' })
  const [savingPassword, setSavingPassword] = useState(false)

  // Shifts
  const [shifts, setShifts] = useState([])
  const [savingShift, setSavingShift] = useState(null)
  const [newShift, setNewShift] = useState({ name: '', start_time: '09:00', end_time: '17:00', grace_minutes: 15 })
  const [showNewShift, setShowNewShift] = useState(false)

  // Rules
  const [lateRules, setLateRules] = useState([])
  const [leaveRules, setLeaveRules] = useState(null)
  const [overtimeRules, setOvertimeRules] = useState(null)
  const [savingRules, setSavingRules] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchAll()
    setProfileForm({
      full_name: profile.full_name || '',
      phone: profile.phone || '',
      designation: profile.designation || '',
      department: profile.department || ''
    })
  }, [profile])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [companyRes, shiftsRes, lateRes, leaveRes, overtimeRes] = await Promise.all([
        supabase.from('company_settings').select('*').limit(1),
        supabase.from('shifts').select('*').order('created_at'),
        supabase.from('late_rules').select('*').order('min_minutes'),
        supabase.from('leave_rules').select('*').limit(1),
        supabase.from('overtime_rules').select('*').limit(1),
      ])

      if (companyRes.data && companyRes.data.length > 0) {
        const c = companyRes.data[0]
        setCompany({
          company_name: c.company_name || '',
          company_email: c.company_email || '',
          company_phone: c.company_phone || '',
          company_address: c.company_address || '',
          work_start_time: c.work_start_time?.slice(0,5) || '09:00',
          late_grace_minutes: c.late_grace_minutes || 15
        })
      }

      setShifts(shiftsRes.data || [])
      setLateRules(lateRes.data || [])
      if (leaveRes.data && leaveRes.data.length > 0) setLeaveRules(leaveRes.data[0])
      if (overtimeRes.data && overtimeRes.data.length > 0) setOvertimeRules(overtimeRes.data[0])
    } catch (e) {
      console.error('Settings fetchAll:', e)
    } finally {
      setLoading(false)
    }
  }

  const saveCompany = async () => {
    setSavingCompany(true)
    try {
      const { data } = await supabase.from('company_settings').select('id').limit(1)
      if (data && data.length > 0) {
        await supabase.from('company_settings').update(company).eq('id', data[0].id)
      } else {
        await supabase.from('company_settings').insert(company)
      }
      setMessage('✅ Company settings saved!')
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSavingCompany(false)
    }
  }

  const saveProfile = async () => {
    setSavingProfile(true)
    try {
      const { error } = await supabase.from('profiles')
        .update(profileForm).eq('id', profile.id)
      if (error) throw error
      setMessage('✅ Profile updated!')
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const savePassword = async () => {
    if (!passwordForm.newPass) { setMessage('❌ Enter new password!'); return }
    if (passwordForm.newPass !== passwordForm.confirm) { setMessage('❌ Passwords do not match!'); return }
    if (passwordForm.newPass.length < 6) { setMessage('❌ Min 6 characters!'); return }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass })
      if (error) throw error
      setMessage('✅ Password changed!')
      setPasswordForm({ current: '', newPass: '', confirm: '' })
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSavingPassword(false)
    }
  }

  const saveShift = async (shift) => {
    setSavingShift(shift.id)
    try {
      const { error } = await supabase.from('shifts')
        .update({ name: shift.name, start_time: shift.start_time, end_time: shift.end_time, grace_minutes: shift.grace_minutes })
        .eq('id', shift.id)
      if (error) throw error
      setMessage('✅ Shift saved!')
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSavingShift(null)
    }
  }

  const createShift = async () => {
    if (!newShift.name) { setMessage('❌ Shift name required!'); return }
    try {
      const { error } = await supabase.from('shifts').insert(newShift)
      if (error) throw error
      setMessage('✅ Shift created!')
      setNewShift({ name: '', start_time: '09:00', end_time: '17:00', grace_minutes: 15 })
      setShowNewShift(false)
      fetchAll()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const deleteShift = async (id) => {
    if (!window.confirm('Delete this shift?')) return
    await supabase.from('shifts').delete().eq('id', id)
    setMessage('✅ Shift deleted!')
    fetchAll()
  }

  const updateLateRule = (id, field, value) => {
    setLateRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const saveLateRule = async (rule) => {
    try {
      await supabase.from('late_rules').update({
        name: rule.name,
        deduction_type: rule.deduction_type,
        deduction_amount: parseFloat(rule.deduction_amount) || 0
      }).eq('id', rule.id)
      setMessage('✅ Rule saved!')
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const saveLeaveRules = async () => {
    setSavingRules(true)
    try {
      if (leaveRules?.id) {
        await supabase.from('leave_rules').update({
          annual_leaves: parseInt(leaveRules.annual_leaves) || 0,
          monthly_leaves: parseInt(leaveRules.monthly_leaves) || 0,
          sick_leaves: parseInt(leaveRules.sick_leaves) || 0,
          casual_leaves: parseInt(leaveRules.casual_leaves) || 0,
          unauthorized_deduction: parseFloat(leaveRules.unauthorized_deduction) || 0,
          extra_leave_deduction: parseFloat(leaveRules.extra_leave_deduction) || 0,
        }).eq('id', leaveRules.id)
      }
      setMessage('✅ Leave rules saved!')
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSavingRules(false)
    }
  }

  const saveOvertimeRules = async () => {
    setSavingRules(true)
    try {
      if (overtimeRules?.id) {
        await supabase.from('overtime_rules').update({
          rate_per_hour: parseFloat(overtimeRules.rate_per_hour) || 0,
          min_hours: parseFloat(overtimeRules.min_hours) || 1,
          is_active: overtimeRules.is_active
        }).eq('id', overtimeRules.id)
      }
      setMessage('✅ Overtime rules saved!')
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSavingRules(false)
    }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '12px' }} />)}
    </div>
  )

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>Settings</h2>
        <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>Manage your workspace</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: '4px', marginBottom: '24px',
        background: 'white', padding: '6px', borderRadius: '12px',
        border: '1px solid #e5e5e5', overflowX: 'auto'
      }}>
        {TABS.filter(t => isAdmin || isManager || t.id === 'profile' || t.id === 'rules').map(tab => (
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

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
          border: `1px solid ${message.includes('❌') ? 'rgba(215,25,32,0.2)' : 'rgba(22,163,74,0.2)'}`,
          color: message.includes('❌') ? '#d71920' : '#16a34a',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* ===== COMPANY TAB ===== */}
      {activeTab === 'company' && (isAdmin || isManager) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card">
            <h3 style={{ color: '#111', margin: '0 0 20px', fontSize: '16px', fontWeight: '800' }}>
              🏢 Company Profile
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { label: 'Company Name', key: 'company_name', placeholder: 'Klipscen' },
                { label: 'Company Email', key: 'company_email', placeholder: 'info@klipscen.com' },
                { label: 'Phone', key: 'company_phone', placeholder: '+92 300 0000000' },
                { label: 'Address', key: 'company_address', placeholder: 'City, Country' },
              ].map(field => (
                <div key={field.key}>
                  <label className="input-label">{field.label}</label>
                  <input
                    type="text" value={company[field.key] || ''}
                    onChange={(e) => setCompany({ ...company, [field.key]: e.target.value })}
                    placeholder={field.placeholder} className="input"
                    disabled={!isAdmin && !isManager}
                  />
                </div>
              ))}
            </div>
            {(isAdmin || isManager) && (
              <button onClick={saveCompany} disabled={savingCompany} className="btn btn-primary" style={{ marginTop: '16px' }}>
                {savingCompany ? '⟳ Saving...' : '💾 Save Company'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ===== PROFILE TAB ===== */}
      {activeTab === 'profile' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Profile Info */}
          <div className="card">
            <h3 style={{ color: '#111', margin: '0 0 20px', fontSize: '16px', fontWeight: '800' }}>
              👤 My Profile
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {[
                { label: 'Full Name', key: 'full_name', placeholder: 'Your name' },
                { label: 'Phone', key: 'phone', placeholder: '+92 300 0000000' },
                { label: 'Designation', key: 'designation', placeholder: 'Video Editor' },
                { label: 'Department', key: 'department', placeholder: 'Video Editing' },
              ].map(field => (
                <div key={field.key}>
                  <label className="input-label">{field.label}</label>
                  <input
                    type="text" value={profileForm[field.key] || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, [field.key]: e.target.value })}
                    placeholder={field.placeholder} className="input"
                  />
                </div>
              ))}
            </div>

            {/* Read only info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '14px' }}>
              {[
                { label: 'Email', value: profile?.email },
                { label: 'Role', value: profile?.role?.replace('_', ' ') },
              ].map(item => (
                <div key={item.label} style={{ background: '#f9f9f9', borderRadius: '8px', padding: '10px' }}>
                  <div style={{ color: '#bbb', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ color: '#888', fontSize: '13px', fontWeight: '600', textTransform: 'capitalize' }}>{item.value}</div>
                </div>
              ))}
            </div>

            <button onClick={saveProfile} disabled={savingProfile} className="btn btn-primary" style={{ marginTop: '16px' }}>
              {savingProfile ? '⟳ Saving...' : '💾 Save Profile'}
            </button>
          </div>

          {/* Password */}
          <div className="card">
            <h3 style={{ color: '#111', margin: '0 0 20px', fontSize: '16px', fontWeight: '800' }}>
              🔑 Change Password
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '400px' }}>
              <div>
                <label className="input-label">New Password</label>
                <input type="password" value={passwordForm.newPass}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                  placeholder="Min 6 characters" className="input" />
              </div>
              <div>
                <label className="input-label">Confirm Password</label>
                <input type="password" value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  placeholder="Repeat password" className="input" />
              </div>
            </div>
            <button onClick={savePassword} disabled={savingPassword} className="btn btn-primary" style={{ marginTop: '16px' }}>
              {savingPassword ? '⟳ Saving...' : '🔑 Change Password'}
            </button>
          </div>
        </div>
      )}

      {/* ===== SHIFTS TAB ===== */}
      {activeTab === 'shifts' && (isAdmin || isManager) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: '#111', margin: '0 0 4px', fontSize: '16px', fontWeight: '800' }}>🕐 Shifts</h3>
              <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>{shifts.length} shifts configured</p>
            </div>
            <button onClick={() => setShowNewShift(true)} className="btn btn-primary btn-sm">+ Add Shift</button>
          </div>

          {/* Existing Shifts */}
          {shifts.map(shift => (
            <div key={shift.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'rgba(215,25,32,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '20px'
                  }}>🕐</div>
                  <div>
                    <input
                      value={shift.name}
                      onChange={(e) => setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, name: e.target.value } : s))}
                      style={{ border: 'none', outline: 'none', fontSize: '15px', fontWeight: '800', color: '#111', background: 'transparent', width: '200px' }}
                    />
                    <div style={{ color: '#888', fontSize: '12px' }}>
                      {shift.start_time} — {shift.end_time} · {shift.grace_minutes}min grace
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => saveShift(shift)} disabled={savingShift === shift.id} className="btn btn-primary btn-sm">
                    {savingShift === shift.id ? '⟳' : '💾 Save'}
                  </button>
                  <button onClick={() => deleteShift(shift.id)} className="btn btn-danger btn-sm">🗑️</button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <div>
                  <label className="input-label">Start Time</label>
                  <input type="time" value={shift.start_time}
                    onChange={(e) => setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, start_time: e.target.value } : s))}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">End Time</label>
                  <input type="time" value={shift.end_time}
                    onChange={(e) => setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, end_time: e.target.value } : s))}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">Grace (minutes)</label>
                  <input type="number" value={shift.grace_minutes}
                    onChange={(e) => setShifts(prev => prev.map(s => s.id === shift.id ? { ...s, grace_minutes: parseInt(e.target.value) } : s))}
                    className="input" min="0" />
                </div>
              </div>
            </div>
          ))}

          {/* New Shift Form */}
          {showNewShift && (
            <div className="card" style={{ border: '1px dashed #d71920' }}>
              <h4 style={{ color: '#d71920', margin: '0 0 16px', fontSize: '14px', fontWeight: '700' }}>+ New Shift</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '14px' }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">Shift Name</label>
                  <input type="text" value={newShift.name}
                    onChange={(e) => setNewShift({ ...newShift, name: e.target.value })}
                    placeholder="Morning Shift" className="input" autoFocus />
                </div>
                <div>
                  <label className="input-label">Start Time</label>
                  <input type="time" value={newShift.start_time}
                    onChange={(e) => setNewShift({ ...newShift, start_time: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">End Time</label>
                  <input type="time" value={newShift.end_time}
                    onChange={(e) => setNewShift({ ...newShift, end_time: e.target.value })}
                    className="input" />
                </div>
                <div>
                  <label className="input-label">Grace Minutes</label>
                  <input type="number" value={newShift.grace_minutes}
                    onChange={(e) => setNewShift({ ...newShift, grace_minutes: parseInt(e.target.value) })}
                    className="input" min="0" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={createShift} className="btn btn-primary btn-sm">Create Shift</button>
                <button onClick={() => setShowNewShift(false)} className="btn btn-secondary btn-sm">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== RULES TAB ===== */}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Info for employees */}
          {!isAdmin && !isManager && (
            <div style={{
              background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)',
              borderRadius: '10px', padding: '12px 16px',
              color: '#2563eb', fontSize: '13px', fontWeight: '600'
            }}>
              ℹ️ These are company rules set by management. Read only.
            </div>
          )}

          {/* Late Deduction Rules */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ color: '#111', margin: '0 0 4px', fontSize: '16px', fontWeight: '800' }}>
                  ⏰ Late Deduction Rules
                </h3>
                <p style={{ color: '#888', margin: 0, fontSize: '12px' }}>
                  Set deduction per category
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lateRules.map(rule => (
                <div key={rule.id} style={{
                  background: '#f9f9f9', borderRadius: '10px', padding: '14px',
                  border: '1px solid #e5e5e5'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                    {/* Name */}
                    <div>
                      <label className="input-label">Category</label>
                      <input value={rule.name}
                        onChange={(e) => updateLateRule(rule.id, 'name', e.target.value)}
                        className="input" style={{ fontSize: '13px' }}
                        disabled={!isAdmin && !isManager}
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="input-label">Type</label>
                      <select value={rule.deduction_type}
                        onChange={(e) => updateLateRule(rule.id, 'deduction_type', e.target.value)}
                        className="input" style={{ fontSize: '13px' }}
                        disabled={!isAdmin && !isManager}
                      >
                        <option value="fixed">Fixed (PKR)</option>
                        <option value="percentage">% of Daily</option>
                      </select>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="input-label">
                        {rule.deduction_type === 'fixed' ? 'Amount (PKR)' : 'Percentage (%)'}
                      </label>
                      <input type="number" value={rule.deduction_amount}
                        onChange={(e) => updateLateRule(rule.id, 'deduction_amount', e.target.value)}
                        className="input" style={{ fontSize: '13px' }} min="0"
                        disabled={!isAdmin && !isManager}
                      />
                    </div>

                    {/* Save */}
                    {(isAdmin || isManager) && (
                      <div style={{ paddingTop: '18px' }}>
                        <button onClick={() => saveLateRule(rule)} className="btn btn-primary btn-sm">
                          💾
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Range Info */}
                  <div style={{ color: '#aaa', fontSize: '11px', marginTop: '6px' }}>
                    Range: {rule.min_minutes} min
                    {rule.max_minutes ? ` — ${rule.max_minutes} min` : '+'} late
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Leave Rules */}
          {leaveRules && (
            <div className="card">
              <h3 style={{ color: '#111', margin: '0 0 20px', fontSize: '16px', fontWeight: '800' }}>
                🏖️ Leave Rules
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                {[
                  { label: 'Annual Leaves (per year)', key: 'annual_leaves', type: 'number' },
                  { label: 'Monthly Leaves (per month)', key: 'monthly_leaves', type: 'number' },
                  { label: 'Sick Leaves (per year)', key: 'sick_leaves', type: 'number' },
                  { label: 'Casual Leaves (per year)', key: 'casual_leaves', type: 'number' },
                  { label: 'Unauthorized Absence Deduction (PKR/day)', key: 'unauthorized_deduction', type: 'number' },
                  { label: 'Extra Leave Deduction (PKR/day)', key: 'extra_leave_deduction', type: 'number' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="input-label">{field.label}</label>
                    <input
                      type={field.type} value={leaveRules[field.key] || 0}
                      onChange={(e) => setLeaveRules({ ...leaveRules, [field.key]: e.target.value })}
                      className="input" min="0"
                      disabled={!isAdmin && !isManager}
                    />
                  </div>
                ))}
              </div>

              {/* Leave Summary for employees */}
              <div style={{
                background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.15)',
                borderRadius: '10px', padding: '14px', marginTop: '16px'
              }}>
                <div style={{ color: '#16a34a', fontWeight: '800', fontSize: '13px', marginBottom: '10px' }}>
                  Leave Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                  {[
                    { label: 'Annual', value: leaveRules.annual_leaves },
                    { label: 'Monthly', value: leaveRules.monthly_leaves },
                    { label: 'Sick', value: leaveRules.sick_leaves },
                    { label: 'Casual', value: leaveRules.casual_leaves },
                  ].map(l => (
                    <div key={l.label} style={{ textAlign: 'center' }}>
                      <div style={{ color: '#16a34a', fontSize: '20px', fontWeight: '800' }}>{l.value}</div>
                      <div style={{ color: '#888', fontSize: '11px' }}>{l.label}</div>
                    </div>
                  ))}
                </div>
                {(leaveRules.unauthorized_deduction > 0 || leaveRules.extra_leave_deduction > 0) && (
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(22,163,74,0.15)' }}>
                    <div style={{ color: '#d71920', fontSize: '12px', fontWeight: '600' }}>
                      ⚠️ Unauthorized absence: PKR {leaveRules.unauthorized_deduction}/day
                    </div>
                    <div style={{ color: '#d71920', fontSize: '12px', fontWeight: '600', marginTop: '4px' }}>
                      ⚠️ Extra leave: PKR {leaveRules.extra_leave_deduction}/day
                    </div>
                  </div>
                )}
              </div>

              {(isAdmin || isManager) && (
                <button onClick={saveLeaveRules} disabled={savingRules} className="btn btn-primary" style={{ marginTop: '16px' }}>
                  {savingRules ? '⟳ Saving...' : '💾 Save Leave Rules'}
                </button>
              )}
            </div>
          )}

          {/* Overtime Rules */}
          {overtimeRules && (
            <div className="card">
              <h3 style={{ color: '#111', margin: '0 0 20px', fontSize: '16px', fontWeight: '800' }}>
                ⚡ Overtime Rules
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label className="input-label">Rate Per Hour (PKR)</label>
                  <input type="number" value={overtimeRules.rate_per_hour}
                    onChange={(e) => setOvertimeRules({ ...overtimeRules, rate_per_hour: e.target.value })}
                    className="input" min="0"
                    disabled={!isAdmin && !isManager}
                  />
                </div>
                <div>
                  <label className="input-label">Minimum Overtime Hours</label>
                  <input type="number" value={overtimeRules.min_hours}
                    onChange={(e) => setOvertimeRules({ ...overtimeRules, min_hours: e.target.value })}
                    className="input" min="0" step="0.5"
                    disabled={!isAdmin && !isManager}
                  />
                </div>
              </div>

              {/* Toggle */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#f9f9f9', borderRadius: '10px', padding: '14px',
                border: '1px solid #e5e5e5', marginBottom: '16px'
              }}>
                <div>
                  <div style={{ color: '#111', fontWeight: '700', fontSize: '14px' }}>Overtime Enabled</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>
                    PKR {overtimeRules.rate_per_hour}/hr · min {overtimeRules.min_hours}hr
                  </div>
                </div>
                {(isAdmin || isManager) ? (
                  <div onClick={() => setOvertimeRules({ ...overtimeRules, is_active: !overtimeRules.is_active })}
                    style={{
                      width: '48px', height: '26px', borderRadius: '13px',
                      background: overtimeRules.is_active ? '#d71920' : '#e5e5e5',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s'
                    }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'white', position: 'absolute', top: '3px',
                      left: overtimeRules.is_active ? '25px' : '3px',
                      transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                ) : (
                  <span style={{
                    background: overtimeRules.is_active ? 'rgba(22,163,74,0.1)' : '#f5f5f5',
                    color: overtimeRules.is_active ? '#16a34a' : '#888',
                    padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700'
                  }}>
                    {overtimeRules.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>

              {(isAdmin || isManager) && (
                <button onClick={saveOvertimeRules} disabled={savingRules} className="btn btn-primary">
                  {savingRules ? '⟳ Saving...' : '💾 Save Overtime Rules'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
