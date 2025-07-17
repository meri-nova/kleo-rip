import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  // Add CORS headers for Chrome extension
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    const { profileInfo, posts } = await request.json()

    if (!profileInfo || !posts || !Array.isArray(posts)) {
      return NextResponse.json({ error: 'Profile info and posts array are required' }, { status: 400, headers: corsHeaders })
    }

    console.log('Processing DOM-extracted posts for local storage:', posts.length)

    // Validate LinkedIn URL format
    if (!profileInfo.profileUrl || !profileInfo.profileUrl.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'Invalid LinkedIn profile URL' }, { status: 400, headers: corsHeaders })
    }

    // Extract username from URL
    const username = profileInfo.profileUrl.split('/in/')[1]?.split('/')[0] || ''
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')

    // Enhanced logging and relaxed filtering
    console.log(`📊 API: Processing ${posts.length} posts from extension`);
    
    // Track filtering statistics
    const preFilterCount = posts.length;
    const filterReasons = {
      noContent: 0,
      shortContent: 0,
      total: 0
    };
    
    const validPosts = posts
      .filter((post, index) => {
        const hasContent = post.content && post.content.length > 0;
        const contentLength = post.content ? post.content.length : 0;
        const isValidLength = contentLength > 5; // Relaxed from 20 to 5
        
        if (!hasContent) {
          filterReasons.noContent++;
          console.log(`❌ API: Post ${index + 1} filtered - No content`);
          return false;
        }
        
        if (!isValidLength) {
          filterReasons.shortContent++;
          console.log(`❌ API: Post ${index + 1} filtered - Content too short (${contentLength} chars): "${post.content.substring(0, 30)}..."`);
          return false;
        }
        
        console.log(`✅ API: Post ${index + 1} accepted - ${contentLength} chars, ${post.likes}L/${post.comments}C/${post.reposts}R`);
        return true;
      })
      .map((post, index) => ({
        content: post.content,
        likes: parseInt(post.likes) || 0,
        comments: parseInt(post.comments) || 0,
        reposts: parseInt(post.reposts) || 0,
        linkedinPostUrl: post.linkedinPostUrl || `${profileInfo.profileUrl}/activity/post-${Date.now()}-${index}`,
        postDate: post.postDate ? new Date(post.postDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      }))

    // Enhanced API filtering summary
    console.log(`📊 API FILTERING SUMMARY:`);
    console.log(`  🔍 Posts received: ${preFilterCount}`);
    console.log(`  ✅ Posts accepted: ${validPosts.length}`);
    console.log(`  ❌ Posts filtered: ${preFilterCount - validPosts.length}`);
    console.log(`  📈 Acceptance rate: ${((validPosts.length / preFilterCount) * 100).toFixed(1)}%`);
    console.log(`📊 API FILTERING BREAKDOWN:`);
    console.log(`  No content: ${filterReasons.noContent}`);
    console.log(`  Short content: ${filterReasons.shortContent}`);

    if (validPosts.length === 0) {
      console.log(`❌ API: No valid posts after filtering - returning error`);
      return NextResponse.json({ error: 'No valid posts found in extracted data' }, { status: 400, headers: corsHeaders })
    }

    // Sort posts by likes descending
    validPosts.sort((a, b) => b.likes - a.likes)
    console.log(`📊 API: Sorted ${validPosts.length} posts by likes (top post: ${validPosts[0]?.likes} likes)`)

    // Prepare file data
    const profileData = {
      profileInfo: {
        profileUrl: profileInfo.profileUrl,
        username: username,
        fullName: profileInfo.fullName || '',
        profileImageUrl: profileInfo.profileImageUrl || ''
      },
      scrapedAt: new Date().toISOString(),
      postsCount: validPosts.length
    }

    const postsData = {
      profileUrl: profileInfo.profileUrl,
      scrapedAt: new Date().toISOString(),
      posts: validPosts
    }

    // Create file paths
    const profileFileName = `${username}_${timestamp}.json`
    const postsFileName = `${username}_${timestamp}_posts.json`
    
    const profileFilePath = join(process.cwd(), 'scraped-data', 'profiles', profileFileName)
    const postsFilePath = join(process.cwd(), 'scraped-data', 'posts', postsFileName)

    // Write files
    await writeFile(profileFilePath, JSON.stringify(profileData, null, 2))
    await writeFile(postsFilePath, JSON.stringify(postsData, null, 2))

    console.log(`✅ Successfully saved ${validPosts.length} posts to local files:`)
    console.log(`  Profile: ${profileFilePath}`)
    console.log(`  Posts: ${postsFilePath}`)

    return NextResponse.json({
      success: true,
      message: `Successfully scraped ${validPosts.length} posts from LinkedIn DOM`,
      files: {
        profile: profileFileName,
        posts: postsFileName
      },
      postsCount: validPosts.length,
      topPosts: validPosts.slice(0, 3).map(p => ({
        content: p.content.substring(0, 100) + '...',
        likes: p.likes,
        comments: p.comments
      }))
    }, { headers: corsHeaders })

  } catch (error) {
    console.error('Local scrape API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: corsHeaders })
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