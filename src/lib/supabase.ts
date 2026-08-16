import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://aytkufuoorzypxkghmqe.supabase.co'
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5dGt1ZnVvb3J6eXB4a2dobXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2MDE4NjgsImV4cCI6MjEwMjE3Nzg2OH0.LXSWAgPY-u93Z0f9QfeO3GgtsHyk1F9rv-84bcvQtBQ'

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const url = (rawUrl && rawUrl.trim().length > 0) ? rawUrl.trim() : DEFAULT_URL
const anonKey = (rawKey && rawKey.trim().length > 0) ? rawKey.trim() : DEFAULT_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url, anonKey)