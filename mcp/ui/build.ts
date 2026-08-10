import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const uiRoot = dirname(fileURLToPath(import.meta.url))
const root = resolve(uiRoot, '..', '..')
const outputPath = resolve(uiRoot, 'dist', 'nexus-preview.html')

export async function buildMcpUi() {
  const build = await Bun.build({
    entrypoints: [resolve(uiRoot, 'src', 'index.tsx')],
    target: 'browser',
    format: 'esm',
    minify: true,
    sourcemap: 'none',
    splitting: false,
    define: { 'process.env.NODE_ENV': '"production"' },
  })

  if (!build.success) {
    throw new AggregateError(build.logs, 'Could not build the MCP App preview')
  }

  const scriptOutput = build.outputs.find((output) => output.kind === 'entry-point')
  if (!scriptOutput) throw new Error('MCP App bundle did not contain an entry point')

  const [template, widgetCss, previewCss, normalFont, italicFont, script] = await Promise.all([
    readFile(resolve(uiRoot, 'src', 'index.html'), 'utf8'),
    readFile(resolve(uiRoot, 'src', 'widget.css'), 'utf8'),
    readFile(resolve(root, 'src', 'features', 'preview', 'nexusPreview.css'), 'utf8'),
    readFile(resolve(root, 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-opsz-normal.woff2')),
    readFile(resolve(root, 'node_modules', '@fontsource-variable', 'inter', 'files', 'inter-latin-opsz-italic.woff2')),
    scriptOutput.text(),
  ])

  const fontCss = `@font-face{font-family:"Inter Variable";font-style:normal;font-display:swap;font-weight:100 900;src:url(data:font/woff2;base64,${normalFont.toString('base64')}) format("woff2-variations")}@font-face{font-family:"Inter Variable";font-style:italic;font-display:swap;font-weight:100 900;src:url(data:font/woff2;base64,${italicFont.toString('base64')}) format("woff2-variations")}`
  const safeScript = (await script).replace(/<\/script/gi, '<\\/script')
  const html = template
    .replace('/*__MCP_APP_STYLES__*/', () => `${fontCss}\n${previewCss}\n${widgetCss}`)
    .replace('/*__MCP_APP_SCRIPT__*/', () => safeScript)

  if (html === template) throw new Error('MCP App template placeholders were not replaced')
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, html, 'utf8')
  return outputPath
}

if (import.meta.main) console.log(await buildMcpUi())
