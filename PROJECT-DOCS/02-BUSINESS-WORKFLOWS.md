
# BILOKAT — BUSINESS WORKFLOWS

> Document Type: Business Workflow & State Machine Specification
> Project: Bilokat
> Version: 1.0.0
> Parent Documents: `00-MASTER-SPEC.md`, `01-ARCHITECTURE.md`
> Status: Workflow Foundation
> Implementation Status: Not Started
> Last Updated: 2026-09-07

---

# 1. PURPOSE

This document defines the operational behavior of the Bilokat marketplace.

It specifies:

* Business actors
* Entity lifecycles
* State machines
* State transitions
* Transition permissions
* Preconditions
* Validation
* Side effects
* Events
* Notifications
* Exception handling
* Recovery workflows
* Approval workflows
* Escalation workflows
* Financial consequences

This document is the behavioral source for implementing Bilokat business logic.

Architecture defines how the system is structured.

This document defines how the business behaves.

---

# 2. CORE WORKFLOW PRINCIPLE

Every important business process must follow:

```text
Actor
 ↓
Action
 ↓
Authorization
 ↓
Validation
 ↓
Business Rules
 ↓
State Transition
 ↓
Transaction
 ↓
Event
 ↓
Notification / Side Effect
 ↓
Audit
```

A frontend action is never sufficient to change authoritative business state.

---

# 3. ACTORS

Bilokat may contain the following actors:

```text
CUSTOMER
SELLER_OWNER
SELLER_MANAGER
SELLER_STAFF

CATALOG_REVIEWER
SUPPORT_AGENT
COD_AGENT
DELIVERY_PARTNER

FINANCE_OPERATOR
ANALYTICS_USER

CONTROL_ADMIN
SUPER_ADMIN

SYSTEM
BACKGROUND_WORKER
AI_ASSISTANT
EXTERNAL_PROVIDER
```

Every actor must have explicitly defined permissions.

---

# 4. STATE MACHINE RULE

Every important state machine must define:

```text
Current State
Allowed Action
Actor
Preconditions
Validation
Next State
Side Effects
Event
Audit
```

The backend must reject invalid transitions.

---

# 5. GENERAL STATE TRANSITION RULE

Invalid:

```text
CURRENT STATE
      ↓
Frontend sends desired state
      ↓
Database directly updated
```

Correct:

```text
CURRENT STATE
      ↓
Authorized Command
      ↓
Business Rule Validation
      ↓
Allowed Transition
      ↓
Database Transaction
      ↓
Event
      ↓
Audit
```

---

# 6. USER ACCOUNT WORKFLOW

## 6.1 User Registration

```text
UNREGISTERED
      ↓
REGISTRATION_STARTED
      ↓
IDENTITY_VERIFICATION
      ↓
REGISTERED
      ↓
ACTIVE
```

Possible exception:

```text
REGISTRATION_STARTED
      ↓
REGISTRATION_FAILED
```

---

## 6.2 Registration Preconditions

Depending on authentication method:

* Valid contact information
* OTP verification where required
* Password validation where applicable
* Terms acceptance where required
* Duplicate account checks
* Abuse/rate-limit checks

---

## 6.3 User Suspension

```text
ACTIVE
 ↓
SUSPENDED
```

Possible recovery:

```text
SUSPENDED
 ↓
REVIEW
 ↓
ACTIVE
```

Permanent removal/deactivation must follow platform retention and legal policies.

---

# 7. CUSTOMER SHOPPING WORKFLOW

Primary customer journey:

```text
HOME
 ↓
DISCOVER
 ↓
SEARCH / CATEGORY
 ↓
PRODUCT VIEW
 ↓
ADD TO CART / BUY NOW
 ↓
CART
 ↓
CHECKOUT
 ↓
LOGIN / ACCOUNT VERIFICATION
 ↓
ADDRESS
 ↓
PAYMENT / COD
 ↓
ORDER
 ↓
TRACK
 ↓
DELIVERY
 ↓
POST-ORDER
```

---

# 8. PRODUCT DISCOVERY WORKFLOW

Customer may:

* Browse categories
* Search
* Filter
* Sort
* View recommendations
* Open product
* Compare products
* View seller information
* View availability

Only currently eligible products/listings may be returned.

---

# 9. PRODUCT VISIBILITY RULE

A product/listing is customer-visible only if required conditions are satisfied.

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
Availability = VALID
AND
Serviceability = VALID
AND
Policy Restrictions = PASS
```

Failure of any required condition may remove customer visibility.

---

# 10. PRODUCT DETAIL WORKFLOW

When customer opens a product:

```text
Product ID
 ↓
Authorization / Visibility Check
 ↓
Product Data
 ↓
Active Listings
 ↓
Price
 ↓
Availability
 ↓
Delivery Estimate
 ↓
Seller Information
 ↓
Policies
 ↓
Recommendations
```

Unavailable or suspended listings must not be purchasable.

---

# 11. CART WORKFLOW

## 11.1 Add to Cart

```text
PRODUCT VIEW
 ↓
ADD TO CART
 ↓
Listing Validation
 ↓
Availability Check
 ↓
Quantity Validation
 ↓
Cart Updated
```

---

## 11.2 Cart Validation

Before checkout:

```text
Cart
 ↓
Product Exists?
 ↓
Listing Active?
 ↓
Seller Active?
 ↓
Price Valid?
 ↓
Stock Available?
 ↓
Quantity Allowed?
 ↓
Coupon Valid?
 ↓
Delivery Serviceable?
 ↓
Checkout Allowed
```

---

# 12. GUEST CART

Guest customers may maintain a temporary cart.

```text
Anonymous Session
 ↓
Guest Cart
 ↓
Login
 ↓
Authenticated Cart
 ↓
