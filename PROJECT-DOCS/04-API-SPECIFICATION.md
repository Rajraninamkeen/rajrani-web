# BILOKAT — API SPECIFICATION

> Document Type: Production API Contract
> Project: Bilokat
> Version: 1.0.0
> Parent Documents: `00-MASTER-SPEC.md`, `01-ARCHITECTURE.md`, `02-BUSINESS-WORKFLOWS.md`, `03-DATABASE-DESIGN.md`
> Status: API Foundation
> Implementation Status: Not Started
> Last Updated: 2026-09-07

---

# 1. PURPOSE

This document defines the authoritative API contract for Bilokat.

The API is the controlled boundary between:

```text
Customer Applications
Seller Applications
Catalog Applications
Support Applications
Delivery Applications
Finance Applications
Control Applications
Analytics Applications
AI Systems
External Providers
        ↓
    BILOKAT API
        ↓
Database / Cache / Storage / Events / Workers
```

The API must enforce:

* Authentication
* Authorization
* Validation
* Business rules
* Tenant isolation
* Data integrity
* Idempotency
* Rate limiting
* Auditability
* Error handling
* Observability
* Security

Frontend applications must never bypass the API for transactional operations.

---

# 2. API PRINCIPLE

The frontend is a client.

The backend is authoritative.

Therefore:

```text
Frontend Request
      ↓
Authentication
      ↓
Authorization
      ↓
Validation
      ↓
Business Rule Evaluation
      ↓
Database Transaction
      ↓
Event / Outbox
      ↓
Response
```

Frontend validation improves UX but is never a security boundary.

---

# 3. API STYLE

Primary style:

```text
REST API
```

with:

```text
JSON
HTTPS
Versioned endpoints
OpenAPI documentation
```

Additional protocols may be introduced later for specific workloads:

```text
WebSocket / SSE
Webhook
Internal event bus
```

These do not replace the primary REST contract.

---

# 4. BASE URL

Production:

```text
https://api.bilokat.com
```

API version:

```text
/api/v1
```

Example:

```text
GET /api/v1/products
```

The actual production domain may change.

Applications must never hardcode environment-specific URLs.

Use environment configuration.

---

# 5. VERSIONING

Initial public API:

```text
v1
```

Example:

```text
/api/v1/products
/api/v1/orders
/api/v1/payments
```

Breaking changes require a new API version.

Examples of breaking changes:

* Removing fields
* Renaming fields
* Changing field meaning
* Changing authentication requirements
* Changing response semantics
* Removing endpoints

Non-breaking additions may remain within the same version.

---

# 6. CONTENT TYPE

Requests:

```http
Content-Type: application/json
```

Responses:

```http
Content-Type: application/json
```

File uploads use:

```text
multipart/form-data
```

or controlled direct-to-storage upload flows.

---

# 7. CHARACTER ENCODING

API payloads should use:

```text
UTF-8
```

---

# 8. REQUEST ID

Every request should receive a unique request ID.

Header:

```http
X-Request-ID: <request-id>
```

If supplied by a trusted upstream, it must be validated.

Otherwise the backend generates one.

The request ID must appear in:

* Logs
* Error responses
* Audit metadata where applicable
* Distributed traces

---

# 9. CORRELATION ID

Long-running workflows should support:

```http
X-Correlation-ID: <correlation-id>
```

This connects:

```text
API request
 ↓
Database transaction
 ↓
Outbox event
 ↓
Worker
 ↓
External provider
```

---

# 10. IDEMPOTENCY

Operations that create financial, inventory, or irreversible state must support idempotency.

Header:

```http
Idempotency-Key: <unique-key>
```

Examples:

```text
POST /payments
POST /orders
POST /refunds
POST /inventory/reservations
POST /settlements
```

---

# 11. IDEMPOTENCY RULES

For the same:

```text
scope + Idempotency-Key
```

the API must not execute the operation twice.

The backend should store:

```text
request hash
status
response reference
created_at
expires_at
```

If the same key is reused with a different request body:

```text
409 Conflict
```

---

# 12. AUTHENTICATION

Authentication must support secure modern mechanisms.

Primary architecture:

```text
Access Credential
+
Refresh Credential
```

Exact token/session implementation will be finalized during backend implementation.

Authentication must support:

* Login
* Logout
* Session revocation
* Credential rotation
* Device/session management
* OTP verification
* Password reset where applicable
* Step-up authentication for sensitive operations

---

# 13. AUTHENTICATION HEADER

For bearer-based APIs:

```http
Authorization: Bearer <access-token>
```

The API must never accept credentials from query parameters.

Bad:

```text
/api/v1/orders?token=...
```

---

# 14. PUBLIC VS PROTECTED APIs

Public endpoints may expose:

```text
Catalog
Categories
Public product information
Public seller information
Search
Public content
```

Protected endpoints include:

```text
Cart
Checkout
Orders
Payments
Addresses
Account
Seller operations
Support
Finance
Control
```

Some endpoints may use optional authentication to personalize public results.

---

# 15. AUTHORIZATION

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
What are you allowed to do?
```

Every protected operation requires authorization.

---

# 16. RBAC + ABAC

Bilokat uses:

```text
RBAC
+
ABAC
```

RBAC determines role-based capabilities.

ABAC determines contextual access.

Examples:

```text
Seller can edit own listings
Seller cannot edit another seller's listing

Support agent can view assigned tickets
Support agent cannot access settlement administration

Finance user can process settlements
Finance user cannot suspend sellers

Control administrator may suspend a seller
but only with required permission and audit reason
```

---

# 17. TENANT ISOLATION

Seller data must be isolated.

Every seller-scoped query must derive seller identity from authenticated context.

Never trust:

```text
seller_id
```

provided by an untrusted client as the sole authorization mechanism.

---

# 18. STANDARD SUCCESS RESPONSE

Recommended structure:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}
```

