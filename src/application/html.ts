/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Tagged template that escapes every interpolated value. Wrap a value in `raw()` only when
 * it is HTML this module built itself.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce((out, part, i) => {
    if (i >= values.length) return out + part;
    return out + part + render(values[i]);
  }, "");
}

class RawHtml {
  constructor(readonly value: string) {}
}

export function raw(value: string): RawHtml {
  return new RawHtml(value);
}

function render(value: unknown): string {
  if (value instanceof RawHtml) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  if (value === null || value === undefined) return "";
  return escapeHtml(typeof value === "string" ? value : JSON.stringify(value));
}

/** Shared page shell for the storyboard preview and the QA report. */
export function page(title: string, body: string): string {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <style>
          :root {
            color-scheme: light dark;
            --bg: #f9f6f0;
            --fg: #121518;
            --muted: #5a6067;
            --surface: #fff;
            --border: #dcdee0;
            --primary: #c4452a;
            --pass: #19744a;
            --warn: #985f00;
            --fail: #c0283f;
            --manual: #2c3e35;
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #121518;
              --fg: #f6f7f7;
              --muted: #a0a6ac;
              --surface: #1a1d21;
              --border: #3f444a;
              --primary: #ef9c80;
              --pass: #4caf80;
              --warn: #d29a2e;
              --fail: #e8697d;
              --manual: #89a898;
            }
          }
          * {
            box-sizing: border-box;
          }
          body {
            margin: 0;
            background: var(--bg);
            color: var(--fg);
            font:
              15px/1.55 system-ui,
              -apple-system,
              "Segoe UI",
              sans-serif;
          }
          main {
            max-width: 1100px;
            margin: 0 auto;
            padding: 32px 16px 80px;
          }
          h1 {
            font-size: 26px;
            margin: 0 0 4px;
            letter-spacing: -0.01em;
          }
          h2 {
            font-size: 18px;
            margin: 40px 0 12px;
          }
          h3 {
            font-size: 15px;
            margin: 0 0 6px;
          }
          p {
            margin: 0 0 10px;
          }
          .muted {
            color: var(--muted);
          }
          .card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 12px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th,
          td {
            text-align: left;
            padding: 8px 10px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
          }
          th {
            font-weight: 600;
            color: var(--muted);
            font-size: 13px;
          }
          .scroll {
            overflow-x: auto;
          }
          .pill {
            display: inline-block;
            padding: 1px 9px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 600;
            border: 1px solid currentColor;
            white-space: nowrap;
          }
          .pass {
            color: var(--pass);
          }
          .warn {
            color: var(--warn);
          }
          .fail {
            color: var(--fail);
          }
          .manual {
            color: var(--manual);
          }
          img,
          video {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            border: 1px solid var(--border);
            display: block;
          }
          ul {
            margin: 6px 0 0;
            padding-left: 20px;
          }
          code {
            font:
              13px ui-monospace,
              SFMono-Regular,
              Menlo,
              monospace;
          }
          .bar {
            display: flex;
            height: 28px;
            border-radius: 6px;
            overflow: hidden;
            border: 1px solid var(--border);
          }
          .bar div {
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            overflow: hidden;
            white-space: nowrap;
            border-right: 1px solid var(--bg);
            background: color-mix(in srgb, var(--primary) 22%, var(--surface));
          }
          label.check {
            display: flex;
            gap: 10px;
            align-items: flex-start;
            padding: 6px 0;
          }
          .notice {
            border-left: 4px solid var(--warn);
          }
        </style>
      </head>
      <body>
        <main>${raw(body)}</main>
      </body>
    </html> `;
}
