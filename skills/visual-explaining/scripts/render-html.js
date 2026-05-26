#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');

const templatePath = path.join(__dirname, '..', 'assets', 'visual-explainer.html');
const template = fs.readFileSync(templatePath, 'utf8');
const DEFAULT_EXPORT_PATH_FILE = path.join(os.homedir(), '.visual-explaining-export-path');
const LEGACY_EXPORT_PATH_FILE = path.join(os.homedir(), '.ck-visual-explaining-export-path');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\n/g, '&#10;');
}

function renderInlineText(text) {
  const value = String(text || '');
  const segments = value.split(/(`[^`]+`)/g);

  return segments
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (segment.startsWith('`') && segment.endsWith('`') && segment.length >= 2) {
        return `<code>${escapeHtml(segment.slice(1, -1))}</code>`;
      }

      return escapeHtml(segment);
    })
    .join('');
}

function normalizeTextBlocks(text) {
  if (Array.isArray(text)) {
    return text.map((entry) => String(entry).trim()).filter(Boolean);
  }

  return String(text || '')
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function renderTextBody(text) {
  const blocks = normalizeTextBlocks(text);
  return blocks
    .map((block) => {
      if (block.startsWith('- ')) {
        const items = block
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => line.replace(/^- /, ''));

        return `<ul>${items.map((item) => `<li>${renderInlineText(item)}</li>`).join('')}</ul>`;
      }

      return `<p>${renderInlineText(block)}</p>`;
    })
    .join('\n');
}

function renderTextBlock(block) {
  return [
    '<div class="content-block content-block--text">',
    renderTextBody(block.text || ''),
    '</div>',
  ].join('\n');
}

function renderListBlock(block) {
  const items = Array.isArray(block.items) ? block.items : [];
  return [
    '<div class="content-block content-block--list">',
    `<ul>${items.map((item) => `<li>${renderInlineText(item)}</li>`).join('')}</ul>`,
    '</div>',
  ].join('\n');
}

function renderCalloutBlock(block) {
  const title = block.title ? `<h3>${escapeHtml(block.title)}</h3>` : '';
  return [
    '<aside class="content-block content-block--callout">',
    title,
    renderTextBody(block.text || ''),
    '</aside>',
  ].join('\n');
}

function renderFilesBlock(block) {
  const items = Array.isArray(block.items) ? block.items : [];
  const files = items
    .map((item) => {
      if (typeof item === 'string') {
        return `<li><code>${escapeHtml(item)}</code></li>`;
      }

      const filePath = item && item.path ? `<code>${escapeHtml(item.path)}</code>` : '';
      const note = item && item.note ? `<span class="file-note">${renderInlineText(item.note)}</span>` : '';
      return `<li><div class="file-item">${filePath}${note}</div></li>`;
    })
    .join('');

  return [
    '<div class="content-block content-block--files">',
    `<ul>${files}</ul>`,
    '</div>',
  ].join('\n');
}

function quoteFlowchartLabel(label) {
  const escaped = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `["${escaped}"]`;
}

function quoteFlowchartDecisionLabel(label) {
  const escaped = label.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `{"${escaped}"}`;
}

function isAlreadyQuotedFlowchartLabel(label) {
  const trimmed = label.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"');
}

function requiresQuotedFlowchartLabel(label) {
  return String(label || '').trim().length > 0;
}

function normalizeFlowchartLabel(label) {
  let normalized = label;
  if (isAlreadyQuotedFlowchartLabel(normalized)) {
    normalized = normalized.trim().slice(1, -1);
  }

  normalized = normalized
    .replace(/\\"/g, '"')
    .replace(/\n+/g, '<br/>');

  if (normalized.includes('"')) {
    normalized = normalized.replace(/"/g, '');
  }

  return normalized;
}

function isEscaped(source, index) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function isInsideDoubleQuotedText(source, index) {
  let quoteCount = 0;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source[cursor] === '"' && !isEscaped(source, cursor)) {
      quoteCount += 1;
    }
  }

  return quoteCount % 2 === 1;
}

function isInsideEdgeLabel(source, index) {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  const linePrefix = source.slice(lineStart, index);
  const pipeCount = (linePrefix.match(/\|/g) || []).length;

  return pipeCount % 2 === 1;
}

function sanitizeDelimitedFlowchartLabels(source, openCharacter, closeCharacter, quoteLabel) {
  let sanitized = '';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (
      character !== openCharacter ||
      isInsideDoubleQuotedText(source, index) ||
      isInsideEdgeLabel(source, index)
    ) {
      sanitized += character;
      continue;
    }

    let depth = 1;
    let cursor = index + 1;

    while (cursor < source.length && depth > 0) {
      if (source[cursor] === openCharacter) {
        depth += 1;
      } else if (source[cursor] === closeCharacter) {
        depth -= 1;
      }

      cursor += 1;
    }

    if (depth !== 0) {
      sanitized += character;
      continue;
    }

    const label = source.slice(index + 1, cursor - 1);
    const normalizedLabel = normalizeFlowchartLabel(label);
    sanitized += isAlreadyQuotedFlowchartLabel(label) || requiresQuotedFlowchartLabel(normalizedLabel)
      ? quoteLabel(normalizedLabel)
      : `${openCharacter}${normalizedLabel}${closeCharacter}`;
    index = cursor - 1;
  }

  return sanitized;
}

function sanitizeFlowchartLabels(source) {
  return sanitizeDelimitedFlowchartLabels(source, '[', ']', quoteFlowchartLabel);
}

function sanitizeFlowchartDecisionLabels(source) {
  return sanitizeDelimitedFlowchartLabels(source, '{', '}', quoteFlowchartDecisionLabel);
}

function normalizeEdgeLabel(label) {
  return label
    .replace(/^\s*"([\s\S]*)"\s*$/g, '$1')
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/"/g, "'")
    .trim();
}

function sanitizeFlowchartEdgeLabels(source) {
  return source.replace(/\|([^|\n]+)\|/g, (match, label) => {
    if (!/[[\]"]/.test(label)) {
      return match;
    }

    return `|${normalizeEdgeLabel(label)}|`;
  });
}

function sanitizeMermaidSource(source) {
  const trimmed = String(source || '').trim();
  if (/^(flowchart|graph)\b/m.test(trimmed)) {
    return sanitizeFlowchartEdgeLabels(sanitizeFlowchartLabels(sanitizeFlowchartDecisionLabels(trimmed)));
  }

  return trimmed;
}

function renderMermaidBlock(block) {
  const mermaid = sanitizeMermaidSource(block.mermaid || '');
  if (!mermaid) {
    throw new Error('Mermaid block is missing Mermaid source.');
  }

  return [
    '<div class="content-block content-block--diagram">',
    `  <div class="diagram-frame" data-diagram-output data-mermaid-source="${escapeAttribute(mermaid)}">`,
    '    <div class="diagram-toolbar" data-export-control>',
    '      <button class="toolbar-button" type="button" data-fullscreen title="Toggle Fullscreen">⛶</button>',
    '    </div>',
    '  </div>',
    '</div>',
  ].join('\n');
}

function renderContentBlock(block) {
  const type = block && block.type ? block.type : 'text';

  if (type === 'text') {
    return renderTextBlock(block);
  }

  if (type === 'list') {
    return renderListBlock(block);
  }

  if (type === 'callout') {
    return renderCalloutBlock(block);
  }

  if (type === 'files') {
    return renderFilesBlock(block);
  }

  if (type === 'mermaid') {
    return renderMermaidBlock(block);
  }

  throw new Error(`Unsupported block type "${type}".`);
}

function getSectionBlocks(section) {
  if (Array.isArray(section.blocks)) {
    return section.blocks;
  }

  return [
    { type: 'text', text: section.text || '' },
    { type: 'mermaid', mermaid: section.mermaid || '' },
  ];
}

function renderSection(section, index) {
  const heading = section.heading || `Section ${index + 1}`;
  const blocks = getSectionBlocks(section);
  if (blocks.length === 0) {
    throw new Error(`Section "${heading}" must contain at least one block.`);
  }

  if (!Array.isArray(section.blocks) && !section.mermaid) {
    throw new Error(`Section "${heading}" is missing Mermaid source.`);
  }

  return [
    `<article class="pair" data-export-section data-export-title="${escapeAttribute(heading)}">`,
    '  <section class="text-pane">',
    '    <div class="section-heading">',
    '      <div>',
    '        <p class="section-label">Explanation</p>',
    `        <h2>${escapeHtml(heading)}</h2>`,
    '      </div>',
    '      <button class="export-button" type="button" data-export-control data-export-section-button>Save section PNG</button>',
    '    </div>',
    `    <div class="body">${blocks.map(renderContentBlock).join('\n')}</div>`,
    '  </section>',
    '</article>',
  ].join('\n');
}

function renderVisualExplainerHtml(spec) {
  if (!spec || typeof spec !== 'object') {
    throw new Error('A spec object is required.');
  }

  const title = String(spec.title || 'Visual Explainer').trim();
  const sections = Array.isArray(spec.sections) ? spec.sections : [];
  if (sections.length === 0) {
    throw new Error('At least one section is required.');
  }

  const summary = spec.summary
    ? `<p class="summary">${renderInlineText(String(spec.summary).trim())}</p>`
    : '';

  const pairs = sections.map(renderSection).join('\n');

  return template
    .replace('{{PAGE_TITLE}}', escapeAttribute(title))
    .replace('{{TITLE}}', escapeHtml(title))
    .replace('{{SUMMARY}}', summary)
    .replace('{{PAIRS}}', pairs);
}

function ensureHtmlExtension(filePath) {
  return filePath.endsWith('.html') ? filePath : `${filePath}.html`;
}

function expandHomePath(value) {
  if (!value) {
    return value;
  }

  if (value === '~') {
    return os.homedir();
  }

  if (value.startsWith('~/')) {
    return path.join(os.homedir(), value.slice(2));
  }

  return value;
}

function readConfiguredExportDir(configFilePath = DEFAULT_EXPORT_PATH_FILE) {
  if (configFilePath === DEFAULT_EXPORT_PATH_FILE && !fs.existsSync(configFilePath) && fs.existsSync(LEGACY_EXPORT_PATH_FILE)) {
    configFilePath = LEGACY_EXPORT_PATH_FILE;
  }

  if (!fs.existsSync(configFilePath)) {
    return null;
  }

  const rawValue = fs.readFileSync(configFilePath, 'utf8').trim();
  if (!rawValue) {
    return null;
  }

  return path.resolve(expandHomePath(rawValue));
}

function slugifyTitle(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function resolveOutputPath(requestedOutput, spec, configFilePath = DEFAULT_EXPORT_PATH_FILE, now = Date.now()) {
  const configuredDir = readConfiguredExportDir(configFilePath);

  if (requestedOutput) {
    if (path.isAbsolute(requestedOutput)) {
      return requestedOutput;
    }

    if (configuredDir) {
      return path.join(configuredDir, requestedOutput);
    }

    throw new Error(
      `Missing default export directory config at ${configFilePath}. Ask the user where to store visual explainer HTML files, then save that path in the config file.`,
    );
  }

  if (configuredDir) {
    const baseName = slugifyTitle(spec && spec.title) || `visual-explainer-${now}`;
    return path.join(configuredDir, `${baseName}.html`);
  }

  throw new Error(
    `Missing default export directory config at ${configFilePath}. Ask the user where to store visual explainer HTML files, then save that path in the config file.`,
  );
}

function writeHtmlArtifact(outputPath, html) {
  const resolvedPath = path.resolve(ensureHtmlExtension(outputPath));
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, html, 'utf8');
  return {
    outputPath: resolvedPath,
    fileUrl: pathToFileURL(resolvedPath).href,
  };
}

function openInDefaultBrowser(targetPath) {
  const platform = process.platform;
  if (platform === 'darwin') {
    execFileSync('open', [targetPath], { stdio: 'ignore' });
    return;
  }

  if (platform === 'win32') {
    execFileSync('cmd', ['/c', 'start', '', targetPath], { stdio: 'ignore' });
    return;
  }

  execFileSync('xdg-open', [targetPath], { stdio: 'ignore' });
}

function printHelp() {
  console.log('Usage: node render-html.js (--input <spec.json> | --stdin) [--output <file.html>] [--open]');
  console.log(`Default export config file: ${DEFAULT_EXPORT_PATH_FILE}`);
  console.log('');
  console.log('Spec format:');
  console.log('{');
  console.log('  "title": "Payments Overview",');
  console.log('  "summary": "Short intro",');
  console.log('  "sections": [');
  console.log('    {');
  console.log('      "heading": "Checkout Flow",');
  console.log('      "text": "Explanation text above the diagram.",');
  console.log('      "mermaid": "flowchart TD\\n  A-->B"');
  console.log('    }');
  console.log('  ]');
  console.log('}');
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = {
    input: null,
    stdin: false,
    output: null,
    open: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--open') {
      result.open = true;
      continue;
    }

    if (arg === '--stdin') {
      result.stdin = true;
      continue;
    }

    if (arg === '--input' || arg === '-i') {
      result.input = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === '--output' || arg === '-o') {
      result.output = args[index + 1];
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (result.stdin && result.input) {
    throw new Error('Use either --input or --stdin, not both.');
  }

  if (!result.stdin && !result.input) {
    throw new Error('Missing required input. Use --input <spec.json> or --stdin.');
  }

  return result;
}

function main() {
  const options = parseArgs(process.argv);
  const rawSpec = options.stdin
    ? fs.readFileSync(0, 'utf8')
    : fs.readFileSync(path.resolve(options.input), 'utf8');
  const spec = JSON.parse(rawSpec);
  const html = renderVisualExplainerHtml(spec);
  const outputPath = resolveOutputPath(options.output, spec);
  const artifact = writeHtmlArtifact(outputPath, html);

  console.log(`HTML artifact: ${artifact.outputPath}`);
  console.log(`Open in browser: ${artifact.fileUrl}`);

  if (options.open) {
    openInDefaultBrowser(artifact.outputPath);
    console.log('Browser launch requested via the default OS handler.');
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

module.exports = {
  renderVisualExplainerHtml,
  sanitizeMermaidSource,
  readConfiguredExportDir,
  resolveOutputPath,
  writeHtmlArtifact,
  openInDefaultBrowser,
};
