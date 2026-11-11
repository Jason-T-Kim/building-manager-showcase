"""Run with: python3 -m examples.demo. All data is fictional."""
import sqlite3
from fractions import Fraction
from .billing_math import calculate_amounts
from .query_reuse import load_invoice_view


def main():
    invoice = calculate_amounts([Fraction(10000, 3)] * 3)
    with sqlite3.connect(":memory:") as connection:
        connection.execute("CREATE TABLE payments (id INTEGER PRIMARY KEY, "
                           "invoice_id INTEGER, reference TEXT, amount INTEGER, "
                           "voided INTEGER, reason TEXT)")
        connection.executemany("INSERT INTO payments VALUES (?, ?, ?, ?, ?, ?)", [
            (1, 1, "sample-partial", 4000, 0, ""),
            (2, 1, "sample-canceled", 1000, 1, "Duplicate entry"),
        ])
        history, summary = load_invoice_view(connection, 1, invoice.total)
        print("FICTIONAL DATA / LOCAL EXAMPLE")
        print(f"Subtotal: {invoice.subtotal:,} KRW | VAT: {invoice.vat:,} KRW")
        print(f"Total: {invoice.total:,} KRW | Amount due: {summary.amount_due:,} KRW")
        print(f"History rows retained: {len(history)} (including canceled entries)")


if __name__ == "__main__":
    main()
