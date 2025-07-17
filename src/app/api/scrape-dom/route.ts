import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  // Add CORS headers for Chrome extension
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const supabaseAdmin = getSupabaseAdmin()
    const { profileInfo, posts } = await request.json()

    if (!profileInfo || !posts || !Array.isArray(posts)) {
      return NextResponse.json({ error: 'Profile info and posts array are required' }, { status: 400, headers: corsHeaders })
    }

    console.log('Processing DOM-extracted posts:', posts.length)

    // Validate LinkedIn URL format
    if (!profileInfo.profileUrl || !profileInfo.profileUrl.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'Invalid LinkedIn profile URL' }, { status: 400, headers: corsHeaders })
    }

    // Extract username from URL
    const username = profileInfo.profileUrl.split('/in/')[1]?.split('/')[0]

    // Check if profile already exists, create if not
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('linkedin_url', profileInfo.profileUrl)
      .single()

    let profileId: string

    if (existingProfile) {
      profileId = existingProfile.id
    } else {
      // Create new profile
      const { data: newProfile, error } = await supabaseAdmin
        .from('profiles')
        .insert({
          linkedin_url: profileInfo.profileUrl,
          username: username,
          full_name: profileInfo.fullName || null,
          profile_image_url: profileInfo.profileImageUrl || null
        })
        .select()
        .single()

      if (error || !newProfile) {
        console.error('Profile creation error:', error)
        return NextResponse.json({ error: 'Failed to create profile' }, { status: 500, headers: corsHeaders })
      }

      profileId = newProfile.id
    }

    // Clear existing posts for this profile (to avoid mixing old data with new data)
    await supabaseAdmin
      .from('posts')
      .delete()
      .eq('profile_id', profileId)

    // Enhanced logging and relaxed filtering for Supabase
    console.log(`📊 Supabase API: Processing ${posts.length} posts from extension`);
    
    const validPosts = posts
      .filter((post, index) => {
        const hasContent = post.content && post.content.length > 0;
        const contentLength = post.content ? post.content.length : 0;
        const isValidLength = contentLength > 5; // Relaxed from 50 to 5
        
        if (!hasContent) {
          console.log(`❌ Supabase: Post ${index + 1} filtered - No content`);
          return false;
        }
        
        if (!isValidLength) {
          console.log(`❌ Supabase: Post ${index + 1} filtered - Content too short (${contentLength} chars)`);
          return false;
        }
        
        console.log(`✅ Supabase: Post ${index + 1} accepted - ${contentLength} chars`);
        return true;
      })
      .map((post, index) => ({
        profile_id: profileId,
        linkedin_post_url: post.linkedinPostUrl || `${profileInfo.profileUrl}/activity/post-${Date.now()}-${index}`,
        content: post.content,
        likes: parseInt(post.likes) || 0,
        comments: parseInt(post.comments) || 0,
        reposts: parseInt(post.reposts) || 0,
        post_date: post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }))

    if (validPosts.length === 0) {
      return NextResponse.json({ error: 'No valid posts found in extracted data' }, { status: 400, headers: corsHeaders })
    }

    // Sort posts by likes descending before saving
    validPosts.sort((a, b) => b.likes - a.likes)

    // Use upsert to handle potential duplicates
    const { error: postsError } = await supabaseAdmin
      .from('posts')
      .upsert(validPosts, { 
        onConflict: 'linkedin_post_url',
        ignoreDuplicates: false 
      })

    if (postsError) {
      console.error('Database upsert error:', postsError)
      console.error('Valid posts data:', JSON.stringify(validPosts.slice(0, 2), null, 2))
      return NextResponse.json({ 
        error: 'Failed to save posts to database', 
        details: postsError.message,
        code: postsError.code 
      }, { status: 500, headers: corsHeaders })
    }

    // Update profile with latest scrape info
    await supabaseAdmin
      .from('profiles')
      .update({
        last_scraped_at: new Date().toISOString(),
        post_count: validPosts.length,
        full_name: profileInfo.fullName || existingProfile?.full_name,
        profile_image_url: profileInfo.profileImageUrl || existingProfile?.profile_image_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)

    console.log(`Successfully saved ${validPosts.length} DOM-extracted posts`)

    return NextResponse.json({
      success: true,
      profileId: profileId,
      postsCount: validPosts.length,
      message: `Successfully scraped ${validPosts.length} posts from LinkedIn DOM`
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('DOM scrape API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders })
  }
}

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}