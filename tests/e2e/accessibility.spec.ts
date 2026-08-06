import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function expectNoWcagViolations(page: Page) {
  // The preview deliberately mirrors Nexus' captured colors. Scan the app
  // chrome and authoring UI without treating that third-party fidelity surface
  // as our design system.
  const results = await new AxeBuilder({ page }).exclude('.nexus-surface').withTags(wcagTags).analyze()
  const report = results.violations.map((violation) =>
    `${violation.id}: ${violation.help}\n${violation.nodes.map((node) => node.target.join(' ')).join('\n')}`,
  ).join('\n\n')
  expect(results.violations, report).toEqual([])
}

test.describe('WCAG smoke coverage', () => {
  test('workspace has no automated WCAG A/AA violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.app-shell')).toBeVisible()
    await expectNoWcagViolations(page)
  })

  test('settings has no automated WCAG A/AA violations', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    const categories = ['Appearance', 'Editor', 'Preview', 'Autosave & recovery', 'Images', 'Templates & components', 'Accessibility', 'Keyboard', 'Privacy & data']
    for (const category of categories) {
      await page.getByRole('button', { name: category, exact: true }).click()
      await expect(page.getByRole('heading', { name: category, exact: true })).toBeVisible()
      await expectNoWcagViolations(page)
    }
  })

  test('visual authoring and every overlay have no automated WCAG A/AA violations', async ({ page, isMobile }) => {
    await page.goto('/')
    if (isMobile) await page.locator('.mobile-mode-select select').selectOption('visual')
    else await page.getByRole('button', { name: 'Visual', exact: true }).click()
    await expect(page.locator('.visual-editor-content')).toBeVisible()
    await expectNoWcagViolations(page)

    await page.getByRole('button', { name: 'Tools', exact: true }).last().click()
    await expect(page.getByRole('complementary', { name: 'Authoring tools' })).toBeVisible()
    await expectNoWcagViolations(page)
    await page.getByRole('button', { name: 'Close tools' }).click()

    await page.getByRole('button', { name: 'Documents', exact: true }).last().click()
    await expect(page.getByRole('complementary', { name: 'Documents' })).toBeVisible()
    await expectNoWcagViolations(page)
    await page.getByRole('button', { name: 'Close documents' }).click()

    await page.getByRole('button', { name: 'Export', exact: true }).last().click()
    await expect(page.getByRole('dialog', { name: 'Export and import' })).toBeVisible()
    await expectNoWcagViolations(page)
  })

  test('in-app reduced motion removes drawer transitions', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Settings', exact: true }).last().click()
    await page.getByRole('button', { name: 'Accessibility', exact: true }).click()
    await page.getByRole('checkbox', { name: /Reduce motion/ }).check()
    await page.getByRole('button', { name: 'Back to editor' }).click()
    await expect(page.locator('[data-reduced-motion="true"]')).toBeVisible()
    await page.getByRole('button', { name: 'Tools', exact: true }).last().click()
    expect(await page.locator('.tools-drawer').evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s')
  })
})
