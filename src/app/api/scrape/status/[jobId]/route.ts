import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Get job status
    const { data: job, error } = await supabaseAdmin
      .from('scrape_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If job is completed, also return the posts
    let posts = null
    if (job.status === 'completed') {
      const { data: postsData } = await supabaseAdmin
        .from('posts')
        .select('*')
        .eq('profile_id', job.profile_id)
        .order('likes', { ascending: false })

      posts = postsData
    }

    return NextResponse.json({
      job,
      posts
    })

  } catch (error) {
    console.error('Status API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}