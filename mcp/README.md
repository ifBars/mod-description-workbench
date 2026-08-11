# Nexus description MCP

The repository includes a local stdio MCP server that helps models produce paste-ready Nexus Mods BBCode using the same conversion and validation rules as Mod Description Workbench.

It is a companion process, not an application backend. It does not log in to Nexus Mods, access the workbench's IndexedDB data, scrape pages, edit listings, save drafts, or publish mods.

## Capabilities

- `write_nexus_mod_description` prompt: gives a model the evidence-bounded authoring guide plus verified mod facts.
- `build_nexus_description` tool: creates a conservative full description from structured facts.
- `convert_to_nexus_bbcode` tool: converts Markdown through the workbench's Nexus compatibility boundary.
- `validate_nexus_bbcode` tool: reports unsupported tags, broken nesting, local-only images, and raw scriptable HTML.
- `nexus://compatibility/authoring-guide` resource: exposes the supported tags, recommended structure, and factual-claim rules.
- Embedded MCP App: `build_nexus_description` and `convert_to_nexus_bbcode` open an interactive desktop/mobile preview in clients that support MCP Apps, using the workbench's renderer, preview CSS, and bundled fonts.

The tool result still includes plain text and structured `bbcode`/`issues` fields. Clients without MCP Apps support therefore receive the complete usable result without the embedded preview.

## Install without cloning the repository

On Windows, run this from PowerShell:

```powershell
irm -UseBasicParsing https://github.com/ifBars/mod-description-workbench/releases/latest/download/install-mcp.ps1 | iex
```

The installer downloads the latest self-contained Windows MCP release to your local app-data directory and registers it globally with Codex as `nexus-description-workbench`. It does not install the workbench source, Bun, Node.js, or any application backend. Restart Codex after installation, then use `/mcp` to confirm the server is connected.

Codex Desktop, the CLI, and the IDE extension share that global MCP configuration. The installer prints the executable path; the same executable can be selected as a local STDIO server with no arguments in other MCP Apps clients such as Claude Desktop.

For macOS, Linux, or users who prefer a runtime-based package, each GitHub release also includes a small `portable.zip`. Extract it and configure the client to run `node /absolute/path/to/server.js`. Node.js 20 or newer is required only for that portable build.

See the [latest release](https://github.com/ifBars/mod-description-workbench/releases/latest) for standalone and portable assets, checksums, and the installer as a downloadable file.

## Run from the repository

Install dependencies, then configure an MCP client to spawn the server over stdio:

```json
{
  "mcpServers": {
    "nexus-description-workbench": {
      "command": "bun",
      "args": [
        "run",
        "C:\\path\\to\\nexus-description-writer\\mcp\\start.ts"
      ]
    }
  }
}
```

This source-based setup is intended for contributors. The MCP client must launch the process with a normal local working environment where `bun` is available. The source entry point quietly rebuilds its local UI resource before opening the stdio protocol. No port, API key, or Nexus Mods account is required.

For a built JavaScript entry point:

```powershell
bun run mcp:build
node dist-mcp/server.js
```

Point the MCP client's `command` to `node` and its `args` to the absolute `dist-mcp/server.js` path. Rebuild after compatibility logic changes.

`mcp:build` creates both the server bundle and its self-contained preview resource. Verify that packaged entry point over stdio with:

```powershell
bun run mcp:smoke
```

## Embedded preview development

Build just the MCP App resource, or open its standalone development fixture:

```powershell
bun run mcp:ui
bun run mcp:ui:preview
```

The preview resource is intentionally self-contained: its JavaScript, fidelity CSS, and Inter font files are inlined so a host does not need to fetch a web application. The surrounding toolbar follows host theme and font variables, while the Nexus surface stays fixed to the measured workbench appearance. Arbitrary remote image and media domains are not granted by default.

## Suggested model workflow

1. Supply only verified repository facts or author-provided facts to `write_nexus_mod_description`.
2. Ask the model for raw Nexus BBCode.
3. Read the build result's `issues` array; call `validate_nexus_bbcode` only for BBCode supplied or changed separately.
4. In an MCP Apps client, inspect the embedded desktop/mobile preview. In another client, paste the result into Mod Description Workbench for the same preview and revision.
5. Paste the final BBCode into Nexus manually and review it there before saving.

The validator checks the workbench's known syntax boundary; it cannot guarantee that every factual claim is true or that Nexus has not changed its renderer.

See [BENCHMARK.md](./BENCHMARK.md) for the real-model integration matrix, presentation rubric, and the split-versus-consolidated tool decision.
