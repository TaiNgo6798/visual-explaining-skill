# Visual Explaining Skill

An open-source LLM skill for generating a single local HTML explainer for a codebase, module, feature, fix, or recent implementation.

The generated HTML can mix prose, file notes, callouts, lists, and Mermaid diagrams. Mermaid renders in the browser, so the skill does not require a local Mermaid renderer.

## Contents

- `SKILL.md` - the skill instructions agents should load.
- `scripts/render-html.js` - the helper that renders an explainer spec into HTML.
- `templates/visual-explainer.html` - the browser-rendered HTML template.
- `references/html-layouts.md` - layout and spec examples for agents.
- `scripts/render-html.test.js` - Node test coverage for the renderer.

## Requirements

- Node.js 20 or newer.
- A browser with network access for Mermaid and PNG export dependencies loaded from jsDelivr.

## Test

```bash
npm test
```

## Manual Usage

```bash
cat <<'JSON' | node scripts/render-html.js --stdin --output ./visual-explainer.html
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
