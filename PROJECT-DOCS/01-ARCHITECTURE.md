# BILOKAT — SYSTEM ARCHITECTURE

> Document Type: Technical Architecture Specification
> Project: Bilokat
> Version: 1.0.0
> Parent Specification: 00-MASTER-SPEC.md
> Status: Architecture Foundation
> Implementation Status: Not Started
> Last Updated: 2026-09-07

---

# 1. PURPOSE

This document converts the Bilokat Master Specification into a concrete technical architecture.

It defines:

- Application boundaries
- Backend architecture
- Frontend architecture
- Data ownership
- Database architecture
- API architecture
- Authentication architecture
- Authorization architecture
- Event architecture
- Queue/background processing
- Cache architecture
- Search architecture
- Storage architecture
- Notification architecture
- AI architecture boundaries
- Observability
- Deployment boundaries
- Scalability principles
- Inter-application communication
- Security boundaries
- Failure isolation
- Technology selection principles

This document is a technical blueprint.

It must be read together with:

`00-MASTER-SPEC.md`

The Master Specification defines what Bilokat must do.

This document defines how the system should technically support it.

---

# 2. ARCHITECTURAL GOALS

The architecture must prioritize:

1. Security
2. Data integrity
3. Reliability
4. Maintainability
5. Scalability
6. Independent deployability
7. Clear ownership
8. Testability
9. Observability
10. Performance
11. Extensibility
12. AI readiness

The architecture must avoid unnecessary complexity.

The goal is not to create the largest number of services.

The goal is to create clear boundaries that can scale when actual traffic and operational requirements demand it.

---

# 3. ARCHITECTURAL STYLE

Bilokat should initially use a:

## Modular Central Backend + Independent Frontends + Event-Driven Infrastructure

architecture.

Conceptually:

```text
                         ┌──────────────────────┐
                         │      CUSTOMER WEB    │
                         └──────────┬───────────┘
                                    │
                         ┌──────────▼───────────┐
                         │      SELLER WEB      │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │                                │
                    │        BILOKAT API             │
                    │                                │
                    │  Modular Business Backend     │
                    │                                │
                    └───────────────┬────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
     PostgreSQL                  Redis                   Object Storage
          │                         │                         │
          │                         │                         │
          ▼                         ▼                         ▼
      Source of                Cache / Queue              Media
       Truth                   / Sessions                 / Files
          │
          ▼
     Event System
          │
    ┌─────┼─────────┬────────────┬────────────┐
    ▼     ▼         ▼            ▼            ▼
 Analytics Search  Notifications AI       Background Jobs
````

The backend should be modular internally.

It should not immediately be fragmented into many independently deployed microservices unless there is a demonstrated need.

---

# 4. NO MONOREPO

Bilokat will use independent repositories/applications.

Recommended logical repositories:

```text
bilokat-api
customer-web
seller-web
catalog-publishing-web
support-web
delivery-web
finance-web
control-web
analytics-web
```

Optional shared packages may exist separately.

Examples:

```text
bilokat-types
bilokat-api-client
bilokat-ui
bilokat-validation
bilokat-auth
bilokat-config
```

Shared packages should be versioned and released independently.

Applications must not directly depend on each other's source code.

---

# 5. APPLICATION BOUNDARIES

## 5.1 customer-web

Primary audience:

Customer

Responsibilities:

* Public discovery
* Search
* Product browsing
* Product details
* Cart
* Checkout
* Account
* Orders
* Returns
* Wishlist
* Reviews
* Notifications
* Customer AI experiences

Must not contain:

* Seller administration
* Internal support controls
* Finance operations
* Platform administration

---

# 6. seller-web

Primary audience:

Seller

Responsibilities:

* Seller dashboard
* Seller profile
* Product management
* Listing management
* Inventory
* Orders
* Packaging
* Fulfillment
* Returns
* Reports
* Settlements
* Support

Seller Web must communicate only through authorized APIs.

It must never directly access the database.

---

# 7. catalog-publishing-web

Primary audience:

Catalog and moderation teams

Responsibilities:

* Product review
* Catalog governance
* Attribute validation
* Media review
* Duplicate detection
* Content quality
* Compliance checks
* Approval
* Correction requests
* Rejection
* Publication
* Suspension

This application must not bypass backend authorization.

---

# 8. support-web

Primary audience:

Support agents

Responsibilities:

* Customer support
* Seller support
* Ticketing
* Conversations
* COD verification
* Escalation
* SLA
* Internal notes
* Permitted operational actions

Support permissions must be separate from Control Panel permissions.

---

# 9. delivery-web

Primary audience:

Delivery partners

Responsibilities:

* Availability
* Delivery assignments
* Pickup
* Delivery
* Navigation
* Verification
* Proof of delivery
* Failed delivery
* Return pickup

The application should be mobile-first.

It may be deployed as a PWA where appropriate.

---

# 10. finance-web

Primary audience:

Finance users

Responsibilities:

* Financial transactions
* Revenue
* Commission
* Taxes
* Refunds
* Seller payable
* Settlements
* Reconciliation
* Finance reports

Financial operations require strict authorization.

---

# 11. control-web

Primary audience:

Authorized platform administrators

Responsibilities:

* Seller governance
* Catalog governance
* Product controls
* Listing controls
* Platform configuration
* Communication
* Campaigns
* Permissions
* Emergency controls
* Operational overrides
* Audit

This is the highest-authority operational application.

---

# 12. analytics-web

Primary audience:

Authorized business/operations users

Responsibilities:

* Business analytics
* Customer analytics
* Seller analytics
* Product analytics
* Delivery analytics
* Finance analytics
* Operational analytics
* AI-generated insights

Analytics should consume derived/analytical data rather than modifying authoritative commerce state.

---

# 13. CENTRAL BACKEND

Repository:

```text
bilokat-api
```

The backend is the authoritative business layer.

It should contain clear modules rather than one giant unstructured codebase.

Initial logical modules:

```text
auth
users
organizations
roles
permissions
sessions
sellers
seller-onboarding
kyc
documents
catalog
categories
attributes
products
variants
listings
pricing
inventory
warehouses
carts
checkout
orders
payments
coupons
delivery
returns
refunds
notifications
support
reviews
settlements
finance
analytics-events
search
storage
ai
audit
configuration
feature-flags
health
```

Modules should have clear responsibilities.

---

# 14. MODULAR BACKEND STRUCTURE

Recommended conceptual structure:

```text
bilokat-api/
│
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── sellers/
│   │   ├── catalog/
│   │   ├── products/
│   │   ├── listings/
│   │   ├── inventory/
│   │   ├── carts/
│   │   ├── checkout/
│   │   ├── orders/
│   │   ├── payments/
│   │   ├── coupons/
│   │   ├── delivery/
│   │   ├── returns/
│   │   ├── refunds/
│   │   ├── support/
│   │   ├── finance/
│   │   ├── settlements/
│   │   ├── notifications/
│   │   ├── reviews/
│   │   ├── search/
│   │   ├── analytics/
│   │   ├── ai/
│   │   ├── storage/
│   │   ├── audit/
│   │   └── configuration/
│   │
│   ├── common/
│   ├── infrastructure/
│   ├── events/
│   ├── jobs/
│   ├── config/
│   └── main
│
├── prisma/
├── test/
└── ...
```

The exact framework may be selected during implementation after verifying current stable versions.

---

# 15. BACKEND LAYERING

Each major module should follow a predictable internal structure.

Conceptually:

```text
Controller / API
      ↓
