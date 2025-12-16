export const typeDefs = /* GraphQL */ `
  scalar DateTime

  type User {
    id: ID!
    email: String!
    name: String!
    username: String!
    avatar: String
    bio: String
    role: String!
    createdAt: DateTime!
    conversations: [Conversation!]!
    conversationCount: Int!
  }

  type Philosopher {
    id: ID!
    name: String!
    slug: String!
    era: String!
    years: String!
    nationality: String!
    biography: String!
    portrait: String!
    systemPrompt: String!
    topics: [String!]!
    quotes: [String!]!
    conversationCount: Int!
  }


  type Conversation {
    id: ID!
    title: String!
    summary: String
    isPublic: Boolean!
    isAnonymous: Boolean!
    viewCount: Int!
    forkCount: Int!
    createdAt: DateTime!
    updatedAt: DateTime!
    user: User
    philosopher: Philosopher!
    messages(limit: Int): [Message!]!
    forkedFrom: Conversation
    likes(limit: Int): [Like!]!
    likeCount: Int!
    comments(limit: Int): [Comment!]!
    commentCount: Int!
    isLikedByMe: Boolean!
  }

  type Message {
    id: ID!
    content: String!
    role: String!
    createdAt: DateTime!
  }

  type Like {
    id: ID!
    user: User!
    createdAt: DateTime!
  }

  type Comment {
    id: ID!
    content: String!
    user: User!
    createdAt: DateTime!
    parentId: ID
    replies(limit: Int): [Comment!]!
    likeCount: Int!
    isLikedByMe: Boolean!
  }


  type AuthPayload {
    token: String!
    user: User!
  }

  type SendMessageResult {
    userMessage: Message!
    philosopherMessage: Message!
  }

  type Query {
    me: User
    philosophers(era: String, search: String): [Philosopher!]!
    philosopher(slug: String!): Philosopher
    feed(cursor: String, limit: Int, search: String, philosopherSlug: String): ConversationConnection!
    conversation(id: ID!): Conversation
    myConversations: [Conversation!]!
    userConversations(username: String!, cursor: String, limit: Int): ConversationConnection!
    user(username: String!): User
    # Notifications
    myNotifications(limit: Int, unreadOnly: Boolean): [Notification!]!
    unreadNotificationCount: Int!
    
    # Admin
    adminUsers(limit: Int): [User!]!
    adminConversations(limit: Int, search: String): ConversationConnection!
    analytics: Analytics
  }

  type Analytics {
    totalViews: Int!
    uniqueVisitors: Int!
    avgDuration: Int!
    topPages: [PageStat!]!
    topCountries: [CountryStat!]!
    recentVisitors: [PageViewRecord!]!
  }

  type PageStat {
    path: String!
    count: Int!
  }

  type CountryStat {
    country: String
    count: Int!
  }

  type PageViewRecord {
    id: ID!
    path: String!
    ipAddress: String
    country: String
    city: String
    userAgent: String
    duration: Int
    createdAt: DateTime!
  }




  type Notification {
    id: ID!
    type: String!
    conversationId: String
    actorId: String
    message: String!
    read: Boolean!
    createdAt: DateTime!
  }

  type ConversationConnection {
    edges: [Conversation!]!
    pageInfo: PageInfo!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }

  type Mutation {
    chatEphemeral(philosopherId: ID!, messages: [MessageInput!]!): String!
    register(email: String!, password: String!, name: String!, username: String!): AuthPayload!
    login(identifier: String!, password: String!): AuthPayload!
    # Password reset
    requestPasswordReset(email: String!): PasswordResetResponse!
    resetPassword(token: String!, newPassword: String!): AuthPayload!
    createConversation(philosopherId: ID!, title: String!): Conversation!
    sendMessage(conversationId: ID!, content: String!): SendMessageResult!
    togglePublic(conversationId: ID!): Conversation!
    setAnonymous(conversationId: ID!, isAnonymous: Boolean!): Conversation!
    forkConversation(conversationId: ID!, title: String): Conversation!
    deleteConversation(conversationId: ID!): Boolean!
    updateConversationTitle(conversationId: ID!, title: String!): Conversation!
    likeConversation(conversationId: ID!): Conversation!
    unlikeConversation(conversationId: ID!): Conversation!
    addComment(conversationId: ID!, content: String!, parentId: ID): Comment!
    deleteComment(commentId: ID!): Boolean!
    likeComment(commentId: ID!): Comment!
    unlikeComment(commentId: ID!): Comment!
    updateProfile(name: String, bio: String, avatar: String, username: String, currentPassword: String, newPassword: String): User!

    # Notifications
    markNotificationRead(notificationId: ID!): Notification!
    markAllNotificationsRead: Int!
    # Admin mutations
    adminDeleteConversation(conversationId: ID!): Boolean!
    adminDeleteComment(commentId: ID!): Boolean!
    adminDeleteUser(userId: ID!): Boolean!
    updateUserRole(userId: ID!, role: String!): User!
    
    # Philosopher Management (Admin)
    createPhilosopher(name: String!, slug: String!, era: String!, years: String!, nationality: String!, biography: String!, portrait: String!, systemPrompt: String!, topics: [String!]!, quotes: [String!]!): Philosopher!
    updatePhilosopher(id: ID!, name: String, slug: String, era: String, years: String, nationality: String, biography: String, portrait: String, systemPrompt: String, topics: [String!], quotes: [String!]): Philosopher!
    deletePhilosopher(id: ID!): Boolean!
  }


  type PasswordResetResponse {
    success: Boolean!
    message: String!
  }

  input MessageInput {
    role: String!
    content: String!
  }
`
