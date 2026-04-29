import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

const ADMIN_STORAGE_KEY = 'admin_visible_modules'

const ALL_MODULES = [
  'dashboard', 'messages', 'announcements', 'projects', 'tasks',
  'files', 'attendance', 'timetracking', 'clienttime',
  'employees', 'officecalls', 'reports', 'payroll', 'settings'
]

const ROLE_DEFAULT_MODULES = {
  admin: ALL_MODULES,
  manager: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'files', 'attendance', 'timetracking', 'clienttime', 'employees', 'officecalls', 'reports'],
  employee: ['dashboard', 'messages', 'announcements', 'tasks', 'attendance', 'timetracking', 'settings'],
  partner: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'clienttime', 'files'],
  junior_editor: ['dashboard', 'messages', 'announcements', 'tasks', 'timetracking', 'settings'],
  senior_editor: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'timetracking', 'clienttime', 'files', 'settings'],
  client_manager: ['dashboard', 'messages', 'announcements', 'projects', 'tasks', 'clienttime', 'employees', 'settings'],
  qa_reviewer: ['dashboard', 'messages', 'announcements', 'tasks', 'projects', 'settings'],
}

export function usePermissions(profile) {
  const [permissions, setPermissions] = useState({})
  const [allPermissions, setAllPermissions] = useState([])
  const [userModules, setUserModules] = useState(null)
  const [presentationMode, setPresentationMode] = useState(false)
  const [adminVisibleModules, setAdminVisibleModules] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return

    const init = async () => {
      setLoading(true)

      if (profile.role === 'admin') {
        try {
          const saved = localStorage.getItem(ADMIN_STORAGE_KEY)
          if (saved) {
            const parsed = JSON.parse(saved)
            // Make sure new modules are included
            const merged = [...new Set([...parsed, ...ALL_MODULES.filter(m => !parsed.includes(m))])]
            setAdminVisibleModules(merged)
          } else {
            setAdminVisibleModules(ALL_MODULES)
          }
        } catch {
          setAdminVisibleModules(ALL_MODULES)
        }
      }

      await Promise.all([
        fetchPermissions(),
        fetchUserModules(),
        fetchPresentationMode(),
      ])

      setLoading(false)
    }

    init()
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
    }
  }

  const fetchUserModules = async () => {
  if (!profile) return
  try {
    console.log('🔐 Fetching modules for:', profile.id, profile.full_name)
    
    const { data, error } = await supabase
      .from('user_module_visibility')
      .select('*')
      .eq('user_id', profile.id)

    console.log('🔐 Modules data:', data, 'Error:', error)

    if (data && data.length > 0) {
      const visible = data.filter(d => d.is_visible).map(d => d.module_id)
      console.log('🔐 Visible modules:', visible)
      setUserModules(visible)
    } else {
      console.log('🔐 No data — using role defaults for:', profile.role)
      setUserModules(ROLE_DEFAULT_MODULES[profile.role] || ALL_MODULES)
    }
  } catch (e) {
    console.error('🔐 fetchUserModules error:', e)
    setUserModules(ROLE_DEFAULT_MODULES[profile.role] || ALL_MODULES)
  }
}

  const fetchPresentationMode = async () => {
    try {
      const { data } = await supabase
        .from('presentation_mode').select('*').single()
      if (data) setPresentationMode(data.is_active || false)
    } catch (e) {}
  }

  const subscribeToChanges = () => {
    const sub1 = supabase
      .channel('permissions-live-v5')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'module_visibility'
      }, () => fetchPermissions())
      .subscribe()

    const sub2 = supabase
      .channel('presentation-live-v5')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'presentation_mode'
      }, (payload) => {
        setPresentationMode(payload.new?.is_active || false)
      })
      .subscribe()

    const sub3 = supabase
      .channel(`user-modules-v3-${profile.id}`)
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
    if (!profile || loading) return false

    if (profile.role === 'admin') {
      return adminVisibleModules.includes(moduleId)
    }

    if (userModules !== null) {
      return userModules.includes(moduleId)
    }

    const roleDefaults = ROLE_DEFAULT_MODULES[profile.role] || ALL_MODULES
    return roleDefaults.includes(moduleId)
  }

  const canAccess = (moduleId) => {
    if (!profile || loading) return false

    if (profile.role === 'admin') {
      return adminVisibleModules.includes(moduleId)
    }

    if (userModules !== null) {
      return userModules.includes(moduleId)
    }

    const roleDefaults = ROLE_DEFAULT_MODULES[profile.role] || ALL_MODULES
    return roleDefaults.includes(moduleId)
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
    } catch (e) {}
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