Cart Merge
```

---

# 13. CART MERGE

After login:

```text
Guest Cart
+
User Cart
 ↓
Conflict Resolution
 ↓
Quantity Validation
 ↓
Stock Validation
 ↓
Final Cart
```

Potential conflicts:

* Same product exists in both carts
* Stock insufficient
* Listing unavailable
* Price changed
* Product removed

The customer must be informed of important changes.

---

# 14. BUY NOW WORKFLOW

Buy Now should minimize unnecessary steps.

```text
Product
 ↓
Listing Validation
 ↓
Quantity Validation
 ↓
Stock Validation
 ↓
Checkout Session
 ↓
Address
 ↓
Payment / COD
```

Buy Now must not silently create a final order before payment/COD requirements are satisfied.

---

# 15. CHECKOUT WORKFLOW

```text
CART
 ↓
CHECKOUT_STARTED
 ↓
AUTHENTICATION CHECK
 ↓
ADDRESS
 ↓
ITEM VALIDATION
 ↓
PRICE CALCULATION
 ↓
TAX CALCULATION
 ↓
DELIVERY CALCULATION
 ↓
COUPON VALIDATION
 ↓
FINAL TOTAL
 ↓
PAYMENT METHOD
 ↓
ORDER CREATION / PAYMENT FLOW
```

---

# 16. CHECKOUT TOTAL

Backend calculates:

```text
Item Price
+
Applicable Taxes
+
Delivery Charges
+
Other Applicable Charges
-
Seller/Platform Discounts
-
Coupon
=
Final Payable
```

The exact calculation order must be implemented from the final pricing specification.

Frontend totals are informational only.

---

# 17. CHECKOUT EXPIRATION

Checkout sessions may expire.

Possible reasons:

* Payment timeout
* Session timeout
* Stock reservation expiry
* Price quote expiry

Expired checkout must be revalidated before continuing.

---

# 18. ADDRESS WORKFLOW

```text
ADD ADDRESS
 ↓
VALIDATE
 ↓
SERVICEABILITY CHECK
 ↓
SAVE
 ↓
SELECT FOR CHECKOUT
```

Address validation should consider:

* Required fields
* PIN/area
* Contact information
* Delivery coverage
* Restricted areas

---

# 19. ONLINE PAYMENT WORKFLOW

```text
CHECKOUT
 ↓
PAYMENT INITIATED
 ↓
PAYMENT PROVIDER
 ↓
CUSTOMER PAYMENT
 ↓
PROVIDER RESULT
 ↓
WEBHOOK / STATUS VERIFICATION
 ↓
BACKEND VERIFICATION
 ↓
PAYMENT CONFIRMED
 ↓
ORDER CONFIRMED
```

Frontend payment success alone must never finalize the order.

---

# 20. PAYMENT FAILURE

```text
PAYMENT_INITIATED
 ↓
PAYMENT_FAILED
```

Customer may retry where permitted.

Retry must use safe idempotency handling.

---

# 21. PAYMENT PENDING

```text
PAYMENT_INITIATED
 ↓
PAYMENT_PENDING
```

Backend waits for verified provider status.

Customer must not receive a false “successful order” state.

---

# 22. PAYMENT DUPLICATE PROTECTION

Repeated provider callbacks must produce:

```text
ONE PAYMENT RESULT
ONE ORDER EFFECT
```

not:

```text
Duplicate Payment
Duplicate Order
Duplicate Settlement
```

Idempotency is mandatory.

---

# 23. COD WORKFLOW

COD requires additional verification.

```text
CHECKOUT
 ↓
COD SELECTED
 ↓
AUTHENTICATED CUSTOMER
 ↓
ADDRESS VERIFIED
 ↓
PRIMARY MOBILE
 ↓
SECONDARY MOBILE REQUIRED
 ↓
SECONDARY OTP
 ↓
OTP VERIFIED
 ↓
COD VERIFICATION QUEUE
 ↓
SUPPORT/COD AGENT
 ↓
CALL CUSTOMER
 ↓
DECISION
```

---

# 24. COD VERIFICATION STATES

```text
NOT_REQUIRED
PENDING_CUSTOMER_OTP
OTP_VERIFIED
PENDING_AGENT_VERIFICATION
CALL_ASSIGNED
CALL_IN_PROGRESS
FOLLOW_UP_REQUIRED
CONFIRMED
REJECTED
EXPIRED
```

---

# 25. COD APPROVAL

Agent confirms:

* Customer identity/context
* Order intent
* Delivery details
* COD amount
* Required verification information

Then:

```text
COD_PENDING
 ↓
COD_CONFIRMED
 ↓
ORDER_CONFIRMED
```

---

# 26. COD REJECTION

Possible reasons:

* Customer denies placing order
* Invalid contact
* Customer unreachable after required attempts
* Address/serviceability issue
* Risk policy failure
* Duplicate/fraud suspicion
* Customer cancellation
* Other documented reason

Result:

```text
COD_PENDING
 ↓
COD_REJECTED
 ↓
ORDER_CANCELLED
```

Reason must be recorded.

---

# 27. COD FOLLOW-UP

If customer cannot be reached:

```text
CALL_ATTEMPT
 ↓
FOLLOW_UP_REQUIRED
 ↓
NEXT_CALL
```

Maximum attempts and time window must be configurable.

---

# 28. ORDER CREATION

An order may be created only after required checkout validations succeed.

```text
Checkout Valid
+
Payment Confirmed
OR
COD Verification Completed
 ↓
ORDER_CREATED
```

---

# 29. MULTI-SELLER ORDER

One customer checkout may produce:

```text
CUSTOMER ORDER
 ├── SELLER ORDER A
 ├── SELLER ORDER B
 └── SELLER ORDER C
