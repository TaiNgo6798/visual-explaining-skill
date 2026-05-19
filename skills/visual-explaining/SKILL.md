---
name: visual-explaining
description: Explain, overview, summarize, or map out a codebase, module, feature, fix, or recent implementation. Use when the user asks for an overview, summary, info, explanation, or big-picture view of any code.
license: MIT
---

# Visual Explaining

Generate an explanation of a domain, module, fix, or feature as a single HTML artifact. Use diagrams when they clarify the topic; do not force every explanation into the same diagram-pair shape.

## When to Use

Use when:
- User says "overview", "explain", "summarize", "info", "map out", or "big picture" about code
- User asks "what does X do?" or "how does X work?" about a repo, module, or feature
- User asks for a summary of a fix, feature, or implementation just completed
- User says "give me an overview of this repo/service/module"

Do not use when:
- User wants a code review
- User wants an implementation plan instead of an explainer

## Output Contract

The primary deliverable is one local HTML file.

That HTML must contain:
1. explanation content based on real codebase facts
2. visual diagrams only where they improve understanding

The JSON spec used to generate the HTML is implementation detail unless the user explicitly asks for it.

Structure rules:
- Choose the smallest useful structure for the user's question.
- Put diagrams near the text they clarify.
- Do not add a diagram for sections that are clearer as prose, bullets, callouts, or file notes.
- Do not group unrelated prose at the top and all diagrams at the bottom.
- Legacy `text + mermaid` sections are valid for simple diagram-led explainers.
- Prefer flexible `blocks` when the explanation has mixed content.

Diagram rules:
- Mermaid source is the canonical diagram definition
- Mermaid is rendered client-side in the browser into SVG
- Do not depend on `mmdc` or any other globally installed local renderer
- Do not ask the user to install a renderer as part of this skill

Browser rules:
- Report the absolute HTML artifact path
- Report it as a clickable markdown file link when the client supports file-path links
- Report the matching `file:///...` URL
- Do not rely on markdown `file:///...` links inside webviews that rewrite URLs
- In VS Code-style chat clients, expect the artifact link to open the file in the editor, not the system browser
- Prefer launching the browser with the helper's `--open` flag as part of the workflow
- Only say the browser was opened if you actually launched it

PNG export:
- Generated HTML includes `Save page PNG` and `Save section PNG` buttons
- The buttons export the whole explainer or one section from the browser
- Export controls are filtered out of the captured PNG without changing the live page layout
- PNG export targets 4x resolution and automatically backs off for very large captures to stay inside browser canvas limits

## Process

### Step 1: Confirm Default Export Directory

Before generating any explainer, resolve where HTML artifacts should be stored.

Default path config file:
- `~/.visual-explaining-export-path`

Legacy fallback:
- If the new config file is missing, the renderer also reads `~/.ck-visual-explaining-export-path` for compatibility.

Rules:
- If the config file is missing or empty, ask the user where they want explainer HTML files stored by default.
- Persist that directory path into `~/.visual-explaining-export-path`.
- Reuse the stored path for future explainers.
- Ask again only when the user wants to change the default location.

Persist command after the user replies:

```bash
EXPORT_DIR="<absolute-directory-from-user>"
mkdir -p "$EXPORT_DIR"
printf '%s\n' "$EXPORT_DIR" > "$HOME/.visual-explaining-export-path"
```

Load the configured path:

```bash
EXPORT_DIR="$(cat "$HOME/.visual-explaining-export-path")"
```

### Step 2: Determine Scope and Explanation Shape

| Input | Scope | Useful Shape |
|-------|-------|--------------|
| "info on the codebase" | Top-level architecture: all major domains | Summary, major components, key files, dependency/data-flow diagrams |
| "info on `<module>`" | Module internals: files, responsibilities, data flow | Responsibilities, file map, callouts for conventions, focused diagrams |
| "how does X work?" | Code walkthrough: entry point through result | Ordered steps, important files, one flow diagram if useful |
| "info on what I just implemented" | Implementation summary: what changed, why, how | Problem, solution, impact, touched files, optional before/after diagram |
| "info on this fix/feature" | Change summary: problem -> solution -> result | Problem, root cause, fix, risk/test notes, optional flow diagram |

### Step 3: Gather Facts

- Read relevant files: entry points, services, configs, key functions
- Identify: components, data flow, dependencies, patterns used
- For recent changes: diff what was added or modified vs. before

Reference: `references/html-layouts.md` for HTML layout guidance and block schema examples.

### Step 4: Draft Explanation Sections

For each section or topic:
- Write a short heading
- Choose ordered blocks that fit the topic
- Keep each section focused on one idea, flow, subsystem, or change
- Split large explanations into multiple sections when the topic has distinct audiences or flows

Available block types:
- `text`: short prose paragraphs
- `list`: compact bullets
- `callout`: important decision, risk, convention, or takeaway
- `files`: file paths with short notes
- `mermaid`: diagram source rendered in the browser

Use a `mermaid` block only when relationships, flow, dependencies, state, or sequence are clearer visually.

### Step 5: Draft Mermaid Source

Rules:
- Use Mermaid as the source of truth for each diagram
- Keep each diagram scoped to the nearby section
- Prefer multiple smaller diagrams over one overloaded diagram
- Use real names from the codebase: files, modules, functions, services
- Keep labels compact so rendered SVG stays readable

