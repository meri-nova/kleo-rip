'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { Post, Profile } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

function DashboardContent() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [sortBy, setSortBy] = useState('likes')
  const [timeframe, setTimeframe] = useState('all')
  const [, setJobId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set())

  const searchParams = useSearchParams()
  const profileUrl = mounted ? searchParams.get('profile') : null
  const initialJobId = mounted ? searchParams.get('job') : null

  useEffect(() => {
    setMounted(true)
  }, [])

  const loadPosts = useCallback(async () => {
    if (!profileUrl) return
    
    try {
      setLoading(true)
      const params = new URLSearchParams({
        profileUrl,
        sortBy,
        timeframe
      })
      
      const response = await fetch(`/api/posts?${params}`)
      const data = await response.json()
      
      if (response.ok) {
        setProfile(data.profile)
        setPosts(data.posts)
      }
    } catch (error) {
      console.error('Failed to load posts:', error)
    } finally {
      setLoading(false)
    }
  }, [profileUrl, sortBy, timeframe])

  const pollJobStatus = useCallback(async (jobId: string) => {
    setScraping(true)
    
    const poll = async () => {
      try {
        const response = await fetch(`/api/scrape/status/${jobId}`)
        const data = await response.json()
        
        if (data.job) {
          if (data.job.status === 'completed') {
            setScraping(false)
            if (data.posts) {
              setPosts(data.posts)
            }
            loadPosts() // Refresh to get latest data
          } else if (data.job.status === 'failed') {
            setScraping(false)
            alert('Scraping failed: ' + data.job.error_message)
          } else {
            // Still running, poll again
            setTimeout(poll, 2000)
          }
        }
      } catch (error) {
        console.error('Failed to check job status:', error)
        setScraping(false)
      }
    }
    
    poll()
  }, [loadPosts])

  useEffect(() => {
    if (profileUrl) {
      loadPosts()
    }
    if (initialJobId) {
      setJobId(initialJobId)
      pollJobStatus(initialJobId)
    }
  }, [profileUrl, initialJobId, sortBy, timeframe, loadPosts, pollJobStatus])

  const handleRefresh = async () => {
    if (!profileUrl) return
    
    try {
      setScraping(true)
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedinUrl: profileUrl })
      })
      
      const data = await response.json()
      
      if (data.jobId) {
        setJobId(data.jobId)
        pollJobStatus(data.jobId)
      } else if (data.cached) {
        setScraping(false)
        setProfile(data.profile)
        setPosts(data.posts)
      }
    } catch (error) {
      console.error('Failed to start scraping:', error)
      setScraping(false)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  const truncateContent = (content: string, maxLength: number = 200) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const togglePostExpansion = (postId: string) => {
    setExpandedPosts(prev => {
      const newSet = new Set(prev)
      if (newSet.has(postId)) {
        newSet.delete(postId)
      } else {
        newSet.add(postId)
      }
      return newSet
    })
  }


  // Show loading while mounting to prevent hydration errors
  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">LinkedIn Post Scraper</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!profileUrl) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">LinkedIn Post Scraper</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">No profile URL provided. Please use the Chrome extension to scrape a LinkedIn profile.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">LinkedIn Posts</h1>
          <button
            onClick={handleRefresh}
            disabled={scraping}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Refresh'}
          </button>
        </div>

        {profile && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-2">{profile.full_name || profile.username}</h2>
            <p className="text-gray-600 mb-2">{profile.linkedin_url}</p>
            <p className="text-sm text-gray-500">
              {profile.last_scraped_at 
                ? `Last scraped: ${formatDate(profile.last_scraped_at)}`
                : 'Never scraped'
              }
            </p>
            <p className="text-sm text-gray-500">Total posts: {profile.post_count}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="likes">Likes</option>
                <option value="comments">Comments</option>
                <option value="reposts">Reposts</option>
                <option value="date">Date</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All time</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading posts...</p>
          </div>
        ) : scraping ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Scraping posts...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">No posts found. Try scraping this profile first.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {posts.map((post) => {
              const isExpanded = expandedPosts.has(post.id)
              const shouldTruncate = post.content && post.content.length > 200
              
              return (
                <div key={post.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  {/* LinkedIn-style header */}
                  <div className="p-4 pb-3">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-semibold text-sm">
                            {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || 'U'}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            {profile?.full_name || profile?.username || 'LinkedIn User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {post.post_date ? formatDate(post.post_date) : 'Unknown date'} • 
                            <span className="ml-1">🌐 Public</span>
                          </p>
                        </div>
                      </div>
                      <button className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                        </svg>
                      </button>
                    </div>
                    
                    {/* Post content */}
                    <div className="text-gray-900 leading-relaxed">
                      {post.content && (
                        <>
                          <p className="whitespace-pre-wrap text-sm">
                            {isExpanded || !shouldTruncate 
                              ? post.content 
                              : truncateContent(post.content)}
                          </p>
                          {shouldTruncate && (
                            <button
                              onClick={() => togglePostExpansion(post.id)}
                              className="text-gray-500 hover:text-blue-600 text-sm font-medium mt-2 flex items-center"
                            >
                              {isExpanded ? '...see less' : '...see more'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* LinkedIn-style engagement section */}
                  <div className="border-t border-gray-100">
                    {/* Engagement counts */}
                    <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center space-x-4">
                        {post.likes > 0 && (
                          <span className="flex items-center">
                            <span className="w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center mr-1">
                              👍
                            </span>
                            {formatNumber(post.likes)}
                          </span>
                        )}
                        {(post.comments > 0 || post.reposts > 0) && (
                          <span>
                            {post.comments > 0 && `${formatNumber(post.comments)} comments`}
                            {post.comments > 0 && post.reposts > 0 && ' • '}
                            {post.reposts > 0 && `${formatNumber(post.reposts)} reposts`}
                          </span>
                        )}
                      </div>
                      <a 
                        href={post.linkedin_post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-xs"
                      >
                        View on LinkedIn →
                      </a>
                    </div>

                    {/* LinkedIn-style action buttons */}
                    <div className="border-t border-gray-100 px-4 py-2">
                      <div className="flex items-center justify-around">
                        <button className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-gray-50 text-gray-600 text-sm">
                          <span>👍</span>
                          <span>Like</span>
                        </button>
                        <button className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-gray-50 text-gray-600 text-sm">
                          <span>💬</span>
                          <span>Comment</span>
                        </button>
                        <button className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-gray-50 text-gray-600 text-sm">
                          <span>🔄</span>
                          <span>Repost</span>
                        </button>
                        <button className="flex items-center space-x-2 px-4 py-2 rounded-md hover:bg-gray-50 text-gray-600 text-sm">
                          <span>📤</span>
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">LinkedIn Post Scraper</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}