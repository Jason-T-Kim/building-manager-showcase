"""A read-only summary of retained payment records; no write operations.

This adaptation illustrates balance semantics. The real application also
checks roles and dates and serializes writes with database transactions.
"""
from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class Payment:
    reference: str
    amount: int
    voided: bool = False
    reason: str = ""

    def __post_init__(self):
        if type(self.amount) is not int or self.amount <= 0:
            raise ValueError("Payment must be a positive whole amount")
        if self.voided and not self.reason.strip():
            raise ValueError("Cancellation needs a reason")


@dataclass(frozen=True)
class PaymentSummary:
    paid: int
    remaining: int
    amount_due: int
    overpaid: int


def summarize_payments(total: int, payments: Iterable[Payment]) -> PaymentSummary:
    if type(total) is not int or total < 0:
        raise ValueError("Invoice total must be a non-negative whole amount")
    paid = sum(payment.amount for payment in payments if not payment.voided)
    remaining = total - paid
    return PaymentSummary(paid, remaining, max(remaining, 0), max(-remaining, 0))
