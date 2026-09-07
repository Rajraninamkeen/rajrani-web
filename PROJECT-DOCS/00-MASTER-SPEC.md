Bilkul. Ye **`00-MASTER-SPEC.md` ka complete content** hai. Isko exactly copy karke `PROJECT-DOCS/00-MASTER-SPEC.md` mein paste kar do.

````markdown
# BILOKAT — MASTER SPECIFICATION

> Document Type: Master Project Constitution
> Project: Bilokat
> Version: 1.0.0
> Status: Architecture Foundation
> Implementation Status: Not Started
> Last Updated: 2026-09-07

---

# 1. DOCUMENT PURPOSE

This document is the permanent master specification and architectural constitution of the Bilokat platform.

It defines:

- What Bilokat is
- What business problem it solves
- How the marketplace operates
- Application boundaries
- Core business rules
- User types
- Seller lifecycle
- Product lifecycle
- Catalog lifecycle
- Customer lifecycle
- Cart and checkout behavior
- Payment behavior
- COD verification
- Order lifecycle
- Delivery lifecycle
- Return/refund lifecycle
- Finance and settlement principles
- Support workflows
- Control Panel authority
- AI principles
- Security principles
- Data principles
- Scalability principles
- Development principles
- Testing principles
- Production-readiness requirements

This document must be treated as the highest-level project specification.

Any future implementation must remain compatible with this specification unless an architectural decision is explicitly recorded and approved.

---

# 2. PROJECT VISION

Bilokat is a modern, scalable, secure, multi-seller marketplace platform.

The platform must be capable of supporting:

- Multiple sellers
- Multiple product categories
- Dynamic catalogs
- Dynamic product attributes
- Multiple sellers offering similar products
- Seller-specific listings and pricing
- Customer shopping
- Search and discovery
- Cart
- Checkout
- Online payments
- Cash on Delivery
- Delivery partner operations
- Returns
- Refunds
- Customer support
- Seller support
- Finance and settlements
- Platform administration
- Analytics
- AI-powered intelligence

Bilokat must not be designed as a single-store e-commerce website.

It must be designed as a marketplace platform from the beginning.

The architecture must allow future categories, sellers, warehouses, cities, delivery zones, business models, and services without requiring fundamental architectural rewrites.

---

# 3. CORE PRINCIPLES

The following principles are mandatory.

## 3.1 Production First

Every feature must be designed as if it will eventually operate in production.

No feature should be considered complete merely because:

- The UI exists
- An API returns data
- A database table exists
- A happy-path demo works

A feature is complete only when it is:

1. Implemented
2. Integrated
3. Validated
4. Tested
5. Secure
6. Observable
7. Error-handled
8. Edge-case handled
9. Performance considered
10. Production verified

---

# 4. NO FAKE IMPLEMENTATION

The system must not use fake production behavior.

Do not use:

- Hardcoded products
- Hardcoded sellers
- Hardcoded categories
- Hardcoded prices
- Hardcoded orders
- Hardcoded payment success
- Fake delivery status
- Fake stock
- Fake coupons
- Fake customer data
- Fake seller data
- Static dashboard numbers presented as real data

Mock data may only exist in:

- Unit tests
- Integration tests
- Automated test fixtures
- Local development seed data

Mock/test data must never silently become production behavior.

---

# 5. NO MONOREPO

Bilokat must NOT be implemented as a monorepo.

Applications should remain independently deployable.

The architecture should support:

- Independent repositories
- Independent deployments
- Independent CI/CD
- Independent scaling
- Shared versioned packages where useful

Shared packages may be distributed through an appropriate private package/registry mechanism.

Potential shared packages include:

- `@bilokat/types`
- `@bilokat/api-client`
- `@bilokat/ui`
- `@bilokat/auth`
- `@bilokat/config`
- `@bilokat/validation`

Shared packages must not create tight application coupling.

---

# 6. HIGH-LEVEL SYSTEM ARCHITECTURE

Bilokat consists of:

## Customer Platform

Customer-facing shopping experience.

## Seller Platform

Seller business management experience.

## Catalog Publishing Platform

Product review, moderation, catalog governance and publishing.

## Support Platform

Customer and seller support operations.

## Delivery Platform

Delivery partner operational workflow.

## Finance Platform

Settlement, reconciliation, financial reporting.

## Control Platform

High-authority platform governance and operational control.

## Analytics Platform

Business, customer, seller, product, logistics and operational intelligence.

## Central Backend

The primary source of business logic and data APIs.

## Intelligence Layer

AI/ML-powered platform intelligence.

---

# 7. APPLICATIONS

The architecture should support the following independent applications.

## 7.1 customer-web

Responsibilities:

- Homepage
- Search
- Category browsing
- Product discovery
- Product detail
- Cart
- Checkout
- Payments
- Orders
- Tracking
- Returns
- Refund status
- Wishlist
- Customer account
- Addresses
- Notifications
- Coupons
- Reviews
- AI shopping features

---

## 7.2 seller-web

Responsibilities:

- Seller dashboard
- Seller onboarding status
- Products
- Listings
- Inventory
- Orders
- Packaging
- Pickup requests
- Returns
- Delivery
- Payments
- Settlements
- Reports
- Support tickets
- Business profile

---

## 7.3 catalog-publishing-web

Responsibilities:

- Product review
- Catalog review
- Attribute validation
- Image/content quality
- Duplicate detection
- Compliance checks
- Product approval
- Correction requests
- Rejection
- Publication
- Suspension
- Catalog governance

---

## 7.4 support-web

Responsibilities:

- Customer support
- Seller support
- Ticket management
- Conversations
- COD verification
- Escalations
- Refund/return assistance
- SLA management
- Internal notes
- Support actions

---

## 7.5 delivery-web

Responsibilities:

- Delivery partner workflow
- Pickup requests
- Rider assignment
- Pickup
- Delivery
- Navigation integration
- Delivery verification
- Proof of delivery
- Failed delivery
- Return pickup

The interface should be mobile-first and PWA-compatible where appropriate.

---

## 7.6 finance-web

Responsibilities:

- Transactions
- Revenue
- Commission
- Taxes
- Delivery charges
- Refunds
- Seller payable
- Settlements
- Reconciliation
- Financial reports

---

## 7.7 control-web

Responsibilities:

- Seller governance
- Product governance
- Listing control
- Pricing control
- Communication
- Platform configuration
- Permissions
- Emergency controls
- Operational overrides
- Audit
- Governance

This is a high-authority internal application.

---

## 7.8 analytics-web

Responsibilities:

