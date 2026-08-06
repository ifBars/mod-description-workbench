import { Bold, Braces, Code2, Heading2, Image, Italic, Link, List, ListOrdered, Palette, Quote, RemoveFormatting, Strikethrough, Underline, View } from 'lucide-react'
import type { AuthoringMode, AuthoringToolTab } from '../../domain/types'
import type { EditorCommand } from './editorCommands'

interface FormattingToolbarProps {
  mode: AuthoringMode
  visual?: boolean
  onCommand: (command: EditorCommand) => void
  onModeChange: (mode: AuthoringMode) => void
  onOpenTools: (tab?: AuthoringToolTab) => void
}

const controls: Array<{ label: string; icon: typeof Bold; command: EditorCommand }> = [
  { label: 'Bold', icon: Bold, command: 'bold' }, { label: 'Italic', icon: Italic, command: 'italic' },
  { label: 'Underline', icon: Underline, command: 'underline' }, { label: 'Strike', icon: Strikethrough, command: 'strike' },
  { label: 'Heading', icon: Heading2, command: 'heading' }, { label: 'Quote', icon: Quote, command: 'quote' },
  { label: 'Code', icon: Code2, command: 'code' }, { label: 'Bullets', icon: List, command: 'bulletList' },
  { label: 'Numbered list', icon: ListOrdered, command: 'orderedList' },
]

export function FormattingToolbar({ mode, visual = false, onCommand, onModeChange, onOpenTools }: FormattingToolbarProps) {
  return (
    <div className="formatting-toolbar" role="toolbar" aria-label="Formatting">
      {controls.map(({ label, icon: Icon, command }) => (
        <button className="icon-button" key={label} type="button" title={label} aria-label={label}
          onClick={() => onCommand(command)}>
          <Icon aria-hidden="true" />
        </button>
      ))}
      <span className="toolbar-divider" />
      <button className="icon-button" type="button" title="Link" aria-label="Insert link" onClick={() => onCommand('link')}><Link /></button>
      <button className="icon-button" type="button" title="Colour" aria-label="Choose colour" onClick={() => onOpenTools('color')}><Palette /></button>
      <button className="icon-button" type="button" title="Image" aria-label="Manage images" onClick={() => onOpenTools('images')}><Image /></button>
      <button className="icon-button" type="button" title="Spoiler" aria-label="Build spoiler" onClick={() => onOpenTools('spoiler')}><View /></button>
      <button className={`icon-button ${mode === 'bbcode' && !visual ? 'active' : ''}`} type="button" title="BBCode source" aria-label="BBCode source" onClick={() => onModeChange('bbcode')}><Braces /></button>
      <button className="icon-button" type="button" title="Remove formatting" aria-label="Remove formatting" onClick={() => onCommand('removeFormatting')}><RemoveFormatting /></button>
    </div>
  )
}
