import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vwxmulmumplsblsxlpyd.supabase.co'
const supabaseKey = 'sb_publishable_y01Nb56XmrzpQ8heiPFbWQ_05cLZ_16'

export const supabase = createClient(supabaseUrl, supabaseKey)
