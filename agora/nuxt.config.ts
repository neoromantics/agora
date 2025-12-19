// https://nuxt.com/docs/api/configuration/nuxt-config

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/image'
  ],

  devtools: {
    enabled: true
  },

  // App base URL for deployment at /cafe
  app: {
    baseURL: process.env.NUXT_PUBLIC_BASE_URL || '/agora',
    head: {
      title: 'Agora - Conversations with Great Minds',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1' },
        { name: 'description', content: 'A platform for meaningful conversations with history\'s greatest philosophers and writers.' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/agora/favicon.png' },
        // Classical serif fonts
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },

        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  // Runtime configuration
  runtimeConfig: {
    // Server-side only
    jwtSecret: process.env.JWT_SECRET,
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    logLevel: process.env.LOG_LEVEL || 'INFO',
    disableLlm: process.env.DISABLE_LLM === 'true',
    // LLM Provider Configuration
    llmProvider: process.env.LLM_PROVIDER || 'gemini',
    llmModel: process.env.LLM_MODEL || 'gemma-3-27b-it',
    // MinIO Object Storage
    minioEndpoint: process.env.NUXT_MINIO_ENDPOINT || '',
    minioAccessKey: process.env.NUXT_MINIO_ACCESS_KEY || '',
    minioSecretKey: process.env.NUXT_MINIO_SECRET_KEY || '',
    minioBucket: process.env.NUXT_MINIO_BUCKET || 'agora',
    minioUseSsl: process.env.NUXT_MINIO_USE_SSL || 'false',
    // Public (exposed to client)
    public: {
      baseUrl: process.env.NUXT_PUBLIC_BASE_URL || '/agora'
    }
  },

  routeRules: {
    // Prerendering requires DB access, which we don't have during Docker build
    // '/': { prerender: true },
    // '/gallery': { prerender: true },
    // '/api/**': { cors: true },
    '/admin/**': {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }
  },

  compatibilityDate: '2025-01-15',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // Nuxt Image - configure IPX with correct baseURL for subpath deployment
  image: {
    provider: 'ipx',
    ipx: {
      // @ts-expect-error IPX options including alias are passed through at runtime
      alias: {
        // Map relative paths (e.g. /agora/api/img) to localhost to bypass external loopback latency
        [`${process.env.NUXT_PUBLIC_BASE_URL || '/agora/beta'}/api/img`]: `http://localhost:3000${process.env.NUXT_PUBLIC_BASE_URL || '/agora/beta'}/api/img`
      }
    },
    // Configure domains for IPX
    domains: [
      'localhost',
      '127.0.0.1',
      'vcm-51278.vm.duke.edu',
      'upload.wikimedia.org',
      'commons.wikimedia.org',
      'i.imgur.com',
      'lh3.googleusercontent.com',
      'secure.gravatar.com',
      'server.gravatar.com',
      'pbs.twimg.com'
    ]
  }
})
