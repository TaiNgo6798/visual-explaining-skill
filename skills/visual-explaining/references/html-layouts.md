# HTML Layout Reference

This skill renders a single HTML artifact. Diagrams are parsed from standard Mermaid specifications and rendered in the browser as interactive Cytoscape.js canvases (supporting drag-and-drop node organization and zoom/pan resizing).

## Core Layout Rules

- Produce one local HTML file per explainer
- The page contains one or more explanation sections
- Each section contains ordered content blocks
- The header includes `Save page PNG`
- Each section includes `Save section PNG`
- PNG export controls are filtered out of exported images without changing the live page layout
- PNG export targets 4x resolution and backs off for very large captures to avoid browser canvas failures
- Use diagrams only where they clarify relationships, flow, state, dependencies, or sequence
- Place diagrams near the content they clarify
- If the user asks for many diagrams, split the page into focused sections instead of one shared prose block
- Treat any JSON spec used for generation as internal workflow detail, not a user-facing artifact

## Section Shapes

### Architecture Overview

Use summary, component notes, file notes, and focused diagrams:

```text
Page Header
  -> intro summary

Section 1: System Shape
  -> text
  -> list of major components
  -> Mermaid dependency or data-flow diagram

Section 2: Important Files
  -> files block
  -> callout for conventions or boundaries
```

### Code Walkthrough

Use steps first; diagram only if the flow is non-obvious:

```text
Page Header
  -> intro summary

Section 1: Request Path
  -> ordered list of steps
  -> files block
  -> Mermaid flow diagram

Section 2: Key Decision
  -> text
  -> callout
```

### Change Summary

Use problem, solution, impact, files, and optional before/after flow:

```text
Page Header
  -> intro summary

Section 1: Problem and Fix
  -> text
  -> callout

Section 2: Changed Surface
  -> files block
  -> list of behavior changes
  -> optional Mermaid diagram
```

## Writing Guidance

- Keep each section scoped to one topic
- Prefer 1 to 3 short paragraphs or a short bullet list
- Use the section heading to anchor what the reader is looking at
- If one explanation needs a different audience or level of detail, make it a separate section
- Do not add placeholder diagrams; a clear file list or callout is better than a decorative graph

## Diagram Guidance

- Mermaid is the canonical source
- The browser renders Mermaid into SVG inside the page
- Prefer several smaller diagrams over one overloaded diagram
- Use real names from the repo: files, services, handlers, jobs, commands
- Keep node labels short enough that the diagram remains readable on laptop-width screens

## Generator

Before generation, ensure the default export directory is configured:

- Config file: `~/.visual-explaining-export-path`
- Legacy fallback: `~/.ck-visual-explaining-export-path`
- If missing/empty, ask the user for the default location, then persist it.

Persist command:

```bash
EXPORT_DIR="<absolute-directory-from-user>"
mkdir -p "$EXPORT_DIR"
printf '%s\n' "$EXPORT_DIR" > "$HOME/.visual-explaining-export-path"
```

Use command:

```bash
EXPORT_DIR="$(cat "$HOME/.visual-explaining-export-path")"
```

Use the helper that ships with the skill:

```bash
SKILL_DIR="<absolute-path-to-this-skill-directory>"
EXPORT_DIR="$(cat "$HOME/.visual-explaining-export-path")"
cat <<'JSON' | node "$SKILL_DIR/scripts/render-html.js" \
  --stdin \
  --output "$EXPORT_DIR/visual-explainer.html"
{
  "title": "Repository Overview",
  "summary": "Short intro for the whole page.",
  "sections": [
    {
      "heading": "Request Flow",
      "text": "Text shown above the diagram.",
      "mermaid": "flowchart TD\n  Client --> API --> Service"
    }
  ]
}
JSON
```

Optional browser open:

```bash
SKILL_DIR="<absolute-path-to-this-skill-directory>"
EXPORT_DIR="$(cat "$HOME/.visual-explaining-export-path")"
cat <<'JSON' | node "$SKILL_DIR/scripts/render-html.js" \
  --stdin \
  --output "$EXPORT_DIR/visual-explainer.html" \
  --open
{
  "title": "Repository Overview",
  "summary": "Short intro for the whole page.",
  "sections": [
    {
      "heading": "Request Flow",
      "text": "Text shown above the diagram.",
      "mermaid": "flowchart TD\n  Client --> API --> Service"
    }
  ]
}
JSON
```

If needed, the helper also accepts `--input /absolute/path/to/file.json`, but stdin is preferred so the workflow stays HTML-only from the user's perspective.
If `--output` is relative and config exists, the renderer resolves it inside the configured export directory.
If `--output` is omitted and config exists, the renderer uses a title-based filename in the configured export directory.

Preferred completion behavior:
- Use `--open` by default after generating the artifact
- Skip browser launch only when the user explicitly prefers not to open it
- Do not depend on clickable chat links to open the system browser

## Spec Format

Legacy diagram-led sections still work:

```json
{
  "title": "Repository Overview",
  "summary": "Short intro for the whole page.",
  "sections": [
    {
      "heading": "Request Flow",
      "text": "Text shown above the diagram.",
      "mermaid": "flowchart TD\n  Client --> API --> Service"
    },
    {
      "heading": "Background Jobs",
      "text": [
        "Jobs are queued by the API.",
        "Workers consume and persist results."
      ],
      "mermaid": "flowchart TD\n  API --> Queue --> Worker --> DB"
    }
  ]
}
```

Flexible sections use ordered blocks:

```json
{
  "title": "Repository Overview",
  "summary": "Short intro for the whole page.",
  "sections": [
    {
      "heading": "Request Flow",
      "blocks": [
        { "type": "text", "text": "Requests enter through the API and are delegated to the service layer." },
        { "type": "list", "items": ["Validate input", "Load domain state", "Persist result"] },
        { "type": "files", "items": [
          { "path": "src/api/routes.ts", "note": "Defines HTTP routes" },
          { "path": "src/domain/service.ts", "note": "Owns business logic" }
        ] },
        { "type": "callout", "title": "Boundary", "text": "Route handlers should stay thin." },
        { "type": "mermaid", "mermaid": "flowchart TD\n  Route --> Service --> Database" }
      ]
    }
  ]
}
```

## Reporting Rules

- Report the artifact as a clickable markdown file link using the absolute filesystem path
- Report the `file:///...` URL as secondary output
- Only claim the browser was opened if the open step was actually executed
- Do not mention ASCII fallback or renderer installation prompts
- In VS Code-like clients, expect the artifact link to open in the editor instead of the browser

Preferred reporting example:

```md
Artifact: [architecture-overview.html](/Users/name/project/docs/architecture-overview.html)
Browser URL: file:///Users/name/project/docs/architecture-overview.html
To open in browser on macOS: `open /Users/name/project/docs/architecture-overview.html`
```

Avoid wrapping the browser URL in backticks because some clients will render it as plain text instead of a clickable link.
Do not rely on markdown `file:///...` links in IDE webviews because some clients rewrite them through their own resource loader.
Prefer the clickable filesystem artifact link, or launch the browser directly with the helper's `--open` flag.
