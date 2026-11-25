# Cheki API Payment Verification Architecture (AddisGebeya)

AddisGebeya verifies customer bank and mobile-money transfers directly against official financial institution records via the **Cheki API** (`https://cheki.et`), proxied exclusively through the backend (`apps/api`). The frontend never communicates with Cheki directly.

---

## 1. Environment Configuration (`apps/api/.env`)

| Variable | Default | Description |
| --- | --- | --- |
| `CHEKI_API_BASE_URL` | `https://cheki.et` | Base URL for the Cheki verification service (`GET /api/banks`, `GET /api/health`, `POST /api/verify`). |
| `CHEKI_TIMEOUT_MS` | `65000` | Upstream HTTP request timeout in milliseconds (recommended `>= 60000` for slow Ethiopian bank portals). |

---

## 2. Database Schema & Migrations (`apps/api/prisma`)

- **Extended `payments` table (`Payment` model):**
  - `provider`, `verified_reference` (`@unique` normalized `{provider}:{canonicalRef}` key preventing replay across orders), `currency` (strict `ETB`), `sender_name`, `sender_account`, `receiver_name`, `receiver_account`, `transaction_date`, `source_url`, `verified_at`, `reviewed_by_admin_id`, `review_reason`, `reviewed_at`, `verification_response`.
- **`payment_verification_logs` (`PaymentVerificationLog` model):**
  - Immutable audit history of every verification call, upstream HTTP status, actor type (`customer`, `admin`, `system`), submitted reference, and manual override reasons.
- **`payment_provider_configs` (`PaymentProviderConfig` model):**
  - Admin-managed store receiving accounts (`receiving_account_name`, `receiving_account_number`, `account_suffix_digits`, `instructions`, `is_enabled`, `max_payment_age_days`).

---

## 3. REST API Endpoints

Available under both `/api/...` and `/api/v1/...`:

### Customer & Public Discovery Endpoints

| Method | Route | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/payment/providers` | Public | Fetches live supported Cheki banks + health reachability, merged with AddisGebeya enabled receiving accounts and instructions. |
| `POST` | `/api/payment/verify` | Customer/Admin JWT + Sliding Rate Limit (`10/min`) | Verifies transaction reference, conditional account/phone, or QR payload through Cheki. Confirms order only when all validation rules pass. |
| `GET` | `/api/payment/status/:orderId` | Owner JWT or Admin | Returns authoritative persisted `paymentStatus`, `orderStatus`, masked receiving details, and timestamp for checkout reload resilience. |

### Admin Endpoints (`ADMIN` Role Required)

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/api/admin/payments` | Lists all payment verification records with status counts, duplicate reference detection, search, provider filter, date range filter, and attempt logs. |
| `POST` | `/api/admin/payments/:paymentId/review` | Audited manual `approve` or `reject` decision with mandatory reason (`>= 5` characters). Blocked (`409`) if the payment is already `Paid`. |
| `GET` | `/api/admin/payment-providers` | Lists AddisGebeya receiving account configurations across supported Ethiopian banks and wallets. |
| `PUT` | `/api/admin/payment-providers/:providerCode` | Creates or updates receiving account holder name, account/wallet number, suffix digits, checkout instructions, max age days, and enabled status. |

---

## 4. Strict Verification & Security Guarantees

1. **Authoritative Backend Totals:** Monetary validation uses integer santims (`round(amount * 100)`) comparing Cheki's confirmed amount against backend `order.totalETB` (`ETB` currency required).
2. **Decoded/Parsed QR Guard:** Receipts with `decodedOnly: true`, `parsed: true`, `success !== true`, or `verified !== true` never auto-confirm orders.
3. **Store Receiving Account Match:** Masked bank receiver accounts/names on receipts are verified against `payment_provider_configs`. Mismatches flag the payment as `ReviewRequired` while keeping the order `PendingPayment`.
4. **Replay & Concurrency Protection:** Atomic `VerificationPending` update lock prevents concurrent double-verification races; `verified_reference` unique index + pre-check rejects normalized duplicate references (`409`).
5. **Fulfillment Guard:** `OrderService.updateOrderStatus` blocks advancing unpaid non-COD orders past `PendingPayment` (`400 PAYMENT_NOT_VERIFIED`).

---

## 5. Automated Verification

Run the 14-scenario Cheki integration test suite:

```bash
pnpm --filter @addisgebeya/api test:payments
```

