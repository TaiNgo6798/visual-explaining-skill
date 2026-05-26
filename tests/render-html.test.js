const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  sanitizeMermaidSource,
  renderVisualExplainerHtml,
  readConfiguredExportDir,
  resolveOutputPath,
} = require('../skills/visual-explaining/scripts/render-html.js');

test('sanitizeMermaidSource quotes flowchart labels with package-style paths', () => {
  const source = 'flowchart TD\n  Shared[SHARED[@faktoora/shared/lib/foo]] --> App';

  assert.equal(
    sanitizeMermaidSource(source),
    'flowchart TD\n  Shared["SHARED[@faktoora/shared/lib/foo]"] --> App',
  );
});

test('sanitizeMermaidSource quotes flowchart labels with Mermaid-sensitive punctuation', () => {
  const source = 'flowchart TD\n  Api[svc/auth:v2 {public}] --> Worker';

  assert.equal(
    sanitizeMermaidSource(source),
    'flowchart TD\n  Api["svc/auth:v2 {public}"] --> Worker',
  );
});

test('sanitizeMermaidSource quotes simple flowchart labels as a strict default', () => {
  const source = 'flowchart TD\n  User[Shared Cache] --> API';

  assert.equal(sanitizeMermaidSource(source), 'flowchart TD\n  User["Shared Cache"] --> API');
});

test('sanitizeMermaidSource preserves labels that are already quoted', () => {
  const source = 'flowchart TD\n  Shared["Already quoted / stable"] --> App';

  assert.equal(sanitizeMermaidSource(source), 'flowchart TD\n  Shared["Already quoted / stable"] --> App');
});

test('sanitizeMermaidSource normalizes multiline quoted labels with escaped nested quotes', () => {
  const source = 'flowchart TD\n  DB["(\\"Database\n(Prisma)\\")"] --> Resolver';

  assert.equal(
    sanitizeMermaidSource(source),
    'flowchart TD\n  DB["(Database<br/>(Prisma))"] --> Resolver',
  );
});

test('sanitizeMermaidSource quotes labels with nested brackets', () => {
  const source = 'flowchart TD\n  Cache[cache[tenant-a]/primary] --> API';

  assert.equal(
    sanitizeMermaidSource(source),
    'flowchart TD\n  Cache["cache[tenant-a]/primary"] --> API',
  );
});

test('sanitizeMermaidSource quotes decision labels with bracket notation', () => {
  const source = 'flowchart TD\n  c3{Device AND userFeatures[type]?} -->|yes| c4';

  assert.equal(
    sanitizeMermaidSource(source),
    'flowchart TD\n  c3{"Device AND userFeatures[type]?"} -->|yes| c4',
  );
});

test('sanitizeMermaidSource quotes simple decision labels as a strict default', () => {
  const source = 'flowchart TD\n  Gate{Has access} -->|yes| Done';

  assert.equal(sanitizeMermaidSource(source), 'flowchart TD\n  Gate{"Has access"} -->|yes| Done');
});

test('sanitizeMermaidSource quotes punctuation-heavy labels inside subgraphs', () => {
  const source = [
    'flowchart LR',
    '  subgraph Shared["Shared Layer"]',
    '    SDK[sdk@v2/core] --> API',
    '  end',
  ].join('\n');

  assert.equal(
    sanitizeMermaidSource(source),
    [
      'flowchart LR',
      '  subgraph Shared["Shared Layer"]',
      '    SDK["sdk@v2/core"] --> API',
      '  end',
    ].join('\n'),
  );
});

test('sanitizeMermaidSource normalizes edge labels separately from node labels', () => {
  const source = 'flowchart TD\n  A -->|reads [draft] "fast"| B';

  assert.equal(
    sanitizeMermaidSource(source),
    'flowchart TD\n  A -->|reads (draft) \'fast\'| B',
  );
});

test('sanitizeMermaidSource leaves unmatched labels untouched instead of corrupting the line', () => {
  const source = 'flowchart TD\n  Broken[still-open --> Next';

  assert.equal(sanitizeMermaidSource(source), source);
});

test('sanitizeMermaidSource is idempotent for quoted flowchart labels', () => {
  const source = 'flowchart TD\n  Shared[SHARED[@faktoora/shared/lib/foo]] --> App';
  const once = sanitizeMermaidSource(source);

  assert.equal(sanitizeMermaidSource(once), once);
});

test('renderVisualExplainerHtml embeds sanitized Mermaid source', () => {
  const html = renderVisualExplainerHtml({
    title: 'Test',
    sections: [
      {
        heading: 'Flow',
        text: 'Checks HTML embedding.',
        mermaid: 'flowchart TD\n  Shared[SHARED[@faktoora/shared/lib/foo]] --> App',
      },
    ],
  });

  assert.match(
    html,
    /Shared\[&quot;SHARED\[@faktoora\/shared\/lib\/foo\]&quot;\] --&gt; App/,
  );
});

