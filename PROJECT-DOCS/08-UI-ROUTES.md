# BILOKAT — UI ROUTES & FRONTEND ARCHITECTURE

**Document:** 08-UI-ROUTES.md
**Project:** Bilokat Marketplace
**Status:** Architecture Specification
**Purpose:** Complete route, navigation, access-control and frontend UX architecture

---

# 1. Purpose

Bilokat ek multi-seller marketplace hai jisme customer-facing aur internal operational applications alag rahengi.

Frontend applications:

```text
customer-web
seller-web
catalog-publishing-web
support-web
delivery-web
finance-web
control-web
analytics-web
```

Har application ka:

* route structure
* authentication boundary
* authorization boundary
* navigation
* role scope
* UI responsibility
* API access
* loading state
* empty state
* error state

clearly defined hoga.

Frontend authorization sirf UX protection hai.

Final authorization backend par hoga.

---

# 2. Frontend Architecture Principle

```text
User
 ↓
Frontend Route
 ↓
Authentication Check
 ↓
Session Check
 ↓
User Status
 ↓
Organization Context
 ↓
Role/Permission Check
 ↓
Page
 ↓
Backend API Authorization
```

Frontend kabhi security boundary nahi hai.

---

# 3. Application Boundaries

## Customer

```text
customer-web
```

Public marketplace + customer account.

## Seller

```text
seller-web
```

Seller operations.

## Catalog

```text
catalog-publishing-web
```

Catalog creation, governance and publishing workflow.

## Support

```text
support-web
```

Customer/seller support operations.

## Delivery

```text
delivery-web
```

Rider/delivery operations.

## Finance

```text
finance-web
```

Finance and settlement operations.

## Control

```text
control-web
```

High-authority platform control plane.

## Analytics

```text
analytics-web
```

Authorized business intelligence and analytics.

---

# 4. Global Route Conventions

Routes should be:

* lowercase
* predictable
* resource-oriented
* human-readable
* stable
* version-independent

Example:

```text
/products
/products/:productId
/orders
/orders/:orderId
```

Avoid unnecessary routes such as:

```text
/doThingNow
/processProduct
```

---

# 5. Customer Web

Repository:

```text
customer-web
```

Purpose:

> Public Bilokat marketplace and customer account experience.

---

# 6. Customer Public Routes

```text
/
```

Homepage.

```text
/search
```

Search results.

```text
/category/:categorySlug
```

Category listing.

```text
/category/:categorySlug/:subcategorySlug
```

Subcategory listing.

```text
/product/:productSlug
```

Product detail.

```text
/seller/:sellerSlug
```

Seller storefront.

```text
/collections/:collectionSlug
```

Collection/campaign page.

```text
/offers
```

Offers.

```text
/trending
```

Trending products.

```text
/new-arrivals
```

New arrivals.

---

# 7. Customer Cart Routes

```text
/cart
```

Cart.

```text
/cart/saved
```

Saved/cart-later items if supported.

Cart may be available to guests.

---

# 8. Customer Checkout Routes

```text
/checkout
```

Checkout entry.

```text
/checkout/address
```

Address selection.

```text
/checkout/payment
```

Payment selection.

```text
/checkout/review
```

Final review.

```text
/checkout/success/:orderId
```

Successful order.

```text
/checkout/failure
```

Payment/checkout failure.

Checkout pages must not trust frontend totals.

Backend recalculates:

* price
* discount
* coupon
* tax
* delivery
* final amount

---

# 9. Customer Authentication Routes

```text
/login
/register
/verify-otp
/forgot-password
/reset-password
```

Additional passkey/security flows may be added.

---

# 10. Customer Account Routes

```text
/account
/account/profile
/account/security
/account/addresses
/account/orders
/account/orders/:orderId
/account/returns
/account/returns/:returnId
/account/refunds
/account/wishlist
/account/reviews
/account/notifications
/account/support
/account/support/:ticketId
```

Only authenticated customer resources can be accessed.

---

# 11. Customer Order Route

```text
/account/orders/:orderId
```

Should display:

* order summary
* seller
* items
* price
* payment status
* delivery status
* tracking
* address
* expected delivery
* cancellation eligibility
* return eligibility
* refund status
* support

