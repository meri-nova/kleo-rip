'use client'

import { useState, useEffect } from 'react'
import { Post, Profile, ScrapeJob } from '@/lib/supabase'

interface DashboardProps {
  searchParams: { [key: string]: string | string[] | undefined }
}

export default function Dashboard({ searchParams }: DashboardProps) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [sortBy, setSortBy] = useState('likes')
  const [timeframe, setTimeframe] = useState('all')
  const [jobId, setJobId] = useState<string | null>(null)

  const profileUrl = searchParams.profile as string
  const initialJobId = searchParams.job as string

  useEffect(() => {
    if (profileUrl) {
      loadPosts()
    }
    if (initialJobId) {
      setJobId(initialJobId)
      pollJobStatus(initialJobId)
    }
  }, [profileUrl, initialJobId, sortBy, timeframe])

  const loadPosts = async () => {
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
  }

  const pollJobStatus = async (jobId: string) => {
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
  }

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
    return new Date(dateString).toLocaleDateString()
  }

  const formatNumber = (num: number) => {
    return num.toLocaleString()
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
          <div className="grid gap-6">
            {posts.map((post) => (
              <div key={post.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <p className="text-gray-800 mb-3">{post.content}</p>
                    <div className="flex gap-6 text-sm text-gray-500">
                      <span>👍 {formatNumber(post.likes)} likes</span>
                      <span>💬 {formatNumber(post.comments)} comments</span>
                      <span>🔄 {formatNumber(post.reposts)} reposts</span>
                      <span>👁️ {formatNumber(post.views)} views</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {post.post_date ? formatDate(post.post_date) : 'Unknown date'}
                    </p>
                    <a 
                      href={post.linkedin_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View on LinkedIn
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}