test('renderVisualExplainerHtml renders ordered flexible blocks', () => {
  const html = renderVisualExplainerHtml({
    title: 'Flexible Blocks',
    sections: [
      {
        heading: 'Change Summary',
        blocks: [
          { type: 'text', text: 'The API now validates `tenantId` before dispatch.' },
          { type: 'list', items: ['Rejects missing tenants', 'Keeps worker contract unchanged'] },
          { type: 'callout', title: 'Impact', text: 'Invalid jobs fail before reaching the queue.' },
          {
            type: 'files',
            items: [
              { path: 'src/api/jobs.ts', note: 'Validates request input' },
              { path: 'src/workers/jobs.ts', note: 'Consumes unchanged payloads' },
            ],
          },
          { type: 'mermaid', mermaid: 'flowchart TD\n  API[src/api/jobs.ts] --> Queue' },
        ],
      },
    ],
  });

  assert.match(html, /class="content-block content-block--text"/);
  assert.match(html, /The API now validates <code>tenantId<\/code> before dispatch\./);
  assert.match(html, /class="content-block content-block--list"/);
  assert.match(html, /Rejects missing tenants/);
  assert.match(html, /class="content-block content-block--callout"/);
  assert.match(html, /Impact/);
  assert.match(html, /class="content-block content-block--files"/);
  assert.match(html, /src\/api\/jobs\.ts/);
  assert.match(html, /class="content-block content-block--diagram"/);
  assert.match(html, /API\[&quot;src\/api\/jobs\.ts&quot;\] --&gt; Queue/);
});

test('renderVisualExplainerHtml allows block sections without Mermaid', () => {
  const html = renderVisualExplainerHtml({
    title: 'No Diagram',
    sections: [
      {
        heading: 'What Changed',
        blocks: [{ type: 'text', text: 'This summary does not need a diagram.' }],
      },
    ],
  });

  assert.match(html, /This summary does not need a diagram\./);
  assert.doesNotMatch(html, /<pre class="mermaid-source"/);
});

test('renderVisualExplainerHtml rejects unknown flexible block types', () => {
  assert.throws(
    () =>
      renderVisualExplainerHtml({
        title: 'Unknown Block',
        sections: [
          {
            heading: 'Broken',
            blocks: [{ type: 'timeline', items: [] }],
          },
        ],
      }),
    /Unsupported block type "timeline"/,
  );
});

test('renderVisualExplainerHtml adds PNG export controls for page and sections', () => {
  const html = renderVisualExplainerHtml({
    title: 'Export Controls',
    sections: [
      {
        heading: 'First Section',
        blocks: [{ type: 'text', text: 'First section body.' }],
      },
      {
        heading: 'Second Section',
        blocks: [{ type: 'text', text: 'Second section body.' }],
      },
    ],
  });

  assert.match(html, /data-export-page/);
  assert.match(html, /data-export-page-target/);
  assert.match(html, /Save page PNG/);
  assert.equal(html.match(/<article class="pair" data-export-section/g).length, 2);
  assert.match(html, /data-export-title="First Section"/);
  assert.match(html, /data-export-title="Second Section"/);
  assert.match(html, /html-to-image/);
});

test('renderVisualExplainerHtml filters PNG export controls without live layout changes', () => {
  const html = renderVisualExplainerHtml({
    title: 'Export Controls',
    sections: [
      {
        heading: 'First Section',
        blocks: [{ type: 'text', text: 'First section body.' }],
      },
    ],
  });

  assert.ok(html.includes('const exportFilter = (node) => !node.closest?.("[data-export-control]");'));
  assert.match(html, /filter: exportFilter/);
  assert.doesNotMatch(html, /export-rendering/);
  assert.doesNotMatch(html, /Saving\.\.\./);
});

test('renderVisualExplainerHtml uses high-resolution PNG export settings', () => {
  const html = renderVisualExplainerHtml({
    title: 'High Resolution Export',
    sections: [
      {
        heading: 'First Section',
        blocks: [{ type: 'text', text: 'First section body.' }],
      },
    ],
  });

  assert.match(html, /const MAX_EXPORT_PIXEL_RATIO = 4;/);
  assert.match(html, /const MAX_EXPORT_CANVAS_SIDE = 16384;/);
  assert.match(html, /const MAX_EXPORT_CANVAS_AREA = 268435456;/);
  assert.match(html, /pixelRatio: getExportPixelRatio\(node\)/);
  assert.doesNotMatch(html, /pixelRatio: 2/);
});

test('renderVisualExplainerHtml configures Cytoscape labels to stay inside nodes', () => {
  const html = renderVisualExplainerHtml({
    title: 'Contained Labels',
    sections: [
      {
        heading: 'Flow',
        blocks: [
          {
            type: 'mermaid',
            mermaid: 'flowchart TD\n  A[Group A\\nisDisabledField] --> B[guard fires: true\\ndisabled = true]',
          },
        ],
      },
    ],
  });

  assert.match(html, /'text-wrap': 'wrap'/);
  assert.match(html, /'text-max-width': '220px'/);
});