Only data belonging to the authenticated customer may be returned.

---

# 12. Customer AI Routes

AI can be surfaced without requiring separate navigation.

Possible:

```text
/assistant
```

Shopping assistant.

But preferred UX:

```text
Global Search
Product Pages
Cart
Account
```

mein contextual AI entry points.

AI features:

* shopping assistant
* product comparison
* recommendations
* similar products
* personalized discovery

AI failure must not break shopping.

---

# 13. Customer Navigation

Primary navigation:

```text
Home
Categories
Search
Offers
Cart
Account
```

Desktop may additionally show:

* seller storefronts
* collections
* wishlist
* notifications

Mobile navigation should prioritize:

```text
Home
Categories
Search
Cart
Account
```

---

# 14. Customer Product Page

Product page sections:

```text
Images
Title
Rating
Price
MRP
Discount
Seller
Availability
Delivery
Variants
Specifications
Description
Offers
Return Policy
Reviews
Recommendations
```

Dynamic sections must come from backend data.

---

# 15. Customer Search UX

Search page should support:

* keyword search
* semantic understanding
* category filters
* price
* brand
* attributes
* rating
* availability
* delivery
* sorting
* seller
* offers

URL query state should be shareable where practical.

Example:

```text
/search?q=shoes&category=running&maxPrice=1500
```

Backend remains authoritative.

---

# 16. Seller Web

Repository:

```text
seller-web
```

Purpose:

> Seller operational workspace.

---

# 17. Seller Authentication Routes

```text
/login
/register
/verify
/forgot-password
/security
```

Seller login requires valid seller user/session.

---

# 18. Seller Onboarding Routes

```text
/onboarding
/onboarding/profile
/onboarding/business
/onboarding/documents
/onboarding/bank
/onboarding/review
/onboarding/status
```

Lifecycle states:

```text
REGISTERED
PROFILE_INCOMPLETE
APPLICATION_SUBMITTED
AUTOMATIC_VALIDATION
UNDER_REVIEW
CORRECTION_REQUIRED
RESUBMITTED
APPROVED
ACTIVE
```

UI must reflect backend lifecycle.

---

# 19. Seller Dashboard

```text
/dashboard
```

Shows authorized operational metrics:

* sales
* orders
* revenue
* pending orders
* inventory
* returns
* performance
* notifications
* AI insights

No fabricated metrics.

---

# 20. Seller Catalog Routes

```text
/products
/products/new
/products/:productId
/products/:productId/edit
/products/:productId/variants
/products/:productId/media
/products/:productId/status
```

Seller-specific listing management may use:

```text
/listings
/listings/new
/listings/:listingId
/listings/:listingId/edit
```

---

# 21. Seller Inventory Routes

```text
/inventory
/inventory/:sku
/warehouses
/warehouses/:warehouseId
/stock-movements
/batches
```

Only authorized seller inventory is visible.

---

# 22. Seller Order Routes

```text
/orders
/orders/:orderId
/orders/pending
/orders/processing
/orders/ready
/orders/completed
/orders/cancelled
```

Seller sees only relevant seller-order data.

---

# 23. Seller Fulfillment

Order detail should support:

```text
Accept
Reject
Prepare
Pack
Print Label
Mark Ready
Request Pickup
```

Reject action requires reason.

Frontend cannot directly transition arbitrary order states.

---

# 24. Seller Returns

```text
/returns
/returns/:returnId
```

Display:

* return reason
* evidence
* eligibility
* status
* pickup
* inspection
* refund/replacement status

---

# 25. Seller Finance

```text
/finance
/finance/earnings
/finance/transactions
/finance/payables
/finance/settlements
/finance/settlements/:settlementId
```

Financial figures come from backend.

No frontend calculation should be treated as authoritative.

---

# 26. Seller Analytics

```text
/analytics
/analytics/sales
/analytics/products
/analytics/customers
/analytics/returns
/analytics/fulfillment
```

AI insights may be shown separately:

```text
/analytics/insights
```

---

# 27. Seller AI

Possible surfaces:

```text
/products/:productId/ai
/analytics/insights
/inventory/insights
```

