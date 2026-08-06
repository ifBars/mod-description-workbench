# Mod Description Workbench Repository Guidance

## Product boundary

- Build a browser-only, local-first description editor and previewer. Do not add a backend, authentication, analytics, remote draft storage, or paid service without explicit approval.
- Never automate editing, saving, publishing, scraping, or bulk access on Nexus Mods. Use only repo-owned/manual screenshots and fixtures for compatibility work.
- Do not imply Nexus Mods affiliation or endorsement. Keep Nexus-like styling inside the preview surface; the surrounding app must have its own restrained workbench identity.

## Tooling

- Use Bun for package management and scripts. Do not use npm, pnpm, or yarn.
- Preserve Vite + React + strict TypeScript + Tailwind v4 unless a documented decision replaces it.
- Keep `App.tsx` as composition glue. Put route pages in `src/pages`, feature code in `src/features`, reusable primitives in `src/components`, persistence in `src/storage`, parsers/serializers in `src/markup`, and pure helpers in `src/lib`.
- Avoid direct React `useEffect`. Prefer derived state, event handlers, external stores, keyed lifecycles, and `useSyncExternalStore`; isolate unavoidable editor/DOM synchronization in narrowly owned adapters.

## Data and security

- Treat draft content, BBCode, Markdown, HTML, themes, templates, backups, image metadata, and URLs as untrusted input.
- Preview only sanitized allowlisted output. Never render arbitrary scriptable HTML or execute imported code.
- Version persisted schemas and exported backups. Migrations must be deterministic, tested, and non-destructive.
- Use IndexedDB for durable documents, snapshots, and image blobs; keep only small preferences in `localStorage`.
- Preserve source text where possible. Any format conversion that normalizes or drops content must warn before replacing the user's source.

## UX direction

- Build the working editor first, not a marketing landing page.
- Favor a compact, calm authoring workbench: quiet chrome, clear hierarchy, few borders, no nested card grids, fake metrics, glassmorphism, purple gradients, decorative blobs, or oversized empty states.
- Provide a true white/light theme and a neutral Cursor-like charcoal theme. Avoid Space Grotesk and generic AI-startup typography.
- Settings is a full-page surface with categorized navigation, search, live theme preview, reset-by-category, and import/export.
- Keep the primary write → preview → copy/export workflow obvious at desktop and mobile widths.

## Compatibility workflow

- Treat `docs/NEXUS_COMPATIBILITY.md` and manual fixtures under `.artifacts/nexus-reference/manual/` as the compatibility source of truth.
- Do not guess that generic BBCode is supported by Nexus. Add a parser/serializer rule only with a fixture or an explicit documented compatibility decision.
- Keep app-shell fidelity and Nexus-preview fidelity as separate review tracks.
- Never publish the testing mod. Manual reference capture may save an unpublished draft only when the user performs it themselves.

## Verification

- Run `bun run lint`, `bun run typecheck`, `bun run test`, and `bun run build` for implementation changes.
- Test parser round-trips, compatibility warnings, schema migrations, autosave/recovery, and import/export with deterministic fixtures.
- Inspect desktop and mobile layouts, keyboard navigation, light/dark themes, reduced motion, editor/preview modes, and persisted-state restoration.
- Before final UI handoff, compare the accepted concept and latest browser screenshots directly and resolve visible drift.
- Keep screenshots and disposable QA output under `.artifacts/`; remove temporary material before handoff unless it is an approved manual compatibility fixture.