Mermaid label safety:
- Treat flowchart labels as strict data: every node label must be quoted, even simple text, for example `API["API"]`.
- Every decision label must be quoted, for example `Gate{"Has access"}` and `Gate{"Device AND userFeatures[type]?"}`.
- Do not put nested double quotes inside labels. Use plain text or single quotes inside the label.
- Do not put raw line breaks inside quoted labels. Use `<br/>`, for example `DB["Database<br/>(Prisma)"]`.
- Do not wrap label text in escaped quotes or extra parentheses like `DB["(\"Database\n(Prisma)\")"]`; write `DB["Database<br/>(Prisma)"]`.
- Edge labels should stay compact and avoid brackets or double quotes. Prefer `-->|yes|` or `-->|reads draft|`.
- If the browser shows a Mermaid parse error, simplify the reported line's label first: remove nested quotes, brackets, raw newlines, and punctuation before changing diagram structure.

### Step 6: Generate the HTML Artifact

Use the local helper shipped with this skill:

```bash
SKILL_DIR="<absolute-path-to-this-skill-directory>"
EXPORT_DIR="$(cat "$HOME/.visual-explaining-export-path")"
cat <<'JSON' | node "$SKILL_DIR/scripts/render-html.js" \
  --stdin \
  --output "$EXPORT_DIR/visual-explainer.html"
{
  "title": "Payments Overview",
  "summary": "Short intro shown near the top of the page.",
  "sections": [
    {
      "heading": "Checkout Flow",
      "text": "Explanation text shown above the diagram.",
      "mermaid": "flowchart TD\n  User --> API --> Gateway"
    }
  ]
}
JSON
```

To open the result in the default browser:

```bash
SKILL_DIR="<absolute-path-to-this-skill-directory>"
EXPORT_DIR="$(cat "$HOME/.visual-explaining-export-path")"
cat <<'JSON' | node "$SKILL_DIR/scripts/render-html.js" \
  --stdin \
  --output "$EXPORT_DIR/visual-explainer.html" \
  --open
{
  "title": "Payments Overview",
  "summary": "Short intro shown near the top of the page.",
  "sections": [
    {
      "heading": "Checkout Flow",
      "text": "Explanation text shown above the diagram.",
      "mermaid": "flowchart TD\n  User --> API --> Gateway"
    }
  ]
}
JSON
```

Preferred behavior:
- Generate the HTML artifact
- Launch it with `--open` unless the user explicitly asked not to open the browser
- Treat clickable chat links as convenience links only, not as the primary browser-open mechanism
- If `--output` is relative, the renderer will resolve it inside the configured export dir (when `~/.visual-explaining-export-path` is set)
- If `--output` is omitted, the renderer writes into the configured export dir using a title-based filename

The input JSON shape is:

```json
{
  "title": "Payments Overview",
  "summary": "Short intro shown near the top of the page.",
  "sections": [
    {
      "heading": "Checkout Flow",
      "text": "Explanation text shown above the diagram.",
      "mermaid": "flowchart TD\n  User --> API --> Gateway"
    }
  ]
}
```

Flexible block input shape:

```json
{
  "title": "Payments Overview",
  "summary": "Short intro shown near the top of the page.",
  "sections": [
    {
      "heading": "Checkout Responsibilities",
      "blocks": [
        { "type": "text", "text": "Checkout coordinates validation, payment authorization, and order creation." },
        { "type": "files", "items": [
          { "path": "src/checkout/service.ts", "note": "Owns orchestration" },
          { "path": "src/payments/gateway.ts", "note": "Wraps provider calls" }
        ] },
        { "type": "callout", "title": "Boundary", "text": "Payment provider details stay behind the gateway." },
        { "type": "mermaid", "mermaid": "flowchart TD\n  Checkout --> Gateway --> Provider" }
      ]
    }
  ]
}
```

If you already have a JSON file temporarily, `--input /absolute/path/to/file.json` still works, but the preferred workflow is stdin so no `.spec.json` artifact needs to be created.

### Step 7: Report the Result

In the final response:
- state what the explainer covers
- give the artifact as a clickable absolute path link
- give the matching `file:///...` URL as secondary information
- if the browser was opened, say so plainly
- if the browser was not opened, give the local shell command needed to open it
- do not mention the JSON spec artifact unless the user explicitly asked for it
- mention browser opening only if it actually happened

Preferred response shape:

```md
Artifact: [architecture-overview.html](/absolute/path/to/architecture-overview.html)
Browser URL: file:///absolute/path/to/architecture-overview.html
To open in browser on macOS: `open /absolute/path/to/architecture-overview.html`
```

Do not wrap the `file:///...` URL in backticks if you want the client to auto-link it.
Prefer the clickable artifact path link as the primary user action.
Only say `I opened it in the default browser.` when the helper was run with `--open`.

## Key Principles

1. One HTML artifact, not mixed output formats
2. The artifact shape follows the explanation need
3. Use diagrams selectively and place them near the relevant explanation
4. Mermaid is canonical; browser rendering produces the SVG
5. No global/local renderer dependency
6. Use real codebase facts, not placeholder architecture language
7. Keep each section scoped tightly enough to stay readable
8. Prefer flexible blocks for mixed explanations; use legacy pairs only when the explainer is truly diagram-led

## Output Requirements

- The main deliverable is a single HTML file
- The HTML contains ordered explanation blocks chosen for the user's question
- Mermaid diagrams render in-browser to SVG
- The HTML includes PNG export buttons for the whole page and each section
- Multiple diagrams must be placed near the specific content they clarify
- Include the absolute file path and `file:///...` URL in the response
- Do not require a separate global renderer installation
