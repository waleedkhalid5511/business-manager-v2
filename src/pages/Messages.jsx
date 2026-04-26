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
  const [unreadCounts, setUnreadCounts] = useState({})
  const messagesEndRef = useRef(null)
  const isAdmin = profile?.role === 'admin'
  const isManager = profile?.role === 'manager'

  useEffect(() => {
    if (profile) fetchChannels()
  }, [profile])

  useEffect(() => {
    if (activeChannel) {
      fetchMessages()
      fetchPinnedMessages()
      const subscription = supabase
        .channel(`messages-${activeChannel.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${activeChannel.id}`
        }, () => fetchMessages())
        .subscribe()
      return () => subscription.unsubscribe()
    }
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

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeChannel) return
    setSending(true)
    await supabase.from('messages').insert({
      channel_id: activeChannel.id,
      sender_id: profile.id,
      content: newMessage.trim()
    })
    setNewMessage('')
    fetchMessages()
    setSending(false)
  }

  const deleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message?')) return
    await supabase.from('messages').delete().eq('id', msgId)
    fetchMessages()
  }

  const pinMessage = async (msg) => {
    await supabase.from('messages').update({ is_edited: !msg.is_edited }).eq('id', msg.id)
    fetchMessages()
    fetchPinnedMessages()
  }

  const createChannel = async () => {
    if (!newChannelName.trim()) return
    await supabase.from('channels').insert({
      name: newChannelName.toLowerCase().replace(/\s+/g, '-'),
      description: newChannelDesc,
      created_by: profile.id
    })
    setNewChannelName('')
    setNewChannelDesc('')
    setShowNewChannel(false)
    fetchChannels()
  }

  const deleteChannel = async (channelId) => {
    if (!window.confirm('Delete this channel?')) return
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

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })

  const formatDate = (ts) => {
    const date = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })
  }

  const roleColor = (role) => {
    if (role === 'admin') return '#ef4444'
    if (role === 'manager') return '#f59e0b'
    return '#3b82f6'
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
    <div style={{ display: 'flex', height: 'calc(100vh - 130px)', background: '#0f172a', borderRadius: '16px', overflow: 'hidden', border: '1px solid #334155' }}>
      {/* Channels Sidebar */}
      <div style={{ width: '220px', background: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Channels Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Channels
            </span>
            {(isAdmin || isManager) && (
              <button onClick={() => setShowNewChannel(true)} style={{
                background: 'transparent', border: 'none',
                color: '#94a3b8', cursor: 'pointer', fontSize: '20px'
              }}>+</button>
            )}
          </div>
        </div>

        {/* Channel List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {channels.map(channel => (
            <div key={channel.id} style={{ position: 'relative', marginBottom: '2px' }}>
              <button
                onClick={() => setActiveChannel(channel)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '8px', border: 'none',
                  background: activeChannel?.id === channel.id ? '#334155' : 'transparent',
                  color: activeChannel?.id === channel.id ? 'white' : '#94a3b8',
                  cursor: 'pointer', fontSize: '14px', textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}>
                <span style={{ color: '#64748b' }}>#</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {channel.name}
                </span>
              </button>
              {isAdmin && activeChannel?.id === channel.id && (
                <button onClick={() => deleteChannel(channel.id)} style={{
                  position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: '#ef4444',
                  cursor: 'pointer', fontSize: '12px', padding: '2px 4px'
                }}>🗑️</button>
              )}
            </div>
          ))}
        </div>

        {/* User Info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '14px', fontWeight: 'bold', flexShrink: 0
          }}>
            {profile?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: 'white', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.full_name}
            </div>
            <div style={{ color: roleColor(profile?.role), fontSize: '10px', textTransform: 'capitalize' }}>
              {profile?.role}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div style={{
              padding: '12px 20px', borderBottom: '1px solid #334155',
              background: '#1e293b', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: '#64748b', fontSize: '18px' }}>#</span>
                <div>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>{activeChannel.name}</div>
                  {activeChannel.description && (
                    <div style={{ color: '#94a3b8', fontSize: '11px' }}>{activeChannel.description}</div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Search */}
                <input
                  type="text" placeholder="🔍 Search..."
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{
                    padding: '6px 10px', background: '#0f172a',
                    border: '1px solid #334155', borderRadius: '6px',
                    color: 'white', fontSize: '12px', outline: 'none', width: '140px'
                  }}
                />
                {/* Pinned */}
                <button onClick={() => setShowPinned(!showPinned)} style={{
                  background: showPinned ? '#334155' : 'transparent',
                  border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px', padding: '4px 8px', borderRadius: '6px'
                }}>📌</button>
                <div style={{ color: '#94a3b8', fontSize: '12px' }}>{messages.length} msgs</div>
              </div>
            </div>

            {/* Pinned Messages */}
            {showPinned && pinnedMessages.length > 0 && (
              <div style={{ background: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 20px' }}>
                <div style={{ color: '#f59e0b', fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
                  📌 Pinned Messages
                </div>
                {pinnedMessages.map(msg => (
                  <div key={msg.id} style={{
                    background: '#1e293b', borderRadius: '8px', padding: '8px 12px',
                    marginBottom: '6px', borderLeft: '3px solid #f59e0b'
                  }}>
                    <div style={{ color: '#f59e0b', fontSize: '11px', marginBottom: '3px' }}>{msg.profiles?.full_name}</div>
                    <div style={{ color: 'white', fontSize: '13px' }}>{msg.content}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Search Results */}
            {search && filteredMessages && (
              <div style={{ background: '#0f172a', borderBottom: '1px solid #334155', padding: '12px 20px', maxHeight: '200px', overflowY: 'auto' }}>
                <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '8px' }}>
                  {filteredMessages.length} results for "{search}"
                </div>
                {filteredMessages.map(msg => (
                  <div key={msg.id} style={{
                    background: '#1e293b', borderRadius: '8px', padding: '8px 12px', marginBottom: '6px'
                  }}>
                    <div style={{ color: '#3b82f6', fontSize: '11px', marginBottom: '3px' }}>{msg.profiles?.full_name}</div>
                    <div style={{ color: 'white', fontSize: '13px' }}>{msg.content}</div>
                    <div style={{ color: '#475569', fontSize: '10px' }}>{formatTime(msg.created_at)}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {messages.length === 0 ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    {/* Date Divider */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0 10px' }}>
                      <div style={{ flex: 1, height: '1px', background: '#334155' }} />
                      <span style={{ color: '#64748b', fontSize: '11px', whiteSpace: 'nowrap' }}>
                        {formatDate(msgs[0].created_at)}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: '#334155' }} />
                    </div>

                    {msgs.map((msg, idx) => {
                      const isOwn = msg.sender_id === profile?.id
                      const showAvatar = idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id

                      return (
                        <div key={msg.id}
                          style={{
                            display: 'flex', flexDirection: isOwn ? 'row-reverse' : 'row',
                            gap: '10px', marginBottom: '4px', alignItems: 'flex-end',
                            position: 'relative'
                          }}
                          className="message-row"
                        >
                          {/* Avatar */}
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: isOwn
                              ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                              : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                            display: showAvatar ? 'flex' : 'none',
                            alignItems: 'center', justifyContent: 'center',
                            color: 'white', fontSize: '13px', fontWeight: 'bold', flexShrink: 0
                          }}>
                            {msg.profiles?.full_name?.charAt(0).toUpperCase()}
                          </div>
                          {!showAvatar && <div style={{ width: '32px', flexShrink: 0 }} />}

                          <div style={{ maxWidth: '65%' }}>
                            {showAvatar && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                marginBottom: '3px', flexDirection: isOwn ? 'row-reverse' : 'row'
                              }}>
                                <span style={{ color: roleColor(msg.profiles?.role), fontSize: '12px', fontWeight: 'bold' }}>
                                  {isOwn ? 'You' : msg.profiles?.full_name}
                                </span>
                                <span style={{ color: '#475569', fontSize: '10px' }}>{formatTime(msg.created_at)}</span>
                                {msg.is_edited && <span style={{ color: '#f59e0b', fontSize: '10px' }}>📌</span>}
                              </div>
                            )}
                            <div style={{ position: 'relative' }}>
                              <div style={{
                                background: isOwn
                                  ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' : '#1e293b',
                                border: isOwn ? 'none' : '1px solid #334155',
                                borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                                padding: '10px 14px', color: 'white',
                                fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word'
                              }}>
                                {msg.content}
                              </div>
                              {/* Message Actions */}
                              {(isOwn || isAdmin || isManager) && (
                                <div style={{
                                  position: 'absolute', top: '-8px',
                                  right: isOwn ? 'auto' : '-8px',
                                  left: isOwn ? '-8px' : 'auto',
                                  display: 'flex', gap: '4px', opacity: 0,
                                  transition: 'opacity 0.2s'
                                }} className="msg-actions">
                                  <button onClick={() => pinMessage(msg)} style={{
                                    background: '#334155', border: 'none', borderRadius: '4px',
                                    color: msg.is_edited ? '#f59e0b' : '#94a3b8',
                                    cursor: 'pointer', fontSize: '11px', padding: '2px 5px'
                                  }}>📌</button>
                                  {(isOwn || isAdmin) && (
                                    <button onClick={() => deleteMessage(msg.id)} style={{
                                      background: '#334155', border: 'none', borderRadius: '4px',
                                      color: '#ef4444', cursor: 'pointer', fontSize: '11px', padding: '2px 5px'
                                    }}>🗑️</button>
                                  )}
                                </div>
                              )}
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

            {/* Message Input */}
            <div style={{
              padding: '16px 20px', borderTop: '1px solid #334155',
              background: '#1e293b', display: 'flex', gap: '10px', alignItems: 'flex-end'
            }}>
              <input
                type="text" value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Message #${activeChannel.name}...`}
                style={{
                  flex: 1, padding: '12px 16px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '10px',
                  color: 'white', fontSize: '14px', outline: 'none'
                }}
              />
              <button onClick={sendMessage} disabled={sending || !newMessage.trim()} style={{
                padding: '12px 20px',
                background: sending || !newMessage.trim() ? '#334155' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                border: 'none', borderRadius: '10px',
                color: sending || !newMessage.trim() ? '#64748b' : 'white',
                cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                fontSize: '16px', fontWeight: 'bold'
              }}>➤</button>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
              <p>Select a channel to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* New Channel Modal */}
      {showNewChannel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#1e293b', borderRadius: '16px', padding: '28px', width: '100%', maxWidth: '400px', border: '1px solid #334155' }}>
            <h3 style={{ color: 'white', margin: '0 0 20px', fontSize: '18px' }}>+ New Channel</h3>
            <div style={{ marginBottom: '14px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Channel Name</label>
              <input type="text" value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g. marketing"
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>Description (Optional)</label>
              <input type="text" value={newChannelDesc}
                onChange={(e) => setNewChannelDesc(e.target.value)}
                placeholder="What is this channel about?"
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setShowNewChannel(false)} style={{ flex: 1, padding: '11px', background: '#334155', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
              <button onClick={createChannel} style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>Create Channel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