For list endpoints:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "requestId": "req_...",
    "pagination": {}
  }
}
```

---

# 19. STANDARD ERROR RESPONSE

Recommended:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be processed.",
    "details": []
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

Do not expose:

* Stack traces
* Database errors
* SQL
* Internal secrets
* Provider credentials
* Internal infrastructure details

---

# 20. ERROR CODE PRINCIPLE

Errors must have stable machine-readable codes.

Examples:

```text
AUTHENTICATION_REQUIRED
INVALID_CREDENTIALS
FORBIDDEN
RESOURCE_NOT_FOUND
VALIDATION_ERROR
CONFLICT
RATE_LIMITED
IDEMPOTENCY_CONFLICT
INVALID_STATE
INSUFFICIENT_INVENTORY
PAYMENT_FAILED
PAYMENT_VERIFICATION_FAILED
COUPON_INVALID
COUPON_EXPIRED
ORDER_NOT_CANCELLABLE
RETURN_NOT_ELIGIBLE
REFUND_NOT_ALLOWED
SELLER_NOT_ACTIVE
PRODUCT_NOT_PUBLISHED
SERVICEABILITY_FAILED
INTERNAL_ERROR
```

---

# 21. HTTP STATUS CODES

Use standard HTTP semantics.

```text
200 OK
201 Created
202 Accepted
204 No Content

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
429 Too Many Requests

500 Internal Server Error
502 Bad Gateway
503 Service Unavailable
504 Gateway Timeout
```

---

# 22. VALIDATION

Every request must be validated server-side.

Validate:

* Type
* Format
* Length
* Range
* Required fields
* Enum values
* Relationships
* Business constraints

Example:

```text
quantity > 0
```

must be validated server-side.

---

# 23. MASS ASSIGNMENT PROTECTION

The backend must use explicit DTO/input schemas.

Never blindly map:

```text
request.body
```

into database entities.

Clients must not be able to submit protected fields such as:

```text
role
status
approved_at
seller_id
commission
settlement_status
payment_status
```

unless the endpoint explicitly permits it.

---

# 24. PAGINATION

List APIs must support pagination.

Preferred:

```text
cursor-based pagination
```

Example:

```text
GET /api/v1/orders?limit=20&cursor=...
```

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "pagination": {
      "nextCursor": "...",
      "hasMore": true
    }
  }
}
```

---

# 25. PAGINATION LIMITS

The API must enforce server-side maximum limits.

Example:

```text
default: 20
maximum: 100
```

Exact limits may vary by endpoint.

Clients must not request unlimited records.

---

# 26. SORTING

Sorting must use allowlisted fields.

Example:

```text
?sort=createdAt
?sort=-createdAt
```

Do not allow arbitrary SQL-like expressions.

---

# 27. FILTERING

Filtering must be explicit.

Example:

```text
GET /api/v1/orders?status=DELIVERED
```

Only supported filters are accepted.

---

# 28. SEARCH

Search endpoints may support:

```text
q
category
brand
price range
attributes
seller
availability
rating
delivery/serviceability
```

Search results are derived from authoritative catalog state.

---

# 29. SEARCH AUTHORITY

Search must never expose:

```text
SUSPENDED product
INACTIVE seller listing
UNPUBLISHED product
UNAVAILABLE offer
```

unless the requesting application has explicit internal permissions.

---

# 30. USER API

Base:

```text
/api/v1/users
```

Endpoints:

```text
GET    /me
PATCH  /me
DELETE /me
```

---

# 31. AUTH API

Base:

```text
/api/v1/auth
```

Endpoints:

```text
POST /register
POST /login
POST /logout
POST /refresh
POST /verify-phone
POST /verify-email
POST /forgot-password
POST /reset-password
GET  /sessions
POST /sessions/revoke
POST /step-up
```

Exact authentication flows may differ for customer, seller and internal users.

---

# 32. ADDRESS API

```text
GET    /api/v1/addresses
POST   /api/v1/addresses
GET    /api/v1/addresses/:id
PATCH  /api/v1/addresses/:id
DELETE /api/v1/addresses/:id
```

Users may manage their own addresses.

---

# 33. CATEGORY API

Public:

```text
GET /api/v1/categories
GET /api/v1/categories/:slug
```

Internal/catalog:

```text
POST  /api/v1/catalog/categories
PATCH /api/v1/catalog/categories/:id
POST  /api/v1/catalog/categories/:id/submit
POST  /api/v1/catalog/categories/:id/approve
POST  /api/v1/catalog/categories/:id/suspend
```

Authorization is mandatory for internal operations.

---

# 34. ATTRIBUTE API

Public/catalog:

```text
GET /api/v1/categories/:id/attributes
```

Catalog management:

```text
GET    /api/v1/catalog/attributes
POST   /api/v1/catalog/attributes
PATCH  /api/v1/catalog/attributes/:id
POST   /api/v1/catalog/categories/:id/attributes
PATCH  /api/v1/catalog/category-attributes/:id
DELETE /api/v1/catalog/category-attributes/:id
```

---

# 35. PRODUCT API

Public:

```text
GET /api/v1/products
GET /api/v1/products/:slug
GET /api/v1/products/:id/variants
```

Catalog management:

```text
POST  /api/v1/catalog/products
GET   /api/v1/catalog/products/:id
PATCH /api/v1/catalog/products/:id
POST  /api/v1/catalog/products/:id/submit
POST  /api/v1/catalog/products/:id/approve
POST  /api/v1/catalog/products/:id/reject
POST  /api/v1/catalog/products/:id/suspend
POST  /api/v1/catalog/products/:id/publish
POST  /api/v1/catalog/products/:id/unpublish
```

---

# 36. PRODUCT LIFECYCLE AUTHORITY

Only authorized catalog/control roles may perform approval/publishing operations.

Seller cannot self-approve a product.

---

# 37. LISTING API

Seller:

```text
GET    /api/v1/seller/listings
POST   /api/v1/seller/listings
GET    /api/v1/seller/listings/:id
PATCH  /api/v1/seller/listings/:id
POST   /api/v1/seller/listings/:id/submit
POST   /api/v1/seller/listings/:id/activate
POST   /api/v1/seller/listings/:id/pause
```

Internal:

```text
POST /api/v1/catalog/listings/:id/suspend
POST /api/v1/catalog/listings/:id/restore
```

---

# 38. SELLER API

Base:

```text
/api/v1/seller
```

Endpoints:

```text
GET /profile
PATCH /profile

GET /application
POST /application/submit

GET /documents
POST /documents
DELETE /documents/:id

GET /status
GET /dashboard
```

---

# 39. SELLER APPLICATION

Flow:

```text
POST /seller/application/submit
```

Backend validates:

* Required profile
* Required documents
* Business rules
* Duplicate seller detection
* Application completeness

Then:

```text
APPLICATION_SUBMITTED
```

event is emitted.

---

# 40. SELLER REVIEW API