test('renderVisualExplainerHtml configures Cytoscape font styling', () => {
  const html = renderVisualExplainerHtml({
    title: 'Styling Labels',
    sections: [
      {
        heading: 'Flow',
        blocks: [
          {
            type: 'mermaid',
            mermaid: 'flowchart TD\n  A[SMALL plan<br/>allocation = 0<br/>noFreeInvoice = true]',
          },
        ],
      },
    ],
  });

  assert.match(html, /'font-family': 'Georgia, Times New Roman, serif'/);
  assert.match(html, /'font-size': '13px'/);
  assert.match(html, /'padding': '14px'/);
});

test('renderVisualExplainerHtml configures Cytoscape Dagre layout and arrow routing', () => {
  const html = renderVisualExplainerHtml({
    title: 'Arrow Bounds',
    sections: [
      {
        heading: 'Flow',
        blocks: [
          {
            type: 'mermaid',
            mermaid: 'flowchart TD\n  API[API] --> DB[(Database<br/>(Prisma))]',
          },
        ],
      },
    ],
  });

  assert.match(html, /'target-arrow-shape': 'triangle'/);
  assert.match(html, /'curve-style': 'taxi'/);
  assert.match(html, /name: 'dagre'/);
});

test('readConfiguredExportDir returns null when config file is missing', () => {
  const missingPath = path.join(os.tmpdir(), `visual-explainer-config-missing-${Date.now()}`);
  assert.equal(readConfiguredExportDir(missingPath), null);
});

test('readConfiguredExportDir resolves configured export path', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-explainer-config-'));
  const configPath = path.join(tmpRoot, '.visual-explaining-export-path');
  const exportDir = path.join(tmpRoot, 'exports');
  fs.writeFileSync(configPath, exportDir, 'utf8');

  assert.equal(readConfiguredExportDir(configPath), exportDir);
});

test('readConfiguredExportDir falls back to legacy config path for default config', () => {
  const homeDir = os.homedir();
  const newConfigPath = path.join(homeDir, '.visual-explaining-export-path');
  const legacyConfigPath = path.join(homeDir, '.ck-visual-explaining-export-path');

  if (fs.existsSync(newConfigPath) || !fs.existsSync(legacyConfigPath)) {
    return;
  }

  assert.equal(readConfiguredExportDir(), fs.readFileSync(legacyConfigPath, 'utf8').trim());
});

test('resolveOutputPath uses configured dir for relative --output values', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-explainer-output-'));
  const configPath = path.join(tmpRoot, '.visual-explaining-export-path');
  const exportDir = path.join(tmpRoot, 'exports');
  fs.writeFileSync(configPath, exportDir, 'utf8');

  assert.equal(
    resolveOutputPath('overview.html', { title: 'Ignored' }, configPath, 1234),
    path.join(exportDir, 'overview.html'),
  );
});

test('resolveOutputPath allows absolute --output values without config', () => {
  const missingPath = path.join(os.tmpdir(), `visual-explainer-config-missing-${Date.now()}`);
  const absoluteOutput = path.join(os.tmpdir(), `visual-explainer-absolute-${Date.now()}.html`);

  assert.equal(
    resolveOutputPath(absoluteOutput, { title: 'Ignored' }, missingPath, 1234),
    absoluteOutput,
  );
});

test('resolveOutputPath builds title-based filename in configured dir when --output is omitted', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'visual-explainer-title-'));
  const configPath = path.join(tmpRoot, '.visual-explaining-export-path');
  const exportDir = path.join(tmpRoot, 'exports');
  fs.writeFileSync(configPath, exportDir, 'utf8');

  assert.equal(
    resolveOutputPath(null, { title: 'Architecture Overview' }, configPath, 1234),
    path.join(exportDir, 'architecture-overview.html'),
  );
});

test('resolveOutputPath throws when no config and no --output', () => {
  const missingPath = path.join(os.tmpdir(), `visual-explainer-config-missing-${Date.now()}`);
  assert.throws(
    () => resolveOutputPath(null, { title: 'Architecture Overview' }, missingPath, 4321),
    /Missing default export directory config/,
  );
});

test('resolveOutputPath throws when --output is relative and config is missing', () => {
  const missingPath = path.join(os.tmpdir(), `visual-explainer-config-missing-${Date.now()}`);
  assert.throws(
    () => resolveOutputPath('overview.html', { title: 'Architecture Overview' }, missingPath, 4321),
    /Missing default export directory config/,
  );
});

test('renderVisualExplainerHtml adds interactive diagram navigation toolbar', () => {
  const html = renderVisualExplainerHtml({
    title: 'Toolbar Test',
    sections: [
      {
        heading: 'Flow',
        blocks: [
          {
            type: 'mermaid',
            mermaid: 'flowchart TD\n  A --> B',
          },
        ],
      },
    ],
  });

  assert.match(html, /class="diagram-toolbar"/);
  assert.match(html, /data-fullscreen/);
  assert.doesNotMatch(html, /data-zoom-in/);
  assert.doesNotMatch(html, /data-zoom-out/);
});