```

Each seller order has independent fulfillment lifecycle.

---

# 30. ORDER PRIMARY STATE

Recommended lifecycle:

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

---

# 31. ORDER EXCEPTION STATES

Possible states:

```text
PAYMENT_FAILED
SELLER_REJECTED
CANCELLED
PICKUP_FAILED
DELIVERY_FAILED
RETURN_REQUESTED
RETURNED
REFUND_PENDING
REFUNDED
```

Exception states must not destroy the original history.

---

# 32. ORDER HISTORY

Every important transition records:

```text
Previous State
New State
Actor
Timestamp
Reason
Metadata
Request ID
Correlation ID
```

---

# 33. SELLER ORDER WORKFLOW

Seller receives order:

```text
SELLER_PENDING
 ↓
SELLER_REVIEW
```

Seller may:

```text
ACCEPT
OR
REJECT
```

---

# 34. SELLER ACCEPTANCE

```text
SELLER_PENDING
 ↓
SELLER_ACCEPTED
 ↓
PACKING
 ↓
READY_FOR_PICKUP
```

Seller must fulfill according to applicable SLA.

---

# 35. SELLER REJECTION

```text
SELLER_PENDING
 ↓
SELLER_REJECTED
```

Mandatory reason.

Examples:

* Out of stock
* Damaged inventory
* Operational issue
* Cannot fulfill
* Compliance issue
* Other

Customer/order compensation behavior depends on business policy.

---

# 36. SELLER PACKING

```text
SELLER_ACCEPTED
 ↓
PACKING
 ↓
PACKED
 ↓
READY_FOR_PICKUP
```

Seller must ensure:

* Correct item
* Correct variant
* Correct quantity
* Appropriate packaging
* Required label
* Required documentation

---

# 37. SHIPPING LABEL

Label may contain:

* Order reference
* Tracking reference
* Seller information
* Pickup address
* Customer delivery information required for fulfillment
* Items
* Quantity
* Variant
* Weight
* Payment type
* Barcode/QR

Sensitive information should be minimized.

---

# 38. PICKUP REQUEST

When seller marks ready:

```text
READY_FOR_PICKUP
 ↓
PICKUP_REQUESTED
 ↓
DELIVERY_ASSIGNMENT
```

---

# 39. DELIVERY ASSIGNMENT

Assignment engine evaluates:

```text
Rider Distance
+
Availability
+
Workload
+
Capacity
+
Vehicle
+
Service Area
+
ETA
+
Performance
```

Then:

```text
UNASSIGNED
 ↓
ASSIGNMENT_ATTEMPT
 ↓
RIDER_ASSIGNED
```

---

# 40. RIDER ACCEPTANCE

```text
RIDER_ASSIGNED
 ↓
RIDER_ACCEPTED
```

If rejected:

```text
RIDER_ASSIGNED
 ↓
RIDER_REJECTED
 ↓
REASSIGNMENT
```

---

# 41. PICKUP WORKFLOW

```text
RIDER_ACCEPTED
 ↓
ARRIVED_AT_PICKUP
 ↓
PICKUP_VERIFICATION
 ↓
PICKED_UP
```

Pickup may require:

* OTP
* Barcode scan
* Package verification
* Seller confirmation

Exact mechanism may depend on operational design.

---

# 42. DELIVERY WORKFLOW

```text
PICKED_UP
 ↓
OUT_FOR_DELIVERY
 ↓
ARRIVED_AT_DESTINATION
 ↓
CUSTOMER_VERIFICATION
 ↓
DELIVERED
```

Proof may include:

* OTP
* Signature
* Photo
* Delivery confirmation

Only required evidence should be collected.

---

# 43. FAILED DELIVERY

Possible reasons:

* Customer unavailable
* Wrong address
* Customer refusal
* Restricted access
* Phone unreachable
* Operational failure

Flow:

```text
OUT_FOR_DELIVERY
 ↓
DELIVERY_FAILED
 ↓
RETRY / RETURN / ESCALATE
```

Reason mandatory.

---

# 44. CUSTOMER CANCELLATION

Cancellation eligibility depends on order state.

Example:

```text
PLACED
 ↓
CANCEL_REQUESTED
 ↓
ELIGIBILITY_CHECK
 ↓
CANCELLED
```

Once fulfillment reaches certain states, cancellation may no longer be allowed and the customer may need to use the return workflow.

---

# 45. SELLER CANCELLATION

Seller cancellation should be restricted and monitored.

```text
SELLER_ACCEPTED
 ↓
SELLER_CANCEL_REQUESTED
 ↓
POLICY CHECK
 ↓
APPROVED / REJECTED
```

Repeated seller cancellations may affect seller performance.

---

# 46. RETURN REQUEST

Customer may request return after delivery when eligible.

```text
DELIVERED
 ↓
RETURN_REQUESTED
 ↓
ELIGIBILITY_CHECK
```

Eligibility may depend on:

* Category
* Seller policy
* Platform policy
* Return window
* Reason
* Item condition
* Evidence

---

# 47. RETURN ELIGIBILITY

Possible outcomes:

```text
ELIGIBLE
NOT_ELIGIBLE
MANUAL_REVIEW
```

AI may assist classification but backend policy remains authoritative.

---

# 48. RETURN APPROVAL

```text
RETURN_REQUESTED
 ↓
RETURN_APPROVED
 ↓
RETURN_PICKUP_SCHEDULED
 ↓
RETURN_PICKED_UP
 ↓
INSPECTION
 ↓
REFUND / REPLACEMENT
```

---

# 49. RETURN REJECTION

```text
RETURN_REQUESTED
 ↓
RETURN_REJECTED
```

Reason must be provided where customer-facing policy requires it.

---

# 50. RETURN PICKUP FAILURE

```text
RETURN_PICKUP_SCHEDULED
 ↓
