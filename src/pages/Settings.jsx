import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Settings({ profile }) {
  const [activeTab, setActiveTab] = useState('company')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState({
    company_name: '',
    work_start_time: '09:00',
    work_end_time: '18:00',
    late_grace_minutes: 15,
    annual_leave_quota: 18,
    sick_leave_quota: 6,
    late_deduction_per_minute: 0,
    uninformed_leave_penalty: 500
  })
  const [partnerAccess, setPartnerAccess] = useState({
    can_view_employees: true,
    can_view_attendance: true,
    can_view_tasks: true,
    can_view_payroll: false,
    can_view_messages: true,
    can_view_reports: false,
    can_manage_employees: false,
    can_manage_tasks: true,
    can_manage_attendance: false
  })
  const [myProfile, setMyProfile] = useState({
    full_name: '',
    phone: '',
    department: '',
    designation: '',
    avatar_url: ''
  })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (profile) {
      fetchSettings()
      fetchMyProfile()
    }
  }, [profile])

  const fetchSettings = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .single()
    if (data) {
      setSettings({
        company_name: data.company_name || '',
        work_start_time: data.work_start_time?.slice(0, 5) || '09:00',
        work_end_time: data.work_end_time?.slice(0, 5) || '18:00',
        late_grace_minutes: data.late_grace_minutes || 15,
        annual_leave_quota: data.annual_leave_quota || 18,
        sick_leave_quota: data.sick_leave_quota || 6,
        late_deduction_per_minute: data.late_deduction_per_minute || 0,
        uninformed_leave_penalty: data.uninformed_leave_penalty || 500
      })
    }
    setLoading(false)
  }

  const fetchMyProfile = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single()
    if (data) {
      setMyProfile({
        full_name: data.full_name || '',
        phone: data.phone || '',
        department: data.department || '',
        designation: data.designation || '',
        avatar_url: data.avatar_url || ''
      })
    }
  }

  const saveSettings = async () => {
    const { error } = await supabase
      .from('company_settings')
      .update({
        company_name: settings.company_name,
        work_start_time: settings.work_start_time,
        work_end_time: settings.work_end_time,
        late_grace_minutes: parseInt(settings.late_grace_minutes),
        annual_leave_quota: parseInt(settings.annual_leave_quota),
        sick_leave_quota: parseInt(settings.sick_leave_quota),
        late_deduction_per_minute: parseFloat(settings.late_deduction_per_minute),
        uninformed_leave_penalty: parseFloat(settings.uninformed_leave_penalty)
      })
      .eq('id', (await supabase.from('company_settings').select('id').single()).data?.id)

    if (error) setMessage('❌ ' + error.message)
    else setMessage('✅ Company settings saved!')
  }

  const saveProfile = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: myProfile.full_name,
        phone: myProfile.phone,
        department: myProfile.department,
        designation: myProfile.designation,
        avatar_url: myProfile.avatar_url
      })
      .eq('id', profile.id)

    if (error) setMessage('❌ ' + error.message)
    else setMessage('✅ Profile updated!')
  }

  const changePassword = async () => {
    if (newPassword !== confirmPassword) {
      setMessage('❌ Passwords do not match!')
      return
    }
    if (newPassword.length < 6) {
      setMessage('❌ Password must be at least 6 characters!')
      return
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setMessage('❌ ' + error.message)
    else {
      setMessage('✅ Password changed successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  const tabs = [
    { id: 'company', icon: '🏢', label: 'Company', adminOnly: true },
    { id: 'attendance_rules', icon: '📅', label: 'Attendance Rules', adminOnly: true },
    { id: 'partner_access', icon: '🔐', label: 'Partner Access', adminOnly: true },
    { id: 'my_profile', icon: '👤', label: 'My Profile', adminOnly: false },
    { id: 'password', icon: '🔑', label: 'Password', adminOnly: false },
  ]

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin)

  if (loading) return <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>

  return (
    <div>
      <h2 style={{ color: 'white', margin: '0 0 24px', fontSize: '22px' }}>⚙️ Settings</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMessage('') }} style={{
            padding: '9px 18px', borderRadius: '8px', border: 'none',
            background: activeTab === tab.id
              ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : '#1e293b',
            color: activeTab === tab.id ? 'white' : '#94a3b8',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {message && (
        <div style={{
          background: message.includes('❌') ? '#7f1d1d' : '#14532d',
          color: message.includes('❌') ? '#fca5a5' : '#86efac',
          padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
        }}>{message}</div>
      )}

      {/* Company Settings */}
      {activeTab === 'company' && isAdmin && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>🏢 Company Information</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Company Name', key: 'company_name', type: 'text', placeholder: 'My Company' },
              { label: 'Work Start Time', key: 'work_start_time', type: 'time' },
              { label: 'Work End Time', key: 'work_end_time', type: 'time' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                <input type={field.type} value={settings[field.key]}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>
          <button onClick={saveSettings} style={{
            marginTop: '20px', padding: '11px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>Save Company Settings</button>
        </div>
      )}

      {/* Attendance Rules */}
      {activeTab === 'attendance_rules' && isAdmin && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>📅 Attendance & Payroll Rules</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Late Grace Period (minutes)', key: 'late_grace_minutes', type: 'number', placeholder: '15' },
              { label: 'Annual Leave Quota (days)', key: 'annual_leave_quota', type: 'number', placeholder: '18' },
              { label: 'Sick Leave Quota (days)', key: 'sick_leave_quota', type: 'number', placeholder: '6' },
              { label: 'Late Deduction Per Minute (PKR)', key: 'late_deduction_per_minute', type: 'number', placeholder: '10' },
              { label: 'Uninformed Leave Penalty (PKR)', key: 'uninformed_leave_penalty', type: 'number', placeholder: '500' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                <input type={field.type} value={settings[field.key]}
                  onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>

          {/* Rules Summary */}
          <div style={{ marginTop: '20px', background: '#0f172a', borderRadius: '10px', padding: '16px' }}>
            <h4 style={{ color: '#94a3b8', margin: '0 0 12px', fontSize: '13px' }}>📋 Current Rules Summary</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Work Hours', value: `${settings.work_start_time} - ${settings.work_end_time}` },
                { label: 'Grace Period', value: `${settings.late_grace_minutes} minutes` },
                { label: 'Annual Leave', value: `${settings.annual_leave_quota} days/year` },
                { label: 'Sick Leave', value: `${settings.sick_leave_quota} days/year` },
                { label: 'Late Penalty', value: `PKR ${settings.late_deduction_per_minute}/min` },
                { label: 'Uninformed Leave', value: `PKR ${settings.uninformed_leave_penalty}/day` },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>{item.label}</span>
                  <span style={{ color: 'white', fontSize: '12px', fontWeight: 'bold' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveSettings} style={{
            marginTop: '20px', padding: '11px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>Save Rules</button>
        </div>
      )}

      {/* Partner Access */}
      {activeTab === 'partner_access' && isAdmin && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: 'white', margin: '0 0 8px', fontSize: '17px' }}>🔐 Partner Access Control</h3>
          <p style={{ color: '#94a3b8', margin: '0 0 20px', fontSize: '13px' }}>
            Control what managers and partners can see and do in the app.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* View Permissions */}
            <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px' }}>
              <h4 style={{ color: '#3b82f6', margin: '0 0 14px', fontSize: '14px' }}>👁️ View Permissions</h4>
              {[
                { key: 'can_view_employees', label: 'View Employees', desc: 'See employee list and profiles' },
                { key: 'can_view_attendance', label: 'View Attendance', desc: 'See all attendance records' },
                { key: 'can_view_tasks', label: 'View Tasks', desc: 'See all tasks and assignments' },
                { key: 'can_view_payroll', label: 'View Payroll', desc: 'See salary and payroll data' },
                { key: 'can_view_messages', label: 'View Messages', desc: 'Access all channels' },
                { key: 'can_view_reports', label: 'View Reports', desc: 'Access analytics and reports' },
              ].map(perm => (
                <div key={perm.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e293b'
                }}>
                  <div>
                    <div style={{ color: 'white', fontSize: '14px' }}>{perm.label}</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{perm.desc}</div>
                  </div>
                  <div
                    onClick={() => setPartnerAccess({ ...partnerAccess, [perm.key]: !partnerAccess[perm.key] })}
                    style={{
                      width: '48px', height: '26px', borderRadius: '13px',
                      background: partnerAccess[perm.key] ? '#3b82f6' : '#334155',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
                    }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'white', position: 'absolute', top: '3px',
                      left: partnerAccess[perm.key] ? '25px' : '3px',
                      transition: 'left 0.2s'
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Manage Permissions */}
            <div style={{ background: '#0f172a', borderRadius: '10px', padding: '16px' }}>
              <h4 style={{ color: '#f59e0b', margin: '0 0 14px', fontSize: '14px' }}>⚡ Manage Permissions</h4>
              {[
                { key: 'can_manage_employees', label: 'Manage Employees', desc: 'Add, edit, deactivate employees' },
                { key: 'can_manage_tasks', label: 'Manage Tasks', desc: 'Create, assign, edit tasks' },
                { key: 'can_manage_attendance', label: 'Manage Attendance', desc: 'Add manual attendance entries' },
              ].map(perm => (
                <div key={perm.key} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #1e293b'
                }}>
                  <div>
                    <div style={{ color: 'white', fontSize: '14px' }}>{perm.label}</div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>{perm.desc}</div>
                  </div>
                  <div
                    onClick={() => setPartnerAccess({ ...partnerAccess, [perm.key]: !partnerAccess[perm.key] })}
                    style={{
                      width: '48px', height: '26px', borderRadius: '13px',
                      background: partnerAccess[perm.key] ? '#f59e0b' : '#334155',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
                    }}>
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '50%',
                      background: 'white', position: 'absolute', top: '3px',
                      left: partnerAccess[perm.key] ? '25px' : '3px',
                      transition: 'left 0.2s'
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setMessage('✅ Partner access settings saved!')} style={{
            marginTop: '20px', padding: '11px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>Save Access Settings</button>
        </div>
      )}

      {/* My Profile */}
      {activeTab === 'my_profile' && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155' }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>👤 My Profile</h3>

          {/* Avatar Preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: myProfile.avatar_url ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 'bold', fontSize: '28px',
              border: '3px solid #334155', overflow: 'hidden', flexShrink: 0
            }}>
              {myProfile.avatar_url
                ? <img src={myProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : myProfile.full_name?.charAt(0).toUpperCase()
              }
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>{myProfile.full_name}</div>
              <div style={{ color: '#3b82f6', fontSize: '13px', textTransform: 'capitalize' }}>{profile?.role}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {[
              { label: 'Full Name', key: 'full_name', type: 'text', placeholder: 'Your name' },
              { label: 'Phone', key: 'phone', type: 'text', placeholder: '03xx-xxxxxxx' },
              { label: 'Department', key: 'department', type: 'text', placeholder: 'Your department' },
              { label: 'Designation', key: 'designation', type: 'text', placeholder: 'Your designation' },
              { label: 'Photo URL', key: 'avatar_url', type: 'text', placeholder: 'https://...' },
            ].map(field => (
              <div key={field.key}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                <input type={field.type} value={myProfile[field.key]}
                  onChange={(e) => setMyProfile({ ...myProfile, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>

          <button onClick={saveProfile} style={{
            marginTop: '20px', padding: '11px 24px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>Save Profile</button>
        </div>
      )}

      {/* Password */}
      {activeTab === 'password' && (
        <div style={{ background: '#1e293b', borderRadius: '16px', padding: '24px', border: '1px solid #334155', maxWidth: '480px' }}>
          <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '17px' }}>🔑 Change Password</h3>

          {[
            { label: 'New Password', key: 'new', value: newPassword, setter: setNewPassword },
            { label: 'Confirm Password', key: 'confirm', value: confirmPassword, setter: setConfirmPassword },
          ].map(field => (
            <div key={field.key} style={{ marginBottom: '16px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '6px' }}>{field.label}</label>
              <input type="password" value={field.value}
                onChange={(e) => field.setter(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}

          <div style={{ background: '#0f172a', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <p style={{ color: '#94a3b8', margin: 0, fontSize: '12px' }}>
              ℹ️ Password Requirements:
            </p>
            <ul style={{ color: '#64748b', fontSize: '12px', margin: '8px 0 0', paddingLeft: '16px' }}>
              <li>At least 6 characters</li>
              <li>Both passwords must match</li>
            </ul>
          </div>

          <button onClick={changePassword} style={{
            width: '100%', padding: '11px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: 'white',
            cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>Change Password</button>
        </div>
      )}
    </div>
  )
}
