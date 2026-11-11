"""Exact arithmetic adapted from the application's billing calculation.

Synthetic inputs only. Lease/proration rules, persistence and authorization
are outside this extract. Integer amounts represent Korean won.
"""
from dataclasses import dataclass
from decimal import Decimal, ROUND_DOWN
from fractions import Fraction
from typing import Iterable


def truncate_won(value):
    """Truncate toward zero, including negative adjustment amounts."""
    if isinstance(value, Fraction):
        return Decimal(int(value))
    return Decimal(value).quantize(Decimal("1"), rounding=ROUND_DOWN)


@dataclass(frozen=True)
class InvoiceAmounts:
    displayed_items: tuple
    fractional_adjustment: int
    subtotal: int
    vat: int
    total: int


def calculate_amounts(raw_items: Iterable[Fraction]) -> InvoiceAmounts:
    """Sum exact items before truncation; retain a display reconciliation.

    Callers supply validated Fraction values, not binary floating-point money.
    Negative line items are allowed; a negative subtotal is not.
    """
    items = tuple(raw_items)
    if not all(isinstance(item, Fraction) for item in items):
        raise TypeError("Supply exact Fraction values")
    subtotal = int(truncate_won(sum(items, Fraction(0))))
    if subtotal < 0:
        raise ValueError("Adjustments cannot exceed the charges")
    displayed = tuple(int(truncate_won(item)) for item in items)
    vat = int(truncate_won(Fraction(subtotal, 10)))
    return InvoiceAmounts(displayed, subtotal - sum(displayed),
                          subtotal, vat, subtotal + vat)
