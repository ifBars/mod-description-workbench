import type { AuthoringMode, ComponentDefinition, ComponentInstance, ComponentVariableType } from './types'
import { convertContent } from '../markup/convert'

export function defaultComponentValues(definition: ComponentDefinition) {
  return Object.fromEntries((definition.variables ?? []).map((variable) => [variable.name, variable.defaultValue]))
}

export function validateComponentValue(type: ComponentVariableType, value: string | boolean, options: string[] = []) {
  if (type === 'boolean') return typeof value === 'boolean'
  if (typeof value !== 'string') return false
  if (type === 'color') return /^#[0-9a-f]{6}$/i.test(value)
  if (type === 'url' || type === 'image') return /^(https:\/\/|asset:\/\/)/i.test(value)
  if (type === 'choice') return options.includes(value)
  return true
}

export function renderComponent(definition: ComponentDefinition, values: Record<string, string | boolean>, mode: AuthoringMode) {
  let rendered = definition.content
  for (const variable of definition.variables ?? []) {
    const candidate = values[variable.name] ?? variable.defaultValue
    const value = validateComponentValue(variable.type, candidate, variable.options) ? candidate : variable.defaultValue
    if (variable.type === 'boolean') {
      const section = new RegExp(`{{#${escapeRegExp(variable.name)}}}([\\s\\S]*?){{/${escapeRegExp(variable.name)}}}`, 'g')
      rendered = rendered.replace(section, value === true ? '$1' : '')
    }
    rendered = rendered.replace(new RegExp(`{{${escapeRegExp(variable.name)}}}`, 'g'), String(value))
  }
  return definition.mode === mode ? rendered : convertContent(rendered, definition.mode, mode)
}

export function componentUpdate(definition: ComponentDefinition, instance: ComponentInstance) {
  return renderComponent(definition, instance.values, instance.mode)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
