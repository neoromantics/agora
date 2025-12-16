import { test, expect } from '@playwright/test'

test.describe('Agora E2E Flows', () => {
  // Generate unique user for each test run to avoid conflicts
  const timestamp = Date.now()
  const username = `testuser_${timestamp}`
  const email = `testuser_${timestamp}@example.com`
  const password = process.env.E2E_TEST_PASSWORD || 'ComplexTestPass_9876!'

  test('User Registration and Chat Flow', async ({ page }) => {
    // 1. Register new account
    await page.goto('/auth/register')

    await page.fill('input[placeholder="Full Name"]', 'Test User')
    await page.fill('input[placeholder="Username"]', username)
    await page.fill('input[placeholder="Email"]', email)
    await page.fill('input[placeholder="Password"]', password)
    await page.fill('input[placeholder="Confirm Password"]', password)

    await page.click('button:has-text("Create Account")')

    // Check redirection to gallery
    await expect(page).toHaveURL(/.*\/gallery/)
    await expect(page.locator('h1')).toContainText('The Gallery of Minds')

    // 2. Start Conversation
    // Find card with Aristotle and click Start Conversation
    // Assuming Aristotle is usually present or we pick the first one
    const startBtn = page.locator('button:has-text("Start Conversation")').first()
    await startBtn.click()

    // Check redirection to conversation
    await expect(page).toHaveURL(/.*\/conversation\/.*/)

    // 3. Send Message
    const message = `What is virtue? [${timestamp}]`
    await page.fill('textarea[placeholder="Type your message..."]', message)
    await page.keyboard.press('Enter')

    // Verify message appears
    await expect(page.locator(`text=${message}`)).toBeVisible({ timeout: 10000 })

    // Verify response (wait for any response bubble that is not from user)
    // This is tricky as we don't know the text, but we can check for existence of a new bubble
    // or just wait a bit. For now, just verifying our message is enough for "send" functionality.
  })

  test('Mobile Layout Verification', async ({ page }) => {
    // Set viewport to iPhone 12/13/14
    await page.setViewportSize({ width: 390, height: 844 })

    // Go to a conversation page (we need to be logged in or public conversation?
    // New conversations require login. Let's just check the header on a public accessible page if possible.
    // Actually, let's just go to the gallery first, login, then check.
    // Or better, login first.

    // Login reuse logic would be better but for now let's just register ANOTHER user
    // or assume we can reuse the login state if configured (but we aren't sharing state here).

    // Fast register for mobile test
    await page.goto('/auth/register')
    const mobileUser = `mob_${Date.now()}`
    await page.fill('input[placeholder="Full Name"]', 'Mobile Test')
    await page.fill('input[placeholder="Username"]', mobileUser)
    await page.fill('input[placeholder="Email"]', `${mobileUser}@test.com`)
    await page.fill('input[placeholder="Password"]', password)
    await page.fill('input[placeholder="Confirm Password"]', password)
    await page.click('button:has-text("Create Account")')
    await expect(page).toHaveURL(/.*\/gallery/)

    // Go to conversation
    await page.locator('button:has-text("Start Conversation")').first().click()
    await expect(page).toHaveURL(/.*\/conversation\/.*/)

    // CHECK HEADER ELEMENTS

    // 1. Check text labels are hidden
    // The "Anonymous" text span has class 'hidden sm:inline', so it should be hidden on mobile
    const anonText = page.getByText('Anonymous')
    await expect(anonText).toBeHidden()

    // 2. Check Era text is hidden
    // Aristotle's era: "384-322 BC"
    const aristotleEra = page.getByText(/384-322 BC/)
    await expect(aristotleEra).toBeHidden()
  })

  test('Login Error Feedback', async ({ page }) => {
    await page.goto('/auth/login')

    // 1. Non-existent account
    await page.fill('input[name="email"]', 'ghost@example.com')
    await page.fill('input[name="password"]', 'anypass')
    await page.click('button:has-text("Sign In")')
    await expect(page.locator('.text-red-500')).toContainText('Account does not exist')

    // 2. Incorrect password (use the user from first test if possible, or register new)
    // Since tests are isolated or parallel, best to register a quick temp user to be safe
    await page.goto('/auth/register')
    const tempUser = `fail_${Date.now()}`
    await page.fill('input[placeholder="Full Name"]', 'Fail Test')
    await page.fill('input[placeholder="Username"]', tempUser)
    await page.fill('input[placeholder="Email"]', `${tempUser}@test.com`)
    await page.fill('input[placeholder="Password"]', password)
    await page.fill('input[placeholder="Confirm Password"]', password)
    await page.click('button:has-text("Create Account")')

    // Logout to test login failure
    // Find logout button in dropdown or assume we can go back to login (which should redirect if authed, so we need logout)
    // For speed, let's just clear cookies or use a new context? Playwright isolates tests by default.
    // Actually, let's just use a fresh context for step 2? Or just logout via UI.
    // UI Logout: Click user menu -> Sign Out
    await page.click('button:has([class*="i-lucide-chevron-down"])') // Dropdown trigger
    await page.click('text=Sign Out')

    // Now back at login? Or home. Go to login.
    await page.goto('/auth/login')
    await page.fill('input[name="email"]', `${tempUser}@test.com`)
    await page.fill('input[name="password"]', 'WrongPass!')
    await page.click('button:has-text("Sign In")')
    await expect(page.locator('.text-red-500')).toContainText('Incorrect password')
  })
})