Capabilities:

* content generation
* product quality suggestions
* attribute extraction
* sales insights
* inventory forecasting
* performance suggestions

AI recommendations require seller review where appropriate.

---

# 28. Catalog Publishing Web

Repository:

```text
catalog-publishing-web
```

Purpose:

> Platform catalog governance and publishing operations.

---

# 29. Catalog Routes

```text
/dashboard

/categories
/categories/new
/categories/:categoryId
/categories/:categoryId/edit

/attributes
/attributes/new
/attributes/:attributeId
/attributes/:attributeId/edit

/category-schemas
/category-schemas/:schemaId

/products
/products/:productId

/product-review
/product-review/:productId

/publications
/publications/:publicationId

/moderation
/moderation/:itemId
```

---

# 30. Catalog Product Workflow UI

```text
Draft
 ↓
Submitted
 ↓
Under Review
 ↓
Correction Required
 ↓
Resubmitted
 ↓
Approved
 ↓
Published
```

Approval and publication are separate UI actions.

---

# 31. Catalog Review Queue

Reviewer should see:

* product data
* variants
* attributes
* media
* seller
* quality score
* policy warnings
* duplicate signals
* AI suggestions
* history
* previous decisions

Actions:

```text
Approve
Reject
Request Correction
Suspend
```

Permission controlled.

---

# 32. Support Web

Repository:

```text
support-web
```

Purpose:

> CRM-like support operations.

---

# 33. Support Routes

```text
/dashboard

/tickets
/tickets/new
/tickets/:ticketId

/customers
/customers/:customerId

/sellers
/sellers/:sellerId

/orders
/orders/:orderId

/returns
/returns/:returnId

/refunds
/refunds/:refundId

/cod
/cod/:verificationId

/escalations
/escalations/:escalationId

/knowledge-base
```

---

# 34. Support Ticket UI

Ticket detail:

```text
Conversation
Customer
Order
Seller
Payment
Delivery
Return
Refund
Attachments
Internal Notes
SLA
Assignment
Escalation
```

Sensitive information must be permission-filtered.

---

# 35. Support AI

Ticket page may expose:

```text
Summarize
Classify
Suggest Reply
Find Policy
Detect Duplicate
Suggest Escalation
```

AI-generated reply remains draft until authorized agent sends it.

---

# 36. Delivery Web

Repository:

```text
delivery-web
```

Mobile-first PWA.

---

# 37. Delivery Routes

```text
/login

/dashboard

/tasks
/tasks/:taskId

/pickups
/pickups/:pickupId

/deliveries
/deliveries/:deliveryId

/route

/history

/earnings

/profile

/notifications
```

---

# 38. Delivery Task UI

Task details:

```text
Order/Tracking ID
Pickup
Drop
Items
Quantity
Package information
Payment type
COD amount if applicable
Customer contact
Delivery instructions
Status
```

Only information required for delivery should be shown.

---

# 39. Delivery State Actions

Allowed actions depend on backend state and rider permission:

```text
Accept Task
Arrived at Pickup
Picked Up
Start Delivery
Arrived
Attempt Delivery
Delivered
Failed
Return to Seller
```

No arbitrary status editing.

---

# 40. Proof of Delivery

Delivery UI may support:

* OTP
* signature
* photo where policy permits
* timestamp
* geolocation evidence where legally/operationally appropriate

Proof should be securely stored.

---

# 41. Finance Web

Repository:

```text
finance-web
```

Purpose:

> Financial operations and reconciliation.

---

# 42. Finance Routes

```text
/dashboard

/transactions
/transactions/:transactionId

/orders
/orders/:orderId

/refunds
/refunds/:refundId

/settlements
/settlements/:settlementId

/seller-payables
/seller-payables/:sellerId

/ledger
/ledger/:entryId

/reconciliation
/reconciliation/:reconciliationId

/adjustments
/adjustments/:adjustmentId

/reports
```

---

# 43. Finance Security

Finance UI requires strict:

* authentication
* permission
* organization scope
* field-level access
* audit logging
* step-up authentication where required

Financial mutation actions may require approval workflows.

---

# 44. Control Web

Repository:

```text
control-web
```

Purpose:

> Highest-authority platform control plane.

This is NOT a normal admin dashboard.

---

# 45. Control Routes

```text
/login
/security

/dashboard

/users
/users/:userId

/organizations
/organizations/:organizationId

/sellers
/sellers/:sellerId

/products
/products/:productId

/listings
/listings/:listingId

/categories
/categories/:categoryId

/orders
/orders/:orderId

/delivery
/delivery/:assignmentId

/payments
/payments/:paymentId

/refunds
/refunds/:refundId

/finance
/finance/:entityId

/campaigns
/campaigns/:campaignId

/platform-config
/platform-config/:configId

/feature-flags
/feature-flags/:flagId

/emergency
/audit
/audit/:auditId

/security/events
```

---

# 46. Control High-Risk Actions

Examples:

```text
Suspend Seller
Deactivate Listing
Change Platform Configuration
Emergency Disable Feature
Modify High-Risk Policy
```

UI should require:

```text
Permission
+
Reason
+
Confirmation
+
Step-Up if required
+
Audit
```

Some operations may require dual approval.

---

# 47. Control AI

Control AI is recommendation-focused.

Possible:

```text
/risk/insights
/anomalies
/ai/insights
```

AI can identify:

* anomalies
* suspicious patterns
* operational bottlenecks
* unusual seller behavior
* system-level trends

AI should not silently perform high-impact control actions.

---

# 48. Analytics Web

Repository:

```text
analytics-web
```

Purpose:

> Authorized business intelligence and reporting.

---

# 49. Analytics Routes

```text
/dashboard

/sales
/orders
/customers
/sellers
/products
/categories
/inventory
/delivery
/returns
/refunds
/finance
/marketing
/funnels
/cohorts
/experiments
```

---

# 50. Natural Language Analytics

Possible route:

```text
/ask
```

Example:

```text
"Last 30 days mein revenue trend kya tha?"
```

Natural-language query:

```text
NL
 ↓
Authorization
 ↓
Query Planning
 ↓
Safe Query
 ↓
Analytics Data
 ↓
Visualization
```

AI must never get unrestricted production DB access.

---

# 51. Analytics Access Control

Analytics visibility depends on:

```text
Role
Organization
Scope
Data classification
Permission
```

Seller:

```text
Own data
```

Finance:

```text
Authorized financial data
```

Control:

```text
Platform-level authorized data
```

---

# 52. Global Authentication Architecture

Each application has its own frontend route guard.

Conceptually:

```text
PublicRoute
ProtectedRoute
PermissionRoute
RoleRoute
OrganizationRoute
StepUpRoute
```

Example:

```text
<ProtectedRoute>
  <PermissionRoute permission="product.approve">
      ...
  </PermissionRoute>
</ProtectedRoute>
```

Actual implementation depends on frontend framework.

---

# 53. Route Guard Rules

Frontend checks:

1. session exists
2. token/session valid
3. user active
4. correct application
5. organization context
6. required permission

Backend repeats all security checks.

---

# 54. Unauthorized Route Behavior

Unauthenticated:

```text
→ Login
```

Authenticated but unauthorized:

```text
→ 403 Forbidden UI
```

Resource not found:

```text
→ 404
```

Do not reveal whether restricted resources exist through error wording.

---

# 55. Deep Link Handling

If user opens:

```text
/orders/123
```

while logged out:

```text
Login
 ↓
Authentication
 ↓
Restore intended route
 ↓
Authorization
 ↓
Open page
```

Only after successful authorization.

---

# 56. Session Expiration

If access token expires:

```text
API 401
 ↓
Attempt refresh according to session contract
 ↓
Success → retry safe request
```

If refresh fails:

```text
Clear session
 ↓
Login
```

Avoid infinite refresh loops.

---

# 57. Permission Changes

If user's permissions change:

```text
Permission Update
 ↓
Backend Session/Permission State
 ↓
Frontend refresh/invalidation
 ↓
UI updates
```

Frontend cached permissions must not remain authoritative.

---

# 58. Navigation Visibility

Navigation items should be permission-aware.

Example:

```text
if user.hasPermission("settlement.read")
    show Settlements
```