- Business analytics
- Customer analytics
- Seller analytics
- Product analytics
- Sales analytics
- Conversion
- Retention
- Inventory intelligence
- Delivery intelligence
- Finance intelligence
- AI-generated insights

---

# 8. CENTRAL BACKEND

The central backend is the authoritative business layer.

Potential responsibilities:

- Authentication
- Authorization
- Users
- Organizations
- Sellers
- KYC
- Catalog
- Categories
- Attributes
- Products
- Listings
- Inventory
- Warehouses
- Orders
- Payments
- Coupons
- Delivery
- Returns
- Refunds
- Settlements
- Notifications
- Support
- Reviews
- Analytics events
- AI orchestration
- Audit logs
- Storage
- Event processing

The frontend must never become the authority for critical business decisions.

---

# 9. SOURCE OF TRUTH

For critical business data:

Backend/database is authoritative.

Frontend state is not authoritative.

Examples:

- Price → Backend
- Stock → Backend
- Coupon validity → Backend
- Payment status → Backend/payment verification
- Order status → Backend
- Seller approval → Backend
- Product approval → Backend
- Delivery status → Backend
- Refund status → Backend
- Settlement status → Backend

Frontend may display calculated information, but critical calculations must be validated server-side.

---

# 10. USER TYPES

The system should support multiple identities and roles.

Potential actors:

- Customer
- Seller owner
- Seller manager
- Seller staff
- Catalog reviewer
- Support agent
- COD verification agent
- Delivery partner
- Finance operator
- Finance manager
- Control administrator
- Platform administrator
- Security administrator
- Analytics user
- System/service account

Roles must not be implemented as simple frontend-only flags.

Authorization must be enforced by backend services.

---

# 11. AUTHENTICATION PRINCIPLES

Authentication must support appropriate modern mechanisms.

Potential methods:

- Email
- Mobile number
- OTP
- Password where required
- OAuth/social login where appropriate
- Session/token based authentication

Security requirements:

- Secure session handling
- Token rotation where applicable
- Expiration
- Revocation
- Device/session management
- Rate limiting
- Brute-force protection
- OTP abuse protection
- Secure password hashing
- Secure recovery flow
- Audit logging

Never store plaintext passwords.

Never expose secrets to frontend code.

---

# 12. AUTHORIZATION

Authorization must be centralized and backend-enforced.

Use a combination of:

- RBAC
- ABAC where necessary
- Resource ownership
- Organization boundaries
- Scope restrictions
- Action-level permissions

Examples:

A seller should only access:

- Their organization
- Their products
- Their orders
- Their inventory
- Their settlements

A support agent should not automatically gain control-admin privileges.

A finance user should not automatically gain seller suspension authority.

A delivery partner should only access assigned/eligible delivery data.

---

# 13. SELLER PRINCIPLE

Seller registration does NOT mean seller approval.

Seller lifecycle:

```text
REGISTERED
↓
PROFILE_INCOMPLETE
↓
APPLICATION_SUBMITTED
↓
AUTOMATIC_VALIDATION
↓
UNDER_REVIEW
↓
CORRECTION_REQUIRED
↓
RESUBMITTED
↓
APPROVED
↓
ACTIVE
````

Possible terminal/exception states:

```text
REJECTED
SUSPENDED
DEACTIVATED
BLOCKED
```

Only an approved and active seller may perform normal marketplace operations.

---

# 14. SELLER ONBOARDING

Seller onboarding may collect:

* Basic information
* Owner/authorized person
* Business details
* Address
* Contact information
* Tax information
* KYC information
* Bank/settlement information
* Required documents
* Business category
* Operational details

Automatic verification may assist with:

* Document extraction
* OCR
* Data consistency
* Duplicate detection
* Validation
* Risk signals

AI must not become the sole authority for legally sensitive verification.

Authoritative verification should come from appropriate official/authorized mechanisms where available.

---

# 15. SELLER REVIEW

Authorized reviewers must be able to see a consolidated seller profile.

Review information may include:

* Seller identity
* Business details
* Documents
* Verification results
* Risk flags
* Submission history
* Correction history
* Review history
* Previous decisions

Reviewer actions:

* Approve
* Reject
* Request correction
* Request additional information
* Suspend if authorized

Every decision must be auditable.

---

# 16. SELLER COMMUNICATION

Seller-facing operational communication should support:

* Email
* In-platform notifications
* Appropriate messaging integrations

Messages should support templates.

Authorized operators may customize messages when necessary.

Every sensitive communication should have:

* Actor
* Timestamp
* Recipient
* Template/version
* Message
* Reason/context
* Delivery status

---

# 17. CATALOG PRINCIPLE

Catalog must be independent from seller-specific offers.

Conceptually:

```text
Catalog Product
      ↓
Seller Listing
      ↓
Inventory
```

A catalog product describes the product itself.

A seller listing describes:

* Seller
* Seller price
* Seller stock relationship
* Seller fulfillment
* Seller-specific offer
* Seller-specific conditions

---

# 18. DYNAMIC CATEGORY SYSTEM

Categories must not be hardcoded into frontend code.

Architecture:

```text
Category
↓
Subcategory
↓
Attribute Schema
↓
Product Form
↓
Product Data
↓
Customer Filters
↓
Product Detail
```

Example:

Electronics may have:

* Brand
* Model
* RAM
* Storage
* Processor
* Screen size

Food may have:

* Ingredients
* Weight
* Shelf life
* Dietary information
* Manufacturing date
* Expiry date

Future categories must be addable without rebuilding the entire frontend architecture.

---

# 19. PRODUCT LIFECYCLE

Product lifecycle should support:

```text
DRAFT
↓
SUBMITTED
↓
VALIDATING
↓
UNDER_REVIEW
↓
CORRECTION_REQUIRED
↓
RESUBMITTED
↓
APPROVED
↓
PUBLISH_READY
↓
PUBLISHED
↓
ACTIVE
```

Exception states:

```text
REJECTED
SUSPENDED
UNPUBLISHED
ARCHIVED
```

Approval and publication are separate concepts.

---

# 20. PRODUCT VISIBILITY

A product must NOT automatically become visible simply because it exists in the database.

Customer visibility should require all relevant conditions.

Conceptually:

```text
Seller = APPROVED + ACTIVE
AND
Product = APPROVED
AND
Publication = PUBLISHED
AND
Listing = ACTIVE
AND
Availability rules = PASS
```

Additional conditions may include:

* Inventory availability
* Serviceability
* Compliance
* Category restrictions
* Regional restrictions
* Seller restrictions
* Product suspension
* Marketplace policy

The exact visibility query must be centrally defined.

---

# 21. PRODUCT CONTENT

Products may contain:

* Title
* Description
* Images
* Videos
* Brand
* Category
* Attributes
* Variants
* Specifications
* Packaging information
* Weight
* Dimensions
* Compliance information
* Tax classification where applicable
* SEO metadata

All user-provided content must be validated and sanitized.

---

# 22. PRODUCT MEDIA

Media handling must support:

* Secure upload
* File type validation
* File size limits
* Malware/security scanning where appropriate
* Image optimization
* Multiple resolutions
* CDN delivery
* Metadata handling
* Access control for private files

Do not trust file extensions alone.

---

# 23. LISTING MODEL

Seller listing should contain seller-specific information.

Examples:

```text
Catalog Product
├── Seller A Listing
│   ├── Price
│   ├── Offer
│   └── Availability
│
├── Seller B Listing
│   ├── Price
│   ├── Offer
│   └── Availability
│
└── Seller C Listing
    ├── Price
    ├── Offer
    └── Availability
