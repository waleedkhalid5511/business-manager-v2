import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Employees({ profile }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showProfile, setShowProfile] = useState(null)
  const [message, setMessage] = useState('')
  const [editEmp, setEditEmp] = useState(null)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('all')
  const [filterRole, setFilterRole] = useState('all')
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    role: 'employee', department: '',
    designation: '', base_salary: '',
    joining_date: new Date().toISOString().split('T')[0],
    avatar_url: ''
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => { fetchEmployees() }, [])

  const fetchEmployees = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setEmployees(data || [])
    setLoading(false)
  }

  const handleSubmit = async () => {
    if (!form.full_name || !form.email) {
      setMessage('❌ Name aur Email zaroori hain!')
      return
    }
    if (editEmp) {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name,
          phone: form.phone,
          role: form.role,
          department: form.department,
          designation: form.designation,
          base_salary: parseFloat(form.base_salary) || 0,
          joining_date: form.joining_date,
          avatar_url: form.avatar_url
        })
        .eq('id', editEmp.id)
      if (error) setMessage('❌ ' + error.message)
      else { setMessage('✅ Update ho gaya!'); fetchEmployees(); closeModal() }
    } else {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: 'TempPass123!',
        options: { data: { full_name: form.full_name, role: form.role } }
      })
      if (error) setMessage('❌ ' + error.message)
      else { setMessage('✅ Employee add ho gaya!'); fetchEmployees(); closeModal() }
    }
  }

  const toggleActive = async (emp) => {
    await supabase.from('profiles').update({ is_active: !emp.is_active }).eq('id', emp.id)
    fetchEmployees()
  }

  const openEdit = (emp) => {
    setEditEmp(emp)
    setForm({
      full_name: emp.full_name, email: emp.email,
      phone: emp.phone || '', role: emp.role,
      department: emp.department || '',
      designation: emp.designation || '',
      base_salary: emp.base_salary || '',
      joining_date: emp.joining_date || '',
      avatar_url: emp.avatar_url || ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false); setEditEmp(null)
    setForm({
      full_name: '', email: '', phone: '',
      role: 'employee', department: '',
      designation: '', base_salary: '',
      joining_date: new Date().toISOString().split('T')[0],
      avatar_url: ''
    })
    setMessage('')
  }

  const roleColor = (role) => {
    if (role === 'admin') return '#ef4444'
    if (role === 'manager') return '#f59e0b'
    return '#3b82f6'
  }

  const departments = [...new Set(employees.map(e => e.department).filter(Boolean))]

  const filtered = employees.filter(emp => {
    const matchSearch = emp.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.designation?.toLowerCase().includes(search.toLowerCase())
    const matchDept = filterDept === 'all' || emp.department === filterDept
    const matchRole = filterRole === 'all' || emp.role === filterRole
    return matchSearch && matchDept && matchRole
  })

  const getJoiningDuration = (date) => {
    if (!date) return ''
    const months = Math.floor((new Date() - new Date(date)) / (1000 * 60 * 60 * 24 * 30))
    if (months < 1) return 'New'
    if (months < 12) return `${months}m`
    return `${Math.floor(months / 12)}y ${months % 12}m`
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: '20px',
        flexWrap: 'wrap', gap: '12px'
      }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: '22px' }}>👥 Employees</h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>
            {filtered.length} / {employees.length} employees
          </p>
        </div>
        {(isAdmin || isManager) && (
          <button onClick={() => setShowModal(true)} style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '10px', padding: '10px 20px',
            color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
          }}>
            + Employee Add Karo
          </button>
        )}
      </div>

      {/* Search + Filters */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <input
          type="text" placeholder="🔍 Search naam, email, designation..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: '200px', padding: '10px 14px',
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none'
          }}
        />
        <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}
          style={{
            padding: '10px 12px', background: '#1e293b',
            border: '1px solid #334155', borderRadius: '8px',
            color: 'white', fontSize: '13px', outline: 'none'
          }}>
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)}
          style={{
            padding: '10px 12px', background: '#1e293b',
            border: '1px solid #334155', borderRadius: '8px',
            color: 'white', fontSize: '13px', outline: 'none'
          }}>
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>
      </div>

      {/* Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '12px', marginBottom: '20px'
      }}>
        {[
          { label: 'Total', value: employees.length, color: '#3b82f6' },
          { label: 'Active', value: employees.filter(e => e.is_active).length, color: '#10b981' },
          { label: 'Admins', value: employees.filter(e => e.role === 'admin').length, color: '#ef4444' },
          { label: 'Managers', value: employees.filter(e => e.role === 'manager').length, color: '#f59e0b' },
          { label: 'Employees', value: employees.filter(e => e.role === 'employee').length, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: '#1e293b', borderRadius: '10px',
            padding: '14px', textAlign: 'center',
            border: `1px solid ${stat.color}33`
          }}>
            <div style={{ color: stat.color, fontSize: '22px', fontWeight: 'bold' }}>
              {stat.value}
            </div>
            <div style={{ color: '#94a3b8', fontSize: '12px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Employee Cards */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{
          background: '#1e293b', borderRadius: '12px',
          padding: '40px', textAlign: 'center', color: '#94a3b8'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
          <p>Koi employee nahi mila!</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {filtered.map(emp => (
            <div key={emp.id} style={{
              background: '#1e293b', borderRadius: '12px',
              padding: '20px', border: '1px solid #334155',
              opacity: emp.is_active ? 1 : 0.6,
              cursor: 'pointer'
            }}
              onClick={() => setShowProfile(emp)}
            >
              {/* Avatar + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: emp.avatar_url ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 'bold', fontSize: '20px',
                  flexShrink: 0, overflow: 'hidden',
                  border: '2px solid #334155'
                }}>
                  {emp.avatar_url
                    ? <img src={emp.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : emp.full_name?.charAt(0).toUpperCase()
                  }
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
                    {emp.full_name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.designation || emp.email}
                  </div>
                </div>
                {!emp.is_active && (
                  <span style={{
                    background: '#7f1d1d', color: '#fca5a5',
                    padding: '2px 8px', borderRadius: '20px', fontSize: '10px'
                  }}>Inactive</span>
                )}
              </div>

              {/* Details */}
              <div style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Role</span>
                  <span style={{
                    background: roleColor(emp.role) + '22',
                    color: roleColor(emp.role),
                    padding: '2px 10px', borderRadius: '20px',
                    fontSize: '11px', fontWeight: 'bold', textTransform: 'capitalize'
                  }}>{emp.role}</span>
                </div>
                {emp.department && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Department</span>
                    <span style={{ color: 'white', fontSize: '12px' }}>{emp.department}</span>
                  </div>
                )}
                {emp.phone && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Phone</span>
                    <span style={{ color: 'white', fontSize: '12px' }}>{emp.phone}</span>
                  </div>
                )}
                {emp.joining_date && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Experience</span>
                    <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>
                      {getJoiningDuration(emp.joining_date)}
                    </span>
                  </div>
                )}
                {isAdmin && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Salary</span>
                    <span style={{ color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>
                      PKR {Number(emp.base_salary || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              {(isAdmin || isManager) && (
                <div style={{ display: 'flex', gap: '8px' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button onClick={() => openEdit(emp)} style={{
                    flex: 1, padding: '8px', background: '#334155',
                    border: 'none', borderRadius: '8px',
                    color: 'white', cursor: 'pointer', fontSize: '12px'
                  }}>✏️ Edit</button>
                  {isAdmin && (
                    <button onClick={() => toggleActive(emp)} style={{
                      flex: 1, padding: '8px',
                      background: emp.is_active ? '#7f1d1d' : '#14532d',
                      border: 'none', borderRadius: '8px',
                      color: emp.is_active ? '#fca5a5' : '#86efac',
                      cursor: 'pointer', fontSize: '12px'
                    }}>
                      {emp.is_active ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }} onClick={() => setShowProfile(null)}>
          <div style={{
            background: '#1e293b', borderRadius: '20px',
            width: '100%', maxWidth: '480px',
            border: '1px solid #334155', overflow: 'hidden'
          }} onClick={(e) => e.stopPropagation()}>
            {/* Profile Header */}
            <div style={{
              background: 'linear-gradient(135deg, #1e3a5f, #312e81)',
              padding: '32px', textAlign: 'center'
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: showProfile.avatar_url ? 'transparent' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 'bold', fontSize: '32px',
                margin: '0 auto 16px', border: '3px solid #334155',
                overflow: 'hidden'
              }}>
                {showProfile.avatar_url
                  ? <img src={showProfile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : showProfile.full_name?.charAt(0).toUpperCase()
                }
              </div>
              <h2 style={{ color: 'white', margin: '0 0 6px', fontSize: '22px' }}>
                {showProfile.full_name}
              </h2>
              <p style={{ color: '#94a3b8', margin: '0 0 12px', fontSize: '14px' }}>
                {showProfile.designation || 'No designation'}
              </p>
              <span style={{
                background: roleColor(showProfile.role) + '33',
                color: roleColor(showProfile.role),
                padding: '4px 16px', borderRadius: '20px',
                fontSize: '12px', fontWeight: 'bold', textTransform: 'capitalize'
              }}>
                {showProfile.role}
              </span>
            </div>

            {/* Profile Details */}
            <div style={{ padding: '24px' }}>
              {[
                { icon: '📧', label: 'Email', value: showProfile.email },
                { icon: '📱', label: 'Phone', value: showProfile.phone || 'N/A' },
                { icon: '🏢', label: 'Department', value: showProfile.department || 'N/A' },
                { icon: '📅', label: 'Joining Date', value: showProfile.joining_date ? new Date(showProfile.joining_date).toLocaleDateString('en-PK', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A' },
                { icon: '⏱️', label: 'Experience', value: getJoiningDuration(showProfile.joining_date) || 'N/A' },
                ...(isAdmin ? [{ icon: '💰', label: 'Base Salary', value: `PKR ${Number(showProfile.base_salary || 0).toLocaleString()}` }] : []),
                { icon: '✅', label: 'Status', value: showProfile.is_active ? 'Active' : 'Inactive' },
              ].map(item => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center',
                  gap: '12px', padding: '12px 0',
                  borderBottom: '1px solid #334155'
                }}>
                  <span style={{ fontSize: '18px', width: '24px' }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>{item.label}</div>
                    <div style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{item.value}</div>
                  </div>
                </div>
              ))}

              <button onClick={() => setShowProfile(null)} style={{
                width: '100%', padding: '12px', marginTop: '16px',
                background: '#334155', border: 'none', borderRadius: '10px',
                color: 'white', cursor: 'pointer', fontSize: '14px'
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b', borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '480px',
            maxHeight: '90vh', overflowY: 'auto', border: '1px solid #334155'
          }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>
              {editEmp ? '✏️ Employee Edit' : '+ Naya Employee'}
            </h3>

            {message && (
              <div style={{
                background: message.includes('❌') ? '#7f1d1d' : '#14532d',
                color: message.includes('❌') ? '#fca5a5' : '#86efac',
                padding: '10px', borderRadius: '8px',
                marginBottom: '16px', fontSize: '13px'
              }}>{message}</div>
            )}

            {[
              { label: 'Full Name *', key: 'full_name', type: 'text', placeholder: 'Ali Hassan' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'ali@company.com', disabled: !!editEmp },
              { label: 'Phone', key: 'phone', type: 'text', placeholder: '03xx-xxxxxxx' },
              { label: 'Department', key: 'department', type: 'text', placeholder: 'Marketing' },
              { label: 'Designation', key: 'designation', type: 'text', placeholder: 'Senior Developer' },
              { label: 'Base Salary (PKR)', key: 'base_salary', type: 'number', placeholder: '50000' },
              { label: 'Joining Date', key: 'joining_date', type: 'date' },
              { label: 'Photo URL (optional)', key: 'avatar_url', type: 'text', placeholder: 'https://...' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {field.label}
                </label>
                <input
                  type={field.type} value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder} disabled={field.disabled}
                  style={{
                    width: '100%', padding: '10px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '8px',
                    color: 'white', fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box',
                    opacity: field.disabled ? 0.5 : 1
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Role</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{
                  width: '100%', padding: '10px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '8px',
                  color: 'white', fontSize: '13px', outline: 'none'
                }}>
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={closeModal} style={{
                flex: 1, padding: '11px', background: '#334155',
                border: 'none', borderRadius: '8px',
                color: 'white', cursor: 'pointer', fontSize: '14px'
              }}>Cancel</button>
              <button onClick={handleSubmit} style={{
                flex: 2, padding: '11px',
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                cursor: 'pointer', fontSize: '14px', fontWeight: 'bold'
              }}>{editEmp ? 'Update Karein' : 'Add Karein'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
