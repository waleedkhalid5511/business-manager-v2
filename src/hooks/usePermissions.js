import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export function usePermissions(profile) {
  const [permissions, setPermissions] = useState({})
  const [presentationMode, setPresentationMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) {
      fetchPermissions()
      fetchPresentationMode()
      subscribeToChanges()
    }
  }, [profile])

  const fetchPermissions = async () => {
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
      .channel('permissions-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'module_visibility'
      }, () => fetchPermissions())
      .subscribe()

    const sub2 = supabase
      .channel('presentation-changes')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'presentation_mode'
      }, (payload) => {
        setPresentationMode(payload.new?.is_active || false)
      })
      .subscribe()

    return () => {
      sub1.unsubscribe()
      sub2.unsubscribe()
    }
  }

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

  const toggleModule = async (moduleId, role, field, value) => {
    await supabase
      .from('module_visibility')
      .update({ [field]: value })
      .eq('module_id', moduleId)
      .eq('role', role)
  }

  const togglePresentationMode = async (active) => {
    await supabase
      .from('presentation_mode')
      .update({
        is_active: active,
        activated_by: profile.id,
        activated_at: new Date().toISOString()
      })
      .eq('id', (await supabase.from('presentation_mode').select('id').single()).data?.id)
    setPresentationMode(active)
  }

  return {
    permissions,
    presentationMode,
    loading,
    canAccess,
    isInSidebar,
    toggleModule,
    togglePresentationMode,
    refreshPermissions: fetchPermissions
  }
}