Application Service
      ↓
Domain / Business Logic
      ↓
Repository / Data Access
      ↓
Database
```

Infrastructure integrations should be separated from core business rules.

Example:

```text
PaymentService
      ↓
PaymentProvider abstraction
      ↓
Specific Gateway Adapter
```

This prevents payment provider lock-in.

---

# 16. DOMAIN OWNERSHIP

Each domain should own its business logic.

Examples:

## Seller domain

Owns:

* Seller status
* Seller onboarding
* Seller profile rules
* Seller approval

## Catalog domain

Owns:

* Product structure
* Categories
* Attributes
* Publication

## Order domain

Owns:

* Order lifecycle
* State transitions
* Order invariants

## Payment domain

Owns:

* Payment state
* Verification
* Webhook processing

## Delivery domain

Owns:

* Delivery lifecycle
* Assignment
* Delivery state

## Finance domain

Owns:

* Financial records
* Settlement calculations
* Reconciliation

No unrelated module should silently mutate another domain's critical state.

---

# 17. DATABASE ARCHITECTURE

Primary transactional database:

```text
PostgreSQL
```

PostgreSQL is the authoritative source for transactional business data.

Likely ORM/data-access layer:

```text
Prisma
```

The exact version must be selected based on the current stable ecosystem at implementation time.

---

# 18. DATABASE RESPONSIBILITIES

PostgreSQL should contain authoritative records for:

* Users
* Organizations
* Sellers
* KYC metadata
* Products
* Categories
* Attributes
* Listings
* Inventory metadata
* Carts
* Orders
* Payments metadata
* Coupons
* Delivery records
* Returns
* Refunds
* Support tickets
* Finance records
* Settlements
* Permissions
* Audit metadata
* Configuration

Large binary files should not be stored directly in PostgreSQL unless there is a specific justified reason.

---

# 19. DATABASE DESIGN PRINCIPLES

Database design must prioritize:

* Referential integrity
* Foreign keys
* Unique constraints
* Check constraints where appropriate
* Proper indexing
* Transaction safety
* Migration safety
* Query efficiency
* Auditability

Do not create tables simply because a frontend screen exists.

Tables must represent meaningful business entities.

---

# 20. DATABASE TRANSACTIONS

Transactions must be used where multiple changes must succeed together.

Examples:

* Order creation
* Stock reservation
* Payment state changes
* Refund state transitions
* Settlement calculations
* Critical seller state transitions

Avoid distributed transactions unless absolutely necessary.

---

# 21. CONCURRENCY

Critical resources must handle concurrent access correctly.

Examples:

Two customers attempting to purchase the final inventory unit.

The architecture must prevent:

```text
Stock = 1

Customer A → buys 1
Customer B → buys 1

Result:
Stock = -1
```

Correct behavior requires transactional reservation/locking strategies.

---

# 22. INVENTORY MODEL

Inventory must be separated conceptually into:

```text
Product
Listing
Inventory
Warehouse
Stock Movement
```

Inventory may contain:

* Available
* Reserved
* Incoming
* Damaged
* Returned
* Batch-specific quantity

All important inventory mutations should create traceable stock movements.

---

# 23. CACHE ARCHITECTURE

Primary cache/session/short-lived state infrastructure:

```text
Redis
```

Potential use cases:

* Sessions
* Rate limiting
* Temporary cart data where appropriate
* Caching
* Distributed locks where justified
* Job queues
* OTP state
* Short-lived verification state
* Frequently accessed configuration
* Search/cache acceleration

Redis must not become the authoritative store for critical transactional data.

---

# 24. REDIS PRINCIPLE

If Redis disappears:

The system should be able to recover.

Critical permanent business data must remain in PostgreSQL.

Redis is primarily:

```text
Acceleration
Coordination
Temporary State
Background Processing
```

not the primary system of record.

---

# 25. BACKGROUND JOB ARCHITECTURE

Long-running/non-critical operations should not block HTTP requests.

Potential jobs:

* Email
* Notifications
* Search indexing
* Image processing
* AI processing
* Analytics aggregation
* Report generation
* Retry workflows
* Data synchronization
* Settlement preparation
* Document processing

Conceptual flow:

```text
API Request
   ↓
Business Transaction
   ↓
Event / Job
   ↓
Queue
   ↓
Worker
   ↓
Processing
```

---

# 26. QUEUE PRINCIPLES

Queues should support:

* Retry
* Backoff
* Dead-letter handling where appropriate
* Idempotency
* Observability
* Failure reporting

A failed background job must not disappear silently.

---

# 27. EVENT ARCHITECTURE

Business events should be emitted for important state changes.

Example:

```text
Order Confirmed
      ↓
ORDER_CONFIRMED
      ├── Notification
      ├── Analytics
      ├── Seller update
      ├── Delivery preparation
      └── AI/ML signals
```

Event consumers should be independent.

---

# 28. EVENT VS COMMAND

Use commands when asking a component to perform an action.

Use events when reporting that something happened.

Example:

```text
Command:
AssignRider

Event:
RiderAssigned
```

This distinction should remain consistent.

---

# 29. EVENT IDEMPOTENCY

Every important event consumer should be able to safely handle duplicate delivery.

Example:

```text
PAYMENT_CONFIRMED
PAYMENT_CONFIRMED
```

must not create two orders or two settlements.

Use event IDs/idempotency keys where appropriate.

---

# 30. OUTBOX PATTERN

For critical database-to-event consistency, an outbox-style approach should be considered.

Conceptually:

```text
Database Transaction
      ├── Business Change
      └── Outbox Event
              ↓
          Event Worker
              ↓
        Message / Queue
