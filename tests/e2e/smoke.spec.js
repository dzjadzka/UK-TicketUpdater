const { test, expect } = require('@playwright/test');

const inviteToken = process.env.E2E_INVITE_TOKEN || 'e2e-invite-token';
let registeredEmail;

const registerNewUser = async (page, email) => {
  await page.goto('/register');
  await page.fill('#invite', inviteToken);
  await page.fill('#email', email);
  await page.fill('#password', 'UserPass123!');
  
  // Submit the form by pressing Enter on the password field
  await page.locator('#password').press('Enter');
  
  // Wait for navigation to dashboard
  await page.waitForURL(/.*\/dashboard.*/, { timeout: 10000 });
  
  await expect(page.getByText(/Your ticket history/i)).toBeVisible();
  await expect(page.getByText(/No tickets yet/i)).toBeVisible();
};

test.describe.serial('Happy-path smoke tests', () => {
  test('registers a user and saves credentials', async ({ page }) => {
    registeredEmail = `e2e-${Date.now()}@example.com`;
    await registerNewUser(page, registeredEmail);

    await page.goto('/settings');
    await expect(page.getByText(/Credentials & Automation/i)).toBeVisible();
    await page.fill('#uk-number', '12345678');
    await page.fill('#uk-password', 'SecretPass123');
    await page.getByLabel('Enable automatic downloads').check();
    
    // Submit form by pressing Enter
    await page.locator('#uk-password').press('Enter');
    await expect(page.getByText(/Credentials saved successfully/i)).toBeVisible();
  });

  test('admin can see registered users', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'AdminPass123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    await expect(page).toHaveURL(/dashboard/);
    await page.goto('/admin/users');

    await expect(page.getByText(/Users/)).toBeVisible();
    await expect(page.getByRole('link', { name: registeredEmail })).toBeVisible();
  });
});