But hidden UI is not security.

Backend still enforces permission.

---

# 59. Loading States

Every route must handle:

```text
Initial Loading
Background Refresh
Pagination Loading
Mutation Loading
AI Loading
Upload Loading
```

Avoid blank screens.

Use:

* skeleton
* spinner where appropriate
* progressive rendering

---

# 60. Empty States

Every list must have meaningful empty state.

Examples:

```text
No orders yet.
No products match your filters.
No pending reviews.
No settlements available.
```

Empty state should offer next useful action when appropriate.

---

# 61. Error States

Every major page should handle:

```text
400
401
403
404
409
422
429
500
503
network failure
timeout
```

Errors must be:

* understandable
* actionable
* sanitized

Internal stack traces never shown.

---

# 62. Offline/Network Handling

For mobile/PWA operational applications:

* delivery
* seller where useful
* support where useful

network failure should provide:

```text
Offline indicator
Retry
Safe local state
Unsynced indicator
```

Critical state transitions require backend confirmation.

Do not falsely show success before server confirmation.

---

# 63. Forms

Forms should have:

* schema validation
* server validation
* field-level errors
* loading state
* duplicate submission prevention
* unsaved-change warning where needed

Frontend validation improves UX.

Backend validation remains authoritative.

---

# 64. File Upload UX

Used for:

* product images
* seller documents
* support attachments
* return evidence
* delivery proof

UI should show:

```text
Selecting
Uploading
Processing
Success
Failed
Retry
```

Backend performs:

* MIME validation
* signature validation
* size validation
* access control
* malware/security checks where configured

---

# 65. Responsive Architecture

Customer:

```text
Mobile-first
Desktop optimized
```

Seller:

```text
Responsive
Desktop operational workflows
Mobile quick actions
```

Catalog:

```text
Desktop-first
Responsive review
```

Support:

```text
Desktop-first
Responsive
```

Delivery:

```text
Mobile-first
PWA
```

Finance:

```text
Desktop-first
Responsive
```

Control:

```text
Desktop-first
Responsive emergency access
```

Analytics:

```text
Desktop-first
Responsive
```

---

# 66. Design System

All applications should use a consistent Bilokat design language where appropriate.

Shared packages may include:

```text
@bilokat/ui
@bilokat/types
@bilokat/api-client
@bilokat/auth
@bilokat/validation
```

Shared package versions must be controlled.

Customer UI must not be tightly coupled to internal admin implementation.

---

# 67. Accessibility

Every application should target strong accessibility practices:

* keyboard navigation
* semantic HTML
* labels
* focus states
* accessible dialogs
* contrast
* screen-reader support
* error announcements
* touch-friendly controls

---

# 68. Performance

Frontend should optimize:

* code splitting
* route-level lazy loading
* image optimization
* caching
* prefetching
* pagination
* virtualization
* bundle size
* API request deduplication

Do not load control/finance functionality into customer bundle.

---

# 69. Security Headers and Browser Security

Frontend deployment should support appropriate:

* CSP
* HSTS
* X-Content-Type-Options
* Referrer-Policy
* frame protection
* secure cookie configuration where applicable

Exact policy configured according to deployment architecture.

---

# 70. Token Storage

Token/session implementation must follow:

`05-AUTH-RBAC-ABAC.md`.

Preferred architecture:

```text
Secure HttpOnly Cookie
+
SameSite Policy
+
CSRF Protection where applicable
```

Avoid exposing long-lived sensitive tokens to JavaScript unnecessarily.

---

# 71. API Client

All applications should use a consistent API client abstraction.

Responsibilities:

* base URL
* authentication
* correlation ID
* request ID
* error normalization
* retry policy
* timeout
* response parsing
* refresh handling
* telemetry

Example package:

```text
@bilokat/api-client
```

---

# 72. Frontend State

Separate:

```text
Server State
Client State
UI State
Session State
```

Server state should not be duplicated unnecessarily.

Examples:

```text
Server:
products
orders
inventory

Client:
selected filters
modal state
draft form

Session:
authenticated user
organization context
permissions
```

---

# 73. URL State

Search/filter/sort state should use URL parameters where useful.

