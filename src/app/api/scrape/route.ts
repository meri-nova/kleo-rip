import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { linkedinUrl } = await request.json()

    if (!linkedinUrl) {
      return NextResponse.json({ error: 'LinkedIn URL is required' }, { status: 400 })
    }

    // Validate LinkedIn URL format
    if (!linkedinUrl.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'Invalid LinkedIn profile URL' }, { status: 400 })
    }

    // Extract username from URL
    const username = linkedinUrl.split('/in/')[1]?.split('/')[0]

    // Check if profile already exists
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('linkedin_url', linkedinUrl)
      .single()

    let profileId: string

    if (existingProfile) {
      profileId = existingProfile.id
      
      // Check if recently scraped (< 24 hours)
      const lastScraped = existingProfile.last_scraped_at
      if (lastScraped) {
        const lastScrapedTime = new Date(lastScraped).getTime()
        const now = new Date().getTime()
        const hoursSinceLastScrape = (now - lastScrapedTime) / (1000 * 60 * 60)
        
        if (hoursSinceLastScrape < 24) {
          // Return cached posts
          const { data: posts } = await supabaseAdmin
            .from('posts')
            .select('*')
            .eq('profile_id', profileId)
            .order('likes', { ascending: false })

          return NextResponse.json({
            cached: true,
            profile: existingProfile,
            posts: posts || [],
            message: 'Returning cached data from last scrape'
          })
        }
      }
    } else {
      // Create new profile
      const { data: newProfile, error } = await supabaseAdmin
        .from('profiles')
        .insert({
          linkedin_url: linkedinUrl,
          username: username
        })
        .select()
        .single()

      if (error || !newProfile) {
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
      }

      profileId = newProfile.id
    }

    // Create scraping job
    const { data: job, error: jobError } = await supabaseAdmin
      .from('scrape_jobs')
      .insert({
        profile_id: profileId,
        status: 'pending'
      })
      .select()
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Failed to create scraping job' }, { status: 500 })
    }

    // Start background scraping (in a real implementation, this would be queued)
    // For now, we'll simulate it
    setTimeout(() => simulateScraping(profileId, job.id, linkedinUrl), 1000)

    return NextResponse.json({
      jobId: job.id,
      profileId: profileId,
      status: 'started',
      message: 'Scraping job started'
    })

  } catch (error) {
    console.error('Scrape API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Simulate scraping process (replace with actual Firecrawl integration)
async function simulateScraping(profileId: string, jobId: string, linkedinUrl: string) {
  try {
    // Update job status to running
    await supabaseAdmin
      .from('scrape_jobs')
      .update({ status: 'running' })
      .eq('id', jobId)

    // Simulate scraping delay
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Simulate scraped posts data (replace with actual Firecrawl data)
    const mockPosts = [
      {
        profile_id: profileId,
        linkedin_post_url: `${linkedinUrl}/activity/post1`,
        content: 'Sample LinkedIn post content about professional development...',
        likes: 150,
        comments: 23,
        reposts: 12,
        views: 1200,
        post_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        profile_id: profileId,
        linkedin_post_url: `${linkedinUrl}/activity/post2`,
        content: 'Another sample post about industry trends and insights...',
        likes: 89,
        comments: 15,
        reposts: 8,
        views: 890,
        post_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]

    // Insert posts
    const { error: postsError } = await supabaseAdmin
      .from('posts')
      .upsert(mockPosts, { onConflict: 'linkedin_post_url' })

    if (postsError) {
      throw new Error('Failed to insert posts')
    }

    // Update profile and job
    await supabaseAdmin
      .from('profiles')
      .update({
        last_scraped_at: new Date().toISOString(),
        post_count: mockPosts.length
      })
      .eq('id', profileId)

    await supabaseAdmin
      .from('scrape_jobs')
      .update({
        status: 'completed',
        posts_found: mockPosts.length,
        posts_updated: mockPosts.length,
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)

  } catch (error) {
    console.error('Scraping simulation error:', error)
    
    await supabaseAdmin
      .from('scrape_jobs')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
  }
}