Internal:

```text
GET  /api/v1/control/sellers
GET  /api/v1/control/sellers/:id
POST /api/v1/control/sellers/:id/approve
POST /api/v1/control/sellers/:id/reject
POST /api/v1/control/sellers/:id/request-correction
POST /api/v1/control/sellers/:id/suspend
POST /api/v1/control/sellers/:id/activate
```

Every high-risk action requires:

* Permission
* Validation
* Reason
* Audit

---

# 41. CART API

```text
GET    /api/v1/cart
POST   /api/v1/cart/items
PATCH  /api/v1/cart/items/:id
DELETE /api/v1/cart/items/:id
DELETE /api/v1/cart
```

Guest carts may use a secure temporary session identifier.

---

# 42. CART RULES

When adding an item:

Backend validates:

* Listing exists
* Listing active
* Product published
* Seller active
* Quantity valid
* Inventory available
* Purchase limits
* Serviceability where applicable

---

# 43. CART PRICE RULE

Cart price is not guaranteed to remain unchanged.

At checkout:

```text
Cart
 ↓
Fresh price lookup
 ↓
Inventory validation
 ↓
Coupon validation
 ↓
Tax calculation
 ↓
Delivery calculation
 ↓
Final checkout
```

---

# 44. CHECKOUT API

```text
POST /api/v1/checkout
GET  /api/v1/checkout/:id
POST /api/v1/checkout/:id/validate
POST /api/v1/checkout/:id/payment
POST /api/v1/checkout/:id/cod
```

Exact endpoint decomposition may change during implementation.

---

# 45. CHECKOUT REQUEST

Conceptual:

```json
{
  "cartId": "...",
  "addressId": "...",
  "paymentMethod": "ONLINE",
  "couponCode": "..."
}
```

The server recalculates all financial values.

---

# 46. CHECKOUT RESPONSE

Should provide:

```text
Products
Seller
Quantity
MRP
Selling price
Discount
Tax
Delivery charge
Coupon discount
Other applicable charges
Final payable amount
Payment method options
Serviceability
```

---

# 47. CHECKOUT SECURITY

Never accept final amount from frontend as authoritative.

Bad:

```json
{
  "amount": 10
}
```

The backend calculates:

```text
final amount
```

from authoritative sources.

---

# 48. ORDER API

Customer:

```text
GET /api/v1/orders
GET /api/v1/orders/:id
POST /api/v1/orders/:id/cancel
```

Seller:

```text
GET  /api/v1/seller/orders
GET  /api/v1/seller/orders/:id
POST /api/v1/seller/orders/:id/accept
POST /api/v1/seller/orders/:id/reject
POST /api/v1/seller/orders/:id/ready
```

Internal:

```text
GET /api/v1/control/orders
GET /api/v1/control/orders/:id
```

---

# 49. ORDER CREATION

Order creation must be transactional.

Conceptually:

```text
Validate checkout
 ↓
Validate inventory
 ↓
Reserve inventory
 ↓
Create order
 ↓
Create seller orders
 ↓
Create order items
 ↓
Create payment context
 ↓
Create outbox events
 ↓
Commit
```

Failure must not leave inconsistent inventory/order state.

---

# 50. ORDER STATE TRANSITIONS

The API must reject invalid transitions.

Example:

```text
PLACED
 ↓
PAYMENT_CONFIRMED
 ↓
SELLER_PENDING
 ↓
SELLER_ACCEPTED
```

A client cannot directly request:

```text
PLACED → DELIVERED
```

---

# 51. SELLER ORDER ACCEPT

```text
POST /api/v1/seller/orders/:id/accept
```

Backend checks:

* Seller owns order
* Order is in acceptable state
* Inventory can fulfill
* Seller is active
* No conflicting cancellation

Then updates state transactionally.

---

# 52. SELLER ORDER REJECT

```text
POST /api/v1/seller/orders/:id/reject
```

Request:

```json
{
  "reasonCode": "OUT_OF_STOCK",
  "reason": "..."
}
```

Reason is mandatory.

---

# 53. INVENTORY API

Seller:

```text
GET   /api/v1/seller/inventory
PATCH /api/v1/seller/inventory/:id
POST  /api/v1/seller/inventory/adjust
```

Internal:

```text
GET  /api/v1/control/inventory
POST /api/v1/control/inventory/adjust
POST /api/v1/control/inventory/transfer
```

---

# 54. INVENTORY ADJUSTMENT

Every manual adjustment requires:

```text
quantity
reason
reference if applicable
actor
timestamp
```

Adjustment creates an inventory movement.

Direct silent quantity overwrite is prohibited for controlled inventory.

---

# 55. PAYMENT API

```text
POST /api/v1/payments
GET  /api/v1/payments/:id
POST /api/v1/payments/:id/verify
```

The API integrates with an approved payment provider.

---

# 56. PAYMENT FLOW

```text
Checkout
 ↓
Payment Intent
 ↓
Provider
 ↓
Customer
 ↓
Provider Result
 ↓
Secure Webhook
 ↓
Backend Verification
 ↓
Payment Confirmation
 ↓
Order Confirmation
```

Frontend success callback alone is insufficient.

---

# 57. PAYMENT WEBHOOK

Provider-specific endpoint:

```text
POST /api/v1/webhooks/payments/:provider
```

Must:

1. Verify signature
2. Validate event
3. Check event ID/idempotency
4. Verify provider reference
5. Validate amount/currency/order relation
6. Process transaction
7. Record event
8. Emit internal event
9. Return appropriate response

---

# 58. COD API

```text
POST /api/v1/orders/:id/cod
GET  /api/v1/cod/:id
POST /api/v1/cod/:id/send-otp
POST /api/v1/cod/:id/verify-otp
```

Internal COD team:

```text
GET  /api/v1/cod/queue
POST /api/v1/cod/:id/assign
POST /api/v1/cod/:id/call-attempt
POST /api/v1/cod/:id/confirm
POST /api/v1/cod/:id/reject
POST /api/v1/cod/:id/follow-up
```

---

# 59. COD DATA ACCESS

COD agents receive only information required for verification.

They must not receive:

* Card credentials
* Payment secrets
* Authentication secrets
* Unnecessary sensitive data

---

# 60. COUPON API

Customer:

```text
POST /api/v1/coupons/validate
```

Internal:

```text
GET   /api/v1/control/coupons
POST  /api/v1/control/coupons
GET   /api/v1/control/coupons/:id
PATCH /api/v1/control/coupons/:id
POST  /api/v1/control/coupons/:id/activate
POST  /api/v1/control/coupons/:id/pause
```

---

# 61. COUPON VALIDATION

Coupon validation must check:

* Code
* Start/end time
* Active status
* Usage limit
* Per-user limit
* Cart value
* Product/category
* Seller
* Customer eligibility
* Payment method
* Other business rules

Final validation happens during order creation too.

---

# 62. DELIVERY API

Internal:

```text
GET  /api/v1/delivery/orders
POST /api/v1/delivery/orders/:id/assign
```

Rider:

```text
GET  /api/v1/delivery/tasks
GET  /api/v1/delivery/tasks/:id
POST /api/v1/delivery/tasks/:id/accept
POST /api/v1/delivery/tasks/:id/reject
POST /api/v1/delivery/tasks/:id/pickup
POST /api/v1/delivery/tasks/:id/out-for-delivery
POST /api/v1/delivery/tasks/:id/deliver
POST /api/v1/delivery/tasks/:id/fail
```

---

# 63. RIDER LOCATION

Where operationally required:

```text
POST /api/v1/delivery/location
```

The backend should control:

* Frequency
* Accuracy requirements
* Retention
* Access permissions

---

# 64. DELIVERY ASSIGNMENT

Assignment may consider:

```text
Distance
Availability
Current workload
Capacity
Vehicle
Serviceability
ETA
Performance
Acceptance history
Pricing
```

The final assignment decision must be backend-controlled.

---

# 65. RETURN API

Customer:

```text
POST /api/v1/orders/:id/returns
GET  /api/v1/returns
GET  /api/v1/returns/:id
POST /api/v1/returns/:id/cancel
```

Internal:

```text
GET  /api/v1/control/returns
POST /api/v1/control/returns/:id/approve
POST /api/v1/control/returns/:id/reject
POST /api/v1/control/returns/:id/inspection
```

---

# 66. RETURN ELIGIBILITY

Backend determines eligibility using:

```text
Order status
Delivery date
Return window
Category
Seller policy
Platform policy
Reason
Product condition
Evidence
Previous return history
```

Frontend cannot override eligibility.

---

# 67. REFUND API

Customer:

```text
GET /api/v1/orders/:id/refunds
GET /api/v1/refunds/:id
```

Internal:

```text
GET  /api/v1/finance/refunds
POST /api/v1/finance/refunds/:id/approve
POST /api/v1/finance/refunds/:id/process
```

High-risk refund operations require appropriate authorization and audit.

---

# 68. REFUND VALIDATION

Before refund:

```text
Order valid
Payment valid
Return eligible
Refundable amount calculated
Previous refunds checked
No duplicate processing
Authorization verified
```

---

# 69. SUPPORT API

Customer:

```text
GET  /api/v1/support/tickets
POST /api/v1/support/tickets
GET  /api/v1/support/tickets/:id
POST /api/v1/support/tickets/:id/messages
```

Support:

```text
GET  /api/v1/support/queue
POST /api/v1/support/tickets/:id/assign
POST /api/v1/support/tickets/:id/escalate
POST /api/v1/support/tickets/:id/resolve
POST /api/v1/support/tickets/:id/close
```

---

# 70. SUPPORT ACCESS

Support agents must see only the data necessary for the ticket.

Sensitive fields should be masked where appropriate.

---

# 71. FINANCE API

```text
GET /api/v1/finance/transactions
GET /api/v1/finance/payables
GET /api/v1/finance/refunds
GET /api/v1/finance/reconciliation
```

Finance mutation endpoints require elevated authorization.

---

# 72. SETTLEMENT API

```text
GET  /api/v1/finance/settlements
GET  /api/v1/finance/settlements/:id
POST /api/v1/finance/settlements/:id/calculate
POST /api/v1/finance/settlements/:id/approve
POST /api/v1/finance/settlements/:id/process
POST /api/v1/finance/settlements/:id/reconcile
```

---

# 73. SETTLEMENT SECURITY

Settlement processing must support:

* Authorization
* Idempotency
* Audit
* Calculation snapshot
* Reconciliation
* Failure handling
* Retry safety

---

# 74. NOTIFICATION API

Customer:

```text
GET   /api/v1/notifications
POST  /api/v1/notifications/:id/read
POST  /api/v1/notifications/read-all
```

Internal:

```text
GET   /api/v1/control/notification-templates
POST  /api/v1/control/notification-templates
PATCH /api/v1/control/notification-templates/:id
```

---

# 75. STORAGE API

Recommended controlled flow:

```text
POST /api/v1/storage/upload-intent
POST /api/v1/storage/complete
```

For sensitive files:

```text
Private storage
+
Signed access
```

The backend must validate uploaded objects.

---

# 76. FILE UPLOAD SECURITY

Validate:

* MIME type
* Extension
* File signature
* Size
* Filename
* Storage key
* Malware scanning where appropriate
* Authorization
* Ownership

Never execute uploaded files.

---

# 77. SEARCH API

```text
GET /api/v1/search
```

Potential parameters:

```text
q
category
seller
minPrice
maxPrice
attributes
rating
sort
cursor
limit
```

Search response should provide:

```text
Products
Listings/offers
Price
Availability
Seller
Relevant attributes
Pagination
```

---

# 78. RECOMMENDATION API

```text
GET /api/v1/recommendations/home
GET /api/v1/products/:id/similar
GET /api/v1/products/:id/frequently-bought-together
GET /api/v1/products/:id/cross-sell
GET /api/v1/products/:id/upsell
```

AI/recommendation output must remain subordinate to business rules.

---

# 79. AI API

Central gateway:

```text
/api/v1/ai
```

Potential capabilities:

```text
POST /search-understanding
POST /shopping-assistant
POST /product-comparison
POST /recommendations
POST /seller-content
POST /catalog-classification
POST /support-assist
POST /analytics-insight
```

---

# 80. AI MUTATION RULE

AI must not directly perform critical mutations such as:

```text
Payment confirmation
Refund execution
Settlement payment
Seller suspension
Permission granting
Inventory adjustment
Order delivery completion
```

AI may recommend.

Deterministic backend logic decides.

---

# 81. AI REQUEST AUTHORIZATION

Every AI capability must define:

```text
Who can invoke it
What data it can access
What tools it can use
What outputs it can produce
Whether human review is required
```

