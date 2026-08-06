import { describe, expect, it } from 'vitest'
import type { ComponentDefinition } from './types'
import { componentVariableIssues, defaultComponentValues, renderComponent, validateComponentValue } from './components'

const definition: ComponentDefinition = {
  id: 'component', name: 'Release', mode: 'bbcode', createdAt: 1,
  content: '[color={{accent}}][b]{{title}}[/b][/color]{{#showLink}}\n[url={{url}}]Download[/url]{{/showLink}}\n{{variant}}',
  variables: [
    { id: 'title', name: 'title', type: 'text', defaultValue: 'Release' },
    { id: 'accent', name: 'accent', type: 'color', defaultValue: '#fb923c' },
    { id: 'show', name: 'showLink', type: 'boolean', defaultValue: true },
    { id: 'url', name: 'url', type: 'url', defaultValue: 'https://example.com' },
    { id: 'variant', name: 'variant', type: 'choice', defaultValue: 'Stable', options: ['Stable', 'Beta'] },
  ],
}

describe('linked reusable components', () => {
  it('derives defaults without mutable synchronization', () => expect(defaultComponentValues(definition)).toMatchObject({ title: 'Release', showLink: true }))
  it('renders typed variables and boolean sections', () => {
    const rendered = renderComponent(definition, { ...defaultComponentValues(definition), title: '2.0', showLink: false, variant: 'Beta' }, 'bbcode')
    expect(rendered).toContain('[b]2.0[/b]')
    expect(rendered).not.toContain('Download')
    expect(rendered).toContain('Beta')
  })
  it('falls back when a typed value is invalid', () => expect(renderComponent(definition, { ...defaultComponentValues(definition), accent: 'red' }, 'bbcode')).toContain('[color=#fb923c]'))
  it('converts the materialized instance to the target mode', () => expect(renderComponent(definition, defaultComponentValues(definition), 'markdown')).toContain('**Release**'))
  it('validates all constrained variable types', () => {
    expect(validateComponentValue('color', '#abcdef')).toBe(true)
    expect(validateComponentValue('url', 'javascript:alert(1)')).toBe(false)
    expect(validateComponentValue('image', 'asset://safe')).toBe(true)
    expect(validateComponentValue('choice', 'Nope', ['Stable'])).toBe(false)
  })

  it('explains undefined and unused variable tokens', () => {
    expect(componentVariableIssues('[b]{{missing}}[/b]', definition.variables)).toContain('{{missing}} has no matching variable.')
    expect(componentVariableIssues('[b]{{title}}[/b]', definition.variables)).toEqual(expect.arrayContaining(['accent is not used in the component source.', 'showLink is not used in the component source.']))
  })
})
