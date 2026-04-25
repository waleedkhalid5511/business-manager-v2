import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function Employees({ profile }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [editEmp, setEditEmp] = useState(null)
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    role: 'employee', department: '',
    designation: '', base_salary: '',
    joining_date: new Date().toISOString().split('T')[0]
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
          joining_date: form.joining_date
        })
        .eq('id', editEmp.id)

      if (error) { setMessage('❌ ' + error.message) }
      else {
        setMessage('✅ Employee update ho gaya!')
        fetchEmployees()
        closeModal()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: 'TempPass123!',
        options: {
          data: {
            full_name: form.full_name,
            role: form.role
          }
        }
      })
      if (error) { setMessage('❌ ' + error.message) }
      else {
        setMessage('✅ Employee add ho gaya!')
        fetchEmployees()
        closeModal()
      }
    }
  }

  const toggleActive = async (emp) => {
    await supabase
      .from('profiles')
      .update({ is_active: !emp.is_active })
      .eq('id', emp.id)
    fetchEmployees()
  }

  const openEdit = (emp) => {
    setEditEmp(emp)
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      phone: emp.phone || '',
      role: emp.role,
      department: emp.department || '',
      designation: emp.designation || '',
      base_salary: emp.base_salary || '',
      joining_date: emp.joining_date || ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditEmp(null)
    setForm({
      full_name: '', email: '', phone: '',
      role: 'employee', department: '',
      designation: '', base_salary: '',
      joining_date: new Date().toISOString().split('T')[0]
    })
    setMessage('')
  }

  const roleColor = (role) => {
    if (role === 'admin') return '#ef4444'
    if (role === 'manager') return '#f59e0b'
    return '#3b82f6'
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ color: 'white', margin: '0 0 4px', fontSize: '22px' }}>
            👥 Employees
          </h2>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '13px' }}>
            {employees.length} total employees
          </p>
        </div>
        {(isAdmin || isManager) && (
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            + Employee Add Karo
          </button>
        )}
      </div>

      {/* Employee Cards */}
      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
          Loading...
        </div>
      ) : employees.length === 0 ? (
        <div style={{
          background: '#1e293b',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>👥</div>
          <p>Koi employee nahi. Pehla employee add karein!</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px'
        }}>
          {employees.map(emp => (
            <div key={emp.id} style={{
              background: '#1e293b',
              borderRadius: '12px',
              padding: '20px',
              border: '1px solid #334155',
              opacity: emp.is_active ? 1 : 0.5
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '44px', height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  flexShrink: 0
                }}>
                  {emp.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
                    {emp.full_name}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {emp.email}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>Role</span>
                  <span style={{
                    background: roleColor(emp.role) + '22',
                    color: roleColor(emp.role),
                    padding: '2px 10px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    textTransform: 'capitalize'
                  }}>
                    {emp.role}
                  </span>
                </div>
                {emp.department && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Department</span>
                    <span style={{ color: 'white', fontSize: '12px' }}>{emp.department}</span>
                  </div>
                )}
                {emp.designation && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>Designation</span>
                    <span style={{ color: 'white', fontSize: '12px' }}>{emp.designation}</span>
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

              {(isAdmin || isManager) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEdit(emp)}
                    style={{
                      flex: 1, padding: '8px',
                      background: '#334155',
                      border: 'none', borderRadius: '8px',
                      color: 'white', cursor: 'pointer', fontSize: '12px'
                    }}
                  >
                    ✏️ Edit
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => toggleActive(emp)}
                      style={{
                        flex: 1, padding: '8px',
                        background: emp.is_active ? '#7f1d1d' : '#14532d',
                        border: 'none', borderRadius: '8px',
                        color: emp.is_active ? '#fca5a5' : '#86efac',
                        cursor: 'pointer', fontSize: '12px'
                      }}
                    >
                      {emp.is_active ? '🚫 Deactivate' : '✅ Activate'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', justifyContent: 'center',
          alignItems: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            borderRadius: '16px', padding: '28px',
            width: '100%', maxWidth: '480px',
            maxHeight: '90vh', overflowY: 'auto',
            border: '1px solid #334155'
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
              }}>
                {message}
              </div>
            )}

            {[
              { label: 'Full Name *', key: 'full_name', type: 'text', placeholder: 'Ali Hassan' },
              { label: 'Email *', key: 'email', type: 'email', placeholder: 'ali@company.com', disabled: !!editEmp },
              { label: 'Phone', key: 'phone', type: 'text', placeholder: '03xx-xxxxxxx' },
              { label: 'Department', key: 'department', type: 'text', placeholder: 'Marketing' },
              { label: 'Designation', key: 'designation', type: 'text', placeholder: 'Developer' },
              { label: 'Base Salary (PKR)', key: 'base_salary', type: 'number', placeholder: '50000' },
              { label: 'Joining Date', key: 'joining_date', type: 'date' },
            ].map(field => (
              <div key={field.key} style={{ marginBottom: '12px' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                  {field.label}
                </label>
                <input
                  type={field.type}
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  disabled={field.disabled}
                  style={{
                    width: '100%', padding: '10px',
                    background: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '8px', color: 'white',
                    fontSize: '13px', outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                style={{
                  width: '100%', padding: '10px',
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px', color: 'white',
                  fontSize: '13px', outline: 'none'
                }}
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={closeModal}
                style={{
                  flex: 1, padding: '11px',
                  background: '#334155', border: 'none',
                  borderRadius: '8px', color: 'white',
                  cursor: 'pointer', fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  flex: 2, padding: '11px',
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  border: 'none', borderRadius: '8px',
                  color: 'white', cursor: 'pointer',
                  fontSize: '14px', fontWeight: 'bold'
                }}
              >
                {editEmp ? 'Update Karein' : 'Add Karein'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
