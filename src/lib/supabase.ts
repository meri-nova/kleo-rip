import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

// Runtime validation for environment variables
function validateEnvVars() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing required Supabase environment variables')
  }
}

function validateAdminEnvVars() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing required Supabase admin environment variables')
  }
}

// Client for browser/client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for server-side operations with validation
export function getSupabaseAdmin() {
  validateAdminEnvVars()
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Database types
export interface Profile {
  id: string
  linkedin_url: string
  username: string | null
  full_name: string | null
  profile_image_url: string | null
  last_scraped_at: string | null
  post_count: number
  created_at: string
  updated_at: string
}

export interface Post {
  id: string
  profile_id: string
  linkedin_post_url: string
  content: string | null
  likes: number
  comments: number
  reposts: number
  post_date: string | null
  scraped_at: string
  updated_at: string
}

export interface ScrapeJob {
  id: string
  profile_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  posts_found: number
  posts_updated: number
  error_message: string | null
  started_at: string
  completed_at: string | null
}

