# Code notes

These examples were prepared for this public repository from patterns in the application's billing code. Interfaces were simplified and all demonstration records are synthetic. They do not include private repository history, deployment settings, customer documents or operational database content.

| Public file | Application relationship | Adaptation |
| --- | --- | --- |
| `examples/billing_math.py` | `truncate_won` and subtotal/VAT calculation in `billing/services.py` | Keeps the truncation helper and arithmetic order; extracts a pure function and a display reconciliation result. Omits leases, calendar proration and persistence. |
| `examples/payment_history.py` | `Invoice.paid_amount`, `remaining`, `amount_due` and `overpaid` in `billing/models.py` | Uses immutable synthetic records and a pure summary function. Does not expose the application's payment-write API. |
| `examples/query_reuse.py` | Request-scoped payment reuse and its checks in `billing/test_query_efficiency.py`; bounded loaders in `billing/output_limits.py` | Demonstrates the read pattern in SQLite using one parameterized SELECT and a synthetic row budget. This is not a literal copy of a Django loader or its query-count claim. |

## What the tests establish

- Exact thirds are summed before truncation.
- Negative adjustment fractions truncate toward zero.
- A fractional VAT amount is truncated separately.
- A canceled payment remains in history but is excluded from the paid total.
- Overpayment is displayed separately from the non-negative amount due.
- One loader call supplies both retained history and the summary with one SELECT.
- Another call sees a new payment; data is not cached across requests.
- Exceeding the example row budget fails explicitly instead of returning an incomplete balance.

Operational authorization, concurrent writes, SMTP delivery, file protection and backup recovery require application-level tests and are outside these extracts.
