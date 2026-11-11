const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../demo/model.js');
test('seed data reconciles and is accepted for local storage', () => {
 const s=M.seed(); assert.equal(M.validState(s),true);
 const t=M.totals(s,'2026-11'); assert.equal(t.total,2777500); assert.equal(t.paid,1841000); assert.equal(t.due,936500); assert.equal(t.total,t.subtotal+t.vat);
});
test('recording a payment updates only the selected month and tenant', () => {
 const s=M.seed(); const n=M.record(s,'2026-11',2,100000);
 assert.equal(M.summary(n,'2026-11',2).paid,500000); assert.equal(M.summary(s,'2026-11',2).paid,400000);
 assert.equal(M.summary(n,'2026-10',2).paid,400000); assert.equal(M.summary(n,'2026-11',1).due,0);
});
test('cancellation retains the row, amount, reason and original input', () => {
 const s=M.seed(); const n=M.cancel(s,'2026-11-p2','Duplicate entry');
 assert.equal(n.payments.length,s.payments.length); assert.equal(M.summary(n,'2026-11',2).paid,0);
 assert.equal(n.payments.find(p=>p.id==='2026-11-p2').amount,400000); assert.equal(n.payments.find(p=>p.id==='2026-11-p2').reason,'Duplicate entry'); assert.equal(s.payments.find(p=>p.id==='2026-11-p2').voided,false);
});
test('cancellation requires a reason and cannot be repeated', () => {
 const s=M.seed(); assert.throws(()=>M.cancel(s,'2026-11-p2',' '));
 const n=M.cancel(s,'2026-11-p2','Duplicate'); assert.throws(()=>M.cancel(n,'2026-11-p2','Again'));
});
test('invalid, fractional and excess payments do not alter data', () => {
 const s=M.seed(); for (const amount of [0,-1,1.5,NaN,Infinity,342501]) assert.throws(()=>M.record(s,'2026-11',2,amount));
 assert.equal(s.payments.length,6); assert.throws(()=>M.record(s,'2030-01',2,1));
});
test('full payment changes status and prevents overpayment', () => {
 const s=M.record(M.seed(),'2026-11',2,342500); assert.equal(M.summary(s,'2026-11',2).status,'Paid'); assert.throws(()=>M.record(s,'2026-11',2,1));
});
test('storage validation rejects malformed and duplicate records', () => {
 assert.equal(M.validState(null),false); const s=M.seed(); s.payments.push({...s.payments[0]});assert.equal(M.validState(s),false);
 const n=M.seed();n.payments[0].amount=10000000;assert.equal(M.validState(n),false);
});
test('PDF has a valid trailer and fictional invoice label', () => {
 const pdf=M.pdf(2,'2026-11');assert.ok(pdf.startsWith('%PDF-1.4'));assert.ok(pdf.includes('FICTIONAL DATA - NOT A REAL INVOICE'));assert.ok(pdf.includes('742,500 KRW'));assert.ok(pdf.endsWith('%%EOF\n'));
});