```

This enables true marketplace behavior.

---

# 24. INVENTORY PRINCIPLE

Inventory must be modeled separately from product and listing.

Inventory may include:

* Warehouse
* Available quantity
* Reserved quantity
* Incoming quantity
* Damaged quantity
* Returned quantity
* Batch
* Expiry
* Stock movement
* Stock adjustment
* Inventory history

Inventory changes must be auditable.

---

# 25. CUSTOMER DISCOVERY

Browsing should not require login.

Customer should be able to:

* Browse homepage
* Browse categories
* Search
* View products
* View sellers
* View offers
* Add to cart
* Buy now
* View product details

Login becomes mandatory at the appropriate checkout/account stage.

---

# 26. SEARCH

Search architecture should support:

* Keyword search
* Typo tolerance
* Filters
* Sorting
* Category filtering
* Brand filtering
* Price filtering
* Availability
* Seller filtering
* Attributes
* Location/serviceability

Future intelligent search may support semantic/natural-language queries.

Search indexing must remain synchronized with authoritative backend data.

---

# 27. HOMEPAGE

Homepage content must be dynamic.

Possible sections:

* Hero banners
* Categories
* Featured products
* Trending
* New arrivals
* Flash deals
* Offers
* Seller collections
* Recommendations
* Promotional sections

Sections should support:

* Ordering
* Enable/disable
* Scheduling
* Targeting
* Versioning where necessary

No production homepage should depend on hardcoded product IDs.

---

# 28. CART

Cart must support guest and authenticated customers.

Guest cart:

* Temporary session/cart identifier
* Persistence
* Expiration
* Merge after login

Authenticated cart:

* User-associated
* Persistent
* Server-authoritative

Cart must validate:

* Product availability
* Listing status
* Price
* Quantity limits
* Seller status
* Serviceability
* Coupon eligibility

before order creation.

---

# 29. BUY NOW

Buy Now should support a direct checkout path.

Conceptually:

```text
Product
↓
Buy Now
↓
Checkout
↓
Address
↓
Payment
↓
Order
```

It should not unnecessarily force the customer through the normal cart experience.

---

# 30. MULTI-SELLER CART

A single customer cart may contain products from multiple sellers.

Example:

```text
Customer Cart
│
├── Seller A
│   ├── Product 1
│   └── Product 2
│
└── Seller B
    └── Product 3
```

Checkout should calculate seller-level and overall totals.

The backend may create:

```text
Customer Order
├── Seller Order A
└── Seller Order B
```

The customer should still receive a simple unified shopping experience.

---

# 31. PRICING

Price calculation must be server-authoritative.

Potential components:

* MRP
* Selling price
* Seller discount
* Platform promotion
* Coupon
* Delivery charge
* Taxes
* Other applicable charges
* Final payable amount

Never trust frontend-submitted totals.

The backend must recalculate final totals.

---

# 32. COUPONS

Coupon validation must happen server-side.

Validation may include:

* Coupon existence
* Active status
* Start date
* Expiry date
* Minimum order value
* Maximum discount
* Applicable category
* Applicable product
* Applicable seller
* Customer eligibility
* Usage limit
* Per-customer limit
* Combination rules
* Geographic restrictions
* Payment-method restrictions

Coupon calculation must be deterministic and auditable.

---

# 33. CHECKOUT

Checkout should collect and validate:

* Customer identity
* Address
* Contact information
* Delivery information
* Order items
* Pricing
* Discounts
* Taxes
* Delivery charges
* Payment method

Before final order creation, backend must revalidate critical data.

---

# 34. ONLINE PAYMENT

Payment flow:

```text
Checkout
↓
Payment Intent / Order
↓
Payment Gateway
↓
Customer Payment
↓
Gateway Confirmation
↓
Secure Webhook / Verification
↓
Backend Verification
↓
Order Confirmation
```

Payment success shown by frontend alone must never be considered authoritative.

The backend must verify payment.

Never store raw card credentials.

---

# 35. PAYMENT WEBHOOK SECURITY

Webhook handling must include:

* Signature verification
* Idempotency
* Event validation
* Duplicate handling
* Replay protection where applicable
* Transaction reconciliation
* Audit logging

A payment event must not accidentally create duplicate orders.

---

# 36. COD

COD is a separate controlled workflow.

Required:

* Login/account
* Delivery address
* Primary mobile
* Secondary mobile
* Secondary mobile OTP verification

Workflow:

```text
COD Selected
↓
Login
↓
Address Validation
↓
Secondary Number
↓
OTP Verification
↓
COD Verification Queue
↓
Support/COD Team Review
↓
Customer Call
↓
Confirm / Reject / Hold / Follow-up
↓
Order Confirmation
```

COD should not automatically become fully confirmed without the required verification workflow.

---

# 37. COD VERIFICATION DATA

Authorized COD operators may see:

* Order ID
* Customer name
* Primary mobile
* Verified secondary mobile
* Address
* PIN/area
* Products
* Quantities
* Product value
* Delivery charges
* Discounts
* Coupon
* Final COD amount
* Account status
* Previous order history as permitted
* Cancellation history
* Return history
* COD history
* Verification status
* Assigned agent
* Call status
* Notes
* Decision
* Rejection/hold reason
* OTP verification status

Sensitive payment credentials must never be exposed.

---

# 38. ORDER PRINCIPLE

Order creation must be transactional and authoritative.

Order data should preserve a snapshot of critical commercial information.

This may include:

* Product identity
* Seller
* Listing
* Quantity
* Price
* Discount
* Tax
* Delivery charge
* Final amount
* Customer information required for fulfillment
* Address snapshot
* Payment reference
* Applicable policy version

Historical orders must remain understandable even if catalog data changes later.

---

# 39. ORDER STATE MACHINE

Primary lifecycle:

```text
PLACED
↓
PAYMENT_CONFIRMED
↓
SELLER_PENDING
↓
SELLER_ACCEPTED
↓
PICKUP_REQUESTED
↓
RIDER_ASSIGNED
↓
READY_FOR_PICKUP
↓
PICKED_UP
↓
OUT_FOR_DELIVERY
↓
DELIVERED
↓
SETTLEMENT_PENDING
↓
SETTLED
```

Exception states may include:

```text
SELLER_REJECTED
CANCELLED
PICKUP_FAILED
DELIVERY_FAILED
RETURN_REQUESTED
RETURNED
REFUND_PENDING
REFUNDED
```

Every transition must record:

* Previous state
* New state
* Actor
* Timestamp
* Reason
* Metadata
* Correlation/reference information

---

# 40. SELLER ORDER ACCEPTANCE

Seller receives order.

Seller may:

* Accept
* Reject

If rejecting, reason is mandatory.

Potential reasons:

* Out of stock
* Damaged product
* Operational issue
* Cannot fulfill
* Other

The rejection must be recorded and may affect seller performance metrics.

---

# 41. PACKAGING

Seller workflow:

```text
Order Accepted
↓
Prepare Product
↓
Pack
↓
Generate/Print Label
↓
Attach Label
↓
Ready for Pickup
```

Shipping/order label may include:

* Order ID
* Tracking ID
* Seller information
* Pickup address
* Customer information required for delivery
* Items
* Quantity
* Variant
* Weight
* Payment type
* Barcode/QR where appropriate

Sensitive information must be minimized.

---

# 42. DELIVERY

Delivery system must support:

* Delivery zones
* Seller location
* Customer location
* Rider location
* Serviceability
* Rider availability
* Capacity
* Vehicle capability
* Workload
* ETA
* Distance
* Performance/rating
* Acceptance history

Assignment must be backend-driven.

---

# 43. DELIVERY PRICING

Delivery pricing should be configurable.

Potential components:

```text
Base Fee
+
Distance Fee
+
Weight/Size Fee
+
Zone Fee
+
Peak/Surcharge
+
Special Handling
```

The exact pricing engine must be deterministic, configurable and auditable.

Track separately:

* Customer delivery charge
* Seller delivery charge if applicable
* Platform share
* Delivery partner earning

---

# 44. DELIVERY PARTNER

Delivery partner workflow:

```text
Available
↓
Delivery Offer
↓
Accept
↓
Navigate to Seller
↓
Arrive
↓
Pickup Verification
↓
Parcel Collected
↓
Navigate to Customer
↓
Out for Delivery
↓
Delivery Verification
↓
Delivered
```

Support:

* Proof of delivery
* OTP where required
* Photo/evidence where appropriate
* Failed delivery reason
* Return-to-seller workflow

---

# 45. DELIVERY TRACKING

Customer should see meaningful order tracking.

Example:

```text
Order Placed
      ↓