Example:

```text
/products?status=active&page=2&sort=latest
```

Benefits:

* shareability
* browser navigation
* refresh persistence
* debugging

---

# 74. Pagination

Large lists must be paginated.

Examples:

* products
* orders
* tickets
* transactions
* audit logs
* analytics events

Avoid loading entire datasets into browser.

---

# 75. Real-Time UI

Where valuable, use:

* WebSocket
* Server-Sent Events
* polling

for:

* delivery tracking
* order updates
* support tickets
* notifications
* operational queues

Backend remains source of truth.

---

# 76. Notifications UI

Global notification center:

```text
/notifications
```

Where applicable.

Notification categories:

```text
Order
Payment
Delivery
Return
Support
Seller
Finance
Security
System
```

Read/unread state backend controlled.

---

# 77. Audit UI

Audit visibility depends on permission.

Examples:

```text
/audit
/audit/:auditId
```

Show:

* actor
* action
* resource
* timestamp
* correlation ID
* reason
* result
* metadata where authorized

Sensitive values must be masked.

---

# 78. AI UI Principles

AI UI must clearly communicate:

* AI-generated
* recommendation vs fact
* confidence where meaningful
* source/context where appropriate
* loading
* failure
* retry
* human review requirement

Never make AI suggestion visually indistinguishable from authoritative system data where that could mislead users.

---

# 79. AI Action Confirmation

For AI-assisted actions:

```text
AI Suggestion
 ↓
Review
 ↓
User Confirmation
 ↓
Backend Validation
 ↓
Execution
```

No silent high-impact mutation.

---

# 80. Frontend Observability

Track:

* page load
* API latency
* frontend errors
* route errors
* failed mutations
* authentication failures
* user-visible failures
* Core Web Vitals where relevant

Do not log sensitive information unnecessarily.

---

# 81. Correlation IDs

Frontend API requests should propagate:

```text
request_id
correlation_id
```

This allows:

```text
Frontend
 ↓
API
 ↓
Service
 ↓
Event
 ↓
Worker
 ↓
AI
```

to be traced.

---

# 82. Route Testing

Every protected route must have tests for:

### Allowed

```text
authorized user → 200
```

### Denied

```text
unauthorized user → 403
```

### Unauthenticated

```text
anonymous → login
```

### Expired Session

```text
expired → refresh/login
```

### Wrong Organization

```text
cross-org → deny
```

### Resource Ownership

```text
foreign resource → deny/not-found according to policy
```

---

# 83. Critical E2E Navigation

## Customer

```text
Home
 ↓
Search
 ↓
Product
 ↓
Cart
 ↓
Login
 ↓
Checkout
 ↓
Payment
 ↓
Order
```

## Seller

```text
Login
 ↓
Onboarding
 ↓
Approval
 ↓
Dashboard
 ↓
Product
 ↓
Submission
 ↓
Order
 ↓
Fulfillment
 ↓
Settlement
```

## Catalog

```text
Login
 ↓
Review Queue
 ↓
Product
 ↓
Review
 ↓
Approve
 ↓
Publish
```

## Support

```text
Ticket
 ↓
Order
 ↓
Customer
 ↓
Policy
 ↓
Resolution
```

## Delivery

```text
Task
 ↓
Pickup
 ↓
Delivery
 ↓
Proof
 ↓
Completed
```

## Finance

```text
Order
 ↓
Transaction
 ↓
Refund
 ↓
Payable
 ↓
Settlement
 ↓
Reconciliation
```

---

# 84. Application Isolation

A customer cannot access internal application functionality merely by changing URL.

Example:

```text
customer-web/control
```

must not expose control UI.

Even if a route is manually accessed, backend authorization prevents access.

---

# 85. Cross-App Authentication

Applications may share a centralized authentication/session architecture.

However:

```text
Authentication
```

and

```text
Authorization
```

remain separate.

A valid login does not automatically grant access to every application.

---

# 86. Cross-App Navigation

If user has access to multiple applications, launcher can expose authorized applications.

Example:

```text
Seller
Support
Finance
Analytics
```

Only applications permitted for that actor should appear.

---

# 87. Permission-Aware UI

