import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function usePermissions(profile) {
  const [permissions, setPermissions] = useState({})
  const [allPermissions, setAllPermissions] = useState([])
  const [presentationMode, setPresentationMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      fetchPermissions()
      fetchPresentationMode()
      const cleanup = subscribeToChanges()
      return cleanup
    }
  }, [profile])

  const fetchPermissions = async () => {
    // Fetch ALL permissions (for admin panel)
    const { data: allData } = await supabase
      .from('module_visibility')
      .select('*')

    setAllPermissions(allData || [])

    // Fetch role-specific permissions
    const { data } = await supabase
      .from('module_visibility')
      .select('*')
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
    setLoading(false)
  }

  const fetchPresentationMode = async () => {
    const { data } = await supabase
      .from('presentation_mode')
      .select('*')
      .single()
    if (data) setPresentationMode(data.is_active)
  }

  const subscribeToChanges = () => {
    const sub1 = supabase
      .channel('permissions-live')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'module_visibility'
      }, () => {
        fetchPermissions()
      })
      .subscribe()

    const sub2 = supabase
      .channel('presentation-live')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'presentation_mode'
      }, (payload) => {
        setPresentationMode(payload.new?.is_active || false)
      })
      .subscribe()

    return () => {
      sub1.unsubscribe()
      sub2.unsubscribe()
    }
  }

  // Admin always has full access
  const canAccess = (moduleId) => {
    if (profile?.role === 'admin') return true
    if (presentationMode) {
      return ['dashboard', 'projects', 'files'].includes(moduleId)
    }
    return permissions[moduleId]?.inDom !== false
  }

  const isInSidebar = (moduleId) => {
    if (profile?.role === 'admin') return true
    if (presentationMode) {
      return ['dashboard', 'projects', 'files'].includes(moduleId)
    }
    return permissions[moduleId]?.inSidebar !== false
  }

  // Get permission for specific role (for admin panel)
  const getModulePermission = (moduleId, role) => {
    const perm = allPermissions.find(
      p => p.module_id === moduleId && p.role === role
    )
    return perm?.is_in_dom !== false
  }

  const toggleModule = async (moduleId, role, value) => {
    const { error } = await supabase
      .from('module_visibility')
      .update({
        is_visible: value,
        is_in_sidebar: value,
        is_in_dom: value
      })
      .eq('module_id', moduleId)
      .eq('role', role)

    if (error) {
      console.error('Toggle error:', error)
      return false
    }

    // Refresh all permissions
    await fetchPermissions()
    return true
  }

  const togglePresentationMode = async (active) => {
    const { data: current } = await supabase
      .from('presentation_mode')
      .select('id')
      .single()

    if (current) {
      await supabase
        .from('presentation_mode')
        .update({
          is_active: active,
          activated_by: profile.id,
          activated_at: new Date().toISOString()
        })
        .eq('id', current.id)
    }
    setPresentationMode(active)
  }

  return {
    permissions,
    allPermissions,
    presentationMode,
    loading,
    canAccess,
    isInSidebar,
    toggleModule,
    togglePresentationMode,
    getModulePermission,
    refreshPermissions: fetchPermissions
  }
}
