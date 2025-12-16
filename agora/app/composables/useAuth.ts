import { AUTH_COOKIE_NAME, AUTH_USER_COOKIE_NAME } from '../utils/constants'

interface User {
  id: string
  email: string
  name: string
  username: string
  avatar: string | null
  bio?: string | null
  role?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
}

export const useAuth = () => {
  // Global auth state
  const authState = useState<AuthState>('auth', () => ({
    user: null,
    token: null,
    isAuthenticated: false
  }))

  // Cookies ensure token is available during SSR
  const cookieOptions = {
    maxAge: 60 * 60 * 24 * 7, // 7 days (matches JWT expiry)
    sameSite: 'lax' as const,
    secure: !import.meta.dev // Secure in production, insecure for localhost
  }
  const authToken = useCookie(AUTH_COOKIE_NAME, cookieOptions)
  const authUser = useCookie<User | null>(AUTH_USER_COOKIE_NAME, cookieOptions)

  // Sync state with cookies immediately (Server & Client)
  if (authToken.value && authUser.value && !authState.value.token) {
    authState.value = {
      user: authUser.value,
      token: authToken.value,
      isAuthenticated: true
    }
  }

  const initialize = async () => {
    if (!authToken.value) return

    // Optimistic login if data exists and not already authenticated (e.g. client-side nav)
    if (authUser.value && !authState.value.isAuthenticated) {
      authState.value = {
        user: authUser.value,
        token: authToken.value,
        isAuthenticated: true
      }
    }

    // Always verify with backend to ensure token validity & get fresh user data
    try {
      const { data } = await $fetch<{ data: { me: User | null } }>('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken.value}`
        },
        body: {
          query: 'query { me { id email name username avatar bio role } }'
        }
      })

      if (!data?.me) {
        logout()
      } else {
        // Update user with latest data and ensure consistent state
        // We use login() here to ensure cookies and state are fully synced
        login(authToken.value, data.me)
      }
    } catch {
      logout()
    }
  }
  // Login
  const login = (token: string, user: User) => {
    authState.value = {
      user,
      token,
      isAuthenticated: true
    }

    authToken.value = token
    authUser.value = user
  }
  // Logout
  const logout = () => {
    authState.value = {
      user: null,
      token: null,
      isAuthenticated: false
    }

    authToken.value = null
    authUser.value = null
  }
  // Update user profile
  const updateUser = (updatedUser: Partial<User>) => {
    if (authState.value.user) {
      authState.value.user = {
        ...authState.value.user,
        ...updatedUser
      }

      authUser.value = authState.value.user
    }
  }
  // Computed getters
  const user = computed(() => authState.value.user)
  const token = computed(() => authState.value.token)
  const isAuthenticated = computed(() => authState.value.isAuthenticated)

  return {
    // State
    user,
    token,
    isAuthenticated,

    // Methods
    initialize,
    login,
    logout,
    updateUser,
    hasAuthCookie: computed(() => !!authToken.value)
  }
}
