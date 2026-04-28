import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TYPE_CONFIG = {
  info: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)', icon: 'ℹ️', label: 'Info' },
  warning: { color: '#d97706', bg: 'rgba(217,119,6,0.08)', icon: '⚠️', label: 'Warning' },
  success: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)', icon: '✅', label: 'Success' },
  urgent: { color: '#d71920', bg: 'rgba(215,25,32,0.08)', icon: '🚨', label: 'Urgent' },
}

export default function Announcements({ profile }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState({
    title: '', body: '', type: 'info'
  })

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAnnouncements()

    const sub = supabase
      .channel(`announcements-live-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'announcements'
      }, () => fetchAnnouncements())
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile])

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(''), 4000)
      return () => clearTimeout(t)
    }
  }, [message])

  const fetchAnnouncements = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
      if (error) throw error
      setAnnouncements(data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const createAnnouncement = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setMessage('❌ Title and message required!')
      return
    }
    try {
      const { error } = await supabase.from('announcements').insert({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        created_by: profile.id,
        is_active: true
      })
      if (error) throw error
      setMessage('✅ Announcement sent!')
      setForm({ title: '', body: '', type: 'info' })
      setShowModal(false)
      fetchAnnouncements()
    } catch (e) {
      setMessage('❌ ' + e.message)
    }
  }

  const toggleActive = async (ann) => {
    await supabase.from('announcements')
      .update({ is_active: !ann.is_active })
      .eq('id', ann.id)
    fetchAnnouncements()
  }

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    setMessage('✅ Deleted!')
    fetchAnnouncements()
  }

  const filtered = announcements.filter(a => {
    if (filter === 'active') return a.is_active
    if (filter === 'archived') return !a.is_active
    if (filter !== 'all') return a.type === filter
    return true
  })

  const activeCount = announcements.filter(a => a.is_active).length
  const urgentCount = announcements.filter(a => a.type === 'urgent' && a.is_active).length

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>
            📢 Announcements
          </h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {activeCount} active · {announcements.length} total
            {urgentCount > 0 && <span style={{ color: '#d71920', fontWeight: '700' }}> · {urgentCount} urgent</span>}
          </p>
        </div>
        {(isAdmin || isManager) && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            📢 New Announcement
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '20px' }}>
        {Object.entries(TYPE_CONFIG).map(([type, config]) => (
          <div key={type} style={{
            background: 'white', borderRadius: '10px', padding: '14px',
            textAlign: 'center', border: `1px solid ${config.color}22`,
            cursor: 'pointer', transition: 'all 0.2s',
            boxShadow: filter === type ? `0 0 0 2px ${config.color}` : '0 1px 4px rgba(0,0,0,0.05)'
          }}
            onClick={() => setFilter(filter === type ? 'all' : type)}
          >
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{config.icon}</div>
            <div style={{ color: config.color, fontSize: '18px', fontWeight: '800' }}>
              {announcements.filter(a => a.type === type).length}
            </div>
            <div style={{ color: '#888', fontSize: '11px' }}>{config.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: `All (${announcements.length})` },
          { id: 'active', label: `Active (${activeCount})` },
          { id: 'archived', label: `Archived (${announcements.length - activeCount})` },
        ].map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '6px 14px', borderRadius: '20px',
            border: `1px solid ${filter === f.id ? '#d71920' : '#e5e5e5'}`,
            background: filter === f.id ? 'rgba(215,25,32,0.08)' : 'white',
            color: filter === f.id ? '#d71920' : '#888',
            cursor: 'pointer', fontSize: '12px', fontWeight: '700'
          }}>
            {f.label}
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

      {/* Announcements List */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '12px' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📢</div>
          <div className="empty-title">No announcements</div>
          <div className="empty-desc">
            {(isAdmin || isManager) ? 'Create an announcement for your team' : 'No announcements from your team yet'}
          </div>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
              📢 New Announcement
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filtered.map(ann => {
            const config = TYPE_CONFIG[ann.type] || TYPE_CONFIG.info
            return (
              <div key={ann.id} style={{
                background: 'white', borderRadius: '14px',
                border: `1px solid ${ann.is_active ? config.color + '30' : '#e5e5e5'}`,
                overflow: 'hidden',
                opacity: ann.is_active ? 1 : 0.6,
                boxShadow: ann.is_active ? `0 2px 12px ${config.color}15` : '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}>
                {/* Top colored bar */}
                {ann.is_active && (
                  <div style={{
                    height: '4px',
                    background: ann.type === 'urgent'
                      ? 'linear-gradient(90deg, #d71920, #ff6b6b)'
                      : ann.type === 'warning'
                        ? 'linear-gradient(90deg, #d97706, #fbbf24)'
                        : ann.type === 'success'
                          ? 'linear-gradient(90deg, #16a34a, #22c55e)'
                          : 'linear-gradient(90deg, #2563eb, #60a5fa)'
                  }} />
                )}

                <div style={{ padding: '18px 20px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '10px',
                        background: config.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', flexShrink: 0
                      }}>
                        {config.icon}
                      </div>
                      <div>
                        <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '2px' }}>
                          {ann.title}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{
                            background: config.bg, color: config.color,
                            padding: '2px 8px', borderRadius: '20px',
                            fontSize: '10px', fontWeight: '800', textTransform: 'uppercase'
                          }}>
                            {config.label}
                          </span>
                          {!ann.is_active && (
                            <span style={{ background: '#f5f5f5', color: '#888', padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700' }}>
                              Archived
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {(isAdmin || isManager) && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => toggleActive(ann)} className="btn btn-sm" style={{
                          background: ann.is_active ? 'rgba(37,99,235,0.08)' : 'rgba(22,163,74,0.08)',
                          color: ann.is_active ? '#2563eb' : '#16a34a',
                          border: `1px solid ${ann.is_active ? 'rgba(37,99,235,0.2)' : 'rgba(22,163,74,0.2)'}`
                        }}>
                          {ann.is_active ? '📦 Archive' : '✅ Restore'}
                        </button>
                        {isAdmin && (
                          <button onClick={() => deleteAnnouncement(ann.id)} className="btn btn-danger btn-sm">
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{
                    color: '#444', fontSize: '14px', lineHeight: '1.7',
                    marginBottom: '14px', whiteSpace: 'pre-wrap'
                  }}>
                    {ann.body}
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="avatar avatar-sm" style={{
                        background: 'rgba(215,25,32,0.1)', color: '#d71920',
                        fontSize: '11px', fontWeight: '800'
                      }}>
                        {ann.profiles?.full_name?.charAt(0).toUpperCase()}
                      </div>
                      <span style={{ color: '#888', fontSize: '12px' }}>
                        <span style={{ color: '#d71920', fontWeight: '700' }}>{ann.profiles?.full_name}</span>
                        {' · '}
                        <span style={{ textTransform: 'capitalize' }}>{ann.profiles?.role?.replace('_', ' ')}</span>
                      </span>
                    </div>
                    <span style={{ color: '#bbb', fontSize: '11px' }}>
                      {new Date(ann.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '520px' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #e5e5e5',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ color: '#111', margin: 0, fontSize: '17px', fontWeight: '800' }}>
                📢 New Announcement
              </h3>
              <button onClick={() => { setShowModal(false); setMessage('') }} style={{
                background: '#f5f5f5', border: 'none', borderRadius: '8px',
                color: '#888', cursor: 'pointer', width: '32px', height: '32px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>✕</button>
            </div>

            <div style={{ padding: '20px 24px' }}>
              {message && (
                <div style={{
                  background: message.includes('❌') ? 'rgba(215,25,32,0.08)' : 'rgba(22,163,74,0.08)',
                  color: message.includes('❌') ? '#d71920' : '#16a34a',
                  padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px'
                }}>{message}</div>
              )}

              {/* Type Selector */}
              <div style={{ marginBottom: '16px' }}>
                <label className="input-label">Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {Object.entries(TYPE_CONFIG).map(([type, config]) => (
                    <div key={type} onClick={() => setForm({ ...form, type })} style={{
                      padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                      border: `1px solid ${form.type === type ? config.color : '#e5e5e5'}`,
                      background: form.type === type ? config.bg : 'white',
                      textAlign: 'center', transition: 'all 0.15s'
                    }}>
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{config.icon}</div>
                      <div style={{
                        color: form.type === type ? config.color : '#888',
                        fontSize: '11px', fontWeight: '700'
                      }}>{config.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Title *</label>
                <input type="text" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Announcement title..."
                  className="input" />
              </div>

              {/* Body */}
              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Message *</label>
                <textarea value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Write your announcement here..."
                  rows={5}
                  style={{
                    width: '100%', padding: '12px', border: '1.5px solid #e5e5e5',
                    borderRadius: '10px', fontSize: '14px', outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                    lineHeight: '1.6', color: '#111', boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d71920'}
                  onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              {/* Preview */}
              {(form.title || form.body) && (
                <div style={{
                  background: TYPE_CONFIG[form.type]?.bg,
                  border: `1px solid ${TYPE_CONFIG[form.type]?.color}30`,
                  borderRadius: '10px', padding: '14px', marginBottom: '20px'
                }}>
                  <div style={{ color: '#888', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                    Preview
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span>{TYPE_CONFIG[form.type]?.icon}</span>
                    <span style={{ color: '#111', fontWeight: '800', fontSize: '14px' }}>{form.title}</span>
                  </div>
                  {form.body && <div style={{ color: '#555', fontSize: '13px', lineHeight: '1.6' }}>{form.body}</div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => { setShowModal(false); setMessage('') }}
                  className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={createAnnouncement}
                  className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                  📢 Send Announcement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
