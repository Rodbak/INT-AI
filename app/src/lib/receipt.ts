import type { SaleReceipt } from './api';

const money = (n: number) => `GH₵ ${Math.round(n).toLocaleString()}`;
const dateStr = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** A plain-text receipt suitable for WhatsApp. */
export function receiptText(rc: SaleReceipt): string {
  const lines = rc.lines.map((l) => `${l.qty} x ${l.name} — ${money(l.qty * l.price)}`).join('\n');
  const parts = [
    `*${rc.shopName}*`,
    `Receipt ${rc.number} · ${dateStr(rc.issuedAt)}`,
    '',
    lines || '(no items listed)',
    '',
    `Subtotal: ${money(rc.subtotal)}`,
  ];
  if (rc.discount > 0) parts.push(`Discount: -${money(rc.discount)}`);
  if (rc.tax > 0) parts.push(`Tax: ${money(rc.tax)}`);
  parts.push(`*Total: ${money(rc.total)}*`);
  parts.push(`Paid (${rc.method.toUpperCase()}): ${money(rc.paid)}`);
  if (rc.outstanding > 0) parts.push(`Balance owing: ${money(rc.outstanding)}`);
  parts.push('', rc.receiptFooter || 'Thank you!');
  return parts.join('\n');
}

/** Open a print-ready receipt in a new window and trigger the print dialog. */
export function printReceipt(rc: SaleReceipt): void {
  const row = (a: string, b: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:12px;${bold ? 'font-weight:700;' : ''}"><span>${a}</span><span>${b}</span></div>`;
  const items = rc.lines.map((l) => row(`${l.qty} × ${l.name}`, money(l.qty * l.price))).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${rc.number}</title>
<style>
  body{font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12.5px;line-height:1.55;color:#111;max-width:300px;margin:16px auto;padding:0 12px;}
  .c{text-align:center;} .rule{border-top:1px dashed #bbb;margin:8px 0;} h1{font-size:16px;margin:0;text-align:center;}
  @media print{@page{margin:6mm;}}
</style></head><body>
  <h1>${rc.shopName}</h1>
  ${rc.receiptHeader ? `<div class="c" style="font-size:11px;color:#555;">${rc.receiptHeader}</div>` : ''}
  <div class="c" style="font-size:10.5px;color:#777;">${rc.number} · ${dateStr(rc.issuedAt)}</div>
  <div class="c" style="font-size:10.5px;color:#777;">${rc.customer}</div>
  <div class="rule"></div>
  ${items}
  <div class="rule"></div>
  ${row('Subtotal', money(rc.subtotal))}
  ${rc.discount > 0 ? row('Discount', '-' + money(rc.discount)) : ''}
  ${rc.tax > 0 ? row('Tax', money(rc.tax)) : ''}
  ${row('TOTAL', money(rc.total), true)}
  ${row(rc.method.toUpperCase(), money(rc.paid))}
  ${rc.outstanding > 0 ? row('Balance', money(rc.outstanding)) : ''}
  <div class="rule"></div>
  <div class="c" style="font-size:11px;">${rc.receiptFooter || 'Thank you!'}</div>
  <script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank', 'width=380,height=640');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