PICKUP_FAILED
 ↓
RESCHEDULE / ESCALATE / CLOSE
```

---

# 51. RETURN INSPECTION

Inspection may be required for certain categories.

Possible result:

```text
PASS
PARTIAL_PASS
FAIL
```

Inspection decision must be traceable.

---

# 52. REPLACEMENT WORKFLOW

Where replacement is supported:

```text
RETURN_APPROVED
 ↓
REPLACEMENT_REQUESTED
 ↓
STOCK_CHECK
 ↓
REPLACEMENT_ALLOCATED
 ↓
FULFILLMENT
 ↓
DELIVERY
```

If replacement stock is unavailable:

```text
REPLACEMENT_UNAVAILABLE
 ↓
REFUND
```

---

# 53. REFUND WORKFLOW

```text
REFUND_PENDING
 ↓
REFUND_INITIATED
 ↓
PAYMENT_PROVIDER
 ↓
REFUND_PROCESSING
 ↓
REFUND_COMPLETED
```

Failure:

```text
REFUND_PROCESSING
 ↓
REFUND_FAILED
 ↓
RETRY / MANUAL_REVIEW
```

---

# 54. REFUND AMOUNT

Refund amount must be calculated by backend based on:

* Original payment
* Returned quantity
* Discount allocation
* Taxes
* Delivery charges
* Coupon rules
* Refund policy
* Seller/platform responsibility

No frontend-calculated refund is authoritative.

---

# 55. PARTIAL REFUND

Partial refund may be required for:

* Partial quantity return
* Damaged component
* Partial service issue
* Approved adjustment

Every partial refund must reference the affected order/item.

---

# 56. SUPPORT TICKET WORKFLOW

```text
OPEN
 ↓
IN_PROGRESS
 ↓
WAITING_FOR_CUSTOMER / WAITING_FOR_SELLER
 ↓
IN_PROGRESS
 ↓
RESOLVED
 ↓
CLOSED
```

Escalation:

```text
IN_PROGRESS
 ↓
ESCALATED
 ↓
SPECIALIST
 ↓
RESOLVED
```

---

# 57. SUPPORT SLA

Ticket records should track:

* Created time
* First response deadline
* Resolution deadline
* Current SLA
* Escalation status
* Assigned agent

SLA values should be configurable.

---

# 58. SUPPORT ACCESS

Support agents may access only information required for their task.

Support must not automatically gain:

* Full finance permissions
* Permission management
* Platform configuration
* Seller suspension authority
* Unrestricted customer data

---

# 59. SELLER ONBOARDING

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
APPROVED
 ↓
ACTIVE
```

Correction path:

```text
UNDER_REVIEW
 ↓
CORRECTION_REQUIRED
 ↓
RESUBMITTED
 ↓
UNDER_REVIEW
```

Exception states:

```text
REJECTED
SUSPENDED
DEACTIVATED
BLOCKED
```

---

# 60. SELLER REGISTRATION

Registration does not mean approval.

```text
REGISTERED ≠ APPROVED
```

Seller cannot perform restricted marketplace operations until required approval conditions are satisfied.

---

# 61. SELLER VALIDATION

Automatic validation may check:

* Required fields
* Duplicate seller information
* Document presence
* Basic data consistency
* Risk indicators
* Required agreements

Automatic validation must not falsely represent itself as official KYC verification.

---

# 62. SELLER REVIEW

Reviewer may:

```text
APPROVE
REJECT
REQUEST_CORRECTION
REQUEST_ADDITIONAL_INFORMATION
```

Every decision must be audited.

---

# 63. SELLER ACTIVATION

Approval:

```text
APPROVED
 ↓
ACTIVATION_CHECK
 ↓
ACTIVE
```

Activation may require:

* Required profile completion
* Required documents
* Operational setup
* Bank/payment setup where applicable
* Policies acceptance

---

# 64. SELLER SUSPENSION

Authorized control action:

```text
ACTIVE
 ↓
SUSPENDED
```

Reason mandatory.

Suspension may affect:

* Listings
* New orders
* Payouts
* Seller operations

Existing orders require explicit handling rules.

---

# 65. PRODUCT CREATION

Seller/catalog operator:

```text
DRAFT
 ↓
VALIDATION
 ↓
SUBMITTED
```

---

# 66. PRODUCT REVIEW

```text
SUBMITTED
 ↓
UNDER_REVIEW
 ↓
APPROVED
```

Correction:

```text
UNDER_REVIEW
 ↓
CORRECTION_REQUIRED
 ↓
RESUBMITTED
```

Rejection:

```text
UNDER_REVIEW
 ↓
REJECTED
```

---

# 67. PRODUCT PUBLICATION

Approval is not publication.

```text
APPROVED
 ↓
PUBLICATION_READY
 ↓
PUBLISHED
```

Suspension:

```text
PUBLISHED
 ↓
SUSPENDED
```

Recovery:

```text
SUSPENDED
 ↓
REVIEW
 ↓
PUBLISHED
```

---

# 68. LISTING WORKFLOW

Seller-specific offer:

```text
DRAFT
 ↓
SUBMITTED
 ↓
ACTIVE
```

Possible:

```text
PAUSED
SUSPENDED
EXPIRED
DEACTIVATED
```

A product can exist while its seller listing is inactive.

---

# 69. CATEGORY WORKFLOW

Category lifecycle:

```text
DRAFT
 ↓
REVIEW
 ↓
ACTIVE
```

Possible:

```text
ARCHIVED
SUSPENDED
```

Category changes must consider existing products.

---

# 70. ATTRIBUTE SCHEMA WORKFLOW

