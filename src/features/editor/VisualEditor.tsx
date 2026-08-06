import Color from '@tiptap/extension-color'
import { Extension, mergeAttributes, Node as TiptapNode } from '@tiptap/core'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react'
import { bbcodeToVisualHTML } from '../../markup/bbcode'
import { visualHTMLToBBCode } from '../../markup/convert'
import type { EditorHandle } from './editorCommands'

interface VisualEditorProps {
  bbcode: string
  assetUrls?: Record<string, string>
  onChange: (bbcode: string) => void
}

const EMPTY_ASSET_URLS: Record<string, string> = {}

const NexusTextStyle = Extension.create({
  name: 'nexusTextStyleAttributes',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontFamily: {
          default: null,
          parseHTML: (element) => element.style.fontFamily.replace(/["']/g, '') || null,
          renderHTML: (attributes) => attributes.fontFamily ? { style: `font-family:${attributes.fontFamily}` } : {},
        },
        fontSize: {
          default: null,
          parseHTML: (element) => element.style.fontSize || null,
          renderHTML: (attributes) => attributes.fontSize ? { style: `font-size:${attributes.fontSize}` } : {},
        },
      },
    }]
  },
})

const NexusBlockquote = TiptapNode.create({
  name: 'blockquote',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return { cite: { default: null, parseHTML: (element) => element.getAttribute('data-cite') } }
  },
  parseHTML() { return [{ tag: 'blockquote' }] },
  renderHTML({ HTMLAttributes }) { return ['blockquote', mergeAttributes(HTMLAttributes, HTMLAttributes.cite ? { 'data-cite': HTMLAttributes.cite } : {}), 0] },
  addCommands() { return { toggleBlockquote: () => ({ commands }) => commands.toggleWrap(this.name) } },
})

const NexusSpoiler = TiptapNode.create({
  name: 'nexusSpoiler',
  group: 'block',
  content: 'block+',
  defining: true,
  parseHTML() { return [{ tag: 'details.bbc-spoiler', contentElement: 'div' }] },
  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'bbc-spoiler nexus-public-spoiler', open: 'open' }), ['summary', ['span', 'Spoiler:'], ' ', ['span', { class: 'bbc-spoiler-show' }, 'Show']], ['div', { class: 'bbc-spoiler-content' }, 0]]
  },
})

const NexusImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: { default: null, parseHTML: (element) => element.getAttribute('width') },
      height: { default: null, parseHTML: (element) => element.getAttribute('height') },
    }
  },
})

export const VisualEditor = forwardRef<EditorHandle, VisualEditorProps>(function VisualEditor({ bbcode, assetUrls = EMPTY_ASSET_URLS, onChange }, ref) {
  const lastEmittedBBCode = useRef<string | null>(null)
  const lastInputBBCode = useRef(bbcode)
  const visualHTML = useMemo(() => bbcodeToVisualHTML(bbcode, assetUrls), [assetUrls, bbcode])
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ blockquote: false, link: { openOnClick: false, autolink: true } }), NexusBlockquote, NexusSpoiler, TextStyle, NexusTextStyle, Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      NexusImage.configure({ allowBase64: true }), Placeholder.configure({ placeholder: 'Describe your mod in detail…' }),
    ],
    content: visualHTML,
    editorProps: { attributes: { class: 'visual-editor-content nexus-description', 'aria-label': 'Visual description editor' } },
    onUpdate: ({ editor: current }) => {
      const nextBBCode = visualHTMLToBBCode(current.getHTML())
      lastEmittedBBCode.current = nextBBCode
      onChange(nextBBCode)
    },
  })

  useLayoutEffect(() => {
    if (!editor || bbcode === lastEmittedBBCode.current || bbcode === lastInputBBCode.current) return
    lastInputBBCode.current = bbcode
    editor.commands.setContent(visualHTML, { emitUpdate: false })
  }, [bbcode, editor, visualHTML])

  useImperativeHandle(ref, () => ({
    insert(value) { editor?.chain().focus().insertContent(bbcodeToVisualHTML(value, assetUrls)).run() },
    run(command) {
      if (!editor) return
      const chain = editor.chain().focus()
      if (command === 'bold') chain.toggleBold().run()
      else if (command === 'italic') chain.toggleItalic().run()
      else if (command === 'underline') chain.toggleUnderline().run()
      else if (command === 'strike') chain.toggleStrike().run()
      else if (command === 'heading') chain.toggleHeading({ level: 2 }).run()
      else if (command === 'quote') chain.toggleBlockquote().run()
      else if (command === 'code') chain.toggleCode().run()
      else if (command === 'bulletList') chain.toggleBulletList().run()
      else if (command === 'orderedList') chain.toggleOrderedList().run()
      else if (command === 'link') chain.setLink({ href: 'https://example.com' }).run()
      else chain.unsetAllMarks().clearNodes().run()
    },
  }), [assetUrls, editor])

  return <div className="visual-editor"><div className="visual-editor-canvas"><EditorContent editor={editor} /></div></div>
})
