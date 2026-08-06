import { expect, test } from '@playwright/test'

test.describe('mobile authoring flow', () => {
  test.skip(({ isMobile }) => !isMobile, 'mobile-only responsive behavior')

  test('uses an explicit write/preview flow without overflow', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Nexus preview' })).toBeHidden()
    await page.locator('.mobile-modebar').getByRole('button', { name: 'Preview', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Nexus preview' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Editor' })).toBeHidden()
    await expect(page.locator('.preview-header').getByRole('button', { name: 'Mobile' })).toHaveClass(/active/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.locator('.mobile-modebar').getByRole('button', { name: 'Write', exact: true }).click()
    await expect(page.getByRole('region', { name: 'Editor' })).toBeVisible()
  })

  test('opens tools from the bottom navigation', async ({ page }) => {
    await page.goto('/')
    await page.locator('.mobile-bottom-nav').getByRole('button', { name: /Tools/ }).click()
    await expect(page.getByRole('heading', { name: 'Image library' })).toBeVisible()
    await expect(page.getByText('Local images stay private')).toBeVisible()
  })

  test('switches authoring formats from the mobile mode selector', async ({ page }) => {
    await page.goto('/')
    const mode = page.locator('.mobile-mode-select select')
    await expect(mode).toHaveValue('markdown')
    const nexusPreview = page.locator('.preview-pane .nexus-description')
    const previewBefore = await nexusPreview.innerHTML()
    await mode.selectOption('bbcode')
    await expect(page.locator('.cm-content')).toBeVisible()
    expect(await nexusPreview.innerHTML()).toBe(previewBefore)
    await mode.selectOption('visual')
    await expect(page.locator('.visual-editor-content')).toBeVisible()
    expect(await nexusPreview.innerHTML()).toBe(previewBefore)
    expect(await page.locator('.visual-editor-canvas').evaluate((element) => {
      const style = getComputedStyle(element)
      return { fontSize: style.fontSize, padding: style.padding, background: style.backgroundColor }
    })).toEqual({ fontSize: '13px', padding: '15px 15px 40px', background: 'rgb(41, 41, 46)' })
  })

  test('keeps full-page settings reachable on mobile', async ({ page }) => {
    await page.goto('/')
    await page.locator('header.app-header .mobile-menu').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.getByRole('button', { name: 'Back to editor' }).click()
    await expect(page.locator('.mobile-modebar')).toBeVisible()
  })
})