```

This prevents a successful database transaction from losing its corresponding event due to process failure.

---

# 31. API ARCHITECTURE

The backend should expose versioned APIs.

Conceptually:

```text
/api/v1/...
```

API conventions should be standardized across all applications.

---

# 32. API DESIGN PRINCIPLES

APIs should have:

* Consistent naming
* Strong schemas
* Validation
* Authorization
* Pagination
* Filtering
* Sorting
* Standard errors
* Request IDs
* Rate limits
* Documentation
* Versioning

---

# 33. API RESPONSE PRINCIPLE

Responses should be predictable.

Success:

```text
data
metadata
```

Error:

```text
code
message
details
requestId
```

Internal implementation details must not leak to clients.

---

# 34. PAGINATION

Large collections must not be returned unbounded.

Use appropriate pagination.

Potential approaches:

* Cursor pagination
* Keyset pagination
* Offset pagination for small/admin datasets where acceptable

Cursor/keyset pagination should be preferred for large frequently changing datasets.

---

# 35. FILTERING AND SORTING

List APIs should support controlled:

* Filtering
* Sorting
* Search
* Pagination

Do not allow arbitrary database expressions from clients.

All query parameters must be validated.

---

# 36. API AUTHORIZATION

Every protected endpoint must verify:

```text
Authentication
+
Role
+
Permission
+
Resource scope
+
Business state
```

Example:

Seller requesting another seller's order:

```text
Authenticated = YES
Role = SELLER
Permission = VIEW_ORDER
Ownership = FAIL

→ DENY
```

---

# 37. AUTHENTICATION ARCHITECTURE

Authentication should have centralized logic.

Conceptually:

```text
Client
 ↓
Auth API
 ↓
Identity Verification
 ↓
Session / Token
 ↓
Authorization
 ↓
Application API
```

Support:

* Login
* Logout
* OTP
* Password authentication where needed
* Session management
* Recovery
* Device/session revocation

---

# 38. SESSION SECURITY

Sessions/tokens must support:

* Expiration
* Revocation
* Rotation where appropriate
* Device awareness
* Suspicious session detection
* Secure storage
* Logout invalidation

Browser storage strategy must be selected with security implications in mind.

Avoid unnecessarily exposing long-lived credentials to JavaScript.

---

# 39. RBAC

Roles are collections of permissions.

Example:

```text
SELLER_OWNER
SELLER_MANAGER
SELLER_STAFF
SUPPORT_AGENT
CATALOG_REVIEWER
FINANCE_OPERATOR
CONTROL_ADMIN
DELIVERY_PARTNER
```

Permissions should be granular.

Example:

```text
seller.product.read
seller.product.create
seller.product.update
seller.product.submit
seller.order.read
seller.order.accept
seller.order.reject
```

---

# 40. ABAC

Attribute-based authorization may be used where RBAC alone is insufficient.

Possible attributes:

* Organization
* Seller
* Region
* Warehouse
* Resource owner
* Department
* Action risk
* User status

Example:

A finance employee may view financial records only for assigned organizations/regions.

---

# 41. SERVICE AUTHORIZATION

Backend services and workers must also authenticate and authorize themselves.

Never assume:

```text
Internal = Trusted
```

Internal endpoints must still have security boundaries.

---

# 42. OBJECT STORAGE

Large media/files should use object storage.

Potential compatible systems:

* S3-compatible storage
* Cloud object storage

Use cases:

* Product images
* Product videos
* Seller documents
* KYC documents
* Return evidence
* Delivery proof
* Reports
* Generated assets

---

# 43. STORAGE SECURITY

Storage must support:

* Private buckets for sensitive files
* Public/CDN access only for intentionally public assets
* Signed URLs where appropriate
* Expiration
* Access control
* File validation
* Malware scanning where appropriate

KYC documents must not be publicly accessible.

---

# 44. CDN

Public product media should ideally be delivered through a CDN.

Flow:

```text
Customer
 ↓
CDN
 ↓
Object Storage
```

This reduces backend load.

---

# 45. IMAGE PROCESSING

Product media pipeline may be:

```text
Upload
 ↓
Validation
 ↓
Security Scan
 ↓
Processing
 ↓
Resize
 ↓
Optimization
 ↓
Storage
 ↓
CDN
```

Original files may be retained according to storage policy.

---

# 46. SEARCH ARCHITECTURE

Search should be treated as a derived system.

Source:

```text
PostgreSQL
```

Derived index:

```text
Search Engine
```

Potential technology should be selected during implementation based on:

* Scale
* Features
* Cost
* Operational complexity
* Search quality

Possible technologies may include:

* OpenSearch
* Elasticsearch-compatible infrastructure
* PostgreSQL full-text search for initial scale
* Specialized search providers

Do not introduce a dedicated search cluster without a real need.

---

# 47. SEARCH DATA FLOW

```text
Product Approved
      ↓
Product Published
      ↓
Database Update
      ↓
Outbox/Event
      ↓
Search Index Worker
      ↓
Search Index
      ↓
Customer Search
```

---

# 48. SEARCH CONSISTENCY

Search index is not authoritative.

If search index becomes unavailable:

* Product data remains safe
* Search can recover
* Index can be rebuilt

There must be a reindex mechanism.

---

# 49. PRODUCT VISIBILITY ARCHITECTURE

Customer API should expose only eligible products/listings.

Eligibility should evaluate:

```text
Seller Status
+
Product Status
+
Publication Status
+
Listing Status
+
Availability
+
Serviceability
+
Policy Restrictions
```

The frontend should not need to filter hidden products manually.

---

# 50. HOMEPAGE CONTENT ARCHITECTURE

Homepage should be driven by backend-managed content.

Conceptually:

```text
CMS/Control Configuration
        ↓
Homepage API
        ↓
Customer Web
```

Sections can include:

* Banner
* Category rail
* Featured products
* Deals
* Trending
* Recommendations
* Collections

The frontend renders supported section types dynamically.

---

# 51. CMS PRINCIPLE

The platform does not need to become a giant generic CMS.

Instead, create domain-specific content models required by Bilokat.

Avoid building unnecessary abstraction.

---

# 52. CART ARCHITECTURE

Cart should be server-aware.

Guest:

```text
Anonymous Customer
 ↓
Cart ID
 ↓
Cart Service
```

Authenticated:

```text
Customer
 ↓
Account
 ↓
Cart
```

After login:

```text
Guest Cart
     +
User Cart
     ↓
Merge Logic
     ↓
Final User Cart
```

Merge conflicts must be handled safely.

---

# 53. CART VALIDATION

Before checkout:

```text
Cart
 ↓
Product validation
 ↓
Listing validation
 ↓
Seller validation
 ↓
Stock validation
 ↓
Price validation
 ↓
Coupon validation
 ↓
Delivery validation
 ↓
Final quote
```

---

# 54. PRICING ENGINE

Pricing must be centralized.

Conceptually:

```text
Base Product/List Price
        ↓
Seller Pricing
        ↓
Promotions
        ↓
Coupon
        ↓
Tax
        ↓
Delivery
        ↓
Final Total
```

The exact order of calculations must be defined in the business workflow/database specification.

---

# 55. ORDER SERVICE

Order service owns:

* Order creation
* Order state
* Order snapshots
* Seller order splits
* Order history
* Cancellation
* Return relationship

Order state transitions must be deterministic.

---

# 56. MULTI-SELLER ORDER ARCHITECTURE

Conceptual model:

```text
Customer Order
│
├── Seller Order A
│   ├── Items
│   ├── Fulfillment
│   └── Delivery
│
└── Seller Order B
    ├── Items
    ├── Fulfillment
    └── Delivery
