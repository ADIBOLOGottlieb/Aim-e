import { esc, money } from './ui.js';

// Histogramme groupé recettes / charges par jour, en SVG pur.
export function dailyChart(daily) {
  const W = 760;
  const H = 240;
  const pad = { top: 14, right: 8, bottom: 26, left: 8 };
  const max = Math.max(1, ...daily.map((d) => Math.max(d.revenue, d.costs)));
  const n = Math.max(daily.length, 1);
  const slot = (W - pad.left - pad.right) / n;
  const barW = Math.max(2, Math.min(22, slot * 0.36));
  const innerH = H - pad.top - pad.bottom;
  const y = (v) => pad.top + innerH - (v / max) * innerH;
  const labelEvery = Math.ceil(n / 10);

  const grid = [0.25, 0.5, 0.75, 1]
    .map((f) => `<line class="grid-line" x1="${pad.left}" x2="${W - pad.right}" y1="${y(max * f)}" y2="${y(max * f)}"/>`)
    .join('');

  const bars = daily
    .map((d, i) => {
      const cx = pad.left + slot * i + slot / 2;
      const [yy, mm, dd] = d.day.split('-');
      const label = i % labelEvery === 0 ? `<text x="${cx}" y="${H - 8}" text-anchor="middle">${dd}/${mm}</text>` : '';
      const title = `${dd}/${mm}/${yy} — recettes ${money(d.revenue)}, charges ${money(d.costs)}`;
      return `<g><title>${esc(title)}</title>
        <rect class="bar-revenue" x="${cx - barW - 1}" y="${y(d.revenue)}" width="${barW}" height="${Math.max(0, pad.top + innerH - y(d.revenue))}" rx="2"/>
        <rect class="bar-costs" x="${cx + 1}" y="${y(d.costs)}" width="${barW}" height="${Math.max(0, pad.top + innerH - y(d.costs))}" rx="2"/>
        ${label}</g>`;
    })
    .join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Recettes et charges par jour">
    ${grid}
    <line class="axis" x1="${pad.left}" x2="${W - pad.right}" y1="${pad.top + innerH}" y2="${pad.top + innerH}"/>
    ${bars}
  </svg>
  <div class="legend"><span><i style="background:var(--accent)"></i>Recettes</span><span><i style="background:var(--border-strong)"></i>Achats & dépenses</span></div>`;
}

export function barList(rows, { label, value, format = (v) => v }) {
  const max = Math.max(1, ...rows.map(value));
  return rows
    .map(
      (r) => `<div class="bar-line"><span>${esc(label(r))}</span><strong class="num">${esc(format(value(r)))}</strong>
        <div class="bar-track"><div class="bar-fill" style="width:${(value(r) / max) * 100}%"></div></div></div>`
    )
    .join('');
}