---

# 82. ANALYTICS API

Internal:

```text
GET /api/v1/analytics/overview
GET /api/v1/analytics/sales
GET /api/v1/analytics/products
GET /api/v1/analytics/sellers
GET /api/v1/analytics/delivery
GET /api/v1/analytics/customers
```

Access is role-based.

---

# 83. CONTROL API

Base:

```text
/api/v1/control
```

This is the highest-authority application surface.

Potential domains:

```text
/users
/roles
/permissions
/sellers
/products
/listings
/orders
/inventory
/payments
/refunds
/delivery
/coupons
/communications
/platform-config
/audit
/security
/emergency
```

---

# 84. HIGH-RISK CONTROL ACTIONS

Examples:

```text
Suspend seller
Block user
Suspend product
Force refund
Manual inventory adjustment
Settlement adjustment
Permission change
Emergency configuration
```

These require:

```text
Strong authentication
Fine-grained permission
Reason
Confirmation
Audit
```

Step-up authentication/approval may be required depending on risk.

---

# 85. PLATFORM CONFIG API

Configuration should be controlled.

Example:

```text
GET  /api/v1/control/config
PATCH /api/v1/control/config/:key
```

Sensitive configuration must not be returned to normal frontend clients.

---

# 86. AUDIT API

Internal:

```text
GET /api/v1/control/audit-logs
GET /api/v1/control/audit-logs/:id
```

Audit access itself should be audited where appropriate.

---

# 87. HEALTH API

Public-safe health:

```text
GET /health
GET /ready
```

Detailed operational health:

```text
GET /internal/health
```

must be protected.

---

# 88. API DEPENDENCY HEALTH

Readiness may verify:

```text
Database
Cache
Queue/event system
Critical dependencies
```

Do not expose credentials or internal topology.

---

# 89. RATE LIMITING

Rate limiting must exist at multiple levels.

Potential dimensions:

```text
IP
User
Device
Endpoint
API key
Seller
Organization
```

Sensitive endpoints receive stricter limits.

---

# 90. STRICT RATE-LIMIT ENDPOINTS

Examples:

```text
Login
OTP
Password reset
COD OTP
Payment creation
Coupon validation
Search abuse-sensitive endpoints
File upload
AI generation
```

---

# 91. BRUTE-FORCE PROTECTION

Authentication endpoints must implement:

* Rate limits
* Progressive delays where appropriate
* Attempt tracking
* Suspicious activity detection
* Session protection

---

# 92. ENUMERATION PROTECTION

Do not reveal whether an account exists when doing so creates security risk.

Example password reset:

```text
Request accepted
```

rather than:

```text
This email does not exist
```

where appropriate.

---

# 93. CORS

CORS must use an explicit allowlist.

Never use:

```text
*
```

for authenticated production APIs unless specifically justified and safe.

Allowed origins should be environment-specific.

---

# 94. SECURITY HEADERS

API infrastructure should use appropriate security headers and transport protections.

HTTPS is mandatory in production.

---

# 95. CSRF

If browser authentication uses cookies, CSRF protection must be implemented.

If bearer tokens are used in Authorization headers, CSRF considerations differ but XSS/token theft protections remain critical.

---

# 96. XSS

API must:

* Validate input
* Encode output where necessary
* Sanitize rich text
* Reject dangerous content where appropriate

Frontend rendering must also remain safe.

---

# 97. SSRF

Any API functionality that fetches external URLs must implement SSRF protection.

Examples:

```text
URL import
Image fetch
Webhook configuration
External integrations
```

Do not blindly request user-supplied URLs.

---

# 98. SQL INJECTION

Use parameterized queries/ORM.

Never concatenate untrusted input into SQL.

---

# 99. OBJECT-LEVEL AUTHORIZATION

Every resource endpoint must check ownership/permission.

Example:

```text
GET /seller/orders/:id
```

must verify:

```text
order.seller_id == authenticatedSeller.id
```

---

# 100. FUNCTION-LEVEL AUTHORIZATION

A user having:

```text
order.read
```

must not automatically have:

```text
order.refund
```

Permissions must be granular.

---

# 101. RESPONSE DATA MINIMIZATION

API responses should return only necessary fields.

Do not return complete database objects by default.

---

# 102. FIELD MASKING

Sensitive fields may be masked.

Example:

```text
******1234
```

instead of complete sensitive value.

---

# 103. API RESOURCE PROJECTION

Different applications may receive different projections.

Example:

```text
Customer Order View
Seller Order View
Support Order View
Finance Order View
Control Order View
```

All derive from the same authoritative state.

---

# 104. CUSTOMER ORDER RESPONSE

Customer should receive:

```text
Order status
Items
Prices
Delivery information
Payment status
Return eligibility
Relevant support information
```

They should not receive:

```text
Internal seller notes
Internal fraud score
Internal support notes
Internal settlement data
```

---

# 105. SELLER ORDER RESPONSE

Seller should receive:

```text
Relevant order items
Customer delivery information required for fulfillment
Payment type
Delivery requirements
Order status
```

Not:

```text
Customer's unrelated account information
Internal risk systems
Platform financial internals
```

---

# 106. SUPPORT ORDER RESPONSE

Support may receive a broader operational view but still only according to role.

---

# 107. FINANCE RESPONSE

Finance views may include:

```text
Amounts
Fees
Commission
Taxes
Refunds
Settlement
Reconciliation
```

But not unnecessary customer secrets.

---

# 108. WEBHOOK SECURITY

All incoming webhooks must support:

```text
Signature verification
Timestamp/replay protection where supported
Event ID deduplication
Payload validation
Provider reference verification
Logging
Failure handling
```

---

# 109. WEBHOOK RESPONSE

Webhook handlers should respond quickly.

Heavy work should be asynchronous:

```text
Webhook
 ↓
Validate
 ↓
Persist
 ↓
Queue/Event
 ↓
Return
```

---

# 110. WEBHOOK RETRIES

Provider retries must be safe.

Duplicate event:

```text
Already processed
```

must not duplicate:

* Payment
* Refund
* Order state
* Settlement
* Inventory change

---

# 111. API EVENTS

Important API operations emit domain events.

Examples:

