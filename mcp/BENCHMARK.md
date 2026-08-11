# MCP design and integration benchmark

Measured on 2026-08-09 with Codex CLI 0.146.0 and `gpt-5.6-luna` at medium and high reasoning. The harness launches a fresh Codex process and local stdio MCP server for every case, records real `mcp_tool_call` events, and verifies the structured result plus the model's final answer.

## Decision

Ship the three single-operation tools. Keep the one-tool/action-dispatch server only as a benchmark control.

The split catalog is 4,354 serialized characters versus 2,708 for the consolidated catalog, but all four model/design groups completed 12/12 tasks correctly and scored 100/100 on presentation. At this scale, the consolidated tool's 38% catalog reduction did not improve content reliability or formatting. It also makes build, convert, and validate fields conditionally required behind one broad schema. Three focused tools retain clearer names, tighter required inputs, and independently useful output contracts.

This follows the MCP guidance that a tool should perform a single operation with clear typed inputs and outputs. Large catalogs can degrade model performance, but progressive discovery is intended for servers with hundreds or thousands of tools—not a catalog of three. Tool annotations improve model and host understanding but remain hints, not security enforcement.

Sources: [MCP server concepts](https://modelcontextprotocol.io/docs/learn/server-concepts), [MCP client best practices](https://modelcontextprotocol.io/docs/develop/clients/client-best-practices), [MCP tool annotations](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/), and [MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector).

## Real-model results

Two repetitions of six scenarios produced 12 runs per design/reasoning group, 48 total.

| Design | Reasoning | Task pass | One-call clean run | Presentation | Mean latency | Mean calls |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Split | Medium | 12/12 | 12/12 | 100/100 | 43.5 s | 1.00 |
| Split | High | 12/12 | 10/12 | 100/100 | 54.4 s | 1.17 |
| Consolidated | Medium | 12/12 | 10/12 | 100/100 | 31.8 s | 1.17 |
| Consolidated | High | 12/12 | 10/12 | 100/100 | 31.1 s | 1.17 |

Every group selected the correct operation, supplied valid arguments, preserved exact converter/build output, reported validation findings, retained supplied facts without the tested inventions, and generated compatibility-clean editorial BBCode. The strict misses were all the same efficiency behavior: after the prompt said “build and verify,” the model called the validator after build even though build already returned an empty `issues` array. No content result failed. The explicit server instructions and tool descriptions now say that build and convert already validate their output.

## Real Schedule I mod authoring benchmark

Measured on 2026-08-11 with `gpt-5.6-luna` at medium reasoning. This paired benchmark uses verified fact packets derived from seven real local projects whose published Nexus descriptions the author identified as preferred references: Drug Expansion, Forklift & Pallets, S1DedicatedServers, S1MAPI, S1API, BiggerLobbies, and HeatedDryingRacks.

The baseline and guided variants receive identical facts. Only the guided variant receives the authoring guide read from `nexus://compatibility/authoring-guide` over the real stdio MCP protocol. The deterministic 100-point rubric measures factual retention, absence of unsupported claims, section fit to the author's reference style, early decision information, Nexus BBCode compatibility, and restraint.

| Variant | Valid runs | Score at least 85 | Mean score | Mean latency | Mean input tokens | Mean output tokens |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline | 7/7 | 5/7 | 90.9 | 19.2 s | 17,285 | 372 |
| MCP guide | 7/7 | 7/7 | 96.7 | 19.9 s | 18,774 | 406 |

The guide improved Drug Expansion by 12 points, Forklift & Pallets by 10, and S1API by 19. Dedicated servers, S1MAPI, BiggerLobbies, and HeatedDryingRacks matched already-strong baselines. This is a bounded seven-case, one-repetition result, not a universal quality claim.

### Leakage controls

The generated model never receives a Nexus URL or ID, published description text, local repository path, reference prose, or scoring profile. Each process starts in its own empty scratch directory with user configuration ignored. Any shell, file, web, MCP, or dynamic-tool action invalidates the run. Each case also withholds distinctive published-description facts as leakage canaries; reproducing one invalidates the run. The measured matrix had zero contaminated runs and zero canary matches.

The first run also exposed a compatibility-validator gap: unsupported tags containing digits, such as `[h1]` and `[h2]`, were skipped by the BBCode tokenizer. The tokenizer now recognizes those tag names so the validator correctly reports them as unknown instead of granting a false compatibility pass.

Run the full paired matrix or one focused case with:

```powershell
bun run mcp:benchmark:real-mods --repetitions=1 --concurrency=4
bun run mcp:benchmark:real-mods --case=heated-drying-racks --repetitions=1 --concurrency=2
```

Latency and token counts are observational, not a speed ranking. Codex loaded the same large local skill context for both variants, and individual cloud runs varied widely. The paired task result is the defensible comparison.

OpenAI's current guidance recommends lean tool sets, representative evals, and using higher reasoning only when measured task quality improves. Luna supports MCP and both medium and high reasoning. In this bounded matrix high reasoning did not improve task or presentation quality over medium, so medium is the default for this workflow; high remains an opt-in for harder fact synthesis. Sources: [latest model guide](https://developers.openai.com/api/docs/guides/latest-model) and [GPT-5.6 Luna](https://developers.openai.com/api/docs/models/gpt-5.6-luna).

## Scenarios and scoring

The six scenarios cover valid and invalid validation, exact Markdown conversion, structured factual authoring, redundant-call behavior, and full editorial authoring. Assertions check tool/action routing, protocol success, exact structured values, factual completeness, absence of named unsupported inventions, compatibility issues, and preservation of the final BBCode.

Presentation is a deterministic 100-point rubric derived from the saved Nexus references under `docs/nexus-files`:

- 20 points: compatibility-clean BBCode.
- 15 points: compact centered title and italic tagline.
- 20 points: clear size-five section hierarchy.
- 20 points: feature bullets plus ordered installation/use steps.
- 10 points: complete requested sections.
- 10 points: restrained whitespace and no ornamental glyph runs.
- 5 points: restrained colors and fonts.

The clean Santa Hat reference informed the compact hierarchy, labelled lists, and ordered installation pattern. The richer Imperium reference showed that strong identity and complete sections can work, while also motivating penalties for repeated ornaments, excessive blank space, competing colors/fonts, and lore before essential information. The rubric scores formatting and factual structure; it is not a claim that one visual style fits every mod.

## Protocol verification

The automated suite connects over stdio and checks tool, prompt, and resource discovery; annotations; successful structured calls; invalid-input rejection without server termination; concurrent read-only calls; BBCode compatibility diagnostics; and the presentation rubric. Run it with:

```powershell
bun run test -- mcp
bun run mcp:benchmark --repetitions=2 --concurrency=4
```

Raw benchmark evidence is generated under `.artifacts/mcp-benchmark/` and intentionally remains disposable rather than tracked.
