'use strict';
const M = window.LedgerModel;
const key = 'jason-ledger-demo-v1';
let state = M.seed(); let period = '2026-11'; let selectedTenant = 2; let toastTimer;
const $ = (id) => document.getElementById(id);
const money = (n) => n.toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
try { const saved = JSON.parse(localStorage.getItem(key)); if (M.validState(saved)) state = saved; } catch (_) { /* A fresh session is available if storage is blocked. */ }
function save() { try { localStorage.setItem(key, JSON.stringify(state)); } catch (_) { toast('Storage is unavailable. Changes will last for this visit only.'); } }
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5000); }
function label(p = period) { return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(p + '-01T12:00:00Z')); }
function download(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function render() {
  const t = M.totals(state, period);
  $('stats').innerHTML = [ ['Subtotal', t.subtotal, 'Before VAT'], ['VAT', t.vat, '10% · Whole-unit truncation'], ['Total invoiced', t.total, '4 tenant invoices'], ['Outstanding', t.due, money(t.paid) + ' KRW received'] ].map(([title, value, note]) => `<article class="stat"><span>${title}</span><strong>${money(value)}</strong><small>${note}</small></article>`).join('');
  $('invoices').innerHTML = M.tenants.map((x) => { const t = M.summary(state, period, x.id); return `<tr><td><div class="tenant-name">${t.name}</div><div class="tenant-unit">Unit ${t.unit}</div></td><td class="muted">${t.area} m²</td><td class="number amount-total">${money(t.total)}</td><td class="number muted">${money(t.paid)}</td><td class="number">${money(t.due)}</td><td><span class="badge ${t.status.toLowerCase()}">${t.status}</span></td><td><button class="row-link" data-invoice="${t.id}">View invoice →</button></td></tr>`; }).join('');
  $('due-date').textContent = (period === '2026-11' ? '30 November' : '31 October') + ' 2026';
  $('all-payments').innerHTML = state.payments.slice().reverse().map((p) => `<tr><td>${M.invoice(p.tenant).name}</td><td>${label(p.period)}</td><td>${esc(p.date)}</td><td class="number">${money(p.amount)} KRW</td><td>${p.voided ? '<span class="status-canceled">Canceled</span><span class="void-note">' + esc(p.reason) + '</span>' : '<span class="badge paid">Recorded</span>'}</td></tr>`).join('');
  $('documents').innerHTML = M.tenants.map((t) => `<section class="panel"><span class="eyebrow">SAMPLE PDF</span><h2>${t.name}</h2><p>${label()} · Unit ${t.unit}<br>${money(M.invoice(t.id).total)} KRW</p><button class="button secondary" data-pdf="${t.id}">↓ Download PDF</button></section>`).join('');
}
function setView(view) {
  if (!['billing', 'payments', 'documents', 'about'].includes(view)) view = 'billing';
  ['billing', 'payments', 'documents', 'about'].forEach((v) => { $(v + '-view').hidden = v !== view; });
  document.querySelectorAll('.nav-item').forEach((n) => { n.classList.toggle('active', n.dataset.view === view); if (n.dataset.view === view) n.setAttribute('aria-current', 'page'); else n.removeAttribute('aria-current'); });
  $('crumb').textContent = { billing: 'Monthly billing', payments: 'Payment history', documents: 'Documents', about: 'About this project' }[view];
  history.replaceState(null, '', '#' + view);
}
function openInvoice(id, keepOpen = false) {
  selectedTenant = Number(id); const t = M.summary(state, period, selectedTenant);
  $('invoice-heading').textContent = t.name;
  $('invoice-content').innerHTML = `<div class="dialog-body"><div class="invoice-meta"><span>Maple House · Unit ${t.unit} · ${t.area} m²</span><span>${label()}</span></div><div class="table-wrap"><table><thead><tr><th>Charge</th><th>Amount (KRW)</th></tr></thead><tbody>${['Management', 'Electricity', 'Water'].map((name, i) => `<tr><td>${name}</td><td class="number">${money(t.charges[i])}</td></tr>`).join('')}<tr><td>VAT (10%)</td><td class="number">${money(t.vat)}</td></tr></tbody></table></div><div class="invoice-summary"><div>Invoice total<strong>${money(t.total)}</strong></div><div>Paid<strong>${money(t.paid)}</strong></div><div>Outstanding<strong>${money(t.due)}</strong></div></div><p class="fineprint">Please use your unit number as the payment reference.</p><div class="dialog-actions"><button class="button secondary" data-pdf="${t.id}">↓ Download PDF</button><button class="button secondary" id="simulate-email">Simulate email</button></div><div class="section-heading"><h2>Payment history</h2><span class="small muted">Canceled rows are retained</span></div>${t.history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>${t.history.map((p) => `<tr><td>${esc(p.date)}</td><td class="number">${money(p.amount)}</td><td>${p.voided ? '<span class="status-canceled">Canceled</span><span class="void-note">' + esc(p.reason) + '</span>' : '<span class="badge paid">Recorded</span>'}</td><td>${p.voided ? '—' : '<button class="cancel-button" data-cancel="' + esc(p.id) + '">Cancel entry</button>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="history-empty">No payments recorded for this period.</div>'}<div id="cancel-slot"></div><form id="payment-form" class="payment-form"><label for="payment-amount">Record a sample payment (KRW)</label><div class="form-row"><input id="payment-amount" type="number" min="1" max="${t.due}" step="1" placeholder="${t.due ? 'Up to ' + money(t.due) : 'Invoice fully paid'}" ${t.due ? '' : 'disabled'} required><button class="button" ${t.due ? '' : 'disabled'}>Record payment</button></div><div id="payment-error" class="inline-error" role="alert"></div><p class="fineprint">Sample payment date: ${period}-10. This only changes your demo records.</p></form></div>`;
  if (!keepOpen) $('invoice-dialog').showModal();
}
document.addEventListener('click', (e) => {
  const button = e.target.closest('button'); if (!button) return;
  if (button.dataset.view) setView(button.dataset.view);
  if (button.dataset.invoice) openInvoice(button.dataset.invoice);
  if (button.dataset.pdf) download(M.pdf(Number(button.dataset.pdf), period), 'application/pdf', 'sample-invoice-' + period + '-' + button.dataset.pdf + '.pdf');
  if (button.dataset.cancel) {
    const pid = button.dataset.cancel;
    $('cancel-slot').innerHTML = `<form id="cancel-form" class="payment-form"><label for="cancel-reason">Why is this sample payment being canceled?</label><div class="form-row"><input id="cancel-reason" maxlength="160" placeholder="e.g. Duplicate entry" required><button class="button secondary">Confirm cancellation</button></div><div id="cancel-error" class="inline-error" role="alert"></div></form>`;
    $('cancel-reason').focus();
    $('cancel-form').addEventListener('submit', (event) => { event.preventDefault(); try { state = M.cancel(state, pid, $('cancel-reason').value); save(); render(); openInvoice(selectedTenant, true); toast('Payment canceled. The original entry and reason remain in history.'); } catch (err) { $('cancel-error').textContent = err.message; } });
  }
  if (button.id === 'simulate-email') toast('Demo only: invoice prepared for sample@example.invalid. No email was sent.');
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'payment-form') return;
  e.preventDefault();
  try { state = M.record(state, period, selectedTenant, Number($('payment-amount').value)); save(); render(); openInvoice(selectedTenant, true); toast('Sample payment recorded. The invoice balance has been updated.'); } catch (err) { $('payment-error').textContent = err.message; }
});
$('period').addEventListener('change', (e) => { period = e.target.value; render(); });
$('close-dialog').addEventListener('click', () => $('invoice-dialog').close());
$('invoice-dialog').addEventListener('click', (e) => { if (e.target === $('invoice-dialog')) { const b = e.target.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) e.target.close(); } });
$('guided').addEventListener('click', () => { setView('billing'); openInvoice(2); });
$('reset').addEventListener('click', () => { state = M.seed(); save(); render(); if ($('invoice-dialog').open) openInvoice(selectedTenant, true); toast('Fictional sample data restored.'); });
$('export').addEventListener('click', () => { const rows = [['Tenant', 'Unit', 'Period', 'Subtotal KRW', 'VAT KRW', 'Total KRW', 'Paid KRW', 'Outstanding KRW'], ...M.tenants.map((t) => { const i = M.summary(state, period, t.id); return [i.name, i.unit, period, i.subtotal, i.vat, i.total, i.paid, i.due]; })]; download(rows.map((r) => r.join(',')).join('\r\n'), 'text/csv;charset=utf-8', 'fictional-settlement-' + period + '.csv'); });
render(); setView(location.hash.slice(1) || 'billing');