```

The customer can experience one checkout while operational systems can process seller-specific fulfillment.

---

# 57. PAYMENT ARCHITECTURE

Use a provider abstraction:

```text
Payment Service
      ↓
Payment Provider Interface
      ├── Provider A
      ├── Provider B
      └── Future Provider
```

Payment records should contain gateway references and state.

Never store raw payment credentials.

---

# 58. PAYMENT STATE MACHINE

Conceptually:

```text
INITIATED
↓
PENDING
↓
AUTHORIZED / SUCCESS
↓
CAPTURED / CONFIRMED
```

Failure/exception states:

```text
FAILED
CANCELLED
EXPIRED
REFUND_PENDING
REFUNDED
PARTIALLY_REFUNDED
```

Exact states depend on gateway and business requirements.

---

# 59. PAYMENT WEBHOOK FLOW

```text
Payment Provider
      ↓
Webhook
      ↓
Signature Verification
      ↓
Idempotency Check
      ↓
Payment Service
      ↓
Database Transaction
      ↓
Payment State Update
      ↓
Order State Update
      ↓
Outbox Event
```

---

# 60. COD ARCHITECTURE

COD should be represented as a dedicated business workflow.

```text
Checkout
 ↓
COD selected
 ↓
Secondary mobile
 ↓
OTP verification
 ↓
COD verification record
 ↓
Support queue
 ↓
Agent action
 ↓
Confirmation
 ↓
Order activation
```

COD status must be separate from generic payment status where necessary.

---

# 61. DELIVERY ARCHITECTURE

Delivery should be a separate domain within the backend.

Responsibilities:

* Serviceability
* Delivery pricing
* Assignment
* Rider state
* Pickup
* Delivery
* Tracking
* Proof
* Failure
* Return pickup

---

# 62. RIDER ASSIGNMENT

Assignment engine should consider:

* Distance
* Availability
* Workload
* Capacity
* Vehicle
* Service area
* ETA
* Performance
* Acceptance history

The initial implementation may use deterministic rules.

AI/ML can later optimize recommendations.

---

# 63. DELIVERY STATE

Delivery state should be distinct from order state.

Example:

```text
Order:
SELLER_ACCEPTED

Delivery:
NOT_ASSIGNED
```

Later:

```text
Order:
PICKED_UP

Delivery:
PICKED_UP
```

This avoids mixing unrelated state machines.

---

# 64. RETURN ARCHITECTURE

Returns should be their own domain.

Responsibilities:

* Eligibility
* Request
* Approval
* Rejection
* Pickup
* Inspection
* Replacement
* Refund initiation

Return state should not simply overwrite order state.

---

# 65. REFUND ARCHITECTURE

Refund service should connect:

```text
Return
 ↓
Refund Decision
 ↓
Refund Record
 ↓
Payment Provider
 ↓
Refund Confirmation
```

Refund records must be immutable in financial history.

Corrections use adjustment records.

---

# 66. FINANCE ARCHITECTURE

Finance should consume authoritative commerce events and records.

Conceptually:

```text
Orders
Payments
Delivery
Returns
Refunds
      ↓
Financial Ledger / Accounting Records
      ↓
Settlement Engine
      ↓
Seller Settlement
```

Exact accounting/ledger implementation must be specified separately before finance coding.

---

# 67. SETTLEMENT ENGINE

Settlement should calculate:

```text
Gross Sale
- Discounts
- Commission
- Taxes
- Delivery Charges
- Refunds
- Adjustments
= Seller Payable
```

The exact formula must be configurable and documented.

---

# 68. NOTIFICATION ARCHITECTURE

Notification service should abstract channels.

```text
Notification Service
 ├── In-App
 ├── Email
 ├── SMS
 └── WhatsApp/External Messaging
```

Business modules should generate notification intents/events rather than directly integrating every provider.

---

# 69. NOTIFICATION DELIVERY

```text
Business Event
 ↓
Notification Event
 ↓
Queue
 ↓
Notification Worker
 ↓
Provider
 ↓
Delivery Result
```

Retries should be safe and idempotent.

---

# 70. SUPPORT ARCHITECTURE

Support should operate over domain records.

A ticket may reference:

* Customer
* Seller
* Order
* Payment
* Delivery
* Return
* Refund

Support should not duplicate the entire business database.

It should reference authoritative records.

---

# 71. AUDIT ARCHITECTURE

Sensitive operations should generate audit records.

Examples:

```text
SELLER_APPROVED
SELLER_SUSPENDED
PRODUCT_APPROVED
PRODUCT_SUSPENDED
PRICE_OVERRIDE
REFUND_APPROVED
SETTLEMENT_ADJUSTED
PERMISSION_CHANGED
ADMIN_ACTION
```

Audit events should be structured.

---

# 72. AI ARCHITECTURE

AI is a platform capability.

Conceptually:

```text
Application
   ↓
Backend
   ↓
AI Gateway
   ↓
AI Orchestrator
   ├── LLM
   ├── ML
   ├── Recommendation
   ├── Search Intelligence
   ├── Risk
   ├── RAG
   └── Evaluation
```

AI must not directly bypass business services.

---

# 73. AI GATEWAY

AI Gateway should provide:

* Provider abstraction
* Authentication
* Rate limits
* Usage tracking
* Cost tracking
* Model selection
* Request validation
* Structured output handling
* Safety controls
* Observability

---

# 74. AI ORCHESTRATOR

The orchestrator decides:

* Which AI capability
* Which model/provider
* Which tools/data
* Whether retrieval is required
* Whether human review is required
* What confidence threshold applies

---

# 75. AI TOOL ACCESS

AI tools should be explicitly defined.

Examples:

```text
searchProducts
getProductDetails
getOrderStatus
getSellerPolicy
getReturnPolicy
getCustomerOrderHistory
getSellerPerformance
```

Each tool must have:

* Permission rules
* Input validation
* Output schema
* Audit behavior
* Data minimization

AI must never receive unrestricted database access.

---

# 76. AI CRITICAL ACTION BOUNDARY

Never:

```text
LLM
 ↓
Direct Database Mutation
```

Correct:

```text
LLM
 ↓
Structured Recommendation
 ↓
Business Service
 ↓
Authorization
 ↓
Validation
 ↓
Transaction
 ↓
Database
```

---

# 77. RECOMMENDATION ARCHITECTURE

Recommendation engine may combine:

```text
Popularity
+
Content Similarity
+
Collaborative Signals
+
Context
+
Business Rules
+
Exploration
```

The architecture should allow future ML models.

---

# 78. ANALYTICS EVENT PIPELINE

Customer/application events:

```text
Frontend
 ↓
