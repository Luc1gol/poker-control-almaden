import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://byeareumqttrthvonjea.supabase.co';
const supabaseKey = 'sb_publishable_FPoPw2pExC1DcoTcyHdxiw_726YqJkO';

export const supabase = createClient(supabaseUrl, supabaseKey);
