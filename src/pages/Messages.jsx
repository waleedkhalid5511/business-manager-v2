import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Messages({ profile }) {
  const [activeTab, setActiveTab] = useState('dms')
  const [employees, setEmployees] = useState([])
  const [channels, setChannels] = useState([])
  const [selectedConvo, setSelectedConvo] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')
  const [showNewChannel, setShowNewChannel] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!profile) return
    fetchEmployees()
    fetchChannels()
  }, [profile])

  useEffect(() => {
    if (!selectedConvo) return
    fetchMessages()
    const cleanup = subscribeMessages()
    return cleanup
  }, [selectedConvo])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchEmployees = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('is_active', true)
      .neq('id', profile.id)
      .order('full_name')
    setEmployees(data || [])
    setLoading(false)
  }

  const fetchChannels = async () => {
    const { data } = await supabase
      .from('channels')
      .select('*')
      .order('name')
    setChannels(data || [])
  }

  const fetchMessages = async () => {
    if (!selectedConvo) return
    try {
      let data, error
      if (selectedConvo.type === 'dm') {
        const res = await supabase
          .from('messages')
          .select('*, profiles(id, full_name, role)')
          .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${selectedConvo.id}),and(sender_id.eq.${selectedConvo.id},receiver_id.eq.${profile.id})`)
          .order('created_at', { ascending: true })
        data = res.data; error = res.error
      } else {
        const res = await supabase
          .from('messages')
          .select('*, profiles(id, full_name, role)')
          .eq('channel_id', selectedConvo.id)
          .order('created_at', { ascending: true })
        data = res.data; error = res.error
      }
      if (!error) setMessages(data || [])
    } catch (e) {
      console.error('fetchMessages error:', e)
    }
  }

  const subscribeMessages = () => {
    const channelName = selectedConvo.type === 'dm'
      ? `dm-${[profile.id, selectedConvo.id].sort().join('-')}`
      : `channel-msg-${selectedConvo.id}`

    const sub = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        const relevant = selectedConvo.type === 'dm'
          ? (
            (payload.new.sender_id === profile.id && payload.new.receiver_id === selectedConvo.id) ||
            (payload.new.sender_id === selectedConvo.id && payload.new.receiver_id === profile.id)
          )
          : payload.new.channel_id === selectedConvo.id

        if (!relevant) return

        const { data } = await supabase
          .from('messages')
          .select('*, profiles(id, full_name, role)')
          .eq('id', payload.new.id)
          .single()

        if (data) {
          setMessages(prev => {
            const exists = prev.find(m => m.id === data.id)
            if (exists) return prev
            return [...prev.filter(m => !m.id?.toString().startsWith('temp')), data]
          })
        }
      })
      .subscribe()

    return () => sub.unsubscribe()
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConvo || sending) return
    setSending(true)

    const content = newMessage.trim()
    setNewMessage('')

    // Optimistic update
    const tempId = 'temp-' + Date.now()
    const optimistic = {
      id: tempId,
      content,
      sender_id: profile.id,
      receiver_id: selectedConvo.type === 'dm' ? selectedConvo.id : null,
      channel_id: selectedConvo.type === 'channel' ? selectedConvo.id : null,
      created_at: new Date().toISOString(),
      profiles: { id: profile.id, full_name: profile.full_name, role: profile.role }
    }
    setMessages(prev => [...prev, optimistic])

    try {
      const msgData = {
        content,
        sender_id: profile.id,
        receiver_id: selectedConvo.type === 'dm' ? selectedConvo.id : null,
        channel_id: selectedConvo.type === 'channel' ? selectedConvo.id : null,
      }

      const { data, error } = await supabase
        .from('messages')
        .insert(msgData)
        .select('*, profiles(id, full_name, role)')
        .single()

      if (error) {
        console.error('Send error:', error)
        setMessages(prev => prev.filter(m => m.id !== tempId))
        setNewMessage(content)
      } else if (data) {
        setMessages(prev => prev.map(m => m.id === tempId ? data : m))
      }
    } catch (e) {
      console.error('Send exception:', e)
      setMessages(prev => prev.filter(m => m.id !== tempId))
      setNewMessage(content)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const createChannel = async () => {
    if (!newChannelName.trim()) return
    const { data } = await supabase.from('channels').insert({
      name: newChannelName.trim().toLowerCase().replace(/\s+/g, '-'),
      created_by: profile.id
    }).select().single()

    if (data) {
      setChannels(prev => [...prev, data])
      setNewChannelName('')
      setShowNewChannel(false)
      selectConvo({ ...data, type: 'channel' })
    }
  }

  const selectConvo = (convo) => {
    setSelectedConvo(convo)
    setMessages([])
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const formatFullTime = (ts) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

  const roleColor = {
    admin: '#d71920', manager: '#d97706', employee: '#2563eb',
    partner: '#7c3aed', junior_editor: '#0891b2', senior_editor: '#059669',
    client_manager: '#d97706', qa_reviewer: '#7c3aed'
  }

  const filteredEmployees = employees.filter(e =>
    e.full_name?.toLowerCase().includes(search.toLowerCase())
  )
  const filteredChannels = channels.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase())
  )

  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric'
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(msg)
    return groups
  }, {})

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 104px)',
      background: 'var(--bg-card)', borderRadius: '16px',
      border: '1px solid var(--border)', overflow: 'hidden',
      boxShadow: 'var(--shadow-md)'
    }}>

      {/* ===== SIDEBAR ===== */}
      <div style={{
        width: '280px', borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)', flexShrink: 0
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '16px', marginBottom: '12px' }}>
            💬 Messages
          </h3>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input"
            style={{ padding: '8px 12px', fontSize: '13px' }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
          {[
            { id: 'dms', label: '👤 Direct' },
            { id: 'channels', label: '# Channels' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: 1, padding: '10px 8px', border: 'none',
              background: 'transparent', cursor: 'pointer',
              color: activeTab === tab.id ? '#d71920' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? '700' : '500',
              fontSize: '12px',
              borderBottom: `2px solid ${activeTab === tab.id ? '#d71920' : 'transparent'}`,
              transition: 'all 0.2s', fontFamily: 'inherit'
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            [1,2,3,4].map(i => (
              <div key={i} className="skeleton" style={{ height: '52px', borderRadius: '10px', marginBottom: '6px' }} />
            ))
          ) : activeTab === 'dms' ? (
            filteredEmployees.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No team members
              </div>
            ) : filteredEmployees.map(emp => {
              const isSelected = selectedConvo?.id === emp.id && selectedConvo?.type === 'dm'
              const color = roleColor[emp.role] || '#888'
              return (
                <div key={emp.id}
                  onClick={() => selectConvo({ ...emp, type: 'dm' })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    background: isSelected ? 'rgba(215,25,32,0.08)' : 'transparent',
                    border: `1px solid ${isSelected ? 'rgba(215,25,32,0.15)' : 'transparent'}`,
                    marginBottom: '2px', transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: `${color}18`, color,
                    border: `2px solid ${color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: '800', fontSize: '14px', flexShrink: 0, position: 'relative'
                  }}>
                    {emp.full_name?.charAt(0).toUpperCase()}
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: '9px', height: '9px', borderRadius: '50%',
                      background: '#16a34a', border: '2px solid var(--bg-card)'
                    }} />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{
                      color: isSelected ? '#d71920' : 'var(--text-primary)',
                      fontWeight: '600', fontSize: '13px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {emp.full_name}
                    </div>
                    <div style={{ color, fontSize: '10px', fontWeight: '600', textTransform: 'capitalize' }}>
                      {emp.role?.replace('_', ' ')}
                    </div>
                  </div>
                  {isSelected && (
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d71920', flexShrink: 0 }} />
                  )}
                </div>
              )
            })
          ) : (
            <>
              {showNewChannel ? (
                <div style={{ padding: '8px', marginBottom: '4px' }}>
                  <input
                    type="text"
                    placeholder="channel-name"
                    value={newChannelName}
                    onChange={e => setNewChannelName(e.target.value)}
                    className="input"
                    style={{ marginBottom: '6px', fontSize: '13px', padding: '8px 12px' }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') createChannel()
                      if (e.key === 'Escape') setShowNewChannel(false)
                    }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={createChannel} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>Create</button>
                    <button onClick={() => setShowNewChannel(false)} className="btn btn-secondary btn-sm">✕</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowNewChannel(true)} style={{
                  width: '100%', padding: '9px 12px',
                  border: '1px dashed var(--border)', borderRadius: '10px',
                  background: 'transparent', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                  marginBottom: '6px', display: 'flex', alignItems: 'center',
                  gap: '6px', transition: 'all 0.2s', fontFamily: 'inherit'
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#d71920'; e.currentTarget.style.color = '#d71920' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                >
                  + New Channel
                </button>
              )}

              {filteredChannels.map(channel => {
                const isSelected = selectedConvo?.id === channel.id && selectedConvo?.type === 'channel'
                return (
                  <div key={channel.id}
                    onClick={() => selectConvo({ ...channel, type: 'channel' })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                      background: isSelected ? 'rgba(215,25,32,0.08)' : 'transparent',
                      border: `1px solid ${isSelected ? 'rgba(215,25,32,0.15)' : 'transparent'}`,
                      marginBottom: '2px', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: '34px', height: '34px', borderRadius: '10px',
                      background: isSelected ? 'rgba(215,25,32,0.1)' : 'var(--bg-hover)',
                      color: isSelected ? '#d71920' : 'var(--text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '800', fontSize: '15px', flexShrink: 0
                    }}>
                      #
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{
                        color: isSelected ? '#d71920' : 'var(--text-primary)',
                        fontWeight: '600', fontSize: '13px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                      }}>
                        {channel.name}
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {/* ===== CHAT AREA ===== */}
      {!selectedConvo ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)'
        }}>
          <div style={{ fontSize: '56px', marginBottom: '16px', opacity: 0.2, animation: 'float 3s ease infinite' }}>💬</div>
          <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            Select a conversation
          </div>
          <div style={{ fontSize: '13px' }}>
            Choose a person or channel to start messaging
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

          {/* Chat Header */}
          <div style={{
            padding: '14px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'var(--bg-card)', flexShrink: 0
          }}>
            {selectedConvo.type === 'dm' ? (
              <>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '50%',
                  background: `${roleColor[selectedConvo.role] || '#d71920'}18`,
                  color: roleColor[selectedConvo.role] || '#d71920',
                  border: `2px solid ${roleColor[selectedConvo.role] || '#d71920'}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '800', fontSize: '16px', position: 'relative', flexShrink: 0
                }}>
                  {selectedConvo.full_name?.charAt(0).toUpperCase()}
                  <div style={{
                    position: 'absolute', bottom: 0, right: 0,
                    width: '11px', height: '11px', borderRadius: '50%',
                    background: '#16a34a', border: '2px solid var(--bg-card)'
                  }} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>
                    {selectedConvo.full_name}
                  </div>
                  <div style={{ color: '#16a34a', fontSize: '11px', fontWeight: '600' }}>● Online</div>
                </div>
              </>
            ) : (
              <>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px',
                  background: 'rgba(215,25,32,0.1)', color: '#d71920',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '800', fontSize: '20px', flexShrink: 0
                }}>
                  #
                </div>
                <div>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '800', fontSize: '15px' }}>
                    {selectedConvo.name}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Team Channel</div>
                </div>
              </>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {messages.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: '12px'
              }}>
                <div style={{ fontSize: '44px', opacity: 0.2 }}>💬</div>
                <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                  {selectedConvo.type === 'dm'
                    ? `Start a conversation with ${selectedConvo.full_name}`
                    : `Welcome to #${selectedConvo.name}!`
                  }
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Messages are end-to-end and real-time
                </div>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([date, dayMessages]) => (
                <div key={date}>
                  {/* Date Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0 16px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                    <span style={{
                      color: 'var(--text-muted)', fontSize: '11px', fontWeight: '700',
                      background: 'var(--bg-card)', padding: '3px 12px',
                      borderRadius: '20px', border: '1px solid var(--border)',
                      whiteSpace: 'nowrap'
                    }}>
                      {date}
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  </div>

                  {dayMessages.map((msg, idx) => {
                    const isOwn = msg.sender_id === profile.id
                    const prevMsg = idx > 0 ? dayMessages[idx - 1] : null
                    const showAvatar = !prevMsg || prevMsg.sender_id !== msg.sender_id
                    const showName = showAvatar && !isOwn && selectedConvo.type === 'channel'
                    const isTemp = msg.id?.toString().startsWith('temp')

                    return (
                      <div key={msg.id} style={{
                        display: 'flex',
                        flexDirection: isOwn ? 'row-reverse' : 'row',
                        alignItems: 'flex-end',
                        gap: '8px',
                        marginBottom: showAvatar ? '10px' : '3px',
                      }}>
                        {/* Avatar space */}
                        <div style={{ width: '30px', flexShrink: 0 }}>
                          {showAvatar && !isOwn && (
                            <div style={{
                              width: '30px', height: '30px', borderRadius: '50%',
                              background: `${roleColor[msg.profiles?.role] || '#888'}18`,
                              color: roleColor[msg.profiles?.role] || '#888',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: '800', fontSize: '12px',
                              border: `1.5px solid ${roleColor[msg.profiles?.role] || '#888'}25`
                            }}>
                              {msg.profiles?.full_name?.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div style={{
                          maxWidth: '65%', display: 'flex',
                          flexDirection: 'column',
                          alignItems: isOwn ? 'flex-end' : 'flex-start'
                        }}>
                          {showName && (
                            <div style={{
                              color: roleColor[msg.profiles?.role] || 'var(--text-muted)',
                              fontSize: '11px', fontWeight: '700',
                              marginBottom: '3px', paddingLeft: '4px'
                            }}>
                              {msg.profiles?.full_name}
                            </div>
                          )}

                          {/* Bubble */}
                          <div style={{
                            padding: '10px 14px',
                            borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                            background: isOwn
                              ? 'linear-gradient(135deg, #d71920, #b5151b)'
                              : 'var(--bg-hover)',
                            color: isOwn ? 'white' : 'var(--text-primary)',
                            fontSize: '14px', lineHeight: '1.55',
                            wordBreak: 'break-word',
                            border: isOwn ? 'none' : '1px solid var(--border)',
                            boxShadow: isOwn
                              ? '0 3px 10px rgba(215,25,32,0.2)'
                              : 'var(--shadow-sm)',
                            opacity: isTemp ? 0.65 : 1,
                            transition: 'opacity 0.3s'
                          }}>
                            {msg.content}
                          </div>

                          {/* Time */}
                          <div style={{
                            color: 'var(--text-muted)', fontSize: '10px',
                            marginTop: '3px', paddingLeft: '4px', paddingRight: '4px'
                          }}>
                            {formatFullTime(msg.created_at)}
                            {isTemp && ' ⏳'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-card)',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'flex-end',
              background: 'var(--bg-hover)', borderRadius: '14px',
              border: '1.5px solid var(--border)',
              padding: '10px 14px', transition: 'border-color 0.2s'
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = '#d71920'}
              onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={e => {
                  setNewMessage(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder={selectedConvo.type === 'dm'
                  ? `Message ${selectedConvo.full_name}...`
                  : `Message #${selectedConvo.name}...`
                }
                rows={1}
                style={{
                  flex: 1, border: 'none', outline: 'none',
                  resize: 'none', background: 'transparent',
                  color: 'var(--text-primary)', fontSize: '14px',
                  lineHeight: '1.5', fontFamily: 'inherit',
                  maxHeight: '120px', overflowY: 'auto'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                style={{
                  width: '38px', height: '38px', borderRadius: '10px',
                  background: newMessage.trim()
                    ? 'linear-gradient(135deg, #d71920, #b5151b)'
                    : 'var(--border)',
                  border: 'none',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '18px', flexShrink: 0,
                  transition: 'all 0.2s',
                  boxShadow: newMessage.trim() ? 'var(--shadow-red)' : 'none',
                  transform: newMessage.trim() ? 'scale(1)' : 'scale(0.9)'
                }}
              >
                {sending
                  ? <span className="animate-spin" style={{ fontSize: '14px' }}>⟳</span>
                  : '↑'
                }
              </button>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '6px', textAlign: 'center' }}>
              Enter to send · Shift+Enter for new line
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