Analytics API/Event Collector
 ↓
Event Queue
 ↓
Processing
 ↓
Analytics Storage
 ↓
Analytics Web
```

Events may include:

* Search
* Impression
* Click
* Product view
* Add to cart
* Checkout
* Purchase
* Cancellation
* Return
* Review
* Recommendation interaction

---

# 79. ANALYTICS DATA PRINCIPLE

Operational database and analytics data should not be tightly coupled.

Analytics workloads must not degrade transactional order processing.

As scale grows, analytical workloads should move toward dedicated analytical storage where appropriate.

---

# 80. OBSERVABILITY ARCHITECTURE

All major backend requests should have:

```text
Request ID
Correlation ID
Structured Logs
Metrics
Errors
Latency
```

Distributed tracing should be introduced where it materially improves debugging.

---

# 81. HEALTH CHECKS

Backend should provide health checks for:

* Application
* Database
* Redis
* Queue
* Storage
* External providers where appropriate

Distinguish:

```text
Liveness
Readiness
Dependency Health
```

---

# 82. SECURITY ARCHITECTURE

Security layers:

```text
Internet
 ↓
TLS
 ↓
Edge/CDN/WAF where available
 ↓
Application
 ↓
Authentication
 ↓
Authorization
 ↓
Validation
 ↓
Business Rules
 ↓
Database
```

No single security layer should be considered sufficient.

---

# 83. RATE LIMITING

Rate limiting should exist at multiple levels where appropriate.

Examples:

* IP
* User
* Account
* API key
* Device/session
* Endpoint
* Action

Sensitive operations require stricter limits.

Examples:

* Login
* OTP
* Password reset
* Coupon application
* COD verification
* Payment attempts

---

# 84. ABUSE PREVENTION

The architecture should support detection/prevention of:

* OTP abuse
* Coupon abuse
* Fake accounts
* Excessive cancellations
* Payment abuse
* Automated scraping
* Account takeover
* Seller manipulation
* Review abuse

Rules may evolve into ML/risk systems later.

---

# 85. FILE SECURITY BOUNDARY

Sensitive documents:

```text
Client
 ↓
Authorized API
 ↓
Private Object Storage
```

Public product images:

```text
Client
 ↓
CDN
 ↓
Public/controlled Object Storage
```

Never expose private storage credentials to browsers.

---

# 86. SECRETS MANAGEMENT

Secrets must be supplied through secure environment/configuration systems.

Never commit:

* Database passwords
* API keys
* JWT secrets
* Payment credentials
* Storage credentials
* AI provider keys

to source control.

---

# 87. CONFIGURATION MANAGEMENT

Configuration should be divided into:

## Environment configuration

Examples:

* Database URL
* Redis URL
* Provider keys

## Business configuration

Examples:

* COD limits
* Return windows
* Commission rates

Business configuration should be stored/managed through controlled mechanisms where dynamic updates are required.

---

# 88. FEATURE FLAG ARCHITECTURE

Feature flags may control:

* Experimental features
* Rollouts
* AI features
* Region availability
* Emergency disable

Flags should not replace proper authorization.

---

# 89. FRONTEND API CLIENT

Each frontend should use a standardized API client.

Example responsibilities:

* Base URL
* Authentication
* Request handling
* Response parsing
* Error normalization
* Retry rules
* Request IDs
* Type safety

Do not duplicate API logic across every component.

---

# 90. FRONTEND STATE

Separate:

## Server state

Examples:

* Products
* Orders
* Seller data
* Inventory

## Client/UI state

Examples:

* Modal open
* Filter drawer
* Selected tab
* Temporary form state

Do not store authoritative server data unnecessarily as permanent client state.

---

# 91. FRONTEND SECURITY

Frontend must assume all client-side values can be manipulated.

Never trust:

```text
price
role
permission
order total
discount
seller ID
product status
payment status
```

All must be verified by backend.

---

# 92. CUSTOMER PERFORMANCE

Customer Web should prioritize:

* Fast initial rendering
* Image optimization
* CDN
* Efficient API calls
* Pagination
* Lazy loading
* Prefetching where beneficial
* Cache/revalidation
* Minimal JavaScript where possible

Exact rendering strategy must be selected based on current framework capabilities.

---

# 93. INTERNAL APPLICATION PERFORMANCE

Internal applications should prioritize:

* Fast data tables
* Efficient filtering
* Bulk actions
* Server-side pagination
* Search
* Keyboard workflows where appropriate

Avoid downloading thousands of records to the browser.

---

# 94. DESIGN SYSTEM

A shared design language should exist across applications.

Shared concepts:

* Typography
* Spacing
* Form controls
* Buttons
* Status badges
* Tables
* Drawers
* Dialogs
* Notifications
* Empty states
* Loading states
* Error states

Shared UI packages may be versioned independently.

---

# 95. APPLICATION THEMES

Each application may have a different operational personality while remaining part of the Bilokat ecosystem.

Customer:

```text
Shopping / Discovery
```

Seller:

```text
Business Operations
```

Support:

```text
CRM / Case Management
```

Control:

```text
Command Center
```

Finance:

```text
Financial Operations
```

Delivery:

```text
Field Operations
```

Analytics:

```text
Intelligence
```

---

# 96. DEPLOYMENT ARCHITECTURE

Each frontend should be independently deployable.

Conceptually:

```text
customer-web       → Deployment A
seller-web         → Deployment B
support-web        → Deployment C
control-web        → Deployment D
...
bilokat-api        → Backend Deployment
```

Backend infrastructure may be scaled independently from frontend applications.

---

# 97. ENVIRONMENTS

Minimum:

```text
development
staging
production
```

Each environment must have isolated:

* Configuration
* Secrets
* Database
* Storage where appropriate
* Redis
* External integrations where possible

---

# 98. CI/CD

Each repository should eventually have:

```text
Commit
 ↓
Lint
 ↓
Type Check
 ↓
Unit Tests
 ↓
Build
 ↓
Integration Tests
 ↓
Security Checks
 ↓
Deploy Staging
 ↓
E2E
 ↓
Production Approval
 ↓
