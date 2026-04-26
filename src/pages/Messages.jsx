import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabase'

export default function Messages({ profile }) {
  const [channels, setChannels] = useState([])
  const [activeChannel, setActiveChannel] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (profile) fetchChannels()
  }, [profile])

  useEffect(() => {
    if (activeChannel) {
      fetchMessages()
      const subscription = supabase
        .channel(`messages-${activeChannel.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
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
    if (data && data.length > 0) setActiveChannel(data[0])
  }

  const fetchMessages = async () => {
    if (!activeChannel) return
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(full_name, role)')
      .eq('channel_id', activeChannel.id)
      .order('created_at', { ascending: true })
      .limit(100)
    setMessages(data || [])
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

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const createChannel = async () => {
    const name = prompt('Channel naam likhein:')
    if (!name) return
    await supabase.from('channels').insert({
      name: name.toLowerCase().replace(/\s+/g, '-'),
      created_by: profile.id
    })
    fetchChannels()
  }

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-PK', {
    hour: '2-digit', minute: '2-digit'
  })

  const formatDate = (ts) => {
    const date = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === today.toDateString()) return 'Aaj'
    if (date.toDateString() === yesterday.toDateString()) return 'Kal'
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

  return (
    <div style={{
      display: 'flex',
      height: 'calc(100vh - 130px)',
      background: '#0f172a',
      borderRadius: '16px',
      overflow: 'hidden',
      border: '1px solid #334155'
    }}>
      {/* Channels Sidebar */}
      <div style={{
        width: '200px', background: '#1e293b',
        borderRight: '1px solid #334155',
        display: 'flex', flexDirection: 'column', flexShrink: 0
      }}>
        <div style={{
          padding: '16px', borderBottom: '1px solid #334155',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{
            color: '#94a3b8', fontSize: '11px',
            fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>Channels</span>
          {isAdmin && (
            <button onClick={createChannel} style={{
              background: 'transparent', border: 'none',
              color: '#94a3b8', cursor: 'pointer', fontSize: '20px'
            }}>+</button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {channels.map(channel => (
            <button key={channel.id}
              onClick={() => setActiveChannel(channel)}
              style={{
                width: '100%', padding: '10px 12px',
                borderRadius: '8px', border: 'none',
                background: activeChannel?.id === channel.id ? '#334155' : 'transparent',
                color: activeChannel?.id === channel.id ? 'white' : '#94a3b8',
                cursor: 'pointer', fontSize: '14px',
                textAlign: 'left', marginBottom: '2px',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
              <span style={{ color: '#64748b' }}>#</span>
              {channel.name}
            </button>
          ))}
        </div>

        {/* User Info */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: '14px', fontWeight: 'bold', flexShrink: 0
          }}>
            {profile?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              color: 'white', fontSize: '12px', fontWeight: 'bold',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {profile?.full_name}
            </div>
            <div style={{
              color: roleColor(profile?.role),
              fontSize: '10px', textTransform: 'capitalize'
            }}>
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
              padding: '14px 20px', borderBottom: '1px solid #334155',
              background: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px'
            }}>
              <span style={{ color: '#64748b', fontSize: '18px' }}>#</span>
              <div>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '15px' }}>
                  {activeChannel.name}
                </div>
                {activeChannel.description && (
                  <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {activeChannel.description}
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '20px',
              display: 'flex', flexDirection: 'column', gap: '2px'
            }}>
              {messages.length === 0 ? (
                <div style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
                  <p>Pehla message bhejein!</p>
                </div>
              ) : (
                Object.entries(groupedMessages).map(([date, msgs]) => (
                  <div key={date}>
                    {/* Date Divider */}
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      gap: '12px', margin: '16px 0 10px'
                    }}>
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
                        <div key={msg.id} style={{
                          display: 'flex',
                          flexDirection: isOwn ? 'row-reverse' : 'row',
                          gap: '10px', marginBottom: '4px', alignItems: 'flex-end'
                        }}>
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
                                marginBottom: '3px',
                                flexDirection: isOwn ? 'row-reverse' : 'row'
                              }}>
                                <span style={{
                                  color: roleColor(msg.profiles?.role),
                                  fontSize: '12px', fontWeight: 'bold'
                                }}>
                                  {isOwn ? 'Aap' : msg.profiles?.full_name}
                                </span>
                                <span style={{ color: '#475569', fontSize: '10px' }}>
                                  {formatTime(msg.created_at)}
                                </span>
                              </div>
                            )}
                            <div style={{
                              background: isOwn
                                ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)'
                                : '#1e293b',
                              border: isOwn ? 'none' : '1px solid #334155',
                              borderRadius: isOwn ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                              padding: '10px 14px', color: 'white',
                              fontSize: '14px', lineHeight: '1.5', wordBreak: 'break-word'
                            }}>
                              {msg.content}
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
              padding: '16px 20px', borderTop: '1px solid #334155',
              background: '#1e293b', display: 'flex', gap: '10px'
            }}>
              <input
                type="text" value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`#${activeChannel.name} mein likhein...`}
                style={{
                  flex: 1, padding: '12px 16px', background: '#0f172a',
                  border: '1px solid #334155', borderRadius: '10px',
                  color: 'white', fontSize: '14px', outline: 'none'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                style={{
                  padding: '12px 20px',
                  background: sending || !newMessage.trim()
                    ? '#334155'
                    : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  border: 'none', borderRadius: '10px',
                  color: sending || !newMessage.trim() ? '#64748b' : 'white',
                  cursor: sending || !newMessage.trim() ? 'not-allowed' : 'pointer',
                  fontSize: '16px', fontWeight: 'bold'
                }}
              >➤</button>
            </div>
          </>
        ) : (
          <div style={{
            flex: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: '#94a3b8'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💬</div>
              <p>Channel select karein</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
