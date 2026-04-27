import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Messages({ profile }) {
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelDesc, setNewChannelDesc] = useState('')
  const [search, setSearch] = useState('')
  const [pinnedMessages, setPinnedMessages] = useState([])
  const [showPinned, setShowPinned] = useState(false)
  const [members, setMembers] = useState([])
  const [showMembers, setShowMembers] = useState(false)
  const [editingMessage, setEditingMessage] = useState(null)
  const [editContent, setEditContent] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (profile) {
      fetchChannels()
      fetchMembers()
    }
  }, [profile])

  useEffect(() => {
    if (!activeChannel) return

    fetchMessages()
    fetchPinnedMessages()

    // ⚡ REALTIME
    const sub = supabase
      .channel(`messages-live-${activeChannel.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public',
        table: 'messages',
        filter: `channel_id=eq.${activeChannel.id}`
      }, () => {
        fetchMessages()
        fetchPinnedMessages()
      })
      .subscribe()

    return () => sub.unsubscribe()
  }, [activeChannel])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchChannels = async () => {
    const { data } = await supabase
      .from('channels').select('*')
      .order('created_at', { ascending: true })
    setChannels(data || [])
    if (data && data.length > 0 && !activeChannel) setActiveChannel(data[0])
  }

  const fetchMessages = async () => {
    if (!activeChannel) return
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name, role, avatar_url)')
      .eq('channel_id', activeChannel.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
  }

  const fetchPinnedMessages = async () => {
    if (!activeChannel) return
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name)')
      .eq('channel_id', activeChannel.id)
      .eq('is_edited', true)
      .order('created_at', { ascending: false })
      .limit(10)
    setPinnedMessages(data || [])
  }

  const fetchMembers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .eq('is_active', true)
    setMembers(data || [])
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChannel) return
    setSending(true)
    await supabase.from('messages').insert({
      channel_id: activeChannel.id,
      sender_id: profile.id,
      content: newMessage.trim()
    })
    setNewMessage('')
    setSending(false)
  }

  const deleteMessage = async (msgId) => {
    await supabase.from('messages').delete().eq('id', msgId)
  }

  const pinMessage = async (msg) => {
    await supabase.from('messages')
      .update({ is_edited: !msg.is_edited })
      .eq('id', msg.id)
  }

  const startEdit = (msg) => {
    setEditingMessage(msg.id)
    setEditContent(msg.content)
  }

  const saveEdit = async (msgId) => {
    if (!editContent.trim()) return
    await supabase.from('messages')
      .update({ content: editContent.trim() })
      .eq('id', msgId)
    setEditingMessage(null)
    setEditContent('')
  }

  const createChannel = async () => {
    if (!newChannelName.trim()) return
    const { data } = await supabase.from('channels').insert({
      name: newChannelName.toLowerCase().replace(/\s+/g, '-'),
      description: newChannelDesc,
      created_by: profile.id
    }).select().single()
    setNewChannelName('')
    setNewChannelDesc('')
    setShowNewChannel(false)
    fetchChannels()
    if (data) setActiveChannel(data)
  }

  const deleteChannel = async (channelId) => {
    if (!window.confirm('Delete this channel and all messages?')) return
    await supabase.from('messages').delete().eq('channel_id', channelId)
    await supabase.from('channels').delete().eq('id', channelId)
    setActiveChannel(null)
    fetchChannels()
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  })

  const formatDate = (ts) => {
    const date = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }

  const roleColor = {
    admin: '#ef4444', manager: '#f59e0b',
    employee: '#3b82f6', partner: '#8b5cf6', client: '#10b981'
  }

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toDateString()
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  const filteredMessages = search
    ? messages.filter(m => m.content?.toLowerCase().includes(search.toLowerCase()))
    : null

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 104px)',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid var(--border)',
      background: 'var(--bg-secondary)'
    }}>
      {/* SIDEBAR */}
      <div style={{
        width: '240px', background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>Workspace</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <div className="status-dot online" style={{ width: '6px', height: '6px' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{members.length} members</span>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
          <input type="text" placeholder="🔍 Search messages..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '7px 10px', background: 'var(--bg-hover)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Channels List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 16px 6px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Channels
            </span>
            {(isAdmin || isManager) && (
              <button onClick={() => setShowNewChannel(true)} className="btn-icon" style={{ fontSize: '18px', padding: '2px 6px' }}>+</button>
            )}
          </div>

          {channels.map(channel => (
            <div key={channel.id} style={{ position: 'relative' }}>
              <button onClick={() => { setActiveChannel(channel); setShowMembers(false) }} style={{
                width: '100%', padding: '7px 16px',
                background: activeChannel?.id === channel.id ? 'rgba(59,130,246,0.12)' : 'transparent',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: 'background 0.15s'
              }}>
                <span style={{ color: activeChannel?.id === channel.id ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '14px', fontWeight: '500' }}>#</span>
                <span style={{
                  color: activeChannel?.id === channel.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontSize: '14px', fontWeight: activeChannel?.id === channel.id ? '600' : '400',
                  flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  {channel.name}
                </span>
                {activeChannel?.id === channel.id && isAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); deleteChannel(channel.id) }} style={{
                    background: 'transparent', border: 'none', color: 'var(--text-muted)',
                    cursor: 'pointer', fontSize: '12px', padding: '2px', opacity: 0.6
                  }}>🗑️</button>
                )}
              </button>
            </div>
          ))}

          {/* Members Section */}
          <div style={{ padding: '12px 16px 6px', marginTop: '8px', borderTop: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Members
            </span>
          </div>
          {members.slice(0, 8).map(member => (
            <div key={member.id} style={{ padding: '5px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative' }}>
                <div className="avatar" style={{
                  width: '24px', height: '24px', fontSize: '10px',
                  background: `${roleColor[member.role] || '#3b82f6'}33`,
                  color: roleColor[member.role] || '#3b82f6',
                  border: `1px solid ${roleColor[member.role] || '#3b82f6'}50`
                }}>
                  {member.full_name?.charAt(0).toUpperCase()}
                </div>
                <div className="status-dot online" style={{
                  position: 'absolute', bottom: '-1px', right: '-1px',
                  width: '7px', height: '7px', border: '1.5px solid var(--bg-secondary)'
                }} />
              </div>
              <span style={{
                color: member.id === profile.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {member.full_name}
                {member.id === profile.id && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}> (you)</span>}
              </span>
            </div>
          ))}
        </div>

        {/* My Profile */}
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <div className="avatar avatar-sm" style={{
              background: `${roleColor[profile?.role] || '#3b82f6'}33`,
              color: roleColor[profile?.role] || '#3b82f6',
              border: `1px solid ${roleColor[profile?.role] || '#3b82f6'}50`
            }}>
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="status-dot online" style={{
              position: 'absolute', bottom: '-1px', right: '-1px',
              width: '8px', height: '8px', border: '2px solid var(--bg-secondary)'
            }} />
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name}
            </div>
            <div style={{ color: roleColor[profile?.role] || 'var(--text-muted)', fontSize: '10px', textTransform: 'capitalize' }}>
              {profile?.role}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CHAT */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div style={{
              height: '56px', padding: '0 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)',
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '20px', fontWeight: '300' }}>#</span>
                <div>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '15px' }}>
                    {activeChannel.name}
                  </span>
                  {activeChannel.description && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '10px' }}>
                      {activeChannel.description}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button onClick={() => setShowMembers(!showMembers)} className="btn-icon" style={{ fontSize: '14px', gap: '5px', padding: '6px 10px' }}>
                  👥 <span style={{ fontSize: '12px' }}>{members.length}</span>
                </button>
                <button onClick={() => setShowPinned(!showPinned)} className="btn-icon" style={{
                  fontSize: '14px', padding: '6px 10px',
                  background: showPinned ? 'var(--bg-hover)' : 'transparent',
                  color: showPinned ? 'var(--accent-yellow)' : 'var(--text-muted)'
                }}>
                  📌
                  {pinnedMessages.length > 0 && (
                    <span style={{
                      background: 'var(--accent-yellow)', color: 'black',
                      borderRadius: '10px', padding: '1px 5px',
                      fontSize: '10px', fontWeight: '700', marginLeft: '2px'
                    }}>{pinnedMessages.length}</span>
                  )}
                </button>
                <div style={{ width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{messages.length} msgs</span>
              </div>
            </div>

            {/* Pinned Messages */}
            {showPinned && pinnedMessages.length > 0 && (
              <div style={{
                background: 'rgba(245,158,11,0.05)', borderBottom: '1px solid rgba(245,158,11,0.2)',
                padding: '12px 20px', flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '14px' }}>📌</span>
                  <span style={{ color: 'var(--accent-yellow)', fontSize: '12px', fontWeight: '700' }}>
                    Pinned Messages ({pinnedMessages.length})
                  </span>
                </div>
                {pinnedMessages.map(msg => (
                  <div key={msg.id} style={{
                    background: 'var(--bg-hover)', borderRadius: '8px', padding: '8px 12px',
                    marginBottom: '6px', borderLeft: '3px solid var(--accent-yellow)'
                  }}>
                    <span style={{ color: 'var(--accent-yellow)', fontSize: '11px', fontWeight: '700' }}>{msg.profiles?.full_name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', marginLeft: '8px' }}>{msg.content}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Search Results */}
            {search && filteredMessages && (
              <div style={{
                background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)',
                padding: '12px 20px', maxHeight: '200px', overflowY: 'auto', flexShrink: 0
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '8px' }}>
                  {filteredMessages.length} results for "{search}"
                </div>
                {filteredMessages.map(msg => (
                  <div key={msg.id} style={{ background: 'var(--bg-card)', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px' }}>
                    <div style={{ color: 'var(--accent-blue)', fontSize: '11px', marginBottom: '3px', fontWeight: '700' }}>
                      {msg.profiles?.full_name} · {formatTime(msg.created_at)}
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '16px 20px',
              display: 'flex', flexDirection: 'column'
            }}>
              {messages.length === 0 ? (
                <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
                  <div style={{ fontSize: '48px', marginBottom: '8px' }}>#{activeChannel.name}</div>
                  <div className="empty-title">Welcome to #{activeChannel.name}!</div>
                  <div className="empty-desc">{activeChannel.description || 'Start the conversation!'}</div>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    {/* Date Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                      <span style={{
                        color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700',
                        background: 'var(--bg-hover)', padding: '3px 12px',
                        borderRadius: '20px', border: '1px solid var(--border)', whiteSpace: 'nowrap'
                      }}>
                        {formatDate(msgs[0].created_at)}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    </div>

                    {msgs.map((msg, idx) => {
                      const isOwn = msg.sender_id === profile?.id
                      const prevMsg = msgs[idx - 1]
                      const showHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id ||
                        (new Date(msg.created_at) - new Date(prevMsg.created_at)) > 5 * 60 * 1000

                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: 'flex',
                            flexDirection: isOwn ? 'row-reverse' : 'row',
                            gap: '8px',
                            marginBottom: showHeader ? '12px' : '3px',
                            alignItems: 'flex-end'
                          }}
                          onMouseEnter={e => {
                            const actions = e.currentTarget.querySelector('.msg-actions')
                            if (actions) actions.style.opacity = '1'
                          }}
                          onMouseLeave={e => {
                            const actions = e.currentTarget.querySelector('.msg-actions')
                            if (actions) actions.style.opacity = '0'
                          }}
                        >
                          {/* Avatar */}
                          {showHeader ? (
                            <div className="avatar" style={{
                              width: '32px', height: '32px', fontSize: '13px',
                              background: `${roleColor[msg.profiles?.role] || '#3b82f6'}33`,
                              color: roleColor[msg.profiles?.role] || '#3b82f6',
                              border: `1px solid ${roleColor[msg.profiles?.role] || '#3b82f6'}40`,
                              flexShrink: 0, alignSelf: 'flex-end'
                            }}>
                              {msg.profiles?.full_name?.charAt(0).toUpperCase()}
                            </div>
                          ) : (
                            <div style={{ width: '32px', flexShrink: 0 }} />
                          )}

                          <div style={{ maxWidth: '65%', minWidth: 0 }}>
                            {/* Name + Time */}
                            {showHeader && (
                              <div style={{
                                display: 'flex', alignItems: 'baseline', gap: '8px',
                                marginBottom: '4px',
                                flexDirection: isOwn ? 'row-reverse' : 'row'
                              }}>
                                <span style={{
                                  color: roleColor[msg.profiles?.role] || 'var(--accent-blue)',
                                  fontSize: '13px', fontWeight: '700'
                                }}>
                                  {isOwn ? 'You' : msg.profiles?.full_name}
                                </span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                  {formatTime(msg.created_at)}
                                </span>
                                {msg.is_edited && (
                                  <span style={{ color: 'var(--accent-yellow)', fontSize: '10px', fontWeight: '700' }}>📌</span>
                                )}
                              </div>
                            )}

                            {/* Bubble */}
                            {editingMessage === msg.id ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  onKeyPress={(e) => e.key === 'Enter' && saveEdit(msg.id)}
                                  style={{
                                    flex: 1, padding: '8px 12px', background: 'var(--bg-hover)',
                                    border: '1px solid var(--accent-blue)', borderRadius: '8px',
                                    color: 'var(--text-primary)', fontSize: '13px', outline: 'none'
                                  }} autoFocus />
                                <button onClick={() => saveEdit(msg.id)} className="btn btn-primary btn-sm">Save</button>
                                <button onClick={() => setEditingMessage(null)} className="btn btn-secondary btn-sm">✕</button>
                              </div>
                            ) : (
                              <div style={{
                                padding: '10px 14px',
                                background: isOwn
                                  ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : 'var(--bg-card)',
                                border: isOwn ? 'none' : '1px solid var(--border)',
                                borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                color: 'white',
                                fontSize: '14px', lineHeight: '1.5',
                                wordBreak: 'break-word',
                                display: 'inline-block',
                                maxWidth: '100%'
                              }}>
                                {msg.content}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="msg-actions" style={{
                            display: 'flex', gap: '2px',
                            opacity: 0, transition: 'opacity 0.15s',
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: '8px', padding: '3px',
                            boxShadow: 'var(--shadow-md)',
                            alignSelf: 'center'
                          }}>
                            {(isAdmin || isManager) && (
                              <button onClick={() => pinMessage(msg)} className="btn-icon" style={{
                                fontSize: '12px', padding: '3px 6px',
                                color: msg.is_edited ? 'var(--accent-yellow)' : 'var(--text-muted)'
                              }}>📌</button>
                            )}
                            {isOwn && (
                              <button onClick={() => startEdit(msg)} className="btn-icon" style={{ fontSize: '12px', padding: '3px 6px' }}>✏️</button>
                            )}
                            {(isOwn || isAdmin) && (
                              <button onClick={() => deleteMessage(msg.id)} className="btn-icon" style={{ fontSize: '12px', padding: '3px 6px', color: 'var(--accent-red)' }}>🗑️</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div style={{
              padding: '12px 16px', borderTop: '1px solid var(--border)',
              background: 'var(--bg-secondary)', flexShrink: 0
            }}>
              <div style={{
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                borderRadius: '12px', display: 'flex', alignItems: 'center', overflow: 'hidden'
              }}>
                <input
                  ref={inputRef}
                  type="text" value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={`Message #${activeChannel.name}...`}
                  style={{
                    flex: 1, padding: '13px 16px', background: 'transparent',
                    border: 'none', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                  }}
                />
                <button onClick={sendMessage} disabled={sending || !newMessage.trim()} style={{
                  width: '38px', height: '38px', margin: '4px 8px 4px 0',
                  borderRadius: '8px', border: 'none',
                  background: sending || !newMessage.trim() ? 'var(--border)' : 'var(--accent-blue)',
                  color: sending || !newMessage.trim() ? 'var(--text-muted)' : 'white',
                  cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', transition: 'all 0.2s'
                }}>➤</button>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px', paddingLeft: '4px' }}>
                Press <kbd style={{
                  background: 'var(--bg-hover)', border: '1px solid var(--border)',
                  borderRadius: '3px', padding: '1px 5px', fontSize: '10px'
                }}>Enter</kbd> to send
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-icon">💬</div>
            <div className="empty-title">Select a channel</div>
            <div className="empty-desc">Choose a channel to start messaging</div>
          </div>
        )}
      </div>

      {/* Members Panel */}
      {showMembers && (
        <div style={{
          width: '220px', background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', flexShrink: 0
        }}>
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>
              Members ({members.length})
            </span>
            <button onClick={() => setShowMembers(false)} className="btn-icon" style={{ fontSize: '14px' }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
            {['admin', 'manager', 'employee', 'partner'].map(role => {
              const roleMembers = members.filter(m => m.role === role)
              if (!roleMembers.length) return null
              return (
                <div key={role} style={{ marginBottom: '16px' }}>
                  <div style={{
                    color: 'var(--text-muted)', fontSize: '10px', fontWeight: '700',
                    textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px', marginBottom: '6px'
                  }}>
                    {role}s — {roleMembers.length}
                  </div>
                  {roleMembers.map(member => (
                    <div key={member.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '7px 8px', borderRadius: '8px', cursor: 'pointer',
                      transition: 'background 0.15s'
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ position: 'relative' }}>
                        <div className="avatar avatar-sm" style={{
                          background: `${roleColor[member.role] || '#3b82f6'}33`,
                          color: roleColor[member.role] || '#3b82f6',
                          border: `1px solid ${roleColor[member.role] || '#3b82f6'}40`
                        }}>
                          {member.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="status-dot online" style={{
                          position: 'absolute', bottom: '-1px', right: '-1px',
                          width: '8px', height: '8px', border: '2px solid var(--bg-secondary)'
                        }} />
                      </div>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{
                          color: 'var(--text-primary)', fontSize: '13px',
                          fontWeight: member.id === profile.id ? '700' : '400',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {member.full_name}
                          {member.id === profile.id && <span style={{ color: 'var(--text-muted)', fontWeight: '400', fontSize: '11px' }}> you</span>}
                        </div>
                        <div style={{ color: roleColor[member.role] || 'var(--text-muted)', fontSize: '10px', textTransform: 'capitalize' }}>
                          {member.role}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* New Channel Modal */}
      {showNewChannel && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '420px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '17px', fontWeight: '700' }}>Create Channel</h3>
              <button onClick={() => setShowNewChannel(false)} className="btn-icon">✕</button>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label className="input-label">Channel Name</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '18px' }}>#</span>
                  <input type="text" value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. design-team" className="input" style={{ flex: 1 }}
                    onKeyPress={(e) => e.key === 'Enter' && createChannel()} />
                </div>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label className="input-label">Description (Optional)</label>
                <input type="text" value={newChannelDesc}
                  onChange={(e) => setNewChannelDesc(e.target.value)}
                  placeholder="What is this channel about?" className="input" />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowNewChannel(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button onClick={createChannel} className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Create Channel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