Payment Confirmed
      ↓
Seller Accepted
      ↓
Packing
      ↓
Ready for Pickup
      ↓
Rider Assigned
      ↓
Picked Up
      ↓
Out for Delivery
      ↓
Delivered
```

Exception events should also be visible when relevant.

---

# 46. DELIVERY ESTIMATION

Delivery estimates must be dynamic.

Inputs may include:

* Customer PIN/location
* Seller location
* Inventory location
* Delivery network
* Capacity
* Current operational conditions
* Product handling time

Do not hardcode generic delivery dates.

---

# 47. RETURNS

Return workflow:

```text
Delivered
↓
Return Request
↓
Eligibility Check
↓
Approved / Rejected
↓
Pickup
↓
Inspection if required
↓
Refund / Replacement
```

Eligibility must be based on:

* Product category
* Seller policy
* Platform policy
* Order status
* Delivery date
* Return window
* Return reason
* Product condition
* Evidence requirements

---

# 48. REFUNDS

Refund workflow must track:

* Refund eligibility
* Refund amount
* Refund method
* Payment reference
* Refund status
* Initiation time
* Gateway reference
* Completion
* Failure
* Reconciliation

Refunds must never rely only on frontend status.

---

# 49. SUPPORT

Support platform should provide CRM-like workflows.

Support agent may access only the information and actions required for the role.

Support may handle:

* Customer complaints
* Seller complaints
* Order issues
* Payment issues
* Return issues
* Refund issues
* Delivery issues
* COD verification
* Account issues

Sensitive or privileged actions should require escalation.

---

# 50. TICKETS

Ticket structure should support:

* Ticket ID
* Customer/seller
* Category
* Priority
* Status
* SLA
* Assigned agent
* Conversation
* Internal notes
* Attachments
* Related order
* Related payment
* Related return
* Escalation
* Resolution
* Audit trail

Potential statuses:

```text
OPEN
IN_PROGRESS
WAITING_FOR_CUSTOMER
WAITING_FOR_SELLER
ESCALATED
RESOLVED
CLOSED
```

---

# 51. CONTROL PANEL

Control Panel is the highest-authority operational platform.

It is NOT merely an admin dashboard.

Capabilities may include:

* Seller control
* Seller suspension
* Seller activation
* Seller restriction
* Product suspension
* Listing suspension
* Catalog governance
* Pricing controls
* Communication
* Campaign management
* Platform configuration
* User/permission management
* Emergency controls
* Audit
* Operational overrides

---

# 52. CONTROL PANEL SECURITY

High-authority actions require strong safeguards.

Potential requirements:

* Strong authentication
* Role verification
* Fine-grained permissions
* Step-up authentication for critical operations
* Mandatory reason
* Confirmation
* Audit trail
* Optional approval workflow
* Rate limits
* Sensitive action monitoring

“Full authority” must never mean unrestricted unaudited access.

---

# 53. SELLER DATA CONTROL

Some seller fields may become restricted after approval.

Examples:

* Legal identity
* Certain KYC fields
* Settlement information
* Verified business information

Seller may request changes through support.

Workflow:

```text
Seller
↓
Change Request
↓
Support Ticket
↓
Review
↓
Authorized Action
↓
Audit
↓
Seller Notification
```

---

# 54. CATALOG PUBLISHING

Publishing workspace should provide reviewers with:

* Seller details
* Product preview
* Images
* Title
* Category
* Attributes
* Description
* Pricing
* Compliance
* Documents where relevant
* AI quality checks
* Duplicate warnings
* Validation results
* Seller submitted data
* System/master data

Actions:

* Approve
* Request correction
* Reject
* Suspend
* Publish
* Unpublish

---

# 55. FINANCE

Financial architecture should support:

```text
Order
↓
Revenue
↓
Commission
↓
Taxes
↓
Delivery Charges
↓
Refunds
↓
Seller Payable
↓
Settlement
↓
Reconciliation
```

Financial records must be auditable.

---

# 56. SETTLEMENTS

Seller settlements should track:

* Gross sales
* Discounts
* Commission
* Taxes
* Delivery charges
* Refunds
* Adjustments
* Net payable
* Settlement status
* Settlement reference
* Settlement date

No financial value should be silently overwritten.

Corrections should create traceable adjustment records.

---

# 57. ANALYTICS

Analytics should support:

## Customer

* Acquisition
* Search
* Product views
* Cart
* Conversion
* Retention
* Repeat purchase
* Wishlist
* Returns

## Seller

* Sales
* Acceptance rate
* Rejection rate
* Cancellation
* Returns
* Fulfillment
* Performance
* Settlement

## Product

* Views
* CTR
* Conversion
* Sales
* Returns
* Search performance
* Inventory

## Delivery

* Assignment
* Acceptance
* Pickup time
* Delivery time
* Failed deliveries
* SLA

## Finance

* GMV
* Revenue
* Commission
* Refunds
* Settlements
* Reconciliation

---

# 58. EVENT ARCHITECTURE

Important business actions should generate events.

Examples:

```text
USER_REGISTERED
SELLER_REGISTERED
SELLER_SUBMITTED
SELLER_APPROVED
SELLER_REJECTED