```text
CATEGORY
 ↓
ATTRIBUTE_SCHEMA
 ↓
PRODUCT_FORM
 ↓
PRODUCT_VALIDATION
```

Attributes may be:

* Required
* Optional
* Filterable
* Searchable
* Variant-defining

---

# 71. INVENTORY WORKFLOW

Inventory states may include:

```text
AVAILABLE
RESERVED
ALLOCATED
PICKED
SOLD
DAMAGED
RETURNED
QUARANTINED
```

Inventory must not be reduced merely because a customer viewed a product.

---

# 72. STOCK RESERVATION

During checkout where required:

```text
AVAILABLE
 ↓
RESERVED
```

After successful order:

```text
RESERVED
 ↓
ALLOCATED / COMMITTED
```

If checkout expires:

```text
RESERVED
 ↓
AVAILABLE
```

---

# 73. STOCK MOVEMENT

Every important inventory change should create a movement record.

Examples:

```text
PURCHASE
RESERVATION
RELEASE
SALE
RETURN
DAMAGE
ADJUSTMENT
TRANSFER
```

---

# 74. WAREHOUSE TRANSFER

```text
WAREHOUSE A
 ↓
TRANSFER_REQUESTED
 ↓
TRANSFER_IN_PROGRESS
 ↓
WAREHOUSE B
 ↓
TRANSFER_COMPLETED
```

Failure:

```text
TRANSFER_FAILED
```

---

# 75. COUPON WORKFLOW

Coupon lifecycle:

```text
DRAFT
 ↓
SCHEDULED
 ↓
ACTIVE
 ↓
EXPIRED
```

Possible:

```text
PAUSED
CANCELLED
```

---

# 76. COUPON VALIDATION

Backend validates:

* Coupon status
* Expiry
* Start date
* Customer eligibility
* Product/category eligibility
* Seller eligibility
* Minimum cart amount
* Usage limits
* Per-user limits
* Combination rules

---

# 77. COUPON ABUSE PREVENTION

The system should prevent:

* Repeated usage beyond limits
* Invalid coupon combinations
* Manipulated cart totals
* Unauthorized seller coupons
* Race conditions around usage limits

Coupon redemption must be transaction-safe where required.

---

# 78. DELIVERY PRICING WORKFLOW

Delivery price may depend on:

```text
Base Fee
+
Distance
+
Weight
+
Size
+
Zone
+
Peak Pricing
+
Special Handling
```

Backend generates final charge.

---

# 79. DELIVERY FEE SPLIT

Where applicable, track separately:

```text
Customer Delivery Charge
Seller Delivery Charge
Platform Share
Rider Earning
```

Do not collapse these into one unexplained value.

---

# 80. RIDER WORKFLOW

Rider lifecycle may include:

```text
REGISTERED
 ↓
VERIFIED
 ↓
ACTIVE
 ↓
AVAILABLE
 ↓
ASSIGNED
 ↓
BUSY
 ↓
AVAILABLE
```

Exceptions:

```text
SUSPENDED
INACTIVE
BLOCKED
```

---

# 81. RIDER AVAILABILITY

Rider can:

```text
GO_ONLINE
GO_OFFLINE
```

Assignment must respect current availability.

---

# 82. DELIVERY PROOF

Delivery completion may require configured evidence.

Examples:

* OTP
* Signature
* Photo
* Timestamp
* Location signal

The minimum required evidence should be collected.

---

# 83. FINANCE WORKFLOW

Financial lifecycle:

```text
ORDER
 ↓
REVENUE
 ↓
COMMISSION
 ↓
TAX
 ↓
DELIVERY
 ↓
REFUNDS
 ↓
ADJUSTMENTS
 ↓
SELLER PAYABLE
 ↓
SETTLEMENT
 ↓
RECONCILIATION
```

---

# 84. SETTLEMENT WORKFLOW

```text
SETTLEMENT_PENDING
 ↓
CALCULATION
 ↓
REVIEW
 ↓
APPROVED
 ↓
PROCESSING
 ↓
PAID
 ↓
RECONCILED
```

Failure:

```text
PROCESSING
 ↓
FAILED
 ↓
RETRY / MANUAL_REVIEW
```

---

# 85. FINANCIAL ADJUSTMENTS

Adjustments must never silently overwrite historical values.

Correct:

```text
Original Transaction
+
Adjustment Record
=
Current Financial Position
```

Every adjustment requires:

* Reason
* Actor
* Amount
* Reference
* Timestamp
* Audit

---

# 86. RECONCILIATION

Reconciliation compares:

```text
Bilokat Records
VS
External Provider Records
```

Examples:

* Payments
* Refunds
* Settlements

Differences enter a reconciliation queue.

---

# 87. NOTIFICATION WORKFLOW

```text
BUSINESS EVENT
 ↓
NOTIFICATION RULE
 ↓
USER PREFERENCE CHECK
 ↓
CHANNEL SELECTION
 ↓
QUEUE
 ↓
PROVIDER
 ↓
DELIVERY RESULT
```

---

# 88. NOTIFICATION FAILURE

```text
SEND
 ↓
FAILED
 ↓
RETRY
 ↓
FAILED AGAIN
 ↓
DEAD LETTER / MANUAL REVIEW
```

Important business state must not depend solely on notification success.

---

# 89. EMAIL/SMS/WHATSAPP PRINCIPLE

Notification delivery is a side effect.

Example:

```text
ORDER_CONFIRMED
```

must remain confirmed even if:

```text
SMS_FAILED
```

---

# 90. AUDIT WORKFLOW

High-risk action:

```text
USER ACTION
 ↓
AUTHORIZATION
 ↓
CONFIRMATION
 ↓
BUSINESS ACTION
 ↓
AUDIT EVENT
```

