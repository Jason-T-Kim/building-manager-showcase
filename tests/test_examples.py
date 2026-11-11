import sqlite3
import unittest
from decimal import Decimal
from fractions import Fraction
from examples.billing_math import calculate_amounts, truncate_won
from examples.payment_history import Payment, summarize_payments
from examples.query_reuse import HistoryLimitExceeded, load_invoice_view


class BillingMathTests(unittest.TestCase):
    def test_sum_exact_thirds_before_truncation(self):
        result = calculate_amounts([Fraction(10000, 3)] * 3)
        self.assertEqual(result.subtotal, 10000)
        self.assertEqual(result.displayed_items, (3333, 3333, 3333))
        self.assertEqual(result.fractional_adjustment, 1)
        self.assertEqual(result.total, 11000)

    def test_negative_fractions_truncate_toward_zero(self):
        self.assertEqual(truncate_won(Fraction(-5, 3)), Decimal(-1))
        self.assertEqual(truncate_won(Decimal('-1.9')), Decimal(-1))
        result = calculate_amounts([Fraction(1000), Fraction(-5, 3)])
        self.assertEqual(result.subtotal, 998)
        self.assertEqual(sum(result.displayed_items) + result.fractional_adjustment, 998)

    def test_vat_is_truncated_separately(self):
        result = calculate_amounts([Fraction(10999, 10)])
        self.assertEqual((result.subtotal, result.vat, result.total), (1099, 109, 1208))

    def test_over_reduction_is_rejected(self):
        with self.assertRaises(ValueError):
            calculate_amounts([Fraction(100), Fraction(-101)])

    def test_binary_float_input_is_rejected(self):
        with self.assertRaises(TypeError):
            calculate_amounts([0.1])


class PaymentTests(unittest.TestCase):
    def test_canceled_row_is_retained_without_reducing_balance(self):
        history = (Payment('a', 4000), Payment('b', 1000, True, 'Duplicate entry'))
        summary = summarize_payments(11000, history)
        self.assertEqual((summary.paid, summary.amount_due), (4000, 7000))
        self.assertEqual(len(history), 2)
        self.assertEqual(history[1].reason, 'Duplicate entry')

    def test_overpayment_after_invoice_reduction_is_separate(self):
        summary = summarize_payments(3000, [Payment('a', 4000)])
        self.assertEqual((summary.remaining, summary.amount_due, summary.overpaid), (-1000, 0, 1000))

    def test_cancellation_requires_a_reason(self):
        with self.assertRaises(ValueError):
            Payment('a', 1000, True, ' ')

    def test_non_positive_and_fractional_payments_are_rejected(self):
        for amount in (0, -1, 1.5):
            with self.subTest(amount=amount), self.assertRaises(ValueError):
                Payment('a', amount)


class QueryReuseTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.execute('CREATE TABLE payments (id INTEGER PRIMARY KEY, invoice_id INTEGER, '
                        'reference TEXT, amount INTEGER, voided INTEGER, reason TEXT)')
        self.db.executemany('INSERT INTO payments VALUES (?, ?, ?, ?, ?, ?)', [
            (1, 1, 'partial', 1000, 0, ''),
            (2, 1, 'canceled', 500, 1, 'Duplicate'),
            (3, 2, 'other-invoice', 9999, 0, ''),
        ])

    def test_one_read_supplies_history_and_all_balance_fields(self):
        statements = []
        self.db.set_trace_callback(statements.append)
        history, summary = load_invoice_view(self.db, 1, 2000)
        self.assertEqual((summary.paid, summary.remaining, summary.amount_due, summary.overpaid),
                         (1000, 1000, 1000, 0))
        self.assertEqual(len(history), 2)
        self.assertEqual(len([q for q in statements if q.lstrip().upper().startswith('SELECT')]), 1)

    def test_next_call_sees_new_data(self):
        _, first = load_invoice_view(self.db, 1, 2000)
        self.db.execute("INSERT INTO payments VALUES (4, 1, 'new', 1000, 0, '')")
        _, second = load_invoice_view(self.db, 1, 2000)
        self.assertEqual((first.amount_due, second.amount_due), (1000, 0))

    def test_budget_failure_never_returns_a_partial_balance(self):
        with self.assertRaises(HistoryLimitExceeded):
            load_invoice_view(self.db, 1, 2000, max_rows=1)

    def test_invalid_budget_is_rejected(self):
        with self.assertRaises(ValueError):
            load_invoice_view(self.db, 1, 2000, max_rows=0)


if __name__ == '__main__':
    unittest.main()
