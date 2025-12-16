// Composable for GraphQL requests with authentication
export const useGraphQL = () => {
  const { token } = useAuth()

  // Execute a GraphQL query/mutation with auth
  async function execute<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Add auth token if available
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`
    }

    const response = await $fetch<{ data?: T, errors?: { message: string }[] }>('/api/graphql', {
      method: 'POST',
      headers,
      body: {
        query,
        variables
      }
    })

    if (response.errors && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message || 'GraphQL Error')
    }

    return response.data as T
  }

  // Helper for queries
  async function query<T = unknown>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
    return execute<T>(queryString, variables)
  }

  // Helper for mutations
  async function mutate<T = unknown>(mutationString: string, variables?: Record<string, unknown>): Promise<T> {
    return execute<T>(mutationString, variables)
  }

  return {
    execute,
    query,
    mutate
  }
}