PRODUCT_CREATED
PRODUCT_SUBMITTED
PRODUCT_APPROVED
PRODUCT_PUBLISHED
PRODUCT_SUSPENDED

PRODUCT_VIEWED
SEARCH_PERFORMED
ITEM_ADDED_TO_CART
CHECKOUT_STARTED

PAYMENT_INITIATED
PAYMENT_CONFIRMED
PAYMENT_FAILED

ORDER_CREATED
ORDER_CONFIRMED
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

Events should support:

* Analytics
* Notifications
* AI
* Integrations
* Auditing
* Asynchronous processing

---

# 59. EVENT PRINCIPLES

Events should be:

* Structured
* Versioned where necessary
* Traceable
* Idempotently handled
* Correlated
* Observable

Critical workflows must not depend on unreliable fire-and-forget behavior.

---

# 60. NOTIFICATIONS

Notification infrastructure should support:

* In-app
* Email
* SMS/OTP where appropriate
* WhatsApp or other approved messaging integrations

Notification system should support:

* Templates
* Localization
* Delivery status
* Retry
* Preferences
* Rate limiting
* Event-driven triggers

---

# 61. AI — CORE PRINCIPLE

AI is a central Intelligence Layer.

AI must not be implemented merely as a chatbot.

AI should improve:

* Customer discovery
* Search
* Recommendations
* Seller productivity
* Catalog quality
* Support
* Risk detection
* Analytics
* Operations
* Marketing
* Inventory intelligence

---

# 62. AI ARCHITECTURE

Conceptual architecture:

```text
Applications
     ↓
Central Backend
     ↓
AI Gateway
     ↓
AI Orchestrator
     ├── LLM Services
     ├── ML Services
     ├── Recommendation Engine
     ├── Search Intelligence
     ├── Risk Intelligence
     ├── RAG/Knowledge Layer
     └── AI Evaluation
```

AI providers/models must be abstracted so the platform does not become unnecessarily locked to one provider.

---

# 63. AI CAPABILITIES

Potential capabilities:

1. Semantic search
2. Query understanding
3. Product recommendations
4. Similar products
5. Frequently bought together
6. Cross-sell
7. Upsell
8. Personalized ranking
9. Shopping assistant
10. Product comparison
11. Product content generation
12. Attribute extraction
13. Categorization
14. Image/content quality analysis
15. Duplicate detection
16. Seller listing quality
17. Support classification
18. Support summarization
19. RAG support assistant
20. Fraud/risk detection
21. Demand forecasting
22. Inventory intelligence
23. Seller performance insights
24. Marketing recommendations
25. Customer segmentation
26. Review summarization
27. Sentiment/aspect analysis
28. Natural-language analytics

---

# 64. AI SAFETY

LLMs must NOT directly control critical business state.

AI must not directly modify:

* Payments
* Refunds
* Settlements
* Permissions
* Seller suspension
* Inventory
* Prices
* Orders

Instead:

```text
AI Recommendation
↓
Deterministic Business Logic
↓
Authorization
↓
Validation
↓
Execution
```

---

# 65. AI LEVELS

AI actions should have three levels.

## Level 1 — Assistive

AI recommends.

Human decides.

Example:

* Product title suggestion
* Seller content improvement
* Analytics explanation

## Level 2 — Low-Risk Automation

AI classifies/routes.

Example:

* Ticket category
* Search intent
* Support routing

## Level 3 — Critical

AI only recommends.

Business services decide and execute after authorization.

---

# 66. AI DATA PRINCIPLE

AI must use real platform data where appropriate.

Examples:

* Search behavior
* Product catalog
* Orders
* Seller performance
* Support knowledge
* Policies
* Inventory
* Customer interactions

AI must not fabricate platform data.

---

# 67. AI KNOWLEDGE / RAG

RAG may use verified Bilokat knowledge such as:

* Return policy
* Refund policy
* Seller policy
* Shipping policy
* Commission rules
* Support SOP
* Product guidelines
* Platform rules
* Operational documentation

The AI must prefer verified internal knowledge for Bilokat-specific questions.

---

# 68. AI OBSERVABILITY

AI operations should track where appropriate:

* Model
* Provider
* Prompt version
* Input metadata
* Output
* Confidence
* Latency
* Cost
* Errors
* Human override
* Final outcome

Sensitive data must be handled according to privacy/security policies.

---

# 69. SECURITY PRINCIPLES

Security is a first-class architecture concern.

The platform must defend against:

* Authentication attacks
* Brute force
* Session theft
* CSRF
* XSS
* SQL injection
* NoSQL injection where applicable
* IDOR/BOLA
* Privilege escalation
* Mass assignment
* SSRF
* File upload abuse
* Malicious payloads
* Rate abuse
* Enumeration
* Webhook attacks
* Replay attacks
* Payment fraud
* Coupon abuse
* Account takeover
* API abuse
* Insider misuse

---

# 70. API SECURITY

APIs must use:

* Authentication
* Authorization
* Input validation
* Schema validation
* Rate limiting
* Request size limits
* Secure headers
* Error sanitization
* Logging
* Audit where appropriate

Never expose internal stack traces to customers.

---

# 71. DATA SECURITY

Sensitive information must have appropriate controls.

Examples:

