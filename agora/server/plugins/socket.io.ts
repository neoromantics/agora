import { Server as SocketServer } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { Redis } from 'ioredis'
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin'

export default defineNitroPlugin((nitroApp) => {
  const runtimeConfig = useRuntimeConfig()

  // Create Redis Client for Adapter (Pub/Sub)
  // We need two connections: one for pub, one for sub
  const pubClient = new Redis(runtimeConfig.redisUrl as string)
  const subClient = pubClient.duplicate()

  // Prevent crashes if Redis is unavailable (e.g. during build)
  pubClient.on('error', (err) => {
    console.warn('Redis Pub Client Error:', err.message)
  })
  subClient.on('error', (err) => {
    console.warn('Redis Sub Client Error:', err.message)
  })

  const io = new SocketServer({
    path: '/socket.io', // Standard path - assumes Ingress strips /agora prefix
    transports: ['websocket'], // Force WebSocket on server side too
    cors: {
      origin: '*', // Adjust in production
      methods: ['GET', 'POST']
    },
    // Disable per-message deflate to prevent "Invalid frame header" errors behind proxies
    perMessageDeflate: false,
    adapter: createAdapter(pubClient, subClient)
  })

  // Hook into Nitro's h3 server
  nitroApp.hooks.hook('request', (event) => {
    // Inject io into event context for API routes to use
    event.context.io = io
  })

  // Attach to the underlying Node.js HTTP server
  // Nuxt 3/Nitro exposes the server via hooks or directly
  // For dev/prod consistency, we often use the 'listening' hook or similar
  // But defineNitroPlugin runs before server listen.

  // We can access the engine's server if accessible, but standard Nitro way varies.
  // A reliable way in recent Nitro is hooking into 'close' to cleanup.

  // IMPORTANT: In dev mode (`npm run dev`), Vite/Nuxt dev server creates the HTTP server.
  // We need to attach IO to THAT server.
  // In production (`node .output/server/index.mjs`), it's the Nitro server.

  // Using a trick to attach to the server instance
  nitroApp.hooks.hook('request', (event) => {
    // Only attach once
    // @ts-expect-error - internal socket property
    if (!event.node.res.socket?.server?.io) {
      // @ts-expect-error - internal socket server
      const httpServer = event.node.res.socket?.server
      if (httpServer) {
        io.attach(httpServer)
        httpServer.io = io
      }
    }
  })

  io.on('connection', (socket) => {
    socket.on('join-conversation', (conversationId) => {
      socket.join(`conversation:${conversationId}`)
    })

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`)
    })

    socket.on('disconnect', () => {

    })
  })

  // Expose io on the global object or a singleton for easy access if context missing?
  // Better: Use `event.context.io` in resolvers.

  // Clean up
  nitroApp.hooks.hook('close', () => {
    io.close()
    pubClient.quit()
    subClient.quit()
  })
})
