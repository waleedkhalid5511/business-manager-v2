import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const TYPE_CONFIG = {
  info: { color: '#2563eb', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.2)', icon: 'ℹ️', label: 'Info' },
  warning: { color: '#d97706', bg: 'rgba(217,119,6,0.08)', border: 'rgba(217,119,6,0.2)', icon: '⚠️', label: 'Warning' },
  success: { color: '#16a34a', bg: 'rgba(22,163,74,0.08)', border: 'rgba(22,163,74,0.2)', icon: '✅', label: 'Success' },
  urgent: { color: '#d71920', bg: 'rgba(215,25,32,0.08)', border: 'rgba(215,25,32,0.2)', icon: '🚨', label: 'Urgent' },
}

export default function Announcements({ profile }) {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ title: '', body: '', type: 'info' })
  const [saving, setSaving] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (!profile) return
    fetchAnnouncements()

    const sub = supabase
      .channel(`announcements-live-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchAnnouncements())
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
      console.error('fetchAnnouncements:', e)
    } finally {
      setLoading(false)
    }
  }

  const createAnnouncement = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setMessage('❌ Title and message required!')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('announcements').insert({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        created_by: profile.id,
        is_active: true
      })
      if (error) throw error
      setMessage('✅ Announcement posted!')
      setForm({ title: '', body: '', type: 'info' })
      setShowModal(false)
      fetchAnnouncements()
    } catch (e) {
      setMessage('❌ ' + e.message)
    } finally {
      setSaving(false)
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

  const formatTime = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = now - d
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const activeAnnouncements = announcements.filter(a => a.is_active)
  const inactiveAnnouncements = announcements.filter(a => !a.is_active)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ color: '#111', margin: '0 0 4px', fontSize: '20px', fontWeight: '800' }}>
            📢 Announcements
          </h2>
          <p style={{ color: '#888', margin: 0, fontSize: '13px' }}>
            {activeAnnouncements.length} active · {announcements.length} total
          </p>
        </div>
        {(isAdmin || isManager) && (
          <button onClick={() => setShowModal(true)} className="btn btn-primary btn-sm">
            + New Announcement
          </button>
        )}
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

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '12px' }} />)}
        </div>
      ) : announcements.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-icon">📢</div>
          <div className="empty-title">No announcements yet</div>
          <div className="empty-desc">Post company-wide announcements here</div>
          {(isAdmin || isManager) && (
            <button onClick={() => setShowModal(true)} className="btn btn-primary" style={{ marginTop: '12px' }}>
              + Post Announcement
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Active Announcements */}
          {activeAnnouncements.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ color: '#888', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                Active — {activeAnnouncements.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeAnnouncements.map(ann => {
                  const config = TYPE_CONFIG[ann.type] || TYPE_CONFIG.info
                  return (
                    <div key={ann.id} style={{
                      background: 'white', borderRadius: '14px',
                      border: `1px solid ${config.border}`,
                      borderLeft: `4px solid ${config.color}`,
                      overflow: 'hidden',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                    }}>
                      {/* Top bar for urgent */}
                      {ann.type === 'urgent' && (
                        <div style={{
                          background: config.color, padding: '6px 20px',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                          <span style={{ fontSize: '12px' }}>🚨</span>
                          <span style={{ color: 'white', fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase' }}>
                            URGENT ANNOUNCEMENT
                          </span>
                        </div>
                      )}

                      <div style={{ padding: '18px 20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                            <div style={{
                              width: '36px', height: '36px', borderRadius: '10px',
                              background: config.bg, display: 'flex', alignItems: 'center',
                              justifyContent: 'center', fontSize: '18px', flexShrink: 0
                            }}>
                              {config.icon}
                            </div>
                            <div>
                              <h3 style={{ color: '#111', margin: 0, fontSize: '16px', fontWeight: '800' }}>
                                {ann.title}
                              </h3>
                              <div style={{ display: 'flex', gap: '8px', marginTop: '3px', alignItems: 'center' }}>
                                <span style={{
                                  background: config.bg, color: config.color,
                                  padding: '1px 8px', borderRadius: '20px',
                                  fontSize: '10px', fontWeight: '800', textTransform: 'uppercase'
                                }}>
                                  {config.label}
                                </span>
                                <span style={{ color: '#aaa', fontSize: '12px' }}>
                                  {ann.profiles?.full_name} · {formatTime(ann.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {(isAdmin || isManager) && (
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <button onClick={() => toggleActive(ann)} style={{
                                background: 'rgba(215,25,32,0.08)', color: '#d71920',
                                border: '1px solid rgba(215,25,32,0.2)',
                                borderRadius: '8px', padding: '5px 10px',
                                cursor: 'pointer', fontSize: '11px', fontWeight: '700'
                              }}>
                                Archive
                              </button>
                              <button onClick={() => deleteAnnouncement(ann.id)} style={{
                                background: '#f5f5f5', color: '#888',
                                border: '1px solid #e5e5e5',
                                borderRadius: '8px', padding: '5px 10px',
                                cursor: 'pointer', fontSize: '11px', fontWeight: '700'
                              }}>
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>

                        <div style={{
                          color: '#444', fontSize: '14px', lineHeight: '1.7',
                          whiteSpace: 'pre-wrap', marginLeft: '46px'
                        }}>
                          {ann.body}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Archived/Inactive */}
          {(isAdmin || isManager) && inactiveAnnouncements.length > 0 && (
            <div>
              <div style={{ color: '#bbb', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                Archived — {inactiveAnnouncements.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {inactiveAnnouncements.map(ann => {
                  const config = TYPE_CONFIG[ann.type] || TYPE_CONFIG.info
                  return (
                    <div key={ann.id} style={{
                      background: 'white', borderRadius: '10px',
                      border: '1px solid #e5e5e5',
                      padding: '14px 16px', opacity: 0.6,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{config.icon}</span>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ color: '#888', fontWeight: '700', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ann.title}
                          </div>
                          <div style={{ color: '#bbb', fontSize: '11px' }}>
                            {formatTime(ann.created_at)}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => toggleActive(ann)} style={{
                          background: 'rgba(22,163,74,0.08)', color: '#16a34a',
                          border: '1px solid rgba(22,163,74,0.2)',
                          borderRadius: '8px', padding: '5px 10px',
                          cursor: 'pointer', fontSize: '11px', fontWeight: '700'
                        }}>
                          Restore
                        </button>
                        <button onClick={() => deleteAnnouncement(ann.id)} style={{
                          background: '#f5f5f5', color: '#888',
                          border: '1px solid #e5e5e5', borderRadius: '8px',
                          padding: '5px 8px', cursor: 'pointer', fontSize: '11px'
                        }}>
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
              <button onClick={() => setShowModal(false)} style={{
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
                  {Object.entries(TYPE_CONFIG).map(([key, config]) => (
                    <div key={key} onClick={() => setForm({ ...form, type: key })} style={{
                      padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                      border: `1px solid ${form.type === key ? config.color : '#e5e5e5'}`,
                      background: form.type === key ? config.bg : 'white',
                      textAlign: 'center', transition: 'all 0.15s'
                    }}>
                      <div style={{ fontSize: '20px', marginBottom: '4px' }}>{config.icon}</div>
                      <div style={{ color: form.type === key ? config.color : '#888', fontSize: '11px', fontWeight: '700' }}>
                        {config.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Title *</label>
                <input type="text" value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Announcement title..." className="input" />
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
                    resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', color: '#111',
                    lineHeight: '1.6'
                  }}
                  onFocus={e => e.target.style.borderColor = '#d71920'}
                  onBlur={e => e.target.style.borderColor = '#e5e5e5'}
                />
              </div>

              {/* Preview */}
              {(form.title || form.body) && (
                <div style={{
                  background: TYPE_CONFIG[form.type]?.bg,
                  border: `1px solid ${TYPE_CONFIG[form.type]?.border}`,
                  borderLeft: `4px solid ${TYPE_CONFIG[form.type]?.color}`,
                  borderRadius: '10px', padding: '14px', marginBottom: '20px'
                }}>
                  <div style={{ color: '#888', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                    Preview
                  </div>
                  {form.title && <div style={{ color: '#111', fontWeight: '800', fontSize: '15px', marginBottom: '4px' }}>{form.title}</div>}
                  {form.body && <div style={{ color: '#444', fontSize: '13px', lineHeight: '1.6' }}>{form.body}</div>}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancel
                </button>
                <button onClick={createAnnouncement} disabled={saving} className="btn btn-primary" style={{
                  flex: 2, justifyContent: 'center', opacity: saving ? 0.7 : 1
                }}>
                  {saving ? '⟳ Posting...' : '📢 Post Announcement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
