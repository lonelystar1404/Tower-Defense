/**
 * Styled hover tooltips. Any element with `data-tip` (the title) gets a tooltip with optional
 * `data-tip-meta` (a muted line) and `data-tip-body` (the description) as soon as the pointer
 * is over it. One floating element for the whole page, placed above the target (below if
 * there's no room), so it is never clipped by its container.
 */
let tip: HTMLDivElement | null = null;
let current: HTMLElement | null = null;

function element(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tooltip';
    tip.hidden = true;
    document.body.append(tip);
  }
  return tip;
}

function escape(text: string): string {
  return text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
}

function show(target: HTMLElement): void {
  const el = element();
  const { tip: title, tipMeta: meta, tipBody: body, tipColor: color } = target.dataset;
  el.style.setProperty('--tip-color', color ?? 'var(--cyan)');
  el.innerHTML =
    `<div class="tooltip-title">${escape(title ?? '')}</div>` +
    (meta ? `<div class="tooltip-meta">${escape(meta)}</div>` : '') +
    (body ? `<div class="tooltip-body">${escape(body)}</div>` : '');
  el.hidden = false;
  const r = target.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
  const top = r.top - h - 8 >= 8 ? r.top - h - 8 : r.bottom + 8;
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
}

function hide(): void {
  current = null;
  if (tip) tip.hidden = true;
}

/** Starts showing tooltips for `[data-tip]` elements anywhere on the page. Call once. */
export function initTooltips(): void {
  document.addEventListener('pointerover', (ev) => {
    const target = (ev.target as HTMLElement).closest<HTMLElement>('[data-tip]');
    if (target === current) return;
    current = target;
    if (target) show(target);
    else hide();
  });
  // Content under the pointer can be rebuilt (language change, new hero): don't leave a stale tip.
  document.addEventListener('pointerdown', hide);
  window.addEventListener('scroll', hide, true);
}

/** Attribute string for a tooltip, escaped for use inside an HTML template. */
export function tipAttrs(title: string, meta?: string, body?: string, color?: string): string {
  const a = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return (
    `data-tip="${a(title)}"` +
    (meta ? ` data-tip-meta="${a(meta)}"` : '') +
    (body ? ` data-tip-body="${a(body)}"` : '') +
    (color ? ` data-tip-color="${a(color)}"` : '')
  );
}
