import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useNotifications(profile) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!profile?.id) return
    fetchNotifications()

    const sub = supabase
      .channel(`notif-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchNotifications())
      .subscribe()

    return () => sub.unsubscribe()
  }, [profile?.id])

  const fetchNotifications = async () => {
    if (!profile?.id) return
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) { console.error('notif error:', error); return }
      setNotifications(data || [])
      setUnreadCount((data || []).filter(n => !n.is_read).length)
    } catch (e) {
      console.error('fetchNotifications error:', e)
    }
  }

  const markAsRead = async (id) => {
    await supabase.from('notifications')
      .update({ is_read: true }).eq('id', id)
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
