"""SQLite adaptation of request-scoped payment reuse in Django.

One bounded invoice-history read supplies both the visible history and every
balance field. There is no global cache: a new call reads current records.
"""
from .payment_history import Payment, summarize_payments


class HistoryLimitExceeded(ValueError):
    pass


def load_invoice_view(connection, invoice_id: int, total: int, *, max_rows=1000):
    """Return retained history and summary from one parameterized SELECT.

    max_rows is an example budget, not an operational application setting.
    SQLite is used only to make the read pattern independently executable.
    """
    if type(max_rows) is not int or max_rows < 1:
        raise ValueError("History budget must be a positive integer")
    rows = connection.execute(
        "SELECT reference, amount, voided, reason FROM payments "
        "WHERE invoice_id = ? ORDER BY id LIMIT ?",
        (invoice_id, max_rows + 1),
    ).fetchall()
    if len(rows) > max_rows:
        raise HistoryLimitExceeded("History exceeds this example's read budget")
    history = tuple(Payment(ref, amount, bool(voided), reason)
                    for ref, amount, voided, reason in rows)
    return history, summarize_payments(total, history)