Permission checks should be reusable.

Conceptual:

```text
Can("product.read")
Can("product.create")
Can("product.update")
Can("product.approve")
Can("product.publish")
```

Do not use broad frontend flags like:

```text
isAdmin === true
```

as the sole authorization mechanism.

---

# 88. Business-State UI

Buttons must also reflect business state.

Example:

```text
Product APPROVED
+
Listing ACTIVE
+
Publication PUBLISHED
```

→ customer visibility.

But:

```text
Product APPROVED
+
Publication DRAFT
```

→ publish action may be available to authorized actor.

UI should not show invalid transitions.

Backend remains final authority.

---

# 89. Double Submission Protection

Mutation buttons should prevent accidental duplicate requests.

Examples:

```text
Pay
Place Order
Accept Order
Reject Order
Publish
Refund
Submit Seller Application
```

Use:

* disabled state
* idempotency keys
* request state

where appropriate.

---

# 90. Unsaved Changes

Long forms should warn users before accidental navigation.

Especially:

* seller onboarding
* product creation
* catalog editing
* support responses
* finance adjustments

Do not lose user-entered data unnecessarily.

---

# 91. Error Recovery

Error UI should prefer:

```text
Retry
Reload
Go Back
Save Draft
Contact Support
```

depending on context.

Do not simply display:

```text
Something went wrong.
```

without useful recovery.

---

# 92. Production UI Principle

No page is considered complete unless it handles:

```text
Loading
Success
Empty
Error
Unauthorized
Forbidden
Offline
Retry
Mutation
Validation
Responsive
Accessibility
```

where applicable.

---

# 93. Route Architecture Completion Gate

`08-UI-ROUTES.md` is considered implemented only when:

```text
Routes Defined
+
Application Boundaries Implemented
+
Authentication Guards Implemented
+
Permission Guards Implemented
+
Organization Scope Implemented
+
Business-State UI Implemented
+
API Integration Implemented
+
Loading States Implemented
+
Empty States Implemented
+
Error States Implemented
+
Responsive UI Implemented
+
Accessibility Checked
+
Security Tested
+
Critical E2E Passed
```

---

# 94. Non-Negotiable UI Rules

1. Frontend is never the security authority.
2. Backend authorization always applies.
3. No internal application code is exposed through customer routes.
4. No hardcoded production data.
5. No fake orders/products/financial numbers in production.
6. No arbitrary client-side status transitions.
7. No frontend-authoritative prices or totals.
8. No unrestricted AI actions.
9. No sensitive information in frontend logs.
10. No cross-organization data exposure.
11. Permission-aware UI must use explicit permissions.
12. Critical mutations require backend confirmation.
13. Large datasets must be paginated.
14. Dynamic data must have loading/empty/error states.
15. Core workflows must work when AI is unavailable.
16. Customer, seller and internal applications remain logically isolated.
17. Financial and control operations receive stricter UX/security controls.
18. Every critical route must have E2E coverage.

---

# 95. Final Frontend Architecture

Bilokat frontend ecosystem:

```text
                    BILOKAT API
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
       ▼                 ▼                 ▼
  Customer           Seller           Internal
    Web                Web             Apps
       │                 │                 │
       │                 │        ┌────────┼────────┐
       │                 │        ▼        ▼        ▼
       │                 │     Catalog  Support  Delivery
       │                 │
       │                 │        ┌────────┼────────┐
       │                 │        ▼        ▼        ▼
       │                 │     Finance  Control Analytics
       │                 │
       └─────────────────┴──────────────────────────┘
```

All applications communicate with the central backend.

No frontend directly owns business truth.

---

# FINAL UI CONTRACT

Bilokat ka frontend architecture:

```text
Separated
+
Permission-Aware
+
Role-Aware
+
Organization-Aware
+
Business-State-Aware
+
Responsive
+
Accessible
+
Observable
+
Secure
+
API-Driven
+
AI-Enhanced
```

Core rule:

> **Frontend user experience control karega; backend authorization aur business truth control karega.**

This document defines the route and UX boundary. Actual visual design, component implementation and API integration must follow the previously defined architecture, database, API, authorization, event and AI specifications.
