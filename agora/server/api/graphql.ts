// GraphQL API endpoint using graphql-yoga with Nuxt H3
import { createSchema, createYoga } from 'graphql-yoga'
import type { H3Event } from 'h3'
import { typeDefs } from '../graphql/schema'
import { resolvers } from '../graphql/resolvers'
import type { Context } from '../graphql/context'

// Create schema
const schema = createSchema({
  typeDefs,
  resolvers
})

// Create yoga instance - receives H3Event as serverContext
const yoga = createYoga<{ event: H3Event }, Context>({
  schema,
  graphqlEndpoint: '/api/graphql',
  context: ({ event }) => {
    return { event }
  }
})

// Export handler
export default defineEventHandler(async (event) => {
  const { req, res } = event.node
  // Pass H3 event as serverContext so it's available in context factory
  return await yoga(req, res, { event })
})
