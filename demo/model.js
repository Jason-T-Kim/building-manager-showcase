(function (root) {
  'use strict';
  const periods = ['2026-11', '2026-10'];
  const tenants = [
    { id: 1, name: 'Atelier One', unit: '101', area: 180, charges: [750000, 100000, 40000] },
    { id: 2, name: 'North Office', unit: '201', area: 140, charges: [560000, 85000, 30000] },
    { id: 3, name: 'Paper Room', unit: '301', area: 110, charges: [450000, 65000, 25000] },
    { id: 4, name: 'Field Studio', unit: '401', area: 85, charges: [350000, 50000, 20000] },
  ];
  function seed() {
    return { version: 1, sequence: 10, payments: periods.flatMap((period) => [
      { id: period + '-p1', period, tenant: 1, amount: 979000, date: period + '-03', voided: false, reason: '' },
      { id: period + '-p2', period, tenant: 2, amount: 400000, date: period + '-06', voided: false, reason: '' },
      { id: period + '-p3', period, tenant: 4, amount: 462000, date: period + '-09', voided: false, reason: '' },
    ]), activity: [] };
  }
  function getTenant(id) {
    const tenant = tenants.find((t) => t.id === Number(id));
    if (!tenant) throw new Error('Choose an existing tenant.');
    return tenant;
  }
  function invoice(id) {
    const tenant = getTenant(id);
    const subtotal = tenant.charges.reduce((a, b) => a + b, 0);
    const vat = Math.trunc(subtotal / 10);
    return { ...tenant, subtotal, vat, total: subtotal + vat };
  }
  function summary(state, period, id) {
    const item = invoice(id);
    const history = state.payments.filter((p) => p.period === period && p.tenant === item.id);
    const paid = history.filter((p) => !p.voided).reduce((a, p) => a + p.amount, 0);
    const due = Math.max(item.total - paid, 0);
    return { ...item, history, paid, due, status: due === 0 ? 'Paid' : paid ? 'Partial' : 'Unpaid' };
  }
  function record(state, period, id, amount) {
    if (!periods.includes(period)) throw new Error('Choose an available period.');
    if (state.payments.length >= 100) throw new Error('This demo has reached its history limit. Reset the demo to continue.');
    const item = summary(state, period, id);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > item.due) throw new Error('Enter a whole amount between 1 and the outstanding balance.');
    const next = JSON.parse(JSON.stringify(state));
    const pid = 'demo-' + (++next.sequence);
    next.payments.push({ id: pid, period, tenant: item.id, amount, date: period + '-10', voided: false, reason: '' });
    next.activity.unshift({ text: 'Payment recorded for ' + item.name, amount, period });
    return next;
  }
  function cancel(state, pid, reason) {
    if (!String(reason).trim()) throw new Error('Enter a cancellation reason.');
    const next = JSON.parse(JSON.stringify(state));
    const p = next.payments.find((p) => p.id === pid);
    if (!p || p.voided) throw new Error('This payment is not available to cancel.');
    p.voided = true; p.reason = String(reason).trim().slice(0, 160);
    next.activity.unshift({ text: 'Payment canceled for ' + getTenant(p.tenant).name, amount: p.amount, period: p.period });
    return next;
  }
  function totals(state, period) {
    return tenants.map((t) => summary(state, period, t.id)).reduce((a, t) => ({ subtotal: a.subtotal + t.subtotal, vat: a.vat + t.vat, total: a.total + t.total, paid: a.paid + t.paid, due: a.due + t.due }), { subtotal: 0, vat: 0, total: 0, paid: 0, due: 0 });
  }
  function validState(state) {
    if (!state || state.version !== 1 || !Number.isSafeInteger(state.sequence) || state.sequence < 10 || !Array.isArray(state.payments) || state.payments.length > 100 || !Array.isArray(state.activity)) return false;
    const ids = new Set();
    for (const p of state.payments) {
      if (!p || typeof p.id !== 'string' || ids.has(p.id) || !periods.includes(p.period) || !tenants.some((t) => t.id === p.tenant) || !Number.isSafeInteger(p.amount) || p.amount <= 0 || typeof p.voided !== 'boolean' || typeof p.reason !== 'string' || typeof p.date !== 'string') return false;
      if (p.voided && !p.reason.trim()) return false;
      ids.add(p.id);
    }
    return periods.every((period) => tenants.every((t) => summary(state, period, t.id).paid <= invoice(t.id).total));
  }
  function pdf(id, period) {
    const item = invoice(id);
    const money = (n) => n.toLocaleString('en-US') + ' KRW';
    const lines = ['PROPERTY LEDGER / DEMONSTRATION', 'FICTIONAL DATA - NOT A REAL INVOICE', '', 'Maple House / ' + period, 'Tenant: ' + item.name + ' / Unit ' + item.unit, 'Area: ' + item.area + ' sq m', '', 'Management: ' + money(item.charges[0]), 'Electricity: ' + money(item.charges[1]), 'Water: ' + money(item.charges[2]), '', 'Subtotal: ' + money(item.subtotal), 'VAT (10%): ' + money(item.vat), 'Total: ' + money(item.total), '', 'Generated locally in your browser. No email is sent.'];
    const escape = (s) => s.replace(/([\\()])/g, '\\$1');
    const stream = 'BT /F1 12 Tf 50 790 Td 21 TL ' + lines.map((s, i) => (i ? 'T* ' : '') + '(' + escape(s) + ') Tj').join('\n') + ' ET';
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream'];
    let out = '%PDF-1.4\n'; const offsets = [0];
    objects.forEach((o, i) => { offsets.push(out.length); out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
    const xref = out.length;
    out += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    return out + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
  }
  const api = { periods, tenants, seed, invoice, summary, record, cancel, totals, validState, pdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LedgerModel = api;
})(typeof window !== 'undefined' ? window : globalThis);
