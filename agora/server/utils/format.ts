// Basic URL formatting for images
export const defaultBaseURL = '/agora'

export const getBaseURL = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  const config = useRuntimeConfig(event)
  return config.public.baseUrl || defaultBaseURL
}

export const formatImage = (rawUrl: string, type: string, id: string, baseURL: string) => {
  if (!rawUrl) return ''
  // Pass through direct URLs
  if (rawUrl.startsWith('/uploads/')) return `${baseURL}${rawUrl}`
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) return rawUrl
  if (rawUrl.startsWith('data:')) return rawUrl

  // Proxy internal/MinIO storage
  return `${baseURL}/api/img/${type}/${id}`
}

export const formatUser = (u: any, baseURL: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!u) return null
  return {
    ...u,
    avatar: formatImage(u.avatar, 'user', u.id, baseURL),
    conversationCount: u._count?.conversations || u.conversationCount || 0
  }
}

export const formatPhilosopher = (p: any, baseURL: string) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!p) return null
  return {
    ...p,
    era: p.era || 'Unknown Era',
    portrait: formatImage(p.portrait, 'philosopher', p.id, baseURL),
    conversationCount: p._count?.conversations || p.conversationCount || 0
  }
}
