import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const source = (page: Page) => page.locator('.cm-content')
const preview = (page: Page) => page.getByRole('region', { name: 'Nexus preview' }).locator('.nexus-description')
const sourceValue = (page: Page) => page.locator('.cm-line').allTextContents().then((lines) => lines.join('\n'))

async function replaceSource(page: Page, value: string) {
  await source(page).click()
  await page.keyboard.press('ControlOrMeta+A')
  await page.keyboard.insertText(value)
}

test.describe('desktop authoring workbench', () => {
  test.skip(({ isMobile }) => isMobile, 'desktop-only workbench behavior')

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(source(page)).toBeVisible()
  })

  test('loads the local-first workbench without horizontal overflow', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Mod Description Workbench' })).toHaveText('{}')
    await expect(page.getByRole('region', { name: 'Editor' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Nexus preview' })).toBeVisible()
    const brand = await page.getByRole('button', { name: 'Mod Description Workbench' }).boundingBox()
    const rail = await page.locator('.utility-rail').boundingBox()
    const documents = await page.locator('.utility-rail').getByTitle('Documents').boundingBox()
    expect(Math.abs((brand!.x + brand!.width / 2) - (documents!.x + documents!.width / 2))).toBeLessThanOrEqual(1)
    expect(Math.abs((brand!.x + brand!.width) - (rail!.x + rail!.width))).toBeLessThanOrEqual(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('fits the desktop Nexus canvas inside the split preview at default zoom', async ({ page }) => {
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    const geometry = await page.locator('.preview-stage').evaluate((stage) => {
      const surface = stage.querySelector('.nexus-surface')!
      const stageStyle = getComputedStyle(stage)
      const availableWidth = stage.clientWidth - Number.parseFloat(stageStyle.paddingLeft) - Number.parseFloat(stageStyle.paddingRight)
      return {
        availableWidth,
        stageClientWidth: stage.clientWidth,
        stageScrollWidth: stage.scrollWidth,
        intrinsicSurfaceWidth: surface.clientWidth,
        displayedSurfaceWidth: surface.getBoundingClientRect().width,
        fitScale: Number.parseFloat(getComputedStyle(surface).getPropertyValue('--preview-fit')),
      }
    })

    expect(geometry.intrinsicSurfaceWidth).toBe(1240)
    expect(geometry.displayedSurfaceWidth).toBeLessThanOrEqual(geometry.availableWidth + 1)
    expect(geometry.stageScrollWidth).toBeLessThanOrEqual(geometry.stageClientWidth + 1)
    expect(geometry.fitScale).toBeLessThan(1)
  })

  test('does not counteract browser zoom by recomputing the preview fit', async ({ page }) => {
    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    const surface = page.locator('.nexus-surface')
    const divider = page.getByRole('separator', { name: 'Resize editor and preview' })
    const initialScale = await surface.evaluate((element) => getComputedStyle(element).getPropertyValue('--preview-scale'))
    const handle = await divider.boundingBox()
    expect(handle).not.toBeNull()

    await page.evaluate(() => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: window.devicePixelRatio * 1.25 }))
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 100)
    await page.mouse.down()
    await page.mouse.move(handle!.x - 100, handle!.y + 100)
    await page.mouse.up()

    await expect.poll(() => surface.evaluate((element) => getComputedStyle(element).getPropertyValue('--preview-scale'))).toBe(initialScale)
  })

  test('owns and restores keyboard focus for drawers and export dialog', async ({ page }) => {
    const toolsTrigger = page.locator('.utility-rail').getByTitle('Tools')
    await toolsTrigger.click()
    await expect(page.getByRole('button', { name: 'Close tools' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(page.locator('.tools-drawer :focus')).toHaveCount(1)
    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Close tools' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(toolsTrigger).toBeFocused()

    const documentsTrigger = page.locator('.utility-rail').getByTitle('Documents')
    await documentsTrigger.click()
    await expect(page.getByRole('button', { name: 'Close documents' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(documentsTrigger).toBeFocused()

    const exportTrigger = page.getByRole('button', { name: 'Export', exact: true })
    await exportTrigger.click()
    await expect(page.getByRole('button', { name: 'Download Markdown' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(exportTrigger).toBeFocused()
  })

  test('keeps recovery points inside their document and confirms deletion', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Documents').click()
    await page.getByRole('button', { name: 'New description' }).click()
    const entry = page.locator('.document-entry').filter({ hasText: 'Untitled description' })
    const originalEntry = page.locator('.document-entry').filter({ hasText: 'Schedule I — Better Dealers' })
    const originalToggle = originalEntry.getByRole('button', { name: 'Recovery points for Schedule I — Better Dealers' })
    const recoveryToggle = entry.getByRole('button', { name: 'Recovery points for Untitled description' })

    await originalToggle.click()
    const originalRecovery = originalEntry.getByRole('region', { name: 'Recovery points for Schedule I — Better Dealers' })
    await expect(originalRecovery).toContainText('For Schedule I — Better Dealers')
    const originalRecoveryBox = await originalRecovery.boundingBox()
    const nextDocumentBox = await entry.boundingBox()
    expect(nextDocumentBox!.y).toBeGreaterThanOrEqual(originalRecoveryBox!.y + originalRecoveryBox!.height)
    await originalToggle.click()

    await recoveryToggle.click()
    const recovery = entry.getByRole('region', { name: 'Recovery points for Untitled description' })
    await expect(recovery).toBeVisible()
    await expect(recovery).toContainText('For Untitled description')
    await expect(recovery).toContainText('No recovery points yet for this document.')
    await recoveryToggle.click()
    await expect(recovery).toBeHidden()

    await entry.getByRole('button', { name: 'Delete Untitled description' }).click()
    const confirmation = page.getByRole('alertdialog', { name: 'Delete “Untitled description”?' })
    await expect(confirmation).toContainText('cannot be undone')
    await confirmation.getByRole('button', { name: 'Cancel' }).click()
    await expect(entry).toBeVisible()
    await entry.getByRole('button', { name: 'Delete Untitled description' }).click()
    await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(entry).toHaveCount(0)
  })

  test('keeps all layout choices reachable from preview-only view', async ({ page }) => {
    const layouts = page.getByRole('group', { name: 'Workspace layout' })
    const recommendation = page.getByRole('button', { name: 'Use recommended Preview only layout' })
    await expect(layouts.getByRole('button', { name: 'Split view' }).locator('svg')).toHaveClass(/lucide-columns-2/)
    for (const width of [860, 1600]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(recommendation).toBeVisible()
      const recommendationBox = await recommendation.boundingBox()
      const layoutsBox = await layouts.boundingBox()
      expect(layoutsBox!.x - (recommendationBox!.x + recommendationBox!.width)).toBeLessThanOrEqual(8)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await recommendation.click()
    await expect(page.getByRole('region', { name: 'Editor' })).toBeHidden()
    await layouts.getByRole('button', { name: 'Split view' }).click()
    await layouts.getByRole('button', { name: 'Preview only' }).click()
    await expect(page.getByRole('region', { name: 'Editor' })).toBeHidden()
    await expect(layouts).toBeVisible()
    await expect(layouts.getByRole('button')).toHaveCount(3)
    await layouts.getByRole('button', { name: 'Split view' }).click()
    await expect(page.getByRole('region', { name: 'Editor' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Nexus preview' })).toBeVisible()
    await expect(page.locator('.utility-rail').getByText('Split')).toHaveCount(0)
  })

  test('matches the measured Nexus mobile quote, spoiler, list, and link geometry', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, `[size=5]Mod Description Workbench Fixture[/size]
[size=4]Typography[/size]
[b]Bold[/b] [i]Italic[/i] [u]Underline[/u] [s]Strike[/s]
[color=#d98f39]Hex colour[/color] [size=3]Size three[/size] [font=Courier New]Courier[/font]

[left]Left aligned[/left]
[center]Centred text[/center]
[right]Right aligned[/right]

[quote=Fixture author]A short quotation with [b]nested bold[/b].[/quote]
[code]const safe = "plain text only";[/code]

[list]
[*]First bullet
[*]Second bullet with [i]formatting[/i]
[/list]

[list=1]
[*]First numbered item
[*]Second numbered item
[/list]

[spoiler]Hidden fixture content[/spoiler]
[url=https://example.com]Example link[/url]
[line]

Blank line above and below this final sentence.`)
    await page.getByRole('button', { name: 'Preview only', exact: true }).click()
    await page.getByRole('button', { name: 'Mobile', exact: true }).click()
    await page.evaluate(() => document.fonts.ready)

    const metrics = await page.locator('.nexus-description').evaluate((container) => {
      const measure = (selector: string) => {
        const element = container.querySelector(selector)
        if (!element) return null
        const style = getComputedStyle(element)
        const rect = element.getBoundingClientRect()
        return {
          width: rect.width,
          height: rect.height,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          letterSpacing: style.letterSpacing,
          background: style.backgroundColor,
          borderLeft: style.borderLeft,
          padding: style.padding,
          margin: style.margin,
          top: rect.top,
          bottom: rect.bottom,
        }
      }

      return {
        quote: measure('.nexus-quote'),
        quoteBody: measure('.nexus-quote blockquote'),
        left: measure('div[style*="text-align: left"]'),
        center: measure('div[style*="text-align: center"]'),
        right: measure('div[style*="text-align: right"]'),
        code: measure('pre'),
        spoiler: measure('.nexus-public-spoiler'),
        spoilerButton: measure('.bbc-spoiler-show'),
        list: measure('ul'),
        orderedList: measure('ol'),
        link: measure('a'),
      }
    })
    const expectNear = (actual: number | undefined, expected: number, tolerance = 1) => expect(Math.abs((actual ?? Number.NaN) - expected)).toBeLessThanOrEqual(tolerance)

    expect(metrics.quote).toMatchObject({ fontSize: '13px', lineHeight: '19.5px', letterSpacing: '0.3px', background: 'rgb(56, 56, 56)', padding: '15px', margin: '0px 0px 15px' })
    expectNear(metrics.quote?.width, 345.2)
    expectNear(metrics.quote?.height, 69)
    expect(metrics.quote?.borderLeft).toContain('solid rgb(217, 143, 64)')
    expect(Number.parseFloat(metrics.quote?.borderLeft ?? '')).toBeGreaterThanOrEqual(5)
    expect(Number.parseFloat(metrics.quote?.borderLeft ?? '')).toBeLessThanOrEqual(5.6)
    expect(metrics.quoteBody).toMatchObject({ fontSize: '13px', lineHeight: '19.5px' })
    expectNear(metrics.quoteBody?.width, 309.6)
    expectNear(metrics.quoteBody?.height, 39)
    expect(metrics.spoiler).toMatchObject({ background: 'rgba(0, 0, 0, 0)', padding: '0px', margin: '0px' })
    expectNear(metrics.spoiler?.width, 345.2)
    expectNear(metrics.spoiler?.height, 24.1)
    expect(metrics.spoilerButton).toMatchObject({ fontSize: '11px', lineHeight: '16.5px', background: 'rgb(69, 69, 69)', padding: '3px', margin: '0px' })
    expectNear(metrics.spoilerButton?.width, 37.525)
    expectNear(metrics.spoilerButton?.height, 24.1)
    expect(metrics.list).toMatchObject({ fontSize: '13px', lineHeight: '19.5px', margin: '0px 0px 13px 15px' })
    expectNear(metrics.list?.width, 330.2)
    expectNear(metrics.list?.height, 49)
    expect(metrics.link).toMatchObject({ fontSize: '13px', lineHeight: '19.5px', letterSpacing: '0.3px' })
    // Chromium's platform font rasterization shifts this inline width by just
    // over one pixel between Windows and GitHub's Linux runner.
    expectNear(metrics.link?.width, 81.6625, 1.25)
    expectNear(metrics.link?.height, 16)
    expectNear(metrics.center!.top - metrics.left!.bottom, 0)
    expectNear(metrics.right!.top - metrics.center!.bottom, 0)
    expectNear(metrics.quote!.top - metrics.right!.bottom, 39)
    expectNear(metrics.code!.top - metrics.quote!.bottom, 15)
    expectNear(metrics.list!.top - metrics.code!.bottom, 26)
    expectNear(metrics.orderedList!.top - metrics.list!.bottom, 32.5)
    expectNear(metrics.spoiler!.top - metrics.orderedList!.bottom, 32.5)
    expectNear(metrics.link!.top - metrics.spoiler!.bottom, 21.1)
    await expect(page.getByText('About this mod', { exact: true })).toHaveCount(0)

    await page.locator('.bbc-spoiler-show').click()
    await expect(page.locator('.nexus-public-spoiler')).toHaveAttribute('open', '')
    await expect(page.locator('.bbc-spoiler-content')).toBeVisible()
    const revealedSpoiler = await page.locator('.bbc-spoiler-content').evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, border: style.border, margin: style.margin, padding: style.padding }
    })
    expect(revealedSpoiler).toMatchObject({ background: 'rgba(0, 0, 0, 0)', margin: '5px', padding: '5px' })
    expect(revealedSpoiler.border).toContain('dashed rgb(59, 59, 59)')

    await page.getByRole('button', { name: 'Desktop', exact: true }).click()
    const desktop = await page.locator('.nexus-surface').evaluate((surface) => {
      const description = surface.querySelector('.nexus-description')!
      const quote = surface.querySelector('.nexus-quote')!
      const surfaceStyle = getComputedStyle(surface)
      const descriptionStyle = getComputedStyle(description)
      const quoteStyle = getComputedStyle(quote)
      return {
        surfaceWidth: surface.getBoundingClientRect().width,
        surfacePadding: surfaceStyle.padding,
        surfaceBackground: surfaceStyle.backgroundColor,
        descriptionWidth: description.getBoundingClientRect().width,
        descriptionFontSize: descriptionStyle.fontSize,
        descriptionLineHeight: descriptionStyle.lineHeight,
        quoteWidth: quote.getBoundingClientRect().width,
        quoteHeight: quote.getBoundingClientRect().height,
        quotePadding: quoteStyle.padding,
      }
    })
    expect(desktop).toMatchObject({
      surfacePadding: '20px 140px 40px',
      surfaceBackground: 'rgb(41, 41, 46)',
      descriptionFontSize: '14px',
      descriptionLineHeight: '21px',
      quotePadding: '25px',
    })
    expectNear(desktop.surfaceWidth, 1240)
    expectNear(desktop.descriptionWidth, 960)
    expectNear(desktop.quoteWidth, 960)
    expectNear(desktop.quoteHeight, 71)
  })

  test('resizes split panes by pointer and keyboard and persists the ratio', async ({ page }) => {
    const divider = page.getByRole('separator', { name: 'Resize editor and preview' })
    await expect(divider).toBeVisible()
    const before = await page.getByRole('region', { name: 'Editor' }).boundingBox()
    const handle = await divider.boundingBox()
    expect(before).not.toBeNull()
    expect(handle).not.toBeNull()
    await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + 100)
    await page.mouse.down()
    await page.mouse.move(handle!.x + 110, handle!.y + 100)
    await page.mouse.up()
    const after = await page.getByRole('region', { name: 'Editor' }).boundingBox()
    expect(after!.width).toBeGreaterThan(before!.width + 60)
    const draggedRatio = Number(await divider.getAttribute('aria-valuenow'))
    expect(draggedRatio).toBeGreaterThan(54)
    await expect(page.locator('.save-status')).toContainText('Saved locally', { timeout: 5_000 })

    await page.reload()
    await expect(divider).toHaveAttribute('aria-valuenow', String(draggedRatio))
    await divider.focus()
    await page.keyboard.press('ArrowLeft')
    await expect(divider).toHaveAttribute('aria-valuenow', String(draggedRatio - 2))
    await divider.dblclick()
    await expect(divider).toHaveAttribute('aria-valuenow', '54')
  })

  test('keeps the preview identical when Markdown is converted to BBCode', async ({ page }) => {
    const before = await preview(page).innerHTML()
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(page.locator('.mode-tabs button.active')).toHaveText('BBCode')
    await expect(source(page)).toBeVisible()
    expect(await preview(page).innerHTML()).toBe(before)
  })

  test('reuses initialized editors while switching Markdown, BBCode, and Visual', async ({ page }) => {
    await page.locator('.cm-editor').evaluate((element) => { (globalThis as typeof globalThis & { sourceEditorInstance?: Element }).sourceEditorInstance = element })
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    expect(await page.locator('.cm-editor').evaluate((element) => (globalThis as typeof globalThis & { sourceEditorInstance?: Element }).sourceEditorInstance === element)).toBe(true)

    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    await expect(page.locator('.visual-editor')).toBeVisible()
    await page.locator('.visual-editor').evaluate((element) => { (globalThis as typeof globalThis & { visualEditorInstance?: Element }).visualEditorInstance = element })
    await page.getByRole('button', { name: 'Markdown', exact: true }).click()
    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    expect(await page.locator('.visual-editor').evaluate((element) => (globalThis as typeof globalThis & { visualEditorInstance?: Element }).visualEditorInstance === element)).toBe(true)
    await expect(page.getByText('Loading visual editor…')).toHaveCount(0)
  })

  test('keeps Nexus-only styling identical when BBCode is converted to Markdown', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    await replaceSource(page, '[size=3][color=#fb923c]Release[/color][/size]\n[quote=Bars]Stable[/quote]\n[list=1]\n[*]Fast\n[*]Local\n[/list]\n[center]Centred[/center]')
    const before = await preview(page).innerHTML()
    await page.getByRole('button', { name: 'Markdown', exact: true }).click()
    await expect(page.locator('.mode-tabs button.active')).toHaveText('Markdown')
    await expect(source(page)).toBeVisible()
    expect(await preview(page).innerHTML()).toBe(before)
  })

  test('opens and closes Visual without rewriting BBCode', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    const original = '[color=#fb923c][b]Exact source[/b][/color]\n[quote=Bars]Do not rewrite me[/quote]'
    await replaceSource(page, original)
    const previewBefore = await preview(page).innerHTML()
    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    await expect(page.locator('.visual-editor-content')).toBeVisible()
    expect(await preview(page).innerHTML()).toBe(previewBefore)
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    expect(await sourceValue(page)).toBe(original)
    expect(await preview(page).innerHTML()).toBe(previewBefore)
  })

  test('renders complex Nexus BBCode in Visual without changing its source', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    const original = '[color=#fb923c][b]Release[/b][/color]\n[quote=Bars]Stable[/quote]\n[list=1]\n[*]Fast\n[*]Local\n[/list]\n[spoiler]Secret[/spoiler]\n[img width=640 height=360]https://example.com/a.png[/img]'
    await replaceSource(page, original)
    const previewBefore = await preview(page).innerHTML()

    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    const visual = page.locator('.visual-editor-content')
    await expect(visual).toBeVisible()
    await expect(visual.locator('blockquote[data-cite="Bars"]')).toContainText('Stable')
    await expect(visual.locator('ol li')).toHaveText(['Fast', 'Local'])
    await expect(visual.locator('details.bbc-spoiler')).toContainText('Secret')
    await expect(visual.locator('img')).toHaveAttribute('width', '640')
    expect(await preview(page).innerHTML()).toBe(previewBefore)

    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    expect(await sourceValue(page)).toBe(original)
    expect(await preview(page).innerHTML()).toBe(previewBefore)

    await page.getByRole('button', { name: 'Markdown', exact: true }).click()
    expect(await preview(page).innerHTML()).toBe(previewBefore)
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    expect(await sourceValue(page)).toBe(original)
  })

  test('matches the public Nexus preview styling while remaining editable', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, '[size=3]Size three[/size]\n[quote=Fixture author]A short quotation.[/quote]\n[spoiler]Hidden fixture content[/spoiler]')
    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    await expect(page.locator('.visual-editor-content')).toBeVisible()

    const styles = await page.evaluate(() => {
      const read = (selector: string) => {
        const style = getComputedStyle(document.querySelector(selector)!)
        return { background: style.backgroundColor, color: style.color, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, padding: style.padding, margin: style.margin, fontStyle: style.fontStyle }
      }
      const visualSizeThree = [...document.querySelectorAll<HTMLElement>('.visual-editor-content span')].find((node) => node.textContent === 'Size three')!
      const previewSizeThree = [...document.querySelectorAll<HTMLElement>('.preview-pane .nexus-description span')].find((node) => node.textContent === 'Size three')!
      const visualQuote = document.querySelector<HTMLElement>('.visual-editor-content > blockquote')!
      return {
        canvas: read('.visual-editor-canvas'),
        preview: read('.nexus-surface'),
        quote: read('.visual-editor-content > blockquote'),
        previewQuote: read('.preview-pane .nexus-quote'),
        visualSizeThree: getComputedStyle(visualSizeThree).fontSize,
        previewSizeThree: getComputedStyle(previewSizeThree).fontSize,
        quoteAuthorDisplay: getComputedStyle(visualQuote, '::before').display,
        quoteBodyDisplay: getComputedStyle(visualQuote.querySelector('p')!).display,
      }
    })

    expect(styles.canvas).toMatchObject({ background: styles.preview.background, color: styles.preview.color, fontFamily: styles.preview.fontFamily, fontSize: styles.preview.fontSize, fontWeight: styles.preview.fontWeight, lineHeight: styles.preview.lineHeight, letterSpacing: styles.preview.letterSpacing })
    expect(styles.quote).toMatchObject({ background: styles.previewQuote.background, color: styles.previewQuote.color, padding: styles.previewQuote.padding, margin: styles.previewQuote.margin, fontStyle: styles.previewQuote.fontStyle })
    expect(styles.visualSizeThree).toBe(styles.previewSizeThree)
    expect(styles.quoteAuthorDisplay).toBe('inline')
    expect(styles.quoteBodyDisplay).toBe('inline')
    await expect(page.locator('.visual-editor-content details summary')).toHaveText(/Spoiler:\s*Show/)
    await expect(page.locator('.visual-editor-content .bbc-spoiler-content')).toBeVisible()
  })

  test('focuses Visual without outlining the entire document', async ({ page }) => {
    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    const visual = page.locator('.visual-editor-content')
    await visual.focus()

    expect(await visual.evaluate((element) => ({
      active: document.activeElement === element,
      boxShadow: getComputedStyle(element).boxShadow,
      focusVisible: element.matches(':focus-visible'),
    }))).toEqual({ active: true, boxShadow: 'none', focusVisible: true })
  })

  test('opens and closes Visual without rewriting Markdown', async ({ page }) => {
    const original = '# Exact Markdown\n\n**Do not rewrite me.**'
    await replaceSource(page, original)
    const previewBefore = await preview(page).innerHTML()
    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    await expect(page.locator('.visual-editor-content')).toBeVisible()
    await page.getByRole('button', { name: 'Markdown', exact: true }).click()
    expect(await sourceValue(page)).toBe(original)
    expect(await preview(page).innerHTML()).toBe(previewBefore)
  })

  test('stores an intentional Visual edit as canonical BBCode', async ({ page }) => {
    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    const visual = page.locator('.visual-editor-content')
    await expect(visual).toBeVisible()
    await visual.click()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.insertText('Edited visually')
    await page.keyboard.press('ControlOrMeta+A')
    await page.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(preview(page).locator('strong')).toHaveText('Edited visually')
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    expect(await sourceValue(page)).toContain('[b]Edited visually[/b]')
    await expect(preview(page).locator('strong')).toHaveText('Edited visually')
  })

  test('formats the active source selection rather than appending', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await expect(source(page)).toBeVisible()
    await replaceSource(page, 'Selected text')
    await page.keyboard.press('ControlOrMeta+A')
    await page.getByRole('button', { name: 'Bold', exact: true }).click()
    await expect(source(page)).toContainText('[b]Selected text[/b]')
    await expect(preview(page).locator('strong')).toHaveText('Selected text')
  })

  test('executes the documented source keyboard shortcuts', async ({ page }) => {
    await replaceSource(page, 'Keyboard text')
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.press('ControlOrMeta+B')
    expect(await sourceValue(page)).toBe('**Keyboard text**')
    await source(page).click()
    await page.keyboard.press('ControlOrMeta+F')
    await expect(page.locator('.cm-search')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('opens and accepts Nexus BBCode autocomplete from the keyboard', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, '[cod')
    await page.keyboard.press('ControlOrMeta+Space')
    const completion = page.locator('.cm-tooltip-autocomplete')
    await expect(completion).toBeVisible()
    await expect(completion).toContainText('[code]')
    await page.keyboard.press('Enter')
    expect(await sourceValue(page)).toContain('[code]\n\n[/code]')
  })

  test('visually distinguishes the active line from selected text', async ({ page }) => {
    await source(page).click()
    const colors = await page.evaluate(() => {
      const shell = document.querySelector('.app-shell')!
      const styles = getComputedStyle(shell)
      const activeLine = document.querySelector('.cm-activeLine')!
      return {
        activeToken: styles.getPropertyValue('--active-line').trim(),
        selectionToken: styles.getPropertyValue('--selection').trim(),
        activeBackground: getComputedStyle(activeLine).backgroundColor,
      }
    })
    expect(colors.activeToken).not.toBe(colors.selectionToken)
    expect(colors.activeBackground).toMatch(/^rgba\(255, 255, 255, 0\.02[45]\)$/)
  })

  test('opens settings, switches theme, and returns to the document', async ({ page }) => {
    await page.locator('.source-editor').evaluate((element) => { (globalThis as typeof globalThis & { editorBeforeSettings?: Element }).editorBeforeSettings = element })
    await page.locator('.utility-rail').getByTitle('Settings').click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.locator('.app-shell')).toBeHidden()
    await page.locator('.theme-choice').filter({ hasText: 'Light' }).click()
    await expect(page.locator('[data-theme="light"]', { has: page.locator('.settings-page') })).toBeVisible()
    await page.getByRole('button', { name: 'Back to editor', exact: true }).click()
    await expect(page.locator('.app-shell[data-theme="light"]')).toBeVisible()
    expect(await page.locator('.source-editor').evaluate((element) => (globalThis as typeof globalThis & { editorBeforeSettings?: Element }).editorBeforeSettings === element)).toBe(true)
    await expect(page.getByText('Loading source editor…')).toHaveCount(0)
  })

  test('exports the current document in Nexus BBCode and exposes workspace import', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, '[b]Portable[/b]\n[color=#fb923c]Exact[/color]')
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const panel = page.getByRole('dialog', { name: 'Export and import' })
    await expect(panel).toBeVisible()
    for (const action of [
      'Download Markdown',
      'Download Nexus BBCode',
      'Download rich HTML',
      'Download plain text',
      'Copy Nexus BBCode',
      'Download workspace (.mdw)',
      'Import workspace',
    ]) {
      await expect(panel.getByRole('button', { name: action, exact: true })).toBeVisible()
    }
    const downloadEvent = page.waitForEvent('download')
    await panel.getByRole('button', { name: 'Download Nexus BBCode' }).click()
    const download = await downloadEvent
    expect(download.suggestedFilename()).toBe('schedule-i-better-dealers.bbcode.txt')
    expect(await readFile((await download.path())!, 'utf8')).toBe('[b]Portable[/b]\n[color=#fb923c]Exact[/color]')
  })

  test('searches settings by controls, validates theme imports, and exports a custom theme', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Settings').click()
    const search = page.getByPlaceholder('Search settings')
    await search.fill('font')
    await expect(page.locator('.settings-nav nav').getByRole('button')).toHaveText(['Editor'])
    await search.fill('')
    const themeFile = page.locator('input[type="file"][accept*="application/json"]').last()
    await themeFile.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"tokens":{}}') })
    await expect(page.getByRole('alert')).toHaveText('Invalid theme file.')
    const theme = { name: 'QA theme', dark: true, tokens: { canvas: '#111111', surfaceLow: '#181818', surfaceRaised: '#222222', border: '#333333', text: '#eeeeee', muted: '#aaaaaa', accent: '#dd7733', accentHover: '#ee8844', focus: '#5599cc' } }
    await themeFile.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(theme)) })
    await expect(page.getByRole('status')).toContainText('Imported theme “QA theme”')
    await expect(page.getByLabel('Theme name')).toHaveValue('QA theme')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export theme' }).click()
    expect((await download).suggestedFilename()).toBe('qa-theme.mdw-theme.json')
  })

  test('navigates expanded settings, resets a category, and confirms destructive data reset', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Settings').click()
    await page.getByPlaceholder('Search settings').fill('checkpoint')
    await expect(page.locator('.settings-nav nav').getByRole('button')).toHaveText(['Autosave & recovery'])
    await page.getByRole('button', { name: 'Autosave & recovery' }).click()
    await expect(page.getByRole('heading', { name: 'Autosave & recovery' })).toBeVisible()
    await expect(page.getByText('50', { exact: true })).toBeVisible()

    await page.getByPlaceholder('Search settings').fill('')
    await page.getByRole('button', { name: 'Editor', exact: true }).click()
    await page.getByLabel('Source font size').fill('20')
    await page.getByRole('button', { name: 'Reset editor settings' }).click()
    await expect(page.getByLabel('Source font size')).toHaveValue('14')

    await page.getByRole('button', { name: 'Images', exact: true }).click()
    await page.getByRole('button', { name: 'Open image library' }).click()
    await expect(page.getByRole('heading', { name: 'Image library' })).toBeVisible()
    await page.getByRole('button', { name: 'Close tools' }).click()
    await page.locator('.utility-rail').getByTitle('Settings').click()
    await page.getByRole('button', { name: 'Templates & components' }).click()
    await page.getByRole('button', { name: 'Open components' }).click()
    await expect(page.getByRole('heading', { name: 'Reusable components' })).toBeVisible()
    await page.getByRole('button', { name: 'Close tools' }).click()
    await page.locator('.utility-rail').getByTitle('Settings').click()
    await page.getByRole('button', { name: 'Privacy & data' }).click()
    await page.getByRole('button', { name: 'Reset all local data' }).click()
    await page.getByRole('button', { name: 'Confirm reset all local data' }).click()
    await expect(page.getByRole('status')).toContainText('All local workspace data was reset')
    await page.getByRole('button', { name: 'Back to editor' }).click()
    await expect(page.getByLabel('Document title')).toHaveValue(/Better Dealers/)
  })

  test('inserts Markdown underline and strike with Nexus-identical preview styling', async ({ page }) => {
    await replaceSource(page, 'Format me')
    await page.keyboard.press('ControlOrMeta+A')
    await page.getByRole('button', { name: 'Underline', exact: true }).click()
    await expect(preview(page).locator('u')).toHaveText('Format me')
    await page.keyboard.press('ControlOrMeta+A')
    await page.getByRole('button', { name: 'Strike', exact: true }).click()
    await expect(preview(page).locator('s')).toContainText('Format me')
  })

  test('inserts colour and spoiler tools into Markdown as Nexus-compatible source', async ({ page }) => {
    await page.getByRole('button', { name: 'Choose colour' }).click()
    await expect(page.getByRole('heading', { name: 'Colour picker' })).toBeVisible()
    await page.getByRole('button', { name: 'Insert colour' }).click()
    expect(await sourceValue(page)).toContain('[color=#d97732]coloured text[/color]')
    await expect(preview(page).locator('span[style*="color"]').last()).toContainText('coloured text')
    await page.getByRole('button', { name: 'Build spoiler' }).click()
    await page.getByLabel('Hidden content').fill('Browser-tested secret')
    await page.getByRole('button', { name: 'Insert spoiler' }).click()
    expect(await sourceValue(page)).toContain(':::spoiler Installation notes')
    await expect(preview(page).locator('details').filter({ hasText: 'Browser-tested secret' })).toBeVisible()
  })

  test('keeps colour and spoiler tools working through BBCode and Visual', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, 'Start')
    await page.getByRole('button', { name: 'Choose colour' }).click()
    await page.getByRole('button', { name: 'Insert colour' }).click()
    expect(await sourceValue(page)).toContain('[color=#d97732]coloured text[/color]')
    await page.getByRole('button', { name: 'Build spoiler' }).click()
    await page.getByLabel('Hidden content').fill('BBCode secret')
    await page.getByRole('button', { name: 'Insert spoiler' }).click()
    expect(await sourceValue(page)).toContain('[spoiler]BBCode secret[/spoiler]')

    await page.getByRole('button', { name: 'Visual', exact: true }).click()
    await page.getByRole('button', { name: 'Choose colour' }).click()
    await page.getByRole('button', { name: 'Insert colour' }).click()
    await expect(preview(page).locator('span[style*="color"]').last()).toContainText('coloured text')
    await page.getByRole('button', { name: 'Build spoiler' }).click()
    await page.getByLabel('Hidden content').fill('Visual secret')
    await page.getByRole('button', { name: 'Insert spoiler' }).click()
    await expect(preview(page).locator('details').filter({ hasText: 'Visual secret' })).toBeVisible()
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    expect(await sourceValue(page)).toContain('[spoiler]')
    expect(await sourceValue(page)).toContain('Visual secret')
  })

  test('stores, inserts, and deletes reusable components and templates', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'components', exact: true }).click()
    await page.getByLabel('Component name').fill('QA callout')
    await page.getByRole('button', { name: 'Save current source' }).click()
    await expect(page.getByText('QA callout')).toBeVisible()
    await page.getByRole('button', { name: 'Delete component QA callout' }).click()
    await expect(page.getByText('QA callout')).toHaveCount(0)
    await page.getByRole('button', { name: 'templates', exact: true }).click()
    await page.getByLabel('Template name').fill('QA template')
    await page.getByRole('button', { name: 'Save current document' }).click()
    await expect(page.getByText('QA template')).toBeVisible()
    await page.getByRole('button', { name: 'Delete template QA template' }).click()
    await expect(page.getByText('QA template')).toHaveCount(0)
  })

  test('configures, updates, reviews, and detaches a linked component instance', async ({ page }) => {
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, '[b]{{version}}[/b]')
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'components', exact: true }).click()
    await page.getByLabel('Component name').fill('Linked release')
    await page.getByRole('button', { name: 'Add variable' }).click()
    await expect(page.getByRole('complementary', { name: 'Authoring tools' }).getByText('{{version}}', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Save current source' }).click()
    await page.getByRole('button', { name: 'Close tools' }).click()

    await replaceSource(page, '')
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'components', exact: true }).click()
    await page.getByRole('button').filter({ hasText: 'Linked release' }).first().click()
    await page.getByLabel('version', { exact: true }).fill('2.0.0')
    await page.getByRole('button', { name: 'Insert linked instance' }).click()
    expect(await sourceValue(page)).toContain('[b]2.0.0[/b]')
    await expect(preview(page).locator('strong')).toHaveText('2.0.0')

    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'components', exact: true }).click()
    await page.getByRole('button', { name: 'Edit component Linked release' }).click()
    await page.getByLabel('Definition source').fill('[color=#fb923c][b]{{version}}[/b][/color]')
    await expect(page.getByText('Update available')).toBeVisible()
    await page.getByText('Review changes').click()
    await expect(page.locator('.component-instance')).toContainText('[color=#fb923c]')
    await page.getByRole('button', { name: 'Apply update' }).click()
    await expect(page.getByRole('status')).toContainText('Linked instance updated')
    await page.getByRole('button', { name: 'Close tools' }).click()
    expect(await sourceValue(page)).toContain('[color=#fb923c][b]2.0.0[/b][/color]')
    await expect(preview(page).locator('span[style*="color"] strong')).toHaveText('2.0.0')

    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'components', exact: true }).click()
    await page.getByRole('button', { name: 'Detach' }).click()
    await expect(page.getByText('Linked instances in this document')).toHaveCount(0)
    await page.getByRole('button', { name: 'Close tools' }).click()
    expect(await sourceValue(page)).toContain('[color=#fb923c]')
  })

  test('inserts a built-in full-page template into the active authoring mode', async ({ page }) => {
    await replaceSource(page, '')
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'templates', exact: true }).click()
    await page.getByRole('button').filter({ hasText: 'Clean mod page' }).click()
    expect(await sourceValue(page)).toContain('# Mod name')
    await expect(preview(page)).toContainText('Compatibility')
  })

  test('inserts the canonical Nexus fidelity fixture without Markdown conversion drift', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'templates', exact: true }).click()
    await expect(page.getByRole('button').filter({ hasText: 'Nexus fidelity fixture v2' })).toBeDisabled()
    await page.getByRole('button', { name: 'Close tools' }).click()
    await page.getByRole('button', { name: 'BBCode', exact: true }).click()
    await replaceSource(page, '')
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'templates', exact: true }).click()
    await page.getByRole('button').filter({ hasText: 'Nexus fidelity fixture v2' }).click()
    expect(await sourceValue(page)).toContain('FIXTURE-END · MDW-PUBLIC-V2')
    await expect(preview(page)).toContainText('Nexus Public Fidelity Fixture v2')
    await expect(preview(page).locator('figure.nexus-quote')).toHaveCount(5)
    await expect(preview(page).locator('blockquote cite')).toHaveText(['Fixture author', 'Nested fixture'])
    await expect(preview(page).locator('ol')).toContainText('OL-3 · third numbered item')
    await expect(preview(page).locator('details.nexus-public-spoiler')).toHaveCount(2)
  })

  test('persists a private local image blob and reports cleanup after deletion', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByLabel('Alt text').fill('Tiny local image')
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z4VYAAAAASUVORK5CYII=', 'base64')
    await page.locator('input[type="file"][accept*="image/png"]').first().setInputFiles({ name: 'tiny.png', mimeType: 'image/png', buffer: png })
    await expect(preview(page).locator('img')).toHaveAttribute('src', /^blob:/)
    expect(await sourceValue(page)).toMatch(/!\[Tiny local image\]\(asset:\/\/[\w-]+\)/)
    await expect(page.locator('.save-status')).toContainText('Saved locally', { timeout: 5_000 })
    await page.reload()
    await expect(source(page)).toBeVisible()
    await expect(preview(page).locator('img')).toHaveAttribute('src', /^blob:/)
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await expect(page.getByText('tiny.png')).toBeVisible()
    await expect(page.locator('.asset-row').filter({ hasText: 'tiny.png' })).toContainText('1×1')
    await page.getByRole('button', { name: 'Delete tiny.png' }).click()
    await page.getByRole('button', { name: 'Confirm delete tiny.png' }).click()
    await expect(page.getByText('tiny.png')).toHaveCount(0)
    await expect(preview(page).locator('img')).toHaveCount(0)
    await expect(page.locator('.compatibility')).toContainText('issue')
  })

  test('tracks, replaces, and cleans remote image usage', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByLabel('Image URL').fill('https://example.com/old-banner.png')
    await page.getByLabel('Alt text').fill('Replaceable banner')
    await page.getByRole('button', { name: 'Add URL' }).click()
    expect(await sourceValue(page)).toContain('https://example.com/old-banner.png')

    await page.locator('.utility-rail').getByTitle('Tools').click()
    await expect(page.getByText(/used 1×/)).toBeVisible()
    await page.getByRole('button', { name: 'Replace Replaceable banner' }).click()
    await page.getByLabel('Replacement URL').fill('https://example.com/new-banner.png')
    await page.getByRole('button', { name: 'Replace everywhere' }).click()
    await expect(page.getByRole('status')).toContainText('replaced everywhere')
    await page.getByRole('button', { name: 'Close tools' }).click()
    expect(await sourceValue(page)).toContain('https://example.com/new-banner.png')
    expect(await sourceValue(page)).not.toContain('old-banner.png')

    await replaceSource(page, 'No image remains')
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await expect(page.getByText(/1 unused/)).toBeVisible()
    await page.getByRole('button', { name: 'Clean unused' }).click()
    await page.getByRole('button', { name: 'Confirm remove 1' }).click()
    await expect(page.getByRole('status')).toContainText('1 unused image removed')
    await expect(page.getByText('Replaceable banner')).toHaveCount(0)
  })

  test('exports and imports reusable component and template libraries', async ({ page }) => {
    await page.locator('.utility-rail').getByTitle('Tools').click()
    await page.getByRole('button', { name: 'components', exact: true }).click()
    await page.getByLabel('Component name').fill('Portable component')
    await page.getByRole('button', { name: 'Save current source' }).click()
    const componentDownloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export library' }).click()
    const componentDownload = await componentDownloadEvent
    expect(componentDownload.suggestedFilename()).toBe('mod-description-components.mdw-components.json')
    await page.getByRole('button', { name: 'Delete component Portable component' }).click()
    await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles((await componentDownload.path())!)
    await expect(page.getByRole('status')).toContainText('Imported 1 components')
    await expect(page.getByText('Portable component')).toBeVisible()

    await page.getByRole('button', { name: 'templates', exact: true }).click()
    await page.getByLabel('Template name').fill('Portable template')
    await page.getByRole('button', { name: 'Save current document' }).click()
    const templateDownloadEvent = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export library' }).click()
    const templateDownload = await templateDownloadEvent
    expect(templateDownload.suggestedFilename()).toBe('mod-description-templates.mdw-templates.json')
    await page.getByRole('button', { name: 'Delete template Portable template' }).click()
    await page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles((await templateDownload.path())!)
    await expect(page.getByRole('status')).toContainText('Imported 1 templates')
    await expect(page.getByText('Portable template')).toBeVisible()
    await page.getByRole('button').filter({ hasText: 'Portable template' }).click()
    expect((await sourceValue(page)).match(/# Better Dealers/g)).toHaveLength(2)
  })

  test('autosaves edits across a reload', async ({ page }) => {
    await replaceSource(page, '# Persistent draft\n\nStill here.')
    await expect(page.locator('.save-status')).toContainText('Saved locally', { timeout: 5_000 })
    await page.reload()
    await expect(source(page)).toBeVisible()
    await expect(source(page)).toContainText('Persistent draft')
    await expect(preview(page)).toContainText('Still here.')
  })
})