```text
USER_REGISTERED
SELLER_SUBMITTED
SELLER_APPROVED
PRODUCT_CREATED
PRODUCT_APPROVED
PRODUCT_PUBLISHED
LISTING_ACTIVATED
ITEM_ADDED_TO_CART
CHECKOUT_STARTED
PAYMENT_INITIATED
PAYMENT_CONFIRMED
PAYMENT_FAILED
ORDER_CREATED
SELLER_ACCEPTED
SELLER_REJECTED
RIDER_ASSIGNED
ORDER_PICKED_UP
ORDER_DELIVERED
RETURN_REQUESTED
RETURN_APPROVED
REFUND_INITIATED
REFUND_COMPLETED
TICKET_CREATED
TICKET_ESCALATED
TICKET_RESOLVED
```

---

# 112. EVENT VERSIONING

Every event should have:

```text
event_id
event_type
event_version
aggregate_type
aggregate_id
occurred_at
payload
correlation_id
```

Example:

```json
{
  "eventType": "ORDER_CREATED",
  "eventVersion": 1,
  "aggregateType": "ORDER",
  "aggregateId": "..."
}
```

---

# 113. API → EVENT RELATION

API request:

```text
POST /orders
```

may produce:

```text
ORDER_CREATED
```

The event must only be emitted after the authoritative transaction is successfully committed.

---

# 114. TRANSACTION + OUTBOX

Critical workflow:

```text
BEGIN
 ↓
Database changes
 ↓
Outbox event
 ↓
COMMIT
```

If commit fails:

```text
No successful event
```

If commit succeeds:

```text
Worker can safely process event
```

---

# 115. ASYNC OPERATIONS

Long-running work should return:

```text
202 Accepted
```

when appropriate.

Example:

```text
AI report generation
Large export
Bulk catalog processing
Settlement calculation
```

Response may include:

```json
{
  "success": true,
  "data": {
    "jobId": "..."
  }
}
```

---

# 116. BULK APIs

Bulk operations require special protection.

Example:

```text
POST /api/v1/seller/products/bulk-update
```

Must enforce:

* Maximum item count
* Authorization
* Validation
* Partial failure strategy
* Audit
* Rate limiting
* Job processing where appropriate

---

# 117. BULK RESULT

Possible structure:

```json
{
  "success": true,
  "data": {
    "processed": 95,
    "failed": 5,
    "errors": []
  }
}
```

---

# 118. API EXPORTS

Large reports should not be generated synchronously.

Flow:

```text
Request
 ↓
Authorization
 ↓
Create Job
 ↓
202
 ↓
Worker
 ↓
Generate File
 ↓
Private Storage
 ↓
Signed Download
```

---

# 119. API TIMEOUTS

External calls must have explicit timeouts.

Never allow indefinite provider calls.

---

# 120. RETRY POLICY

Retries must be selective.

Safe candidates:

```text
Transient network failure
Temporary provider unavailable
```

Unsafe blind retries:

```text
Payment charge
Refund
Settlement
Inventory mutation
```

unless idempotency is guaranteed.

---

# 121. CIRCUIT BREAKER

External providers may require circuit-breaking.

Examples:

```text
Payment provider
SMS provider
Email provider
Maps provider
AI provider
Shipping provider
```

---

# 122. GRACEFUL DEGRADATION

If AI fails:

```text
Core commerce continues
```

If recommendation fails:

```text
Normal catalog remains available
```

If analytics fails:

```text
Transactional operations continue
```

Critical dependencies must be classified separately.

---

# 123. API OBSERVABILITY

Every request should support:

```text
Request ID
Correlation ID
Latency
HTTP status
Endpoint
Actor
Application
Error code
```

Sensitive values must not be logged.

---

# 124. DISTRIBUTED TRACING

Where infrastructure supports it:

```text
API
 ↓
Service
 ↓
Database
 ↓
Queue
 ↓
Worker
 ↓
External Provider
```

should be traceable.

---

# 125. LOGGING

Logs should be structured.

Example conceptual:

```json
{
  "level": "info",
  "requestId": "...",
  "route": "/api/v1/orders",
  "method": "POST",
  "status": 201,
  "durationMs": 124
}
```

Never log:

* Passwords
* OTP values
* Access tokens
* Refresh tokens
* Card credentials
* Private keys
* Sensitive KYC content

---

# 126. API CONTRACT DOCUMENTATION

OpenAPI/Swagger should be generated from the actual API contract.

Documentation must include:

* Endpoint
* Method
* Authentication
* Permissions
* Request schema
* Response schema
* Errors
* Examples
* Idempotency requirements
* Pagination
* Rate limits where relevant

---

# 127. CONTRACT-FIRST PRINCIPLE

For major endpoints:

```text
Business Requirement
 ↓
API Contract
 ↓
Validation Schema
 ↓
Implementation
 ↓
Tests
```

Do not implement arbitrary endpoints without contract alignment.

---

# 128. API TESTING

Every critical endpoint requires:

```text
Happy path
Validation failure
Unauthorized
Forbidden
Not found
Conflict
Invalid state
Duplicate request
Race condition where relevant
```

---

# 129. API CONTRACT TESTING

Applications should verify that actual responses remain compatible with the documented contract.

Breaking API changes must be detected before production deployment.

---

# 130. CRITICAL E2E API FLOWS

At minimum:

```text
Customer Registration
 ↓
Login
 ↓
Browse
 ↓
Cart
 ↓
Checkout
 ↓
Online Payment
 ↓
Order
```

And:

```text
Guest Cart
 ↓
Login
 ↓
Cart Merge
 ↓
Checkout
```

And:

```text
COD
 ↓
Secondary Mobile
 ↓
OTP
 ↓
COD Verification
 ↓
Order Confirmation
```

And:

```text
Seller Registration
 ↓
Application
 ↓
Review
 ↓
Approval
 ↓
Product
 ↓
Listing
 ↓
Order
 ↓
Fulfillment
```

---

# 131. API SECURITY TESTS

Must test:

```text
BOLA / IDOR
Privilege escalation
Mass assignment
Authentication bypass
Rate-limit bypass
CSRF where applicable
XSS
Injection
Webhook replay
Webhook forgery
Idempotency bypass
Race conditions
Sensitive data exposure
```

---

# 132. API PERFORMANCE

Critical endpoints should have defined performance targets.

Targets should be measured under realistic load.

Do not claim a specific latency target until infrastructure/load profile is established.

---

# 133. DATABASE TRANSACTION RULE

The API layer must not perform partial critical mutations.

For example:

Bad:

