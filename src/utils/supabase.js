import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://klanbfvywwudprunaqdf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BhYc2LCiC6QLv6bVUiyzlA_XP7sbz29';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);