* Passwords → secure hashing
* Secrets → secret management
* Payment information → gateway/token references
* KYC → restricted access
* Personal data → least privilege
* Internal notes → role-restricted
* Audit logs → tamper-resistant design where appropriate

---

# 72. PRIVACY

The system must follow applicable privacy and data-protection requirements.

Data collection must follow:

* Purpose limitation
* Least privilege
* Data minimization
* Appropriate retention
* Access control
* Secure deletion where applicable

---

# 73. AUDIT LOGGING

Sensitive actions must be auditable.

Audit records should include:

* Actor
* Role
* Action
* Resource
* Previous state where appropriate
* New state where appropriate
* Timestamp
* IP/device/context where appropriate
* Reason
* Correlation ID

Audit logs must not be casually editable or deleted by normal operators.

---

# 74. OBSERVABILITY

Production architecture should support:

* Structured logs
* Metrics
* Distributed tracing where useful
* Error tracking
* Health checks
* Dependency monitoring
* Queue monitoring
* Database monitoring
* Cache monitoring
* API latency monitoring

Critical workflows should have traceability across services/components.

---

# 75. ERROR HANDLING

Every user-facing workflow must support:

* Loading state
* Empty state
* Validation error
* Business-rule error
* Network failure
* Server error
* Retry where safe
* Recovery path

Errors must be meaningful without exposing sensitive internals.

---

# 76. IDEMPOTENCY

Idempotency must be used where duplicate execution could cause financial or operational damage.

Important examples:

* Payment confirmation
* Payment webhooks
* Order creation
* Refunds
* Settlement
* Delivery state transitions
* Notification processing

---

# 77. DATABASE PRINCIPLES

Database architecture must prioritize:

* Referential integrity
* Appropriate normalization
* Correct indexing
* Transaction safety
* Constraints
* Auditability
* Scalability
* Migration safety

The database must reflect business rules, not merely frontend forms.

---

# 78. CACHING

Caching may be used for:

* Product discovery
* Categories
* Homepage content
* Configuration
* Search
* Sessions where appropriate
* Frequently accessed data

Cache invalidation/revalidation must be explicitly designed.

Stale cache must not override critical authoritative data.

---

# 79. PERFORMANCE

The platform should be designed for:

* Fast page loading
* Efficient API calls
* Pagination
* Lazy loading
* Image optimization
* CDN
* Database indexing
* Query optimization
* Caching
* Background processing

Performance should be measured rather than assumed.

---

# 80. FRONTEND PRINCIPLES

All frontend applications should have:

* Consistent design system
* Responsive layouts
* Accessibility
* Keyboard support where appropriate
* Loading states
* Empty states
* Error states
* Form validation
* Optimistic UI only where safe
* Proper server validation
* Secure authentication handling

---

# 81. CUSTOMER UX

Customer Web should prioritize:

* Discoverability
* Speed
* Trust
* Conversion
* Clear pricing
* Clear seller information
* Delivery estimates
* Simple checkout
* Transparent order tracking

The UI may use marketplace patterns familiar from major platforms but must have its own Bilokat identity.

---

# 82. SELLER UX

Seller Web should feel like a business operating system.

Use:

* Dense tables
* Filters
* Search
* Bulk actions
* Drawers
* Forms
* Timelines
* Status indicators
* Reports
* Operational workflows

Do not turn every screen into a decorative card dashboard.

---

# 83. CONTROL UX

Control Web should feel like a command center.

Important elements:

* Global search
* Alerts
* Risk indicators
* Permission indicators
* Activity stream
* Quick actions
* Operational context
* Audit access

High-risk actions must visually communicate their consequences.

---

# 84. SUPPORT UX

Support Web should be optimized for speed and context.

An agent should be able to understand:

* Who is contacting
* Why
* Related order
* Payment status
* Delivery status
* Previous interactions
* Current ticket
* Available actions

without opening excessive screens.

---

# 85. DELIVERY UX

Delivery Web should prioritize:

* Speed
* Large touch targets
* Minimal typing
* Clear next action
* Location/navigation
* Pickup/delivery verification

---

# 86. ACCESSIBILITY

Interfaces should aim for strong accessibility.

Consider:

* Semantic HTML
* Keyboard navigation
* Screen readers
* Focus management
* Color contrast
* Form labels
* Error announcements
* Reduced motion
* Touch target sizing

Accessibility must not be treated as an afterthought.

---

# 87. INTERNATIONALIZATION

Architecture should be capable of supporting:

* Multiple languages
* Multiple currencies if future expansion requires it
* Localized dates
* Localized numbers
* Localized notifications

Do not hardcode language-specific business logic into UI components.

---

# 88. CONFIGURATION

Business configuration should be centralized where appropriate.

Potential configuration:

* Order limits
* Delivery rules
* Coupon rules
* Seller rules
* Return windows
* COD thresholds
* Notification settings
* Feature flags
* Platform policies

Do not scatter business constants across frontend source code.

---

# 89. FEATURE FLAGS

Feature flags may be used for:

* Gradual rollout
* Testing
* A/B testing
* Emergency disable
* Region-specific availability

Feature flags must be centrally managed and auditable where they affect production behavior.

---

# 90. TESTING PRINCIPLE

Testing must exist at multiple levels.

## Unit Tests

Business logic.

## Integration Tests

API/database/service interaction.

## Contract Tests

API compatibility.

## End-to-End Tests

Real user workflows.

## Security Tests

Authorization and abuse cases.

## Performance Tests

Critical endpoints/workflows.

## Regression Tests

Previously fixed bugs.

---

# 91. CRITICAL E2E FLOWS

At minimum, automated tests should eventually cover:

### Customer

```text
Browse
→ Product
→ Add to Cart
→ Login
→ Checkout
→ Payment
→ Order
```

### Guest Cart

```text
Browse
→ Add to Cart
→ Login
→ Cart Merge
→ Checkout
```

### COD

```text
Product
→ Cart
→ Checkout
→ COD
→ Secondary Number
→ OTP
→ Verification
→ Confirmation
```

### Seller

```text
Register
→ Submit
→ Review
→ Approve
→ Activate
→ Add Product
→ Submit
→ Approve
→ Publish
```

### Fulfillment

```text
Order
→ Seller Accept
→ Ready
→ Rider
→ Pickup
→ Delivery
```

### Return

```text
Delivered
→ Return Request
→ Approval
→ Pickup
→ Refund
```

---

# 92. DEVELOPMENT RULES

Developers/AI agents must:

* Inspect existing implementation before changing it
* Avoid unnecessary rewrites
* Follow project documentation
* Follow architecture
* Write maintainable code
* Use strong typing
* Validate inputs
* Add tests
* Handle errors
* Update documentation
* Record architectural decisions