```text
Create Order
 ↓
Response
 ↓
Later reserve stock
```

if that can produce overselling.

Critical consistency must be established before success is returned.

---

# 134. SUCCESS RESPONSE RULE

A mutation should return success only after the required authoritative state is safely committed.

Asynchronous downstream processing may continue after that.

---

# 135. ERROR RETRY GUIDANCE

Errors should communicate whether retry is safe.

For example:

```json
{
  "code": "RATE_LIMITED",
  "retryable": true
}
```

or:

```json
{
  "code": "VALIDATION_ERROR",
  "retryable": false
}
```

---

# 136. API DEPRECATION

Deprecated endpoints must provide:

```text
Deprecation notice
Replacement endpoint
Migration guidance
Removal timeline
```

Do not silently remove APIs.

---

# 137. API COMPATIBILITY

Changes should prefer:

```text
Add field
Add endpoint
Add optional capability
```

over:

```text
Rename field
Remove field
Change semantic meaning
```

---

# 138. CUSTOMER API BOUNDARY

Customer applications may access only customer-facing capabilities.

They must never receive internal:

```text
Control APIs
Finance APIs
Seller governance APIs
Internal support notes
Security internals
```

---

# 139. SELLER API BOUNDARY

Seller applications may access:

```text
Seller profile
Catalog submission
Listings
Inventory
Seller orders
Fulfillment
Seller analytics
Seller support
```

only within authorized seller scope.

---

# 140. CATALOG API BOUNDARY

Catalog application may access:

```text
Categories
Attributes
Products
Variants
Media
Approval
Publication
Catalog quality
```

It should not automatically receive finance authority.

---

# 141. DELIVERY API BOUNDARY

Delivery application receives:

```text
Assigned tasks
Pickup information
Delivery information
Route-related operational data
Delivery status
Proof of delivery
```

Nothing beyond operational necessity.

---

# 142. SUPPORT API BOUNDARY

Support application receives controlled views of:

```text
Customers
Orders
Payments
Returns
Refunds
Delivery
Tickets
```

but not unrestricted database access.

---

# 143. FINANCE API BOUNDARY

Finance application receives:

```text
Transactions
Payables
Refunds
Settlements
Reconciliation
Reports
```

without unrelated control privileges.

---

# 144. CONTROL API BOUNDARY

Control application has the broadest legitimate administrative surface.

Still:

```text
Authentication
+
Permission
+
Context
+
Audit
```

remain mandatory.

---

# 145. API INTERNAL SERVICE ACCESS

Internal services must authenticate to each other.

Do not assume:

```text
Internal = trusted
```

Service credentials must have least privilege.

---

# 146. API SECRET MANAGEMENT

Secrets must come from secure environment/secret management.

Never hardcode:

```text
Database passwords
JWT secrets
Payment secrets
Webhook secrets
AI provider keys
Storage credentials
```

---

# 147. API CONFIGURATION

Environment-specific values:

```text
Development
Staging
Production
```

must remain separate.

---

# 148. PRODUCTION API RULES

Production API must have:

```text
HTTPS
Authentication
Authorization
Rate limiting
Input validation
Audit
Monitoring
Error handling
Backup/recovery support
Secure secret management
```

---

# 149. API NON-NEGOTIABLES

1. Frontend is never authoritative.
2. Backend validates every critical input.
3. Authentication and authorization are separate.
4. Seller data is tenant-isolated.
5. Customer data is user-isolated.
6. Critical mutations support idempotency where required.
7. Payment webhooks are verified.
8. Financial mutations are audited.
9. Inventory mutations are concurrency-safe.
10. API errors do not leak internals.
11. Sensitive data is minimized.
12. Search is not the source of truth.
13. AI cannot directly control critical business state.
14. Production secrets never appear in source code.
15. Breaking API changes require versioning.
16. Critical workflows are transactionally safe.
17. Events are emitted through reliable event architecture.
18. Bulk operations are controlled.
19. External provider failures are handled safely.
20. Every critical endpoint must be tested.

---

# 150. API IMPLEMENTATION GATE

The API implementation phase is considered complete only when:

```text
API Contract
      +
Validation
      +
Authentication
      +
Authorization
      +
Business Rules
      +
Database Transactions
      +
Events
      +
Error Handling
      +
Security
      +
Tests
      +
Observability
```

are implemented and verified.

---

# 151. NEXT DOCUMENT

Next documentation file:

```text
05-AUTH-RBAC-ABAC.md
```

This document will define the complete authorization architecture:

```text
Users
Roles
Permissions
Scopes
Organizations
Seller isolation
Customer isolation
Support access
Finance access
Control access
ABAC policies
Resource-level authorization
Step-up authentication
Session security
Permission inheritance
Temporary access
Emergency access
Audit requirements
```

No production authentication/authorization implementation should begin until that model is defined.

Save it here:

```text
BILOKAT/
└── PROJECT-DOCS/
    ├── 00-MASTER-SPEC.md
    ├── 01-ARCHITECTURE.md
    ├── 02-BUSINESS-WORKFLOWS.md
    ├── 03-DATABASE-DESIGN.md
    └── 04-API-SPECIFICATION.md   ← नया
```



---

# Session 14 addendum — Seller onboarding / KYC endpoints (reference)

## POST /api/v1/auth/seller-register  (public)
Seller self-service registration.
Request:
```json
{ "email": "s@ex.com", "password": "Secret1!", "fullName": "Owner",
  "legalName": "Legal Entity Pvt Ltd", "businessName": "Shop Name",
  "gstin": "27AAACP1234F1Z5",   // optional
  "pan": "AABCD1234E",           // optional
  "commissionRateBps": 0 }       // optional, 0..10000
```
Creates a SELLER Organization (slug `org-<name>-<hex>`), a PENDING Seller with a random
`sellerCode` (`SELL-XXXXXXXX`), a DRAFT SellerApplication, an ACTIVE SELLER User and an OWNER
OrganizationMember. Response 201:
```json
{ "success": true, "data": { "user": {"id":"","email":"","role":"SELLER","status":"ACTIVE"},
  "tokens": {"accessToken":"","refreshToken":"","expiresIn":900},
  "seller": {"id":"","sellerCode":"SELL-XXXXXXXX","legalName":"","displayName":"",
             "status":"PENDING","organizationId":""} } }
```
Errors: 409 duplicate email, 400 validation.

