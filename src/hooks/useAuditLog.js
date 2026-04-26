import { supabase } from '../supabase'

export function useAuditLog() {
  const log = async (userId, action, module, recordId, oldData, newData) => {
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action,
        module,
        record_id: recordId?.toString(),
        old_data: oldData || null,
        new_data: newData || null
      })
    } catch (e) {
      console.error('Audit log error:', e)
    }
  }

  return { log }
}
