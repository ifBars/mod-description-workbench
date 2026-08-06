import { autocompletion, type CompletionContext } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { searchKeymap } from '@codemirror/search'
import { drawSelection, EditorView, highlightActiveLine, highlightActiveLineGutter, highlightSpecialChars, keymap, lineNumbers } from '@codemirror/view'
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { AuthoringMode } from '../../domain/types'
import { BB_CODE_COMPLETIONS } from '../../markup/bbcode'
import { applySourceCommand, type EditorHandle } from './editorCommands'

interface SourceEditorProps {
  content: string
  mode: AuthoringMode
  fontSize: number
  wordWrap: boolean
  onChange: (value: string) => void
}

function bbcodeCompletion(context: CompletionContext) {
  const word = context.matchBefore(/\[[a-z]*/i)
  if (!word || (word.from === word.to && !context.explicit)) return null
  return { from: word.from, options: BB_CODE_COMPLETIONS }
}

function modeExtensions(mode: AuthoringMode): Extension {
  return mode === 'markdown'
    ? markdown()
    : autocompletion({ override: [bbcodeCompletion], activateOnTyping: true, interactionDelay: 0 })
}

function editorTheme(fontSize: number) {
  return EditorView.theme({
    '&': { height: '100%', backgroundColor: 'transparent', fontSize: `${fontSize}px` },
    '.cm-scroller': { fontFamily: '"IBM Plex Mono", monospace', lineHeight: '1.65' },
    '.cm-content': { padding: '18px 0' },
    '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--muted-weak)', paddingLeft: '4px' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--active-line)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--selection) !important' },
  })
}

function useCompartment() {
  const [compartment] = useState(() => new Compartment())
  return compartment
}

export const SourceEditor = forwardRef<EditorHandle, SourceEditorProps>(function SourceEditor({ content, mode, fontSize, wordWrap, onChange }, ref) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const modeRef = useRef(mode)
  const synchronizing = useRef(false)
  const modeCompartment = useCompartment()
  const wrapCompartment = useCompartment()
  const labelCompartment = useCompartment()
  const themeCompartment = useCompartment()

  useLayoutEffect(() => { onChangeRef.current = onChange }, [onChange])
  useLayoutEffect(() => { modeRef.current = mode }, [mode])

  useLayoutEffect(() => {
    if (!host.current) return
    const runSourceCommand = (editor: EditorView, command: Parameters<typeof applySourceCommand>[4]) => {
      const selection = editor.state.selection.main
      const edit = applySourceCommand(editor.state.doc.toString(), selection.anchor, selection.head, modeRef.current, command)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: edit.value }, selection: { anchor: edit.anchor, head: edit.head }, scrollIntoView: true })
      return true
    }
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), drawSelection(),
          bracketMatching(), highlightActiveLine(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([{ key: 'Mod-b', run: (current) => runSourceCommand(current, 'bold') }, ...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          modeCompartment.of(modeExtensions(mode)),
          wrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
          labelCompartment.of(EditorView.contentAttributes.of({ 'aria-label': `${mode} source editor` })),
          themeCompartment.of(editorTheme(fontSize)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !synchronizing.current) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => { editor.destroy(); view.current = null }
    // Runtime configuration and content synchronization are handled by the narrow transaction adapters below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    view.current?.dispatch({ effects: modeCompartment.reconfigure(modeExtensions(mode)) })
  }, [mode, modeCompartment])

  useLayoutEffect(() => {
    view.current?.dispatch({ effects: wrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []) })
  }, [wordWrap, wrapCompartment])

  useLayoutEffect(() => {
    view.current?.dispatch({ effects: labelCompartment.reconfigure(EditorView.contentAttributes.of({ 'aria-label': `${mode} source editor` })) })
  }, [labelCompartment, mode])

  useLayoutEffect(() => {
    view.current?.dispatch({ effects: themeCompartment.reconfigure(editorTheme(fontSize)) })
  }, [fontSize, themeCompartment])

  useLayoutEffect(() => {
    const editor = view.current
    if (!editor || editor.state.doc.toString() === content) return
    synchronizing.current = true
    try { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content } }) }
    finally { synchronizing.current = false }
  }, [content])

  useImperativeHandle(ref, () => ({
    insert(inserted) {
      const editor = view.current
      if (!editor) return
      const { from, to } = editor.state.selection.main
      editor.dispatch({ changes: { from, to, insert: inserted }, selection: { anchor: from + inserted.length }, scrollIntoView: true })
      editor.focus()
    },
    run(command) {
      const editor = view.current
      if (!editor) return
      const selection = editor.state.selection.main
      const edit = applySourceCommand(editor.state.doc.toString(), selection.anchor, selection.head, modeRef.current, command)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: edit.value }, selection: { anchor: edit.anchor, head: edit.head }, scrollIntoView: true })
      editor.focus()
    },
  }), [])

  return <div className="source-editor" ref={host} aria-label={`${mode} source editor`} />
})
