import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useNotifications(profile) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    console.log('🔔 Fetching notifications for:', profile.id)
    fetchNotifications()

    const sub = supabase
      .channel(`notif-live-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
      }, (payload) => {
        console.log('🔔 Realtime notif:', payload)
        fetchNotifications()
      })
      .subscribe((status) => {
        console.log('🔔 Notif subscription status:', status)
      })

    return () => sub.unsubscribe()
  }, [profile?.id])

  const fetchNotifications = async () => {
    if (!profile?.id) return
    try {
      console.log('🔔 Fetching for user:', profile.id)
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      console.log('🔔 Notifications data:', data, 'Error:', error)
      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.is_read).length)
    } catch (e) {
      console.error('fetchNotifications error:', e)
    }
  }

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const notificationIcon = (type) => {
    const icons = {
      task: '✦', success: '✅', warning: '⚠️',
      error: '❌', info: 'ℹ️', file: '📎',
      leave: '🏖️', message: '💬', announcement: '📢'
    }
    return icons[type] || '🔔'
  }

  return {
    notifications, unreadCount,
    markAsRead, markAllRead,
    notificationIcon,
    refresh: fetchNotifications
  }
}
