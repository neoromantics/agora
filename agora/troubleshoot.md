# Troubleshooting Guide

This document contains solutions to common issues encountered during development of the Agora application.

## Table of Contents
- [UModal Content Renders Inline Instead of Overlay](#umodal-content-renders-inline-instead-of-overlay)
- [500 Errors on Admin Pages During SSR](#500-errors-on-admin-pages-during-ssr)
- [Mobile Menu Not Responding to Clicks](#mobile-menu-not-responding-to-clicks)

---

## UModal Content Renders Inline Instead of Overlay

### Symptom
When opening a `UModal`, the modal header and close button appear as a centered overlay, but the main content (form fields, etc.) renders inline at the bottom of the page.

### Root Cause
`UModal` uses Headless UI's Dialog component under the hood, which relies on a Portal to teleport modal content to the end of `<body>`. When the modal content is not placed in the correct slot, Headless UI cannot identify it as the dialog panel, causing it to render in the normal document flow instead of being portaled.

### Broken Code Example
```vue
<UModal v-model:open="isModalOpen">
  <UCard>
    <!-- Your content here -->
  </UCard>
</UModal>
```

### Solution
Wrap the modal content in a `<template #content>` slot:

```vue
<UModal v-model:open="isModalOpen">
  <template #content>
    <UCard>
      <!-- Your content here -->
    </UCard>
  </template>
</UModal>
```

### Additional Considerations
If you're experiencing hydration mismatches, wrap the entire `UModal` in `<ClientOnly>`:

```vue
<ClientOnly>
  <UModal v-model:open="isModalOpen">
    <template #content>
      <UCard>
        <!-- Your content here -->
      </UCard>
    </template>
  </UModal>
</ClientOnly>
```

### Why This Works
- The `#content` slot tells `UModal` to treat the wrapped content as the dialog panel
- Headless UI recognizes this and includes it in the portal
- Everything renders together as a unified overlay

**Reference**: Fixed in commit `78d8c72` (pages/admin/people.vue)

---

## 500 Errors on Admin Pages During SSR

### Symptom
- Navigating to admin pages (e.g., `/admin/users`, `/admin/conversations`) returns a 500 Internal Server Error
- Error occurs on both initial load and page refresh
- User is authenticated and has proper permissions

### Root Cause
The admin middleware was checking `isAuthenticated` during Server-Side Rendering (SSR), but this state was `false` because the `initialize()` function (which validates the token) only runs on the client-side. This caused a redirect during SSR, creating a routing conflict that resulted in 500 errors.

### The Problem in Detail
```typescript
// BAD: This causes 500 errors
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, isAuthenticated, hasAuthCookie, initialize } = useAuth()
  
  // This runs on BOTH server and client
  if (hasAuthCookie.value && !isAuthenticated.value) {
    // But initialize only runs on client!
    if (import.meta.client) {
      await initialize()
    }
  }
  
  // On server: isAuthenticated is still false here!
  // This redirect during SSR causes the 500 error
  if (!isAuthenticated.value || !user.value) {
    return navigateTo('/auth/login')
  }
})
```

### Solution
Separate server-side and client-side logic in the middleware:

```typescript
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, isAuthenticated, hasAuthCookie, initialize } = useAuth()

  // Server-side: Trust cookie presence + verify role from user cookie
  if (import.meta.server) {
    interface User {
      role?: string
    }
    const authUserCookie = useCookie<User | null>('auth_user')
    
    if (!hasAuthCookie.value) {
      return navigateTo({
        path: '/auth/login',
        query: { redirect: to.fullPath }
      })
    }

    // Defense-in-depth: verify ADMIN role without API call
    if (!authUserCookie.value || authUserCookie.value.role !== 'ADMIN') {
      return navigateTo('/')
    }

    // Allow SSR to continue
    return
  }

  // Client-side: Full token validation
  if (hasAuthCookie.value && !isAuthenticated.value) {
    await initialize()
  }

  if (!isAuthenticated.value || !user.value) {
    return navigateTo('/auth/login')
  }

  if (user.value.role !== 'ADMIN') {
    return navigateTo('/')
  }
})
```

### Why This Works
- **Server-side**: Only checks for cookie presence and role claim (no API calls, no loopback issues)
- **Client-side**: Performs full token validation with the backend
- No routing conflicts → No 500 errors
- Maintains security through defense-in-depth (cookie + client validation + API validation)

### Security Considerations
This approach is secure because:
1. Cookies are HttpOnly, Secure (in prod), and SameSite=lax
2. Server checks role claim from signed cookie
3. Client validates token freshness with backend immediately after hydration
4. All data fetches validate tokens server-side via GraphQL resolvers

**Reference**: Fixed in commits `03be75c` and `53c47eb` (middleware/admin.ts)

---

## Mobile Menu Not Responding to Clicks

### Symptom
On mobile viewports, clicking the hamburger menu button does nothing - the dropdown menu does not appear.

### Root Cause
The `UDropdown` component was wrapped in `<ClientOnly>`, which prevented proper event listener attachment during hydration on mobile devices.

### Broken Code Example
```vue
<ClientOnly>
  <UDropdown :items="menuItems">
    <UButton icon="i-lucide-menu" />
  </UDropdown>
</ClientOnly>
```

### Solution
Remove the `<ClientOnly>` wrapper and let the component hydrate normally:

```vue
<UDropdown :items="menuItems">
  <UButton icon="i-lucide-menu" />
</UDropdown>
```

### Why This Works
- `ClientOnly` was initially added to fix hydration issues, but it actually caused them for interactive components
- Removing it allows Vue to properly hydrate the component and attach event listeners
- Nuxt UI components are designed to handle SSR/hydration correctly on their own

### When to Use `ClientOnly`
Use `<ClientOnly>` for:
- Components that use browser-only APIs (window, document, etc.)
- Third-party libraries that don't support SSR
- Modals with portals (as in the first issue above)

Don't use for:
- Standard interactive components (buttons, dropdowns, inputs)
- Nuxt UI components (unless specifically needed for portals)

**Reference**: Fixed in commit `b4b4007` (layouts/admin.vue)

---

## General Debugging Tips

### Checking for SSR Issues
1. Look for `import.meta.client` or `import.meta.server` usage
2. Check if state is being accessed before it's initialized
3. Use browser dev tools to compare server-rendered HTML vs. client-hydrated HTML

### Hydration Mismatch Debugging
1. Check console for "Hydration mismatch" warnings
2. Verify that server and client are rendering the same content
3. Consider using `<ClientOnly>` for truly client-only content
4. Ensure data is available during SSR (not just client-side)

### Modal/Portal Issues
1. Always check if you're using the correct slot (`#content`, `#default`, etc.)
2. Inspect the DOM to see where content is actually rendering
3. Use browser dev tools to check if content is being portaled to `<body>`

---

*Document created: December 15, 2025*
*Last updated: December 15, 2025*