Audit must include enough information to reconstruct the action.

---

# 91. HIGH-RISK ADMIN ACTION

Examples:

* Seller suspension
* Seller activation
* Product suspension
* Refund override
* Settlement adjustment
* Permission change
* Platform configuration
* Emergency controls

May require:

```text
Strong Authentication
+
Fine-Grained Permission
+
Step-Up Authentication
+
Reason
+
Confirmation
+
Audit
```

depending on risk level.

---

# 92. CONTROL OVERRIDE

An override must never mean:

```text
Admin can do anything without rules.
```

Instead:

```text
Authorized Override
+
Reason
+
Validation
+
Audit
+
Scope
```

---

# 93. EMERGENCY WORKFLOW

For severe incidents:

```text
INCIDENT DETECTED
 ↓
ASSESSMENT
 ↓
EMERGENCY CONTROL
 ↓
MITIGATION
 ↓
MONITORING
 ↓
RECOVERY
 ↓
POST-INCIDENT REVIEW
```

Examples:

* Disable compromised seller
* Pause suspicious coupon
* Disable affected payment provider
* Pause unsafe listing
* Restrict affected delivery zone

---

# 94. AI ASSISTIVE WORKFLOW

AI may assist:

```text
Business Data
 ↓
AI Analysis
 ↓
Recommendation
 ↓
Human/System Validation
 ↓
Business Action
```

AI output must not automatically become authoritative state unless that specific low-risk automation has been explicitly approved.

---

# 95. AI CUSTOMER ASSISTANT

Customer:

```text
QUESTION
 ↓
AI INTENT
 ↓
AUTHORIZED DATA RETRIEVAL
 ↓
RESPONSE
```

For actions:

```text
Customer Request
 ↓
AI Understands Intent
 ↓
Structured Action
 ↓
Backend Authorization
 ↓
Business Rule Validation
 ↓
Execution
```

---

# 96. AI PRODUCT CATEGORIZATION

```text
Product Content
 ↓
AI Classification
 ↓
Suggested Category
 ↓
Confidence
 ↓
Rule Validation
 ↓
Human Review where required
 ↓
Final Category
```

AI must not silently publish prohibited or invalid products.

---

# 97. AI LISTING QUALITY

AI may analyze:

* Title
* Description
* Images
* Attributes
* Category
* Duplicate similarity

Output:

```text
QUALITY_SCORE
+
ISSUES
+
SUGGESTIONS
```

Final approval remains controlled by business workflow.

---

# 98. AI SUPPORT ASSISTANCE

AI may:

* Classify tickets
* Summarize conversations
* Suggest responses
* Retrieve policy information
* Identify escalation risk

Agent remains responsible for high-impact decisions unless explicit automation is approved.

---

# 99. AI FRAUD/RISK WORKFLOW

```text
Transaction/Event
 ↓
Risk Signals
 ↓
AI/ML Analysis
 ↓
Risk Score
 ↓
Deterministic Policy
 ↓
ALLOW / REVIEW / BLOCK
```

AI score alone must not bypass policy and authorization.

---

# 100. ANALYTICS WORKFLOW

Operational event:

```text
EVENT
 ↓
QUEUE / PIPELINE
 ↓
PROCESSING
 ↓
ANALYTICS STORAGE
 ↓
AGGREGATION
 ↓
DASHBOARD
```

Analytics must not block core commerce.

---

# 101. SEARCH INDEX WORKFLOW

```text
Catalog Change
 ↓
Event
 ↓
Index Worker
 ↓
Search Index
```

If indexing fails:

```text
RETRY
 ↓
DEAD LETTER / REINDEX QUEUE
```

The database remains authoritative.

---

# 102. PRODUCT REINDEX

Authorized operator may trigger:

```text
FULL REINDEX
PARTIAL REINDEX
FAILED ITEM REINDEX
```

Reindex must be safe to repeat.

---

# 103. ACCOUNT SECURITY WORKFLOW

Suspicious account:

```text
RISK SIGNAL
 ↓
REVIEW
 ↓
ADDITIONAL VERIFICATION
 ↓
ALLOW
OR
RESTRICT
OR
SUSPEND
```

Security controls should not unnecessarily lock legitimate users.

---

# 104. PASSWORD RESET

Where password authentication exists:

```text
RESET REQUEST
 ↓
RATE LIMIT
 ↓
IDENTITY/CONTACT VERIFICATION
 ↓
SHORT-LIVED RESET TOKEN
 ↓
NEW PASSWORD
 ↓
SESSION REVOCATION
```

Reset tokens must be single-use and expire.

---

# 105. OTP WORKFLOW

```text
OTP_REQUESTED
 ↓
RATE_LIMIT_CHECK
 ↓
OTP_SENT
 ↓
OTP_ENTERED
 ↓
VERIFICATION
 ↓
VERIFIED / FAILED / EXPIRED
```

OTP values must never be stored/logged in plaintext unnecessarily.

---

# 106. DOCUMENT REVIEW

Sensitive seller documents:

```text
UPLOAD
 ↓
FILE VALIDATION
 ↓
SECURITY SCAN
 ↓
OCR/AI ASSISTANCE
 ↓
REVIEW
 ↓
APPROVED / REJECTED / CORRECTION
```

Documents must remain protected.

---

# 107. ERROR RECOVERY PRINCIPLE

Every critical workflow must define:

```text
Normal Path
Failure Path
Retry Path
Manual Review Path
Recovery Path
```

---

# 108. EXTERNAL PROVIDER FAILURE

Example payment provider failure:

```text
PAYMENT REQUEST
 ↓
PROVIDER TIMEOUT
 ↓
PAYMENT_PENDING
 ↓
STATUS VERIFICATION
 ↓
CONFIRMED / FAILED
```