Production Deploy
```

Exact pipeline can evolve.

---

# 99. DATABASE MIGRATIONS

Database migrations must be:

* Version controlled
* Reviewable
* Reproducible
* Tested
* Rollout-safe

Never manually change production schema without a controlled migration process.

---

# 100. BACKUP ARCHITECTURE

Database backups must support:

* Automated backups
* Retention policy
* Recovery testing
* Disaster recovery

Critical backup restoration must be periodically tested.

---

# 101. DISASTER RECOVERY

The architecture should eventually define:

* RPO
* RTO
* Backup strategy
* Failover
* Recovery procedure
* Incident ownership

Exact values should be decided based on business scale and cost.

---

# 102. FAILURE ISOLATION

AI failure should not stop commerce.

Search failure should not corrupt catalog.

Notification failure should not cancel orders.

Analytics failure should not stop checkout.

Delivery integration failure should not corrupt payment state.

External providers must be isolated behind adapters and resilient workflows.

---

# 103. RETRY PRINCIPLE

Retries must only be used when safe.

Do not blindly retry:

* Payment creation
* Order creation
* Refund
* Settlement

without idempotency.

---

# 104. TIMEOUT PRINCIPLE

External calls must have explicit timeouts.

Never allow an external dependency to hold a request indefinitely.

---

# 105. CIRCUIT BREAKER / RESILIENCE

For important external dependencies, the architecture may introduce:

* Timeout
* Retry
* Backoff
* Circuit breaker
* Fallback

only where appropriate.

---

# 106. CORRELATION ID

A request should be traceable across:

```text
Frontend
 ↓
API
 ↓
Database
 ↓
Queue
 ↓
Worker
 ↓
External Provider
```

where technically feasible.

---

# 107. DATA RETENTION

Each data category should eventually have a defined:

* Retention period
* Access policy
* Archival strategy
* Deletion policy

Do not keep sensitive data forever without a justified reason.

---

# 108. API DOCUMENTATION

The backend should produce maintainable API documentation.

Documentation must remain synchronized with actual implementation.

The API contract document is not proof of implementation.

---

# 109. CONTRACT-FIRST PRINCIPLE

For shared APIs, the contract should be clearly defined before multiple applications depend on it.

Possible workflow:

```text
Business Requirement
 ↓
API Contract
 ↓
Backend Implementation
 ↓
Client Integration
 ↓
Contract Test
```

---

# 110. VERSIONING

Breaking API changes must use a controlled migration strategy.

Do not silently change:

* Field meanings
* Required parameters
* Response structures
* State values

without considering existing consumers.

---

# 111. OBSERVABILITY OF BUSINESS EVENTS

Technical monitoring alone is insufficient.

Track business health such as:

* Payment success rate
* Seller acceptance rate
* Order creation failures
* Delivery failure rate
* Return rate
* Refund failure rate
* COD rejection rate
* Search failure
* Recommendation performance

---

# 112. SECURITY MONITORING

Monitor suspicious:

* Login attempts
* OTP requests
* Permission changes
* Admin actions
* Seller suspension
* Refund operations
* Settlement adjustments
* API abuse

High-risk actions should generate alerts where appropriate.

---

# 113. ADMIN IMPERSONATION

If “login as seller/customer” is ever implemented:

It must have:

* Explicit permission
* Strong audit
* Visible impersonation state
* Session separation
* Limited duration
* No silent privilege escalation

Never secretly impersonate users.

---

# 114. DATA EXPORT

Authorized users may eventually require:

* Seller reports
* Finance reports
* Customer data exports where permitted
* Analytics exports

Large exports should use background jobs.

---

# 115. BULK OPERATIONS

Internal systems should support safe bulk operations.

Examples:

* Approve products
* Suspend listings
* Update categories
* Export reports

Bulk actions require:

* Permission
* Validation
* Progress tracking
* Failure reporting
* Audit

---

# 116. AUDITABILITY

Every high-impact business decision must be explainable after the fact.

The system should be able to answer:

```text
Who?
What?
When?
Why?
Against which resource?
What changed?
What was the previous state?
What was the result?
```

---

# 117. TESTING ARCHITECTURE

Testing should exist at:

```text
Unit
 ↓
Integration
 ↓
Contract
 ↓
E2E
 ↓
Security
 ↓
Performance
```

Critical workflows must have end-to-end coverage.

---

# 118. TEST ENVIRONMENT

Tests should use isolated:

* Database
* Redis
* Storage
* External provider mocks/sandboxes

Production credentials must never be used in automated tests.

---

# 119. SECURITY TESTING

Security testing should specifically cover:

* IDOR/BOLA
* Broken access control
* Privilege escalation
* Authentication bypass
* Session issues
* Injection
* XSS
* CSRF where applicable
* File upload
* Rate limiting
* Webhook verification
* Business logic abuse

---

# 120. PERFORMANCE TESTING

Critical endpoints should eventually be load tested.

Focus on:

* Product listing
* Search
* Product details
* Cart
* Checkout
* Order creation
* Payment webhook
* Seller order dashboard

---

# 121. SCALABILITY STRATEGY

Initial architecture should remain simple enough to operate.

When scale increases:

```text
Modular Backend
      ↓
Identify Bottleneck
      ↓
Extract Specific Capability
      ↓
Independent Worker/Service
      ↓
Scale Independently
```

Do not create microservices solely for appearance.

---

# 122. FUTURE SERVICE EXTRACTION

Potential future extraction candidates:

* Search
* Notifications
* AI
* Recommendation
* Analytics
* Delivery optimization
* Media processing
* Finance processing

Extraction should happen when:

* Scale requires it
* Team ownership requires it
* Failure isolation requires it
* Independent deployment provides meaningful value

---

# 123. MICROSERVICE RULE

A service should only be separated when it has:

* Clear domain boundary
* Clear data ownership
* Clear API/event contract
* Independent scaling need
* Independent deployment need
* Operational justification

Otherwise, keep it modular inside the central backend.

---

# 124. DATA OWNERSHIP RULE

Each important entity must have a clearly defined owner.

Examples:

```text
Seller → Seller Domain
Product → Catalog Domain
Listing → Listing Domain
Order → Order Domain
Payment → Payment Domain
Delivery → Delivery Domain
Refund → Refund/Finance Domain
Settlement → Finance Domain
```

Other modules reference these entities rather than creating competing copies.

---

# 125. SOURCE OF TRUTH MATRIX

| Domain          | Authoritative Source                    |
| --------------- | --------------------------------------- |
| User            | PostgreSQL / User Domain                |
| Seller          | PostgreSQL / Seller Domain              |
| Product         | PostgreSQL / Catalog Domain             |
| Listing         | PostgreSQL / Listing Domain             |
| Inventory       | PostgreSQL / Inventory Domain           |
| Cart            | PostgreSQL/appropriate session store    |
| Order           | PostgreSQL / Order Domain               |
| Payment         | Payment records + provider verification |
| Delivery        | PostgreSQL / Delivery Domain            |
| Return          | PostgreSQL / Return Domain              |
| Refund          | PostgreSQL / Refund/Finance             |
| Settlement      | PostgreSQL / Finance                    |
| Search          | Derived index                           |
| Analytics       | Analytical storage                      |
| Recommendations | Derived/ML systems                      |
| Cache           | Redis, never authoritative              |

---

# 126. INTER-APPLICATION COMMUNICATION

Applications communicate with:

```text
HTTPS APIs
+
Authentication
+
Authorization
```

They should not:

* Share databases directly
* Read each other's tables
* Import each other's application code
* Bypass backend security

---

# 127. BACKEND INTERNAL COMMUNICATION

Within the modular backend:

Prefer:

```text
Direct module service calls
+
Domain events
+
Background jobs
```

Avoid unnecessary HTTP calls between modules inside the same backend.

---

# 128. EXTERNAL INTEGRATIONS

External providers must be wrapped behind adapters.

Examples:

```text
PaymentProvider
StorageProvider
EmailProvider
SMSProvider
MessagingProvider
MapsProvider
SearchProvider
AIProvider
```

This makes providers replaceable.

---

# 129. PROVIDER FAILOVER

Where business requirements justify it, providers may support fallback.

Example:

```text
Primary Payment Provider
        ↓
