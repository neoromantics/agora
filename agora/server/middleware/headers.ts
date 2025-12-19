export default defineEventHandler((event) => {
  // Access control is handled by corsHandler in routeRules/nitro or manually if needed
  // Here we just set security headers

  // HSTS (HTTP Strict Transport Security) - Force HTTPS
  setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  // Prevent MIME type sniffing
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  // Clickjacking protection (allow from same origin)
  setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')

  // XSS Protection (legacy but good to have)
  setHeader(event, 'X-XSS-Protection', '1; mode=block')

  // Referrer Policy
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin')

  // Content Security Policy (Basic)
  // We allow scripts from self and our known CDN (fonts/images)
  // We don't want to be too strict to break Nuxt scripts, so we allow 'unsafe-inline' for now which Nuxt needs often
  const isDev = process.env.NODE_ENV === 'development'
  const scriptSrc = isDev ? '\'self\' \'unsafe-inline\' \'unsafe-eval\'' : '\'self\' \'unsafe-inline\''

  setHeader(event, 'Content-Security-Policy', `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https: wss:;`)
})
