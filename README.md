# Visual Explaining Skill

An open-source LLM skill for generating a single local HTML explainer for a codebase, module, feature, fix, or recent implementation.

The generated HTML can mix prose, file notes, callouts, lists, and Mermaid diagrams. Mermaid renders in the browser, so the skill does not require a local Mermaid renderer.

## Structure

The installable skill lives in `skills/visual-explaining/`:

```text
visual-explaining-skill/
├── README.md
├── LICENSE
├── package.json
├── tests/
│   └── render-html.test.js
└── skills/
    └── visual-explaining/
        ├── SKILL.md
        ├── agents/
        │   └── openai.yaml
        ├── assets/
        │   └── visual-explainer.html
        ├── references/
        │   └── html-layouts.md
        └── scripts/
            └── render-html.js
```

## Contents

- `skills/visual-explaining/SKILL.md` - the skill instructions agents should load.
- `skills/visual-explaining/agents/openai.yaml` - optional UI metadata for Codex-style skill lists.
- `skills/visual-explaining/scripts/render-html.js` - the helper that renders an explainer spec into HTML.
- `skills/visual-explaining/assets/visual-explainer.html` - the browser-rendered HTML template.
- `skills/visual-explaining/references/html-layouts.md` - layout and spec examples for agents.
- `tests/render-html.test.js` - Node test coverage for the renderer.

## Requirements

- Node.js 20 or newer.
- A browser with network access for Mermaid and PNG export dependencies loaded from jsDelivr.

## Test

```bash
npm test
```

## Manual Usage

```bash
cat <<'JSON' | node skills/visual-explaining/scripts/render-html.js --stdin --output ./visual-explainer.html
{
  "title": "Example Overview",
  "summary": "A short summary of the topic.",
  "sections": [
    {
      "heading": "Request Flow",
      "blocks": [
        { "type": "text", "text": "Requests enter through the API and move into the service layer." },
        { "type": "mermaid", "mermaid": "flowchart TD\n  Client --> API --> Service" }
      ]
    }
  ]
}
JSON
```

Open the generated HTML file in a browser. The page includes buttons to save the full explainer or individual sections as PNG images.

## License

MIT
