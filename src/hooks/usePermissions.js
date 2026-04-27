import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ADMIN_STORAGE_KEY = 'admin_visible_modules'

const ALL_MODULES = [
  'dashboard', 'messages', 'projects', 'tasks',
  'attendance', 'timetracking', 'clienttime',
  'employees', 'payroll', 'settings'
]

export function usePermissions(profile) {
  const [permissions, setPermissions] = useState({})
  const [allPermissions, setAllPermissions] = useState([])
  const [userModules, setUserModules] = useState([])
  const [presentationMode, setPresentationMode] = useState(false)
  const [adminVisibleModules, setAdminVisibleModules] = useState(ALL_MODULES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    fetchPermissions()
    fetchUserModules()
    fetchPresentationMode()

    if (profile.role === 'admin') {
      try {
        const saved = localStorage.getItem(ADMIN_STORAGE_KEY)
        if (saved) setAdminVisibleModules(JSON.parse(saved))
        else setAdminVisibleModules(ALL_MODULES)
      } catch {
        setAdminVisibleModules(ALL_MODULES)
      }
    }

    const cleanup = subscribeToChanges()
    return cleanup
  }, [profile?.id])

  const fetchPermissions = async () => {
    try {
      const { data: allData } = await supabase
        .from('module_visibility').select('*')
      setAllPermissions(allData || [])

      const { data } = await supabase
        .from('module_visibility').select('*')
        .eq('role', profile.role)

      const perms = {}
      ;(data || []).forEach(p => {
        perms[p.module_id] = {
          visible: p.is_visible,
          inSidebar: p.is_in_sidebar,
          inDom: p.is_in_dom
        }
      })
      setPermissions(perms)
    } catch (e) {
      console.error('fetchPermissions error:', e)
    } finally {
      setLoading(false)
    }
  }

  const fetchUserModules = async () => {
    if (!profile) return
    try {
      const { data } = await supabase
        .from('user_module_visibility')
        .select('*')
        .eq('user_id', profile.id)

      if (data && data.length > 0) {
        setUserModules(data.filter(d => d.is_visible).map(d => d.module_id))
      } else {
        // No specific settings — use all modules
        setUserModules(ALL_MODULES)
      }
    } catch (e) {
      console.error('fetchUserModules error:', e)
    }
  }

  const fetchPresentationMode = async () => {
    try {
      const { data } = await supabase
        .from('presentation_mode').select('*').single()
      if (data) setPresentationMode(data.is_active || false)
    } catch (e) {
      console.error('fetchPresentationMode error:', e)
    }
  }

  const subscribeToChanges = () => {
    const sub1 = supabase
      .channel('permissions-live-v3')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'module_visibility'
      }, () => fetchPermissions())
      .subscribe()

    const sub2 = supabase
      .channel('presentation-live-v3')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'presentation_mode'
      }, (payload) => {
        setPresentationMode(payload.new?.is_active || false)
      })
      .subscribe()

    const sub3 = supabase
      .channel(`user-modules-${profile.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'user_module_visibility',
        filter: `user_id=eq.${profile.id}`
      }, () => fetchUserModules())
      .subscribe()

    return () => {
      try {
        sub1.unsubscribe()
        sub2.unsubscribe()
        sub3.unsubscribe()
      } catch (e) {}
    }
  }

  const isInSidebar = (moduleId) => {
    if (!profile) return false

    // Admin — use local storage toggles
    if (profile.role === 'admin') {
      return adminVisibleModules.includes(moduleId)
    }

    // Other users — check per-user visibility first
    if (userModules.length > 0) {
      return userModules.includes(moduleId)
    }

    // Fallback to role-based
    if (permissions[moduleId]?.inSidebar === false) return false
    return true
  }

  const canAccess = (moduleId) => {
    if (!profile) return false

    if (profile.role === 'admin') {
      return adminVisibleModules.includes(moduleId)
    }

    if (userModules.length > 0) {
      return userModules.includes(moduleId)
    }

    if (permissions[moduleId]?.inDom === false) return false
    return true
  }

  const toggleAdminModule = (moduleId) => {
    setAdminVisibleModules(prev => {
      const newList = prev.includes(moduleId)
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
      try {
        localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(newList))
      } catch (e) {}
      return newList
    })
  }

  const showAllModules = () => {
    setAdminVisibleModules(ALL_MODULES)
    try {
      localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(ALL_MODULES))
    } catch (e) {}
  }

  const toggleModule = async (moduleId, role, value) => {
    try {
      await supabase
        .from('module_visibility')
        .update({ is_visible: value, is_in_sidebar: value, is_in_dom: value })
        .eq('module_id', moduleId)
        .eq('role', role)
      await fetchPermissions()
    } catch (e) {
      console.error('toggleModule error:', e)
    }
  }

  const getModulePermission = (moduleId, role) => {
    const perm = allPermissions.find(
      p => p.module_id === moduleId && p.role === role
    )
    if (!perm) return true
    return perm.is_in_dom !== false
  }

  const togglePresentationMode = async (active) => {
    try {
      const { data: current } = await supabase
        .from('presentation_mode').select('id').single()
      if (current) {
        await supabase.from('presentation_mode').update({
          is_active: active,
          activated_by: profile.id,
          activated_at: new Date().toISOString()
        }).eq('id', current.id)
      }
      setPresentationMode(active)
    } catch (e) {
      console.error('togglePresentationMode error:', e)
    }
  }

  return {
    permissions, allPermissions,
    presentationMode, loading,
    canAccess, isInSidebar,
    adminVisibleModules,
    toggleAdminModule, showAllModules,
    toggleModule, togglePresentationMode,
    getModulePermission,
    refreshPermissions: fetchPermissions
  }
}