Never immediately assume failure when provider status is unknown.

---

# 109. DUPLICATE REQUEST HANDLING

Repeated customer requests must not produce duplicate business outcomes.

Examples:

```text
Double-click Pay
Double-click Place Order
Duplicate Webhook
Duplicate Refund Callback
Duplicate Seller Accept
```

Use idempotency and state validation.

---

# 110. CONCURRENT ACTIONS

If two actors act simultaneously:

```text
Seller Accept
+
Admin Suspend Seller
```

the backend must resolve the race using transactional/state rules.

The final state must be deterministic and auditable.

---

# 111. STALE FRONTEND STATE

If frontend displays:

```text
Seller = ACTIVE
```

but backend has changed it to:

```text
SUSPENDED
```

the backend must reject actions that are no longer valid.

Frontend should refresh/update after receiving authoritative response.

---

# 112. BUSINESS EVENT PRINCIPLE

Important successful transitions emit events.

Examples:

```text
USER_REGISTERED
SELLER_SUBMITTED
SELLER_APPROVED
SELLER_REJECTED
PRODUCT_CREATED
PRODUCT_APPROVED
PRODUCT_PUBLISHED
PRODUCT_SUSPENDED
ORDER_CREATED
PAYMENT_CONFIRMED
PAYMENT_FAILED
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
SETTLEMENT_COMPLETED
```

---

# 113. EVENT ORDERING

Where ordering matters, consumers must respect business sequence.

Example:

```text
PAYMENT_CONFIRMED
```

must not be processed as if it happened after:

```text
ORDER_CANCELLED
```

without explicit conflict handling.

---

# 114. EVENT RETRIES

Repeated events must be safe.

Example:

```text
ORDER_DELIVERED
ORDER_DELIVERED
```

must not create two settlement records.

---

# 115. WORKFLOW OWNERSHIP

Every workflow must have a domain owner.

| Workflow          | Owner          |
| ----------------- | -------------- |
| Authentication    | Auth           |
| Seller onboarding | Seller         |
| Product approval  | Catalog        |
| Listing           | Listing        |
| Inventory         | Inventory      |
| Checkout          | Checkout       |
| Payment           | Payment        |
| Order             | Order          |
| Delivery          | Delivery       |
| Return            | Return         |
| Refund            | Refund/Finance |
| Support           | Support        |
| Settlement        | Finance        |
| Notification      | Notification   |
| Search            | Search         |
| AI                | AI             |
| Analytics         | Analytics      |

---

# 116. CROSS-DOMAIN WORKFLOW

Cross-domain workflows should use:

```text
Domain Command
+
Transaction
+
Event
+
Consumer
```

Avoid uncontrolled direct mutation across modules.

---

# 117. CUSTOMER ORDER END-TO-END

Complete successful online flow:

```text
Customer
 ↓
Browse
 ↓
Product
 ↓
Cart
 ↓
Checkout
 ↓
Authentication
 ↓
Address
 ↓
Price Validation
 ↓
Stock Validation
 ↓
Payment
 ↓
Payment Verification
 ↓
Order Created
 ↓
Seller Accepts
 ↓
Seller Packs
 ↓
Ready for Pickup
 ↓
Rider Assigned
 ↓
Pickup
 ↓
Out for Delivery
 ↓
Delivered
 ↓
Settlement
```

---

# 118. CUSTOMER COD END-TO-END

```text
Browse
 ↓
Cart
 ↓
Checkout
 ↓
Login
 ↓
Address
 ↓
COD
 ↓
Secondary Mobile
 ↓
OTP
 ↓
COD Queue
 ↓
Agent Verification
 ↓
Confirmed
 ↓
Seller Fulfillment
 ↓
Rider
 ↓
Delivery
 ↓
COD Collection
 ↓
Settlement
```

---

# 119. CUSTOMER RETURN END-TO-END

```text
Delivered
 ↓
Return Request
 ↓
Eligibility
 ↓
Approval
 ↓
Pickup
 ↓
Inspection if required
 ↓
Refund/Replacement
 ↓
Completion
```

---

# 120. SELLER END-TO-END

```text
Register
 ↓
Profile
 ↓
Documents
 ↓
Submit
 ↓
Review
 ↓
Approval
 ↓
Activation
 ↓
Product Creation
 ↓
Catalog Review
 ↓
Publication
 ↓
Receive Order
 ↓
Accept
 ↓
Pack
 ↓
Ready
 ↓
Pickup
 ↓
Settlement
```

---

# 121. CONTROL ADMIN END-TO-END

```text
Login
 ↓
Strong Authentication
 ↓
Permission Check
 ↓
Resource Selection
 ↓
Action
 ↓
Validation
 ↓
Confirmation
 ↓
Execution
 ↓
Audit
 ↓
Notification/Alert where applicable
```

---

# 122. FINANCE END-TO-END

```text
Order
 ↓
Payment
 ↓
Revenue
 ↓
Commission
 ↓
Tax
 ↓
Delivery
 ↓
Refund/Adjustment
 ↓
Seller Payable
 ↓
Settlement
 ↓
Provider Reconciliation
 ↓
Completed
```

---

# 123. WORKFLOW DESIGN RULE

No critical business workflow should depend exclusively on:

* Browser state
* JavaScript state
* Client-side timers
* Client-side calculations
* AI output
* Notification delivery
* Search index
* Cache

Authoritative workflow state belongs to the backend/database.

---

# 124. STATE TRANSITION AUDIT

For critical transitions:

```text
Entity ID
Previous State
New State
Actor ID
Actor Type
Reason
Timestamp
Request ID
Correlation ID
Metadata
```

must be available according to the audit policy.

---

# 125. MANUAL REVIEW QUEUES

The system should support queues for:

* Seller review
* Product review
* COD verification
* Refund review
* Reconciliation
* Fraud/risk review
* Support escalation
* Delivery exceptions

Queues must support assignment and status tracking.

---

# 126. ESCALATION

Escalation can occur because of:

* SLA breach
* High financial impact
* Security risk
* Customer complaint
* Repeated operational failure
* Manual reviewer decision

Escalation must preserve original ownership/history.

---

# 127. MANUAL CORRECTIONS

Manual correction must never erase history.

Example:

```text
Incorrect Order State
 ↓
Correction Request
 ↓
Authorized Review
 ↓
Correction
 ↓
Audit
```

---

# 128. BUSINESS RULE PRIORITY

When rules conflict:

```text
Legal/Safety Requirements
        ↓
Platform Security
        ↓
Financial Integrity
        ↓
Explicit Business Policy
        ↓
Operational Optimization
        ↓
AI Recommendation
```

AI never outranks security, authorization, or mandatory business rules.

---

# 129. AI FAILURE RULE

If AI is unavailable:

```text
Core Commerce = CONTINUES
```

Examples:

* Product search falls back to normal search
* Recommendations disappear/fallback
* Support agent can respond manually
* Product categorization can be manually performed
* Analytics continues independently

---

# 130. SEARCH FAILURE RULE

If search service fails:

```text
Search Failure
 ↓
Fallback Search / Category Browsing
```

Search outage must not corrupt catalog.

---

# 131. NOTIFICATION FAILURE RULE

If notification fails:

```text
Business Transaction = SUCCESS
Notification = RETRY
```

Notification delivery must not reverse completed commerce transactions.

---

# 132. CACHE FAILURE RULE

If Redis fails:

```text
Cache unavailable
 ↓
Database-backed fallback where safe
```

Critical business state must remain available from authoritative storage.

---

# 133. EVENT FAILURE RULE

If event delivery fails:

```text
Transaction
 ↓
Outbox
 ↓
Retry
```

Do not silently discard critical events.

---

# 134. DATA CONSISTENCY

Strong consistency is preferred for:

* Payments
* Orders
* Inventory reservations
* Refunds
* Settlements
* Permissions

Eventual consistency is acceptable for:

* Search index
* Recommendations
* Analytics
* Some notifications
* Derived dashboards

---

# 135. BUSINESS COMPLETION DEFINITION

A workflow is complete only when:

```text
Happy Path
+
Failure Path
+
Validation
+
Authorization
+
State Transition
+
Event
+
Audit
+
Notification where required
+
Retry
+
Recovery
+
Testing
```

have been implemented where applicable.

---

# 136. WORKFLOW TEST REQUIREMENTS

Minimum critical E2E scenarios:

```text
Customer Browse → Cart → Login → Checkout → Payment → Order

Guest Cart → Login → Merge → Checkout

COD → Secondary OTP → Agent Verification → Order

Seller Register → Submit → Review → Approve → Activate

Product Create → Submit → Review → Approve → Publish

Seller Accept → Pack → Ready → Rider → Pickup → Delivery

Return → Approval → Pickup → Refund

Settlement → Reconciliation
```

---

# 137. PROHIBITED WORKFLOW SHORTCUTS

The following are prohibited:

```text
Frontend directly changing order state
Frontend calculating authoritative payment total
Frontend approving seller
Frontend publishing product
AI directly changing settlement
AI directly issuing refund
Support bypassing permissions
Admin actions without audit
Payment success based only on browser response
Stock deduction without concurrency protection
Refund without financial record
Silent state overwrite
```

---

# 138. FINAL WORKFLOW MODEL

Bilokat should operate according to:

```text
USER ACTION
     ↓
AUTHENTICATION
     ↓
AUTHORIZATION
     ↓
VALIDATION
     ↓
BUSINESS RULE
     ↓
STATE MACHINE
     ↓
DATABASE TRANSACTION
     ↓
OUTBOX / EVENT
     ↓
ASYNC SIDE EFFECTS
     ↓
NOTIFICATION
     ↓
AUDIT
     ↓
OBSERVABILITY
```

---

# 139. WORKFLOW STATUS

```text
Customer Workflow       = DEFINED
Seller Workflow         = DEFINED
Catalog Workflow        = DEFINED
Listing Workflow        = DEFINED
Inventory Workflow      = DEFINED
Checkout Workflow       = DEFINED
Payment Workflow        = DEFINED
COD Workflow            = DEFINED
Order Workflow          = DEFINED
Fulfillment Workflow    = DEFINED
Delivery Workflow       = DEFINED
Return Workflow         = DEFINED
Refund Workflow         = DEFINED
Support Workflow        = DEFINED
Finance Workflow        = DEFINED
Settlement Workflow     = DEFINED
Notification Workflow   = DEFINED
AI Workflow              = DEFINED
Analytics Workflow      = DEFINED
Exception Handling      = DEFINED

Actual Implementation   = NOT STARTED
```

---

# 140. NEXT DOCUMENT

The next document is:

```text
03-DATABASE-DESIGN.md
```

It must convert these workflows into an implementation-ready data model.

It must define:

* Tables/entities
* Columns
* Types
* Primary keys
* Foreign keys
* Unique constraints
* Indexes
* Enums
* Relationships
* Ownership
* Audit fields
* Soft deletion strategy
* Timestamps
* Money representation
* Order structure
* Seller structure
* Product/catalog structure
* Listing structure
* Inventory structure
* Payment structure
* COD structure
* Delivery structure
* Return/refund structure
* Support structure
* Finance/settlement structure
* Notification structure
* AI records
* Event/outbox structure
* Security/session structure
* Database integrity rules

No production implementation should begin until the database design is sufficiently defined and reviewed.