---

# 93. AI CODING AGENT RULES

Any AI coding agent working on Bilokat must follow these rules.

## Rule 1

Do not blindly trust documentation.

Documentation is context.

Actual repository implementation is the truth.

## Rule 2

Do not mark a feature complete until:

* Implemented
* Integrated
* Tested
* Verified

## Rule 3

Do not replace working architecture unnecessarily.

## Rule 4

Do not introduce a new framework/library merely because it is trendy.

Technology choices must have a reason.

## Rule 5

Prefer current stable production technology.

Before introducing a major dependency, verify:

* Maintenance
* Stability
* Compatibility
* Security
* Ecosystem
* Long-term viability

## Rule 6

Do not hardcode production business data.

## Rule 7

Do not put critical authorization only in frontend.

## Rule 8

Do not allow AI to directly mutate critical business state.

## Rule 9

Do not hide errors.

## Rule 10

Do not silently downgrade architecture to make implementation easier.

---

# 94. DOCUMENTATION RULE

Every major feature should eventually document:

* Purpose
* Business workflow
* Actors
* Permissions
* Database entities
* API endpoints
* Validation
* Business rules
* Events
* Notifications
* Security
* Testing
* Edge cases

---

# 95. CHANGE MANAGEMENT

Any architectural change must be recorded.

Use:

```text
DECISIONS.md
```

Each important decision should contain:

* Decision ID
* Date
* Problem
* Options
* Chosen solution
* Reason
* Impact
* Alternatives rejected

---

# 96. PROJECT STATUS

Project status must distinguish:

```text
PLANNED
IN_PROGRESS
PARTIAL
IMPLEMENTED
INTEGRATED
TESTED
VERIFIED
PRODUCTION_READY
```

“Implemented” must not automatically mean “complete”.

---

# 97. FEATURE COMPLETION STANDARD

A feature is:

### 0% — Not started

No meaningful implementation.

### 25% — Skeleton

Basic structure exists.

### 50% — Functional

Main happy path works.

### 75% — Integrated

Major systems are connected.

### 90% — Tested

Critical workflows and edge cases tested.

### 100% — Verified

Implemented + integrated + tested + secure + observable + production verified.

Only 100% should be considered complete.

---

# 98. EDGE CASE PRINCIPLE

Every important feature must consider:

* Duplicate requests
* Concurrent updates
* Network failure
* Timeout
* Partial failure
* Invalid input
* Expired state
* Permission changes
* Deleted resources
* Suspended seller
* Out-of-stock product
* Price changes
* Coupon expiration
* Payment mismatch
* Webhook duplication
* Delivery failure
* Return failure

---

# 99. SCALABILITY PRINCIPLE

The architecture should allow future growth in:

* Sellers
* Customers
* Products
* Orders
* Warehouses
* Cities
* Delivery partners
* Traffic
* AI requests
* Analytics events

without requiring a complete rewrite.

Scale should be introduced based on actual needs and measured bottlenecks.

Do not over-engineer blindly.

---

# 100. DEPLOYMENT PRINCIPLE

Each application should be independently deployable.

Deployment architecture must support:

* Environment separation
* Development
* Staging
* Production
* Secrets management
* Database migrations
* Rollback
* Health checks
* Monitoring
* CI/CD

Production secrets must never be committed to source control.

---

# 101. ENVIRONMENT PRINCIPLE

Minimum environments:

```text
development
staging
production
```

Environment-specific configuration must not be hardcoded.

---

# 102. BACKUP AND RECOVERY

Critical systems must have:

* Database backups
* Backup verification
* Recovery procedures
* Disaster recovery planning
* Recovery objectives appropriate to business requirements

A backup that has never been tested should not be considered reliable.

---

# 103. OBSERVABILITY AND INCIDENT RESPONSE

Production must provide enough visibility to answer:

* What failed?
* When?
* For whom?
* Which request?
* Which service?
* Which database operation?
* Which dependency?
* What was the business impact?
* Was the issue resolved?

Critical incidents should be traceable through correlation IDs.

---

# 104. BUSINESS CONTINUITY

Critical business workflows should fail safely.

Examples:

Payment gateway unavailable:

* Do not create falsely paid orders.

Delivery service unavailable:

* Do not assign invalid rider state.

Database unavailable:

* Do not partially confirm financial transactions.

AI unavailable:

* Core marketplace should continue operating without AI wherever possible.

AI is an enhancement layer, not a single point of failure for core commerce.

---

# 105. AI FAILURE PRINCIPLE

If AI fails:

```text
Core Business System
       ↓
Continues Operating
```

Examples:

* Search should still work without AI.
* Seller product submission should still work without AI.
* Support should still work without AI.
* Orders should still work without AI.
* Payments should still work without AI.

AI should degrade gracefully.

---

# 106. DATA CONSISTENCY

Critical financial and order operations require strong consistency where appropriate.

Eventually consistent systems may be used for:

* Search indexing
* Recommendations
* Analytics
* Notifications
* Non-critical derived views

The architecture must explicitly distinguish authoritative data from derived data.

---

# 107. SEARCH INDEXING

Search/indexed data is derived data.

Flow:

```text
Database Change
↓
Event
↓
Index Update
↓
Search
```

If indexing fails, the source database remains authoritative.

There must be a way to rebuild indexes.

---

# 108. NOTIFICATION FAILURE

Notification delivery failure must not automatically mean business operation failure.

Example:

```text
Order Confirmed
↓
Order remains confirmed
↓
Notification queued
↓
Notification retry
```

Business state and notification delivery state should remain separate.

---

# 109. SECURITY VS CONVENIENCE

When convenience conflicts with security for critical operations, security takes priority.

Especially for:

* Payments
* Refunds
* Settlements
* KYC
* Permissions
* Seller suspension
* Account recovery
* COD verification

---

# 110. PRINCIPLE OF LEAST PRIVILEGE

Every user/service receives only the permissions required.

This applies to:

* Humans
* APIs
* Internal services
* Background jobs
* AI tools
* Database access
* Storage access

---

# 111. SERVICE ACCOUNT SECURITY

Machine/service accounts must have:

* Restricted permissions
* Rotatable credentials
* Auditability
* Environment isolation
* No unnecessary admin access

---

# 112. FILE UPLOAD SECURITY

Any upload system must validate:

* MIME type
* File signature
* File size
* Filename
* Extension
* Content
* Access permissions

Uploads must not automatically become executable or publicly writable.

---

# 113. API VERSIONING

API evolution must be deliberate.

Breaking changes should not silently break existing applications.