## Seller owner surface (Bearer, role SELLER, bound to own seller) — prefix `/api/v1/seller/onboarding`
- `GET  /me` — seller org + latest application + its documents.
- `PATCH /profile` — body subsets of { gstin, pan, businessAddress, city, state,
  bankAccountHolder, bankAccountLast4, bankIfsc, payoutPreference, businessName, agreedToTerms }.
- `POST /documents` — body { documentType, storageObjectId, fileName, mimeType?, sizeBytes? }.
  Storage-intent only; no object store is contacted. Returns the PENDING document record.
- `POST /submit` — moves application to SUBMITTED (or RESUBMITTED) and seller to UNDER_REVIEW.
  Requires agreedToTerms. 409 when seller not in an editable state.

## Marketplace staff — prefix `/api/v1/seller-onboarding`
- `POST /sellers`                      (OPERATOR/ADMIN) create ACTIVE seller; optional operatorEmail.
- `GET  /applications?status=&sellerId=&page=&limit=` (REVIEWER/ADMIN) paged list.
- `GET  /applications/:id`             (REVIEWER/ADMIN) detail + documents + review history.
- `POST /applications/:id/review`      (REVIEWER/ADMIN) { decision: APPROVE|REJECT|CORRECTION_REQUIRED|ADDITIONAL_INFORMATION_REQUIRED, reason?, notes? }.
- `POST /documents/:id/verify`         (REVIEWER/ADMIN) { approved, reason? }.
- `POST /sellers/:id/activate`         (REVIEWER/ADMIN/OPERATOR) APPROVED -> ACTIVE only.
- `POST /sellers/:id/status`           (OPERATOR/ADMIN) { status: ACTIVE|SUSPENDED|DEACTIVATED, reason? }.

Note: a REVIEWER has onboarding scope only and receives 403 on `/finance/**`, `/fulfilment/**`,
`/return-requests/**`, `/seller/orders/**`, and the OP/ADMIN seller-create & status routes.


---

# Session 15 addendum — Delivery/courier endpoints (reference)

## OPERATOR/ADMIN — `/api/v1/delivery`
- `POST /partners` `{ userId (a DELIVERY-role user), partnerCode?, vehicleType? }` → creates an ACTIVE `DeliveryPartner` (one per user). 409 if the user already has a profile; 400 if the user is not DELIVERY-role.
- `GET /partners`, `PATCH /partners/:id/status` `{ status: ACTIVE|SUSPENDED|INACTIVE|REGISTERED }`.
- `GET /assignments?status=&deliveryPartnerId=&orderId=&sellerOrderId=&page=&limit=` (paged).
- `GET /assignments/:id` (assignment + its `delivery_events`).
- `POST /slices/:sellerOrderId/assign` `{ deliveryPartnerId }` and `/reassign` → new ASSIGNED `DeliveryAssignment`. Guards: slice ACCEPTED + not delivered, order SHIPPED/OUT_FOR_DELIVERY, partner ACTIVE, no existing active assignment.
- `POST /assignments/:id/cancel` (only while ASSIGNED/ACCEPTED/PICKED_UP/OUT_FOR_DELIVERY).

## DELIVERY partner — `/api/v1/delivery/tasks` (DELIVERY role; own assignments only)
- `GET /tasks` — my active (ACCEPTED/PICKED_UP/OUT_FOR_DELIVERY) assignments.
- `POST /tasks/:id/{accept,reject}` (reject body `{ reason }`) from ASSIGNED.
- `POST /tasks/:id/{pickup,out-for-delivery}` (ordered steps).
- `POST /tasks/:id/deliver` — marks the slice `deliveredAt`; if it was the last outstanding
  slice, finalizes the order to DELIVERED (earn payables) in the same transaction.
- `POST /tasks/:id/fail` `{ reason }` from any partner-active step.

```
ASSIGNED → ACCEPTED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
              \--REJECTED   \--FAILED   (operator reassigns/cancels)
```

# Session 16 addendum — Return replacement vs refund + evidence upload (reference)

Extends the Session 08 item-level returns API (`orders/:orderId/returns`, `return-requests/:id`).
The refund/auto-debit money logic is unchanged for REFUND-resolution requests.

## Resolution & evidence request
- `POST /api/v1/orders/:orderId/returns` body now also accepts (both optional):
  - `resolution`: `REFUND` (default) | `REPLACEMENT` — the customer-chosen remedy.
  - `evidence[]`: `[{ storageObjectId, fileName?, mimeType?, sizeBytes?, kind? }]`
    (storage-intent object references; backend stores no raw binary).
  - When `resolution: REPLACEMENT`, the request is created with `evidenceRequired: true` and
    each return item with `replacementRequested: true`. Response includes `resolution`,
    `evidenceRequired`, `evidence[]`, `replacement?`.

## Evidence upload
- CUSTOMER `POST /api/v1/orders/:orderId/returns/:returnRequestId/evidence`
  (ownership enforced; 404 cross-owner) and OPERATOR/ADMIN
  `POST /api/v1/return-requests/:returnRequestId/evidence` (RBAC-guarded). Body `EvidenceUploadDto`.
  Both persist a `return_evidence` row and append an audited `EVIDENCE_UPLOADED` event.
  409 if the request is already terminal (REPLACEMENT_ISSUED / COMPLETED / CANCELLED).

## Replacement resolution flow
- `REPLACEMENT` request: ... → operator decision → pickup → picked-up → inspection.
- `POST /api/v1/return-requests/:returnRequestId/inspection` with all items PASS/PARTIAL_PASS:
  the request goes **terminal `REPLACEMENT_ISSUED`** and a `replacement` row is created
  (`RPL-…`, `PENDING_DISPATCH`, quantity = non-FAIL units). **No Refund and no seller-payable
  auto-debit.** A refund endpoint call on a `REPLACEMENT_ISSUED` request returns 409.
  (Outbound dispatch `PENDING_DISPATCH → DISPATCHED → …` is modelled but not yet API-driven.)
- `REFUND` resolution (default) continues exactly as before → `APPROVED_FOR_REFUND` →
  `initiateRefund`/`completeRefund` (server-amounted refund + auto return-debit + terminal
  aggregate update).

```
REFUND     resolution:  …→ APPROVED_FOR_REFUND → (refund) → COMPLETED
REPLACEMENT resolution: …→ REPLACEMENT_ISSUED (terminal) + replacement (PENDING_DISPATCH)
```
