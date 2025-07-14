import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const profileUrl = searchParams.get('profileUrl')
    const sortBy = searchParams.get('sortBy') || 'likes' // likes, comments, reposts, date
    const timeframe = searchParams.get('timeframe') // optional: 7d, 30d, 90d, all

    if (!profileUrl) {
      return NextResponse.json({ error: 'Profile URL is required' }, { status: 400 })
    }

    console.log('Posts API - Looking for profile:', profileUrl)

    // Get profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('linkedin_url', profileUrl)
      .single()

    console.log('Posts API - Profile lookup result:', { profile, profileError })

    if (profileError || !profile) {
      // Try to find all profiles to debug
      const { data: allProfiles } = await supabaseAdmin
        .from('profiles')
        .select('linkedin_url')
        .limit(10)
      
      console.log('Posts API - Available profiles:', allProfiles)
      return NextResponse.json({ 
        error: 'Profile not found', 
        requestedUrl: profileUrl,
        availableProfiles: allProfiles?.map(p => p.linkedin_url) || []
      }, { status: 404 })
    }

    // Build query for posts
    let query = supabaseAdmin
      .from('posts')
      .select('*')
      .eq('profile_id', profile.id)

    // Apply timeframe filter
    if (timeframe && timeframe !== 'all') {
      const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 90
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('post_date', cutoffDate)
    }

    // Apply sorting - default to likes descending (most engagement first)
    const ascending = false
    switch (sortBy) {
      case 'comments':
        query = query.order('comments', { ascending })
        break
      case 'reposts':
        query = query.order('reposts', { ascending })
        break
      case 'date':
        query = query.order('post_date', { ascending: false }) // Most recent first
        break
      case 'likes':
      default: // Default to likes
        query = query.order('likes', { ascending })
        break
    }

    const { data: posts, error: postsError } = await query

    if (postsError) {
      return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
    }

    return NextResponse.json({
      profile,
      posts: posts || [],
      total: posts?.length || 0,
      sortedBy: sortBy,
      timeframe: timeframe || 'all'
    })

  } catch (error) {
    console.error('Posts API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}