Failure
        ↓
Secondary Provider
```

Failover must not cause duplicate financial transactions.

---

# 130. AI PROVIDER ABSTRACTION

AI should not be hardcoded directly into business modules.

Use:

```text
AI Capability
 ↓
AI Gateway
 ↓
Provider Adapter
 ↓
Model
```

This permits future model/provider changes.

---

# 131. AI COST CONTROL

AI architecture must support:

* Token/usage tracking
* Request limits
* Model selection
* Caching where safe
* Smaller models for simple tasks
* Larger models only when needed
* Budget monitoring

AI must not accidentally become an uncontrolled cost center.

---

# 132. AI LATENCY CONTROL

Customer-facing AI must have latency-aware architecture.

Potential techniques:

* Streaming where appropriate
* Caching
* Retrieval optimization
* Model routing
* Async processing for non-immediate tasks

Core shopping workflows should not become dependent on slow AI.

---

# 133. AI SECURITY

Protect against:

* Prompt injection
* Tool abuse
* Data leakage
* Unauthorized retrieval
* Cross-user context leakage
* Sensitive data exposure
* Malicious uploaded content
* Model output misuse

AI tools must enforce authorization independently.

---

# 134. AI DATA ISOLATION

A customer must never receive another customer's:

* Orders
* Personal information
* Support conversations
* Recommendations based on private data

Similarly, sellers must never receive another seller's confidential data.

---

# 135. AI EVALUATION

AI features require measurable quality.

Metrics may include:

* Accuracy
* Precision/recall
* Acceptance rate
* Human override
* Conversion impact
* Resolution rate
* Hallucination rate
* Latency
* Cost

---

# 136. SEARCH + AI BOUNDARY

Traditional search remains available.

AI enhances search.

Correct:

```text
Query
 ↓
Search Understanding
 ↓
Search Engine
 ↓
Ranking
```

Not:

```text
Query
 ↓
LLM invents products
```

Products must come from authoritative catalog/search data.

---

# 137. RECOMMENDATION SAFETY

Recommendations must obey:

* Product visibility
* Seller status
* Inventory
* Serviceability
* Policy restrictions
* Customer eligibility

AI cannot recommend an unavailable/suspended product simply because a model likes it.

---

# 138. BUSINESS RULE ENGINE

Where business rules become complex, avoid scattering conditions throughout controllers.

Examples:

* Coupon eligibility
* Return eligibility
* COD eligibility
* Delivery pricing
* Seller eligibility

Centralize these rules into testable domain/application services.

---

# 139. STATE MACHINE PRINCIPLE

Important lifecycle states must have controlled transitions.

Do not allow:

```text
Delivered
→ Seller Accepted
```

unless an explicitly authorized correction workflow exists.

State transition logic must be backend-enforced.

---

# 140. TIME-BASED RULES

Time-dependent rules should use server-authoritative timestamps.

Examples:

* Coupon expiry
* Return window
* COD verification timeout
* Payment expiration
* Settlement schedule

Do not trust browser time.

---

# 141. MONEY HANDLING

Monetary values must not rely on floating-point arithmetic.

Use an appropriate precise representation.

Prefer:

* Integer minor units where appropriate
* Decimal types where required
* Explicit currency

Every financial amount should have clear semantics.

---

# 142. CURRENCY

Even if initially operating in one currency, monetary models should not make future currency support impossible.

Store:

* Amount
* Currency
* Precision/representation appropriate to currency

---

# 143. TIMEZONE

Backend timestamps should use a consistent authoritative standard, preferably UTC for storage.

Presentation may use localized timezone.

Business rules must explicitly define timezone where necessary.

---

# 144. IDENTIFIERS

Identifiers should be:

* Unique
* Non-predictable where public exposure creates risk
* Stable
* Appropriate for distributed systems

Internal database IDs and public identifiers may be different when justified.

---

# 145. PUBLIC RESOURCE ACCESS

Never expose sequential internal IDs unnecessarily when doing so creates enumeration risk.

Public APIs should verify resource ownership and authorization regardless of identifier format.

---

# 146. LOGGING

Logs should be structured.

Do NOT log:

* Passwords
* OTP values
* Payment credentials
* Secret keys
* Full sensitive documents
* Unnecessary personal information

Logs must respect privacy.

---

# 147. ERROR CODES

Business errors should have stable machine-readable codes.

Example:

```text
SELLER_NOT_ACTIVE
PRODUCT_NOT_PUBLISHED
INSUFFICIENT_STOCK
COUPON_EXPIRED
PAYMENT_VERIFICATION_FAILED
COD_VERIFICATION_REQUIRED
RETURN_WINDOW_EXPIRED
FORBIDDEN
```

Frontend should not depend on parsing human-readable messages.

---

# 148. NOTIFICATION TEMPLATES

Templates should be versionable.

Example:

```text
ORDER_CONFIRMED_V1
ORDER_SHIPPED_V1
COD_PENDING_V1
REFUND_COMPLETED_V1
```

Changing wording should not silently alter historical audit meaning.

---

# 149. LOCALIZATION ARCHITECTURE

User-facing text should be externalizable.

Avoid scattering large hardcoded strings across components.

Business error codes remain language-neutral.

---

# 150. FEATURE DEPENDENCY

Features should declare dependencies.

Example:

```text
Product Publishing
requires:
- Seller approved
- Category exists
- Attribute schema exists
- Product validation
- Media processing
```

A feature must not silently assume unavailable dependencies.

---

# 151. IMPLEMENTATION ORDER

After architecture approval:

```text
Phase 1
Backend Foundation

Phase 2
Identity + Seller

Phase 3
Catalog + Publishing

Phase 4
Customer Commerce

Phase 5
Checkout + Payment + COD

Phase 6
Delivery + Fulfillment

Phase 7
Returns + Support

Phase 8
Control Panel

Phase 9
Finance + Settlement

Phase 10
AI Intelligence

Phase 11
Analytics

Phase 12
Security + Production Hardening
```

---

# 152. PHASE GATE

A phase cannot be considered complete merely because its source code exists.

Required:

```text
Implementation
+
Integration
+
Testing
+
Security Review
+
Workflow Verification
+
Documentation
```

Only then:

```text
PHASE = VERIFIED
```

---

# 153. SESSION HANDOFF

At the end of each development session, update:

```text
STATUS.md
FEATURES.md
CHANGELOG.md
HANDOFF.md
```

If architecture changes:

```text
DECISIONS.md
```

must also be updated.

---

# 154. DOCUMENTATION TRUST RULE

Documentation is context.

Actual implementation is truth.

Before changing a feature, the AI agent must inspect:

* Source code
* Database
* API
* Tests
* Configuration
* Runtime behavior where possible

Do not assume documentation is correct merely because it says “complete”.

---

# 155. ARCHITECTURE REVIEW CHECKLIST

Before implementation begins, verify:

* [ ] Application boundaries defined
* [ ] Backend modules defined
* [ ] Data ownership defined
* [ ] Database strategy defined
* [ ] API strategy defined
* [ ] Auth defined
* [ ] Authorization defined
* [ ] Events defined
* [ ] Queues defined
* [ ] Cache defined
* [ ] Storage defined
* [ ] Search defined
* [ ] Payment boundary defined
* [ ] Delivery boundary defined
* [ ] Finance boundary defined
* [ ] AI boundary defined
* [ ] Security boundary defined
* [ ] Testing strategy defined
* [ ] Deployment strategy defined
* [ ] Observability defined
* [ ] Failure isolation defined

---

# 156. ARCHITECTURE DECISION PRINCIPLES

When choosing between technologies or patterns:

Prefer the solution that provides the best balance of:

```text
Security
+
Correctness
+
Maintainability
+
Performance
+
Operational simplicity
+
Scalability
+
Ecosystem maturity
```

Do not select technology solely because:

* It is fashionable
* It is popular on social media
* An AI model prefers it
* It produces less code

---

# 157. TECHNOLOGY SELECTION RULE

Technology versions must be verified at implementation time.

Do not blindly use outdated examples from this document.

Before installing dependencies, verify:

* Current stable version
* Runtime compatibility
* Security advisories
* Maintenance status
* Compatibility with project stack
* Licensing
* Production maturity

---

# 158. ARCHITECTURE EVOLUTION

This architecture is intentionally designed to evolve.

Initial:

```text
Independent Frontends
        ↓
Modular Central Backend
        ↓
PostgreSQL + Redis + Object Storage
        ↓
Events + Workers
```

Future, if required:

```text
Independent Frontends
        ↓
API Gateway / Edge
        ↓
Domain Services
        ↓
Specialized Infrastructure
```

Service extraction must be driven by real requirements.

---

# 159. NON-NEGOTIABLE ARCHITECTURAL RULES

The following must not be violated without a documented architecture decision:

1. No monorepo.
2. No frontend direct database access.
3. No hardcoded production catalog.
4. No frontend authority over critical business state.
5. No plaintext passwords.
6. No raw payment credentials.
7. No unrestricted AI database access.
8. No AI direct mutation of critical business state.
9. No bypassing backend authorization.
10. No silent critical state changes.
11. No unaudited high-risk administrative actions.
12. No unversioned breaking API changes.
13. No undocumented architecture changes.
14. No marking incomplete features as complete.
15. No unnecessary rewrites of working systems.

---

# 160. FINAL ARCHITECTURE

The intended high-level Bilokat architecture is:

```text
                         INTERNET
                            │
                            ▼
                    CDN / EDGE / WAF
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
          ▼                 ▼                  ▼
   CUSTOMER WEB        SELLER WEB       INTERNAL APPS
                                          │
                      ┌───────────────────┼──────────────────┐
                      │                   │                  │
                      ▼                   ▼                  ▼
               SUPPORT WEB         CONTROL WEB        FINANCE WEB
                      │                   │                  │
                      └───────────────────┼──────────────────┘
                                          │
                                          ▼
                                  ┌───────────────┐
                                  │  BILOKAT API  │
                                  │               │
                                  │ Auth          │
                                  │ Users         │
                                  │ Sellers       │
                                  │ Catalog       │
                                  │ Products      │
                                  │ Listings      │
                                  │ Inventory     │
                                  │ Cart          │
                                  │ Checkout      │
                                  │ Orders        │
                                  │ Payments      │
                                  │ Delivery      │
                                  │ Returns       │
                                  │ Refunds       │
                                  │ Support       │
                                  │ Finance       │
                                  │ Notifications │
                                  │ AI            │
                                  │ Audit         │
                                  └───────┬───────┘
                                          │
                 ┌────────────────────────┼────────────────────────┐
                 │                        │                        │
                 ▼                        ▼                        ▼
             PostgreSQL                 Redis                Object Storage
          Source of Truth       Cache/Queue/Temp State        Media/Files
                 │                        │
                 │                        ▼
                 │                  Background Workers
                 │                        │
                 ▼                        ▼
            Outbox/Event ─────────► Event Processing
                 │                        │
        ┌────────┼─────────┬──────────────┼──────────────┐
        │        │         │              │              │
        ▼        ▼         ▼              ▼              ▼
     Search   Analytics Notifications    AI          Integrations
                │
                ▼
          Analytics Storage
```

---

# 161. ARCHITECTURE STATUS

```text
Application Architecture       = DEFINED
Backend Architecture           = DEFINED
Database Architecture          = DEFINED
API Architecture               = DEFINED
Authentication Architecture    = DEFINED
Authorization Architecture     = DEFINED
Event Architecture             = DEFINED
Queue Architecture             = DEFINED
Cache Architecture             = DEFINED
Storage Architecture           = DEFINED
Search Architecture            = DEFINED
Payment Boundary               = DEFINED
Delivery Boundary              = DEFINED
Finance Boundary               = DEFINED
AI Architecture Boundary       = DEFINED
Security Boundary              = DEFINED
Testing Architecture           = DEFINED
Deployment Principles          = DEFINED

Actual Implementation          = NOT STARTED
```

---

# 162. NEXT DOCUMENT

The next architecture document should be:

```text
02-BUSINESS-WORKFLOWS.md
```

It must convert the platform architecture into detailed business state machines and workflows.

It must define, at minimum:

* Customer lifecycle
* Seller lifecycle
* KYC lifecycle
* Product lifecycle
* Listing lifecycle
* Inventory lifecycle
* Cart lifecycle
* Checkout lifecycle
* Payment lifecycle
* COD lifecycle
* Order lifecycle
* Seller fulfillment lifecycle
* Delivery lifecycle
* Return lifecycle
* Refund lifecycle
* Support lifecycle
* Settlement lifecycle
* Notification lifecycle
* AI workflow boundaries
* Failure/exception workflows
* Cancellation workflows
* Escalation workflows

No implementation should begin until these workflows are sufficiently defined.

````

**Save location:**

```text
BILOKAT/
└── PROJECT-DOCS/
    ├── 00-MASTER-SPEC.md
    └── 01-ARCHITECTURE.md   ← ye content
````