Use appropriate:

* Versioning
* Deprecation
* Compatibility
* Migration strategy

---

# 114. BACKWARD COMPATIBILITY

Independent applications mean backend API compatibility is especially important.

Before changing a shared API:

* Identify consumers
* Check compatibility
* Update clients
* Test
* Deploy safely

---

# 115. NO FRONTEND BUSINESS AUTHORITY

Frontend must never be trusted for:

* Price
* Discount
* Coupon validity
* Payment status
* Seller permissions
* Product approval
* Inventory
* Order state
* Refund eligibility
* Settlement values

Frontend is a client.

Backend is the authority.

---

# 116. NO DATABASE DIRECT ACCESS FROM FRONTEND

Customer/Seller/Internal frontend applications must communicate through authorized backend APIs.

Database credentials must never be exposed to frontend applications.

---

# 117. PRODUCT DATA FLOW

Canonical flow:

```text
Seller
↓
Seller Product Submission
↓
Validation
↓
Catalog Review
↓
Approval
↓
Publication
↓
Listing Activation
↓
Search Index
↓
Customer Web
```

This flow must remain dynamic.

---

# 118. ORDER DATA FLOW

Canonical flow:

```text
Customer
↓
Cart
↓
Checkout
↓
Price Validation
↓
Payment / COD Verification
↓
Order Creation
↓
Seller
↓
Fulfillment
↓
Delivery
↓
Delivery Confirmation
↓
Return/Refund if applicable
↓
Settlement
```

---

# 119. CROSS-SYSTEM PRINCIPLE

No application should independently invent business rules that belong to the central backend.

For example:

Customer Web should not independently calculate final order totals.

Seller Web should not independently decide whether a seller is authorized.

Control Web should not bypass backend authorization.

Analytics should consume events/data rather than become the source of truth.

---

# 120. FUTURE EXTENSIBILITY

The platform should eventually be capable of supporting:

* Multiple countries
* Multiple currencies
* Multiple languages
* Multiple logistics providers
* Multiple payment providers
* Multiple seller types
* Warehouses
* B2B commerce
* Subscriptions
* Wholesale
* Marketplace advertising
* Seller promotions
* Loyalty
* Advanced recommendations
* External APIs

These should not be implemented prematurely unless required.

The architecture should simply avoid making them impossible.

---

# 121. DESIGN PHILOSOPHY

Bilokat should feel:

* Modern
* Fast
* Trustworthy
* Professional
* Scalable
* Intelligent
* Clean
* Operationally powerful

It should not look like:

* A generic template
* A simple CRUD application
* A student project
* A fake dashboard
* A collection of unrelated screens

---

# 122. BUSINESS-CRITICAL PRIORITIES

Priority order:

1. Security
2. Data integrity
3. Correct business behavior
4. Reliability
5. User experience
6. Performance
7. AI enhancement
8. Visual polish

Beautiful UI must never hide incorrect business logic.

---

# 123. IMPLEMENTATION PHILOSOPHY

Implementation must proceed domain by domain.

Recommended sequence:

```text
Architecture
↓
Backend Foundation
↓
Seller
↓
Catalog
↓
Customer
↓
Checkout & Payment
↓
Delivery
↓
Returns & Support
↓
Control Panel
↓
Finance
↓
AI
↓
Analytics
↓
Security Hardening
↓
Production
```

Do not implement random screens independently without connecting them to the underlying business system.

---

# 124. SESSION PRINCIPLE

Each implementation session must have:

## Before

* Read master specification
* Inspect current project state
* Identify dependencies
* Confirm previous work
* Identify incomplete features

## During

* Implement
* Integrate
* Test
* Fix
* Document

## After

* Verify
* Update status
* Update feature registry
* Update changelog
* Update handoff
* Record architectural decisions if required

---

# 125. NO PREMATURE COMPLETION

An AI agent must never say:

> “Everything is complete”

merely because:

* Build passes
* Screens exist
* API responds
* Database migrated

It must verify the complete workflow.

---

# 126. PROJECT TRUTH HIERARCHY

When information conflicts, use this hierarchy:

```text
1. Actual runtime behavior
2. Automated tests
3. Actual source code
4. Database/schema
5. API contracts
6. Project documentation
7. AI assumptions
```

AI assumptions are never authoritative.

---

# 127. ARCHITECTURAL CHANGE RULE

If a future requirement conflicts with this specification:

1. Identify the conflict.
2. Explain the impact.
3. Propose alternatives.
4. Select the best solution.
5. Record the decision.
6. Update affected documentation.
7. Then implement.

Do not silently change architecture.

---

# 128. DEFINITION OF DONE

A feature can be marked `PRODUCTION_READY` only if:

* Business workflow implemented
* Database implemented
* API implemented
* Frontend integrated
* Authorization implemented
* Validation implemented
* Error handling implemented
* Events implemented where needed
* Notifications implemented where needed
* Security reviewed
* Tests written
* Critical edge cases tested
* Observability added
* Performance considered
* Documentation updated
* End-to-end workflow verified

---

# 129. FINAL PROJECT RULE

Bilokat must be built as a real platform, not as a collection of demos.

Every major component must answer:

* What problem does it solve?
* Who can use it?
* What data does it require?
* What permissions are required?
* What business rules apply?
* What happens on success?
* What happens on failure?
* What events are generated?
* What notifications are generated?
* How is it audited?
* How is it secured?
* How is it tested?
* How does it scale?
* What happens if a dependency fails?

If these questions cannot be answered, the feature is not sufficiently designed.

---

# 130. MASTER SPECIFICATION STATUS

Current status:

```text
Architecture Blueprint: DEFINED
Business Model: DEFINED
Application Boundaries: DEFINED
Core Workflows: DEFINED
Security Principles: DEFINED
AI Principles: DEFINED
Testing Principles: DEFINED

Actual Implementation: NOT STARTED
Database Implementation: NOT STARTED
Backend Implementation: NOT STARTED
Frontend Implementation: NOT STARTED
Production Deployment: NOT STARTED
```

This document is the foundation for all future Bilokat development sessions.

Any future AI agent must read and understand this document before making architectural or implementation decisions.

```

### Ab iske baad

Is file ko save karne ke baad **abhi `01-ARCHITECTURE.md` khud se mat bharna**.

Next hum `01-ARCHITECTURE.md` banayenge, aur usme is Master Spec ko actual technical architecture mein convert karenge — **kaun sa backend module, kaunsi database boundary, kaunsi application, APIs kaise connect hongi, Redis/event system kahan lagega, storage kaise hoga, aur poora data-flow kya hoga.**

Uske baad hi actual coding AI ko denge.
```
