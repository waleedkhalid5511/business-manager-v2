import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function useNotifications(profile) {
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (profile) {
      fetchNotifications()
      subscribeToNotifications()
    }
  }, [profile])

  const fetchNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setUnreadCount((data || []).filter(n => !n.is_read).length)
  }

  const subscribeToNotifications = () => {
    const sub = supabase
      .channel(`notifications-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${profile.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new, ...prev])
        setUnreadCount(prev => prev + 1)
      })
      .subscribe()
    return () => sub.unsubscribe()
  }

  const markAsRead = async (id) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', profile.id)
      .eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  const createNotification = async (userId, type, title, body, link) => {
    await supabase.from('notifications').insert({
      user_id: userId,
      type, title, body, link
    })
  }

  const notificationIcon = (type) => {
    const icons = {
      task_assigned: '✅',
      task_deadline: '⏰',
      leave_request: '🏖️',
      leave_approved: '✅',
      leave_rejected: '❌',
      message: '💬',
      payroll: '💰',
      system: '🔔'
    }
    return icons[type] || '🔔'
  }

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllRead,
    createNotification,
    notificationIcon,
    refresh: fetchNotifications
  }
}
