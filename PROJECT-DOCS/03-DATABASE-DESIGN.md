
# BILOKAT — DATABASE DESIGN

> Document Type: Database Architecture & Data Model Specification
> Project: Bilokat
> Version: 1.0.0
> Parent Documents: `00-MASTER-SPEC.md`, `01-ARCHITECTURE.md`, `02-BUSINESS-WORKFLOWS.md`
> Status: Database Foundation
> Implementation Status: Not Started
> Last Updated: 2026-09-07

---

# 1. PURPOSE

This document defines the authoritative transactional data model for Bilokat.

It specifies:

* Entities
* Tables
* Columns
* Data types
* Primary keys
* Foreign keys
* Relationships
* Constraints
* Indexes
* Enumerations
* Ownership
* Lifecycle state storage
* Audit fields
* Money representation
* Inventory representation
* Order architecture
* Payment architecture
* COD architecture
* Delivery architecture
* Return/refund architecture
* Support architecture
* Finance architecture
* Settlement architecture
* Notification architecture
* AI records
* Event/outbox records
* Security/session records
* Database integrity rules

This document must be used together with:

```text
00-MASTER-SPEC.md
01-ARCHITECTURE.md
02-BUSINESS-WORKFLOWS.md
```

---

# 2. DATABASE PRINCIPLE

PostgreSQL is the primary transactional source of truth.

The database must protect business integrity even if:

* Frontend is compromised
* API request is malformed
* Multiple requests arrive simultaneously
* Worker retries occur
* Webhook is duplicated
* Cache is stale
* Search index is outdated
* AI produces an incorrect recommendation
* An administrator makes an invalid request

---

# 3. DATABASE TECHNOLOGY

Primary database:

```text
PostgreSQL
```

Application data access:

```text
Prisma
```

The exact versions must be selected and verified during implementation.

---

# 4. DATABASE NAMING

Recommended conventions:

```text
Tables:
snake_case

Columns:
snake_case

Primary keys:
id

Foreign keys:
<entity>_id

Created:
created_at

Updated:
updated_at
```

Example:

```text
seller_id
product_id
created_at
updated_at
```

---

# 5. IDENTIFIER STRATEGY

Every major entity should have a unique internal identifier.

Recommended:

```text
UUID
```

or another secure globally unique identifier strategy.

Public identifiers may be separate from internal database identifiers when enumeration protection or business requirements justify it.

---

# 6. PRIMARY KEY RULE

Every major table must have:

```text
PRIMARY KEY (id)
```

Primary keys must be immutable.

Changing an entity's ID is not a normal business operation.

---

# 7. TIMESTAMP RULE

Major entities should contain:

```text
created_at
updated_at
```

Lifecycle records should additionally contain appropriate timestamps.

Example:

```text
approved_at
published_at
cancelled_at
delivered_at
```

Do not use frontend timestamps as authoritative business timestamps.

---

# 8. TIME STANDARD

Database timestamps should use UTC.

Business presentation may convert timestamps to local timezone.

Time-sensitive business rules must use backend/database time.

---

# 9. SOFT DELETE PRINCIPLE

Soft deletion should be used only where historical/business integrity requires retention.

Potential fields:

```text
deleted_at
deleted_by
```

Do not automatically add soft-delete columns to every table.

Financial and audit records should generally not be physically deleted.

---

# 10. CORE ENTITY MAP

High-level structure:

```text
User
 │
 ├── Organization
 │      │
 │      └── Seller
 │
 └── Customer Profile
        │
        ├── Address
        ├── Cart
        ├── Order
        ├── Review
        └── Support Ticket

Seller
 │
 ├── Seller Documents
 ├── Seller Warehouses
 ├── Product Listings
 ├── Inventory
 └── Settlements

Catalog
 │
 ├── Category
 ├── Attribute Schema
 ├── Product
 ├── Variant
 └── Media

Product
 │
 └── Listing
        │
        └── Inventory

Customer Order
 │
 ├── Seller Orders
 │      ├── Order Items
 │      ├── Fulfillment
 │      └── Delivery
 │
 ├── Payment
 ├── Return
 └── Refund
```

---

# 11. CORE TABLE GROUPS

## Identity

```text
users
user_profiles
user_sessions
user_devices
user_verification_attempts
```

## Authorization

```text
roles
permissions
role_permissions
user_roles
organization_roles
```

## Organizations

```text
organizations
organization_members
```

## Seller

```text
sellers
seller_profiles
seller_applications
seller_documents
seller_reviews
seller_status_history
```

## Catalog

```text
categories
category_attribute_schemas
attributes
attribute_options
products
product_variants
product_attributes
product_media
```

## Listings

```text
listings
listing_prices
listing_status_history
```

## Inventory

```text
warehouses
warehouse_members
inventory_items
inventory_reservations
inventory_movements
inventory_batches
inventory_transfers
```

## Commerce

```text
carts
cart_items
checkout_sessions
orders
seller_orders
order_items
order_status_history
```

## Payments

```text
payments
payment_attempts
payment_webhooks
payment_transactions
```

## COD

```text
cod_verifications
cod_attempts
cod_notes
```

## Coupons

```text
coupons
coupon_rules
coupon_redemptions
```

## Delivery

```text
delivery_zones
delivery_partners
delivery_partner_profiles
delivery_assignments
delivery_events
delivery_pricing
proof_of_delivery
```

## Returns

```text
return_requests
return_items
return_events
return_inspections
```

## Refunds

```text
refunds
refund_transactions
```

## Support

```text
support_tickets
support_messages
support_assignments
support_events
support_attachments
```

## Finance

```text
financial_transactions
ledger_entries
seller_payables
settlements
settlement_items
settlement_adjustments
reconciliation_records
```

## Notifications

```text
notification_templates
notifications
notification_deliveries
notification_preferences
```

## Events

```text
outbox_events
event_processing_records
```

## Audit

```text
audit_logs
```

## AI

```text
ai_requests
ai_outputs
ai_tool_calls
ai_feedback
ai_usage_records
```

## Analytics

```text
analytics_events
```

---

# 12. USER ENTITY

Table:

```text
users
```

Purpose:

Stores identity-level information.

Recommended fields:

```text
id
email
phone
password_hash
status
email_verified_at
phone_verified_at
last_login_at
created_at
updated_at
deleted_at
```

Do not store plaintext passwords.

---

# 13. USER STATUS

Recommended enum:

```text
PENDING
ACTIVE
SUSPENDED
BLOCKED
DEACTIVATED
```

The exact lifecycle may evolve.

---

# 14. USER PROFILE

Table:

```text
user_profiles
```

Possible fields:

```text
id
user_id
first_name
last_name
display_name
date_of_birth
avatar_media_id
preferred_language
preferred_currency
created_at
updated_at
```

Only collect information actually required by the business.

---

# 15. USER SESSION

Table:

```text
user_sessions
```

Possible fields:

```text
id
user_id
session_identifier
device_id
ip_hash_or_metadata
user_agent_metadata
created_at
last_seen_at
expires_at
revoked_at
```

Do not store unnecessary sensitive network information.

---

# 16. USER DEVICES

Table:

```text
user_devices
```

Possible fields:

```text
id
user_id
device_identifier
platform
app_version
last_seen_at
created_at
updated_at
```

Device identifiers must follow applicable privacy/security requirements.

---

# 17. ORGANIZATION

Table:

```text
organizations
```

Purpose:

Supports future business structures.

Fields:

```text
id
name
slug
type
status
created_at
updated_at
```

Possible organization types:

```text
SELLER
INTERNAL
PARTNER
OTHER
```

---

# 18. ORGANIZATION MEMBERS

Table:

```text
organization_members
```

Fields:

```text
id
organization_id
user_id
status
joined_at
created_at
updated_at
```

Constraint:

```text
UNIQUE (organization_id, user_id)
```

---

# 19. ROLES

Table:

```text
roles
```

Fields:

```text
id
name
scope
description
is_system_role
created_at
updated_at
```

---

# 20. PERMISSIONS

Table:

```text
permissions
```

Fields:

```text
id
code
description
resource
action
created_at
```

Example:

```text
seller.product.read
seller.product.create
seller.product.update
seller.product.submit
seller.order.read
seller.order.accept
seller.order.reject
catalog.product.approve
catalog.product.reject
finance.refund.approve
control.seller.suspend
```

---

# 21. ROLE-PERMISSION

Table:

```text
role_permissions
```

Fields:

```text
role_id
permission_id
```

Constraint:

```text
UNIQUE (role_id, permission_id)
```

---

# 22. USER ROLE

Table:

```text
user_roles
```

Fields:

```text
id
user_id
role_id
organization_id
granted_by
created_at
expires_at
```

A role may optionally be scoped to an organization.

---

# 23. SELLER

Table:

```text
sellers
```

Purpose:

Represents marketplace seller organization.

Fields:

```text
id
organization_id
seller_code
legal_name
display_name
status
approval_status
activated_at
suspended_at
created_at
updated_at
```

---

# 24. SELLER STATUS

Possible states:

```text
REGISTERED
PROFILE_INCOMPLETE
APPLICATION_SUBMITTED
UNDER_REVIEW
CORRECTION_REQUIRED
RESUBMITTED
APPROVED
ACTIVE
REJECTED
SUSPENDED
DEACTIVATED
BLOCKED
```

---

# 25. SELLER APPLICATION

Table:

```text
seller_applications
```

Fields:

```text
id
seller_id
application_number
status
submitted_at
reviewed_at
reviewed_by
rejection_reason
correction_reason
created_at
updated_at
```

---

# 26. SELLER DOCUMENT

Table:

```text
seller_documents
```

Fields:

```text
id
seller_id
document_type
storage_object_id
status
uploaded_at
verified_at
verified_by
rejection_reason
created_at
updated_at
```

Sensitive documents must reference private storage.

---

# 27. SELLER REVIEW

Table:

```text
seller_reviews
```

Fields:

```text
id
seller_application_id
reviewer_id
decision
reason
notes
created_at
```

Possible decisions:

```text
APPROVE
REJECT
CORRECTION_REQUIRED
ADDITIONAL_INFORMATION_REQUIRED
```

---

# 28. SELLER STATUS HISTORY

Table:

```text
seller_status_history
```

Fields:

```text
id
seller_id
previous_status
new_status
changed_by
reason
metadata
created_at
```

This preserves lifecycle history.

---

# 29. CATEGORY

Table:

```text
categories
```

Fields:

```text
id
parent_id
name
slug
description
status
sort_order
path
created_at
updated_at
deleted_at
```

Self-reference:

```text
parent_id → categories.id
```

---

# 30. CATEGORY STATUS

```text
DRAFT
REVIEW
ACTIVE
SUSPENDED
ARCHIVED
```

---

# 31. ATTRIBUTE

Table:

```text
attributes
```

Fields:

```text
id
name
code
data_type
unit
is_filterable
is_searchable
created_at
updated_at
```

Possible data types:

```text
TEXT
NUMBER
BOOLEAN
DATE
ENUM
MULTI_ENUM
```

---

# 32. ATTRIBUTE OPTIONS

Table:

```text
attribute_options
```

Fields:

```text
id
attribute_id
value
display_label
sort_order
created_at
```

---

# 33. CATEGORY ATTRIBUTE SCHEMA

Table:

```text
category_attribute_schemas
```

Fields:

```text
id
category_id
attribute_id
is_required
is_variant_defining
is_filterable
is_searchable
sort_order
validation_rules
created_at
updated_at
```

Constraint:

```text
UNIQUE (category_id, attribute_id)
```

---

# 34. PRODUCT

Table:

```text
products
```

Fields:

```text
id
product_code
name
slug
description
category_id
brand_id
status
approval_status
created_by
approved_by
approved_at
created_at
updated_at
deleted_at
```

Product is catalog identity.

It is not a seller listing.

---

# 35. PRODUCT STATUS

Possible states:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
CORRECTION_REQUIRED
APPROVED
REJECTED
SUSPENDED
ARCHIVED
```

---

# 36. PRODUCT VARIANT

Table:

```text
product_variants
```

Fields:

```text
id
product_id
variant_code
sku_reference
name
status
weight
length
width
height
created_at
updated_at
```

Variant-defining attributes determine variant differences.

---

# 37. PRODUCT ATTRIBUTE

Table:

```text
product_attributes
```

Fields:

```text
id
product_id
attribute_id
value_text
value_number
value_boolean
value_date
option_id
created_at
updated_at
```

Only appropriate value columns should be populated based on attribute type.

---

# 38. PRODUCT MEDIA

Table:

```text
product_media
```

Fields:

```text
id
product_id
variant_id
storage_object_id
media_type
sort_order
alt_text
status
created_at
updated_at
```

Possible media:

```text
IMAGE
VIDEO
DOCUMENT
```

---

# 39. LISTING

Table:

```text
listings
```

Purpose:

Seller-specific offer for a product/variant.

Fields:

```text
id
seller_id
product_id
variant_id
listing_code
status
seller_sku
price
mrp
currency
minimum_quantity
maximum_quantity
created_at
updated_at
```

---

# 40. LISTING STATUS

```text
DRAFT
SUBMITTED
ACTIVE
PAUSED
SUSPENDED
EXPIRED
DEACTIVATED
```

---

# 41. LISTING PRICE HISTORY

Table:

```text
listing_prices
```

Fields:

```text
id
listing_id
price
mrp
currency
effective_from
effective_to
changed_by
reason
created_at
```

Important price changes should be historically traceable.

---

# 42. LISTING STATUS HISTORY

Table:

```text
listing_status_history
```

Fields:

```text
id
listing_id
previous_status
new_status
changed_by
reason
created_at
```

---

# 43. WAREHOUSE

Table:

```text
warehouses
```

Fields:

```text
id
seller_id
name
code
address_id
status
capacity
created_at
updated_at
```

---

# 44. WAREHOUSE STATUS

```text
ACTIVE
INACTIVE
SUSPENDED
CLOSED
```

---

# 45. INVENTORY ITEM

Table:

```text
inventory_items
```

Fields:

```text
id
warehouse_id
listing_id
variant_id
available_quantity
reserved_quantity
allocated_quantity
damaged_quantity
quarantined_quantity
created_at
updated_at
```

Recommended constraint:

```text
available_quantity >= 0
reserved_quantity >= 0
allocated_quantity >= 0
damaged_quantity >= 0
quarantined_quantity >= 0
```

---

# 46. INVENTORY RESERVATION

Table:

```text
inventory_reservations
```

Fields:

```text
id
inventory_item_id
checkout_session_id
order_id
quantity
status
expires_at
created_at
released_at
```

Possible states:

```text
ACTIVE
CONVERTED
RELEASED
EXPIRED
CANCELLED
```

---

# 47. INVENTORY MOVEMENT

Table:

```text
inventory_movements
```

Fields:

```text
id
inventory_item_id
movement_type
quantity
reference_type
reference_id
previous_available
new_available
previous_reserved
new_reserved
actor_id
reason
created_at
```

Movement types:

```text
PURCHASE
RESERVATION
RELEASE
SALE
RETURN
DAMAGE
ADJUSTMENT
TRANSFER_OUT
TRANSFER_IN
```

---

# 48. INVENTORY BATCH

For batch-sensitive categories:

```text
inventory_batches
```

Fields:

```text
id
inventory_item_id
batch_number
manufacturing_date
expiry_date
quantity
status
created_at
updated_at
```

---

# 49. INVENTORY TRANSFER

Table:

```text
inventory_transfers
```

Fields:

```text
id
source_warehouse_id
destination_warehouse_id
status
requested_by
approved_by
started_at
completed_at
created_at
updated_at
```

---

# 50. INVENTORY CONCURRENCY

Stock operations must use transactional protection.

Example:

```text
available_quantity = 1
```

Two simultaneous purchases must not both successfully reserve the same unit.

Database transaction/locking strategy must guarantee:

```text
available_quantity >= 0
```

and correct reservation accounting.

---

# 51. CART

Table:

```text
carts
```

Fields:

```text
id
user_id
guest_session_id
status
currency
created_at
updated_at
expires_at
```

A cart may be associated with either an authenticated user or temporary guest session according to business rules.

---

# 52. CART STATUS

```text
ACTIVE
CONVERTED
ABANDONED
EXPIRED
MERGED
```

---

# 53. CART ITEM

Table:

```text
cart_items
```

Fields:

```text
id
cart_id
listing_id
variant_id
quantity
created_at
updated_at
```

Constraint:

```text
UNIQUE (cart_id, listing_id, variant_id)
```

where applicable.

---

# 54. CHECKOUT SESSION

Table:

```text
checkout_sessions
```

Fields:

```text
id
user_id
cart_id
status
currency
expires_at
created_at
updated_at
```

---

# 55. CHECKOUT STATUS

```text
ACTIVE
PAYMENT_PENDING
COMPLETED
EXPIRED
CANCELLED
```

---

# 56. CHECKOUT SNAPSHOT

Critical checkout information should be captured in an appropriate immutable/snapshot structure.

Examples:

```text
price
tax
discount
delivery_charge
coupon
final_total
```

The exact snapshot model must be finalized during implementation.

---

# 57. ORDER

Table:

```text
orders
```

Purpose:

Customer-facing parent order.

Fields:

```text
id
order_number
user_id
status
currency
subtotal
discount_total
tax_total
delivery_total
grand_total
payment_method
payment_status
placed_at
cancelled_at
delivered_at
created_at
updated_at
```

---

# 58. ORDER STATUS

Primary states:

```text
PLACED
PAYMENT_CONFIRMED
SELLER_PENDING
SELLER_ACCEPTED
PICKUP_REQUESTED
READY_FOR_PICKUP
PICKED_UP
OUT_FOR_DELIVERY
DELIVERED
SETTLEMENT_PENDING
SETTLED
```

Exception states may include:

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

---

# 59. SELLER ORDER

Table:

```text
seller_orders
```

Fields:

```text
id
order_id
seller_id
seller_order_number
status
subtotal
discount_total
tax_total
delivery_total
grand_total
seller_amount
accepted_at
rejected_at
rejection_reason
created_at
updated_at
```

One customer order may contain multiple seller orders.

---

# 60. ORDER ITEM

Table:

```text
order_items
```

Fields:

```text
id
seller_order_id
listing_id
product_id
variant_id
product_name_snapshot
variant_name_snapshot
sku_snapshot
seller_name_snapshot
quantity
unit_price
discount_amount
tax_amount
line_total
created_at
updated_at
```

Snapshots are important because catalog data may change after purchase.

---

# 61. ORDER ADDRESS SNAPSHOT

Orders should retain the delivery address used at purchase.

Possible table:

```text
order_addresses
```

Fields:

```text
id
order_id
type
name
phone
address_line_1
address_line_2
city
state
postal_code
country
latitude
longitude
created_at
```

The exact retention of precise location data must follow privacy requirements.

---

# 62. ORDER STATUS HISTORY

Table:

```text
order_status_history
```

Fields:

```text
id
order_id
previous_status
new_status
actor_type
actor_id
reason
metadata
created_at
```

---

# 63. ORDER CANCELLATION

Table:

```text
order_cancellations
```

Fields:

```text
id
order_id
requested_by
reason_code
reason
status
approved_by
created_at
completed_at
```

This keeps cancellation information separate from general status history.

---

# 64. PAYMENT

Table:

```text
payments
```

Fields:

```text
id
order_id
payment_reference
provider
method
status
amount
currency
provider_payment_id
created_at
updated_at
confirmed_at
failed_at
```

Never store raw card/payment credentials.

---

# 65. PAYMENT STATUS

```text
INITIATED
PENDING
AUTHORIZED
CONFIRMED
FAILED
CANCELLED
EXPIRED
PARTIALLY_REFUNDED
REFUNDED
```

Exact gateway mapping must be defined during implementation.

---

# 66. PAYMENT ATTEMPT

Table:

```text
payment_attempts
```

Fields:

```text
id
payment_id
attempt_number
provider
provider_reference
status
failure_code
failure_reason
created_at
completed_at
```

---

# 67. PAYMENT WEBHOOK

Table:

```text
payment_webhooks
```

Fields:

```text
id
provider
provider_event_id
event_type
signature_verified
payload_hash
processing_status
received_at
processed_at
failure_reason
```

Constraint:

```text
UNIQUE(provider, provider_event_id)
```

where provider event IDs are reliable.

Raw sensitive payload storage must follow security/privacy policy.

---

# 68. PAYMENT TRANSACTION

Table:

```text
payment_transactions
```

Fields:

```text
id
payment_id
transaction_type
amount
currency
provider_reference
status
created_at
```

Types may include:

```text
CHARGE
CAPTURE
REFUND
REVERSAL
ADJUSTMENT
```

---

# 69. COD VERIFICATION

Table:

```text
cod_verifications
```

Fields:

```text
id
order_id
customer_id
primary_contact_reference
secondary_contact_reference
otp_status
verification_status
assigned_agent_id
decision
decision_reason
created_at
updated_at
completed_at
```

Do not store OTP values unnecessarily.

---

# 70. COD STATUS

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

# 71. COD ATTEMPT

Table:

```text
cod_attempts
```

Fields:

```text
id
cod_verification_id
agent_id
attempt_number
status
outcome
notes
attempted_at
next_follow_up_at
```

---

# 72. COD NOTES

Table:

```text
cod_notes
```

Fields:

```text
id
cod_verification_id
agent_id
note
created_at
```

Sensitive customer information should be minimized.

---

# 73. COUPON

Table:

```text
coupons
```

Fields:

```text
id
code
name
description
status
discount_type
discount_value
maximum_discount
minimum_cart_value
starts_at
expires_at
usage_limit
per_user_limit
created_by
created_at
updated_at
```

---

# 74. COUPON STATUS

```text
DRAFT
SCHEDULED
ACTIVE
PAUSED
EXPIRED
CANCELLED
```

---

# 75. COUPON RULES

Table:

```text
coupon_rules
```

Fields:

```text
id
coupon_id
rule_type
rule_value
created_at
```

Potential rules:

```text
CATEGORY
PRODUCT
SELLER
CUSTOMER_SEGMENT
PAYMENT_METHOD
MINIMUM_ORDER
```

---

# 76. COUPON REDEMPTION

Table:

```text
coupon_redemptions
```

Fields:

```text
id
coupon_id
user_id
order_id
discount_amount
status
redeemed_at
```

Usage limits must be transaction-safe.

---

# 77. DELIVERY ZONE

Table:

```text
delivery_zones
```

Fields:

```text
id
name
code
status
postal_code_rules
city
state
created_at
updated_at
```

---

# 78. DELIVERY PARTNER

Table:

```text
delivery_partners
```

Fields:

```text
id
user_id
partner_code
status
verification_status
vehicle_type
capacity
current_latitude
current_longitude
last_location_at
created_at
updated_at
```

Precise location storage must be governed by privacy and operational requirements.

---

# 79. DELIVERY PARTNER STATUS

```text
REGISTERED
VERIFIED
ACTIVE
AVAILABLE
BUSY
SUSPENDED
INACTIVE
BLOCKED
```

---

# 80. DELIVERY ASSIGNMENT

Table:

```text
delivery_assignments
```

Fields:

```text
id
seller_order_id
delivery_partner_id
status
assigned_at
accepted_at
pickup_at
delivery_at
rejected_at
failure_reason
created_at
updated_at
```

---

# 81. DELIVERY ASSIGNMENT STATUS

```text
UNASSIGNED
ASSIGNMENT_ATTEMPT
ASSIGNED
ACCEPTED
REJECTED
ARRIVED_AT_PICKUP
PICKED_UP
OUT_FOR_DELIVERY
ARRIVED_AT_DESTINATION
DELIVERED
FAILED
CANCELLED
```

---

# 82. DELIVERY EVENTS

Table:

```text
delivery_events
```

Fields:

```text
id
delivery_assignment_id
event_type
actor_type
actor_id
latitude
longitude
metadata
created_at
```

---

# 83. DELIVERY PRICING

Table:

```text
delivery_pricing
```

Fields:

```text
id
order_id
seller_order_id
base_fee
distance_fee
weight_fee
zone_fee
peak_fee
special_handling_fee
customer_charge
seller_charge
platform_share
rider_earning
currency
created_at
```

---

# 84. PROOF OF DELIVERY

Table:

```text
proof_of_delivery
```

Fields:

```text
id
delivery_assignment_id
proof_type
storage_object_id
verified
created_at
```

Possible proof types:

```text
OTP
SIGNATURE
PHOTO
OTHER
```

---

# 85. RETURN REQUEST

Table:

```text
return_requests
```

Fields:

```text
id
order_id
customer_id
status
reason_code
reason
evidence_required
requested_at
approved_at
rejected_at
completed_at
created_at
updated_at
```

---

# 86. RETURN STATUS

```text
REQUESTED
ELIGIBILITY_REVIEW
APPROVED
REJECTED
PICKUP_SCHEDULED
PICKUP_FAILED
PICKED_UP
INSPECTION
APPROVED_FOR_REFUND
APPROVED_FOR_REPLACEMENT
COMPLETED
CANCELLED
```

---

# 87. RETURN ITEM

Table:

```text
return_items
```

Fields:

```text
id
return_request_id
order_item_id
quantity
condition
inspection_result
refund_amount
replacement_requested
created_at
updated_at
```

---

# 88. RETURN EVENTS

Table:

```text
return_events
```

Fields:

```text
id
return_request_id
event_type
actor_type
actor_id
reason
metadata
created_at
```

---

# 89. RETURN INSPECTION

Table:

```text
return_inspections
```

Fields:

```text
id
return_item_id
inspector_id
result
condition_notes
evidence_storage_id
created_at
```

Possible results:

```text
PASS
PARTIAL_PASS
FAIL
```

---

# 90. REFUND

Table:

```text
refunds
```

Fields:

```text
id
order_id
return_request_id
payment_id
refund_reference
amount
currency
status
reason
initiated_at
completed_at
failed_at
created_at
updated_at
```

---

# 91. REFUND STATUS

```text
PENDING
APPROVED
INITIATED
PROCESSING
COMPLETED
FAILED
CANCELLED
```

---

# 92. REFUND TRANSACTION

Table:

```text
refund_transactions
```

Fields:

```text
id
refund_id
provider
provider_reference
amount
status
failure_reason
created_at
completed_at
```

---

# 93. SUPPORT TICKET

Table:

```text
support_tickets
```

Fields:

```text
id
ticket_number
customer_id
seller_id
order_id
category
priority
status
assigned_agent_id
sla_deadline
created_at
updated_at
resolved_at
closed_at
```

---

# 94. SUPPORT STATUS

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

# 95. SUPPORT MESSAGE

Table:

```text
support_messages
```

Fields:

```text
id
ticket_id
sender_type
sender_id
message
is_internal
created_at
```

Internal messages must never be exposed to customers/sellers unless explicitly intended.

---

# 96. SUPPORT ASSIGNMENT

Table:

```text
support_assignments
```

Fields:

```text
id
ticket_id
agent_id
assigned_at
unassigned_at
reason
created_at
```

---

# 97. SUPPORT EVENTS

Table:

```text
support_events
```

Fields:

```text
id
ticket_id
event_type
actor_id
metadata
created_at
```

---

# 98. SUPPORT ATTACHMENTS

Table:

```text
support_attachments
```

Fields:

```text
id
ticket_id
message_id
storage_object_id
file_type
file_size
created_at
```

Files must be validated before storage.

---

# 99. FINANCIAL TRANSACTION

Table:

```text
financial_transactions
```

Fields:

```text
id
transaction_reference
transaction_type
order_id
seller_order_id
seller_id
amount
currency
status
effective_at
created_at
```

---

# 100. FINANCIAL TRANSACTION TYPES

Possible:

```text
SALE
COMMISSION
TAX
DELIVERY
REFUND
ADJUSTMENT
PAYOUT
SETTLEMENT
```

---

# 101. LEDGER ENTRY

Table:

```text
ledger_entries
```

Fields:

```text
id
transaction_id
account_reference
entry_type
amount
currency
reference_type
reference_id
created_at
```

The final accounting/ledger model must be reviewed carefully before production finance implementation.

---

# 102. SELLER PAYABLE

Table:

```text
seller_payables
```

Fields:

```text
id
seller_id
order_id
gross_amount
discount_amount
commission_amount
tax_amount
delivery_amount
refund_amount
adjustment_amount
net_payable
currency
status
created_at
updated_at
```

---

# 103. SETTLEMENT

Table:

```text
settlements
```

Fields:

```text
id
seller_id
settlement_reference
period_start
period_end
gross_sales
discounts
commission
taxes
delivery
refunds
adjustments
net_payable
currency
status
approved_at
processed_at
paid_at
reconciled_at
created_at
updated_at
```

---

# 104. SETTLEMENT STATUS

```text
PENDING
CALCULATING
UNDER_REVIEW
APPROVED
PROCESSING
PAID
FAILED
RECONCILIATION_REQUIRED
RECONCILED
```

---

# 105. SETTLEMENT ITEM

Table:

```text
settlement_items
```

Fields:

```text
id
settlement_id
seller_order_id
transaction_type
reference_id
amount
created_at
```

This provides traceability from settlement to individual business transactions.

---

# 106. SETTLEMENT ADJUSTMENT

Table:

```text
settlement_adjustments
```

Fields:

```text
id
settlement_id
seller_id
type
amount
reason
created_by
approved_by
created_at
```

Financial history must never be silently overwritten.

---

# 107. RECONCILIATION

Table:

```text
reconciliation_records
```

Fields:

```text
id
provider
reference_type
internal_reference
external_reference
internal_amount
external_amount
difference
status
reviewed_by
resolution
created_at
resolved_at
```

---

# 108. NOTIFICATION TEMPLATE

Table:

```text
notification_templates
```

Fields:

```text
id
template_code
channel
language
version
subject
body
status
created_at
updated_at
```

---

# 109. NOTIFICATION

Table:

```text
notifications
```

Fields:

```text
id
user_id
type
title
body
data
read_at
created_at
```

---

# 110. NOTIFICATION DELIVERY

Table:

```text
notification_deliveries
```

Fields:

```text
id
notification_id
channel
provider
status
provider_reference
attempt_count
last_attempt_at
delivered_at
failure_reason
created_at
updated_at
```

---

# 111. NOTIFICATION PREFERENCES

Table:

```text
notification_preferences
```

Fields:

```text
id
user_id
notification_type
channel
enabled
created_at
updated_at
```

---

# 112. OUTBOX EVENT

Table:

```text
outbox_events
```

Fields:

```text
id
event_id
event_type
event_version
aggregate_type
aggregate_id
payload
status
attempt_count
available_at
processed_at
created_at
```

Constraint:

```text
UNIQUE(event_id)
```

---

# 113. EVENT PROCESSING RECORD

Table:

```text
event_processing_records
```

Fields:

```text
id
event_id
consumer
status
attempt_count
processed_at
failure_reason
created_at
updated_at
```

Constraint:

```text
UNIQUE(event_id, consumer)
```

This prevents duplicate consumer effects.

---

# 114. AUDIT LOG

Table:

```text
audit_logs
```

Fields:

```text
id
actor_type
actor_id
action
resource_type
resource_id
previous_state
new_state
reason
metadata
request_id
correlation_id
created_at
```

Audit logs should be protected against unauthorized modification.

---

# 115. AI REQUEST

Table:

```text
ai_requests
```

Fields:

```text
id
request_reference
user_id
application
capability
provider
model
prompt_version
status
started_at
completed_at
latency_ms
created_at
```

Do not store raw sensitive prompts unnecessarily.

---

# 116. AI OUTPUT

Table:

```text
ai_outputs
```

Fields:

```text
id
ai_request_id
output_type
structured_output
confidence
human_review_required
accepted
created_at
```

---

# 117. AI TOOL CALL

Table:

```text
ai_tool_calls
```

Fields:

```text
id
ai_request_id
tool_name
input_schema_version
input_metadata
output_metadata
authorized
status
created_at
completed_at
```

Tool authorization must happen independently of the model.

---

# 118. AI FEEDBACK

Table:

```text
ai_feedback
```

Fields:

```text
id
ai_request_id
reviewer_id
rating
feedback
corrected_output
created_at
```

---

# 119. AI USAGE

Table:

```text
ai_usage_records
```

Fields:

```text
id
ai_request_id
provider
model
input_units
output_units
estimated_cost
currency
created_at
```

---

# 120. ANALYTICS EVENT

Table:

```text
analytics_events
```

Fields:

```text
id
event_id
event_type
user_id
anonymous_session_id
entity_type
entity_id
metadata
occurred_at
received_at
created_at
```

Analytics data is derived and must not become the authoritative source for commerce state.

---

# 121. STORAGE OBJECT

A storage metadata table should exist.

Recommended:

```text
storage_objects
```

Fields:

```text
id
storage_provider
bucket
object_key
file_name
mime_type
file_size
visibility
checksum
status
created_by
created_at
deleted_at
```

---

# 122. STORAGE VISIBILITY

Possible:

```text
PRIVATE
PUBLIC
SIGNED_ACCESS
```

Sensitive files should default to private.

---

# 123. FOREIGN KEY PRINCIPLE

Relationships must be enforced using foreign keys wherever appropriate.

Example:

```text
order_items.seller_order_id
        ↓
seller_orders.id
```

Do not rely solely on application-level relationships for critical integrity.

---

# 124. DELETE RULES

Foreign key deletion behavior must be intentionally selected.

For historical records:

Prefer:

```text
RESTRICT
```

or controlled archival.

Avoid cascading deletes across financial/order history.

---

# 125. UNIQUE CONSTRAINTS

Important examples:

```text
users.email
users.phone
organizations.slug
sellers.seller_code
products.slug
listings.listing_code
orders.order_number
seller_orders.seller_order_number
coupons.code
payment provider references
settlement settlement_reference
support ticket_number
```

Exact uniqueness semantics may depend on soft deletion/status.

---

# 126. INDEXING PRINCIPLE

Indexes must be created based on actual query patterns.

Do not index every column.

Indexes should cover:

* Foreign keys
* Frequent filters
* State + timestamp combinations
* Public lookup fields
* Search support where appropriate
* Unique business references

---

# 127. IMPORTANT INDEX EXAMPLES

Potential indexes:

```text
users(email)
users(phone)

sellers(status)
sellers(approval_status)

products(category_id, status)
products(status, approval_status)

listings(seller_id, status)
listings(product_id, status)

inventory_items(warehouse_id, listing_id)

orders(user_id, created_at)
orders(status, created_at)

seller_orders(seller_id, status, created_at)

payments(order_id)
payments(provider_payment_id)

cod_verifications(status, created_at)

delivery_assignments(delivery_partner_id, status)

return_requests(customer_id, status, created_at)

settlements(seller_id, status, created_at)

support_tickets(status, assigned_agent_id)

outbox_events(status, available_at)
```

Actual indexes must be validated against real query plans.

---

# 128. PARTIAL INDEXES

Where useful, partial indexes may be used.

Example concept:

```text
Active listings only
```

or:

```text
Pending outbox events only
```

This should be used only when query patterns justify it.

---

# 129. COMPOSITE INDEXES

Composite indexes should follow actual filtering/sorting patterns.

Example:

```text
seller_id + status + created_at
```

may support seller order dashboards.

Column order must be selected based on query patterns.

---

# 130. MONEY REPRESENTATION

Money must never rely on binary floating-point.

Preferred approaches:

```text
INTEGER minor units
```

or:

```text
NUMERIC / DECIMAL
```

depending on financial requirements.

Every amount must have an explicit currency.

---

# 131. MONEY INTEGRITY

Examples:

```text
grand_total >= 0
refund_amount >= 0
settlement_amount >= 0
```

Additional constraints should be added where business logic permits.

---

# 132. CURRENCY

Financial tables should store:

```text
amount
currency
```

Even if Bilokat initially operates in one currency.

---

# 133. SNAPSHOT PRINCIPLE

Historical transactions must preserve the relevant state at the time of transaction.

Examples:

Order item should snapshot:

* Product name
* Variant name
* SKU
* Seller name
* Unit price
* Discount
* Tax

because current catalog data may change.

---

# 134. IMMUTABILITY PRINCIPLE

The following records should generally be append-only or tightly controlled:

* Audit logs
* Financial transactions
* Ledger entries
* Payment transaction history
* Settlement adjustments
* Order history
* Important inventory movements

Corrections should create new records instead of destroying historical evidence.

---

# 135. ORDER TOTAL INTEGRITY

The database/application must ensure that:

```text
subtotal
+
tax
+
delivery
-
discount
=
grand_total
```

according to the final pricing formula.

The exact formula must be implemented consistently across all order paths.

---

# 136. INVENTORY INTEGRITY

For each inventory record:

```text
available >= 0
reserved >= 0
allocated >= 0
damaged >= 0
quarantined >= 0
```

Business transactions must maintain valid quantity relationships.

---

# 137. COUPON INTEGRITY

Coupon redemption must prevent race conditions around:

```text
usage_limit
per_user_limit
```

Use transactional protection where necessary.

---

# 138. PAYMENT INTEGRITY

Payment provider events must be:

```text
authenticated
verified
deduplicated
validated
audited
```

A payment webhook must never directly trust client-submitted data.

---

# 139. REFUND INTEGRITY

A refund must reference a valid payment/order context.

The system must prevent:

```text
refund > refundable amount
```

unless a specifically authorized adjustment workflow exists.

---

# 140. SETTLEMENT INTEGRITY

Settlement calculations must be reproducible.

Given the same source transactions and rule version, the system should be able to explain how:

```text
net_payable
```

was calculated.

---

# 141. RULE VERSIONING

Important financial/business calculations should record applicable rule/version information where required.

Examples:

```text
commission_rule_version
pricing_rule_version
coupon_rule_version
refund_policy_version
```

This makes historical decisions explainable.

---

# 142. STATE HISTORY PRINCIPLE

Do not rely only on the current status column.

Current state:

```text
status
```

History:

```text
status_history
```

Both may be required.

---

# 143. OPTIMISTIC CONCURRENCY

For records frequently updated by multiple actors, consider:

```text
version
```

or equivalent concurrency control.

Example:

```text
version = 12
```

Update succeeds only if expected version remains 12.

---

# 144. PESSIMISTIC LOCKING

Use database locks where appropriate for highly contested resources.

Examples:

* Inventory reservation
* Coupon usage
* Settlement processing

Lock duration must be minimized.

---

# 145. TRANSACTION BOUNDARIES

One database transaction should contain all changes that must be atomic.

Example order creation may involve:

```text
Order
Seller Orders
Order Items
Payment relation
Inventory Reservation
Outbox Event
```

The exact transaction boundary must be designed carefully.

---

# 146. OUTBOX CONSISTENCY

For critical events:

```text
Business DB Change
+
Outbox Record
```

should be committed atomically.

A worker later publishes/processes the event.

---

# 147. IDEMPOTENCY KEYS

Important APIs should support idempotency where duplicate requests are dangerous.

Potential examples:

```text
POST /orders
POST /payments
POST /refunds
POST /settlements
POST /inventory/reserve
```

The idempotency record should include enough context to detect conflicting reuse.

---

# 148. IDEMPOTENCY RECORD

Potential table:

```text
idempotency_keys
```

Fields:

```text
id
key
scope
request_hash
response_reference
status
created_at
expires_at
```

Unique constraint:

```text
UNIQUE(scope, key)
```

---

# 149. ENUM PRINCIPLE

Enums should be used for stable bounded states.

Avoid database enums for values that are expected to change frequently through configuration.

Examples suitable for enums:

```text
order status
payment status
seller status
return status
```

Dynamic business rules should generally use tables/configuration.

---

# 150. JSONB PRINCIPLE

JSONB may be used for:

* Flexible metadata
* Provider payload metadata
* AI structured output
* Event metadata
* Dynamic validation rules

Do not use JSONB as an excuse to avoid proper relational modeling.

Core business entities should remain strongly structured.

---

# 151. CATEGORY FLEXIBILITY

Categories must be data-driven.

Adding:

```text
New Category
```

must not require rewriting the frontend product form.

Category configuration should determine:

* Attributes
* Required fields
* Filters
* Variant dimensions
* Validation rules

---

# 152. PRODUCT FORM DATA

Frontend product forms should derive their schema from backend/catalog configuration.

Conceptually:

```text
Category
 ↓
Attribute Schema
 ↓
Product Form
 ↓
Validation
 ↓
Product
```

---

# 153. CUSTOMER SEARCH DATA

Search index should be derived from:

```text
products
listings
categories
inventory
seller status
publication status
```

The index must not become the source of truth.

---

# 154. ANALYTICS DATA

Analytics data may be denormalized for performance.

Transactional data should remain normalized where appropriate.

Do not optimize analytics queries by corrupting transactional modeling.

---

# 155. AUDIT DATA SECURITY

Audit records must be accessible only to authorized roles.

Not every employee should be able to view all audit information.

---

# 156. PII CLASSIFICATION

Data should be classified.

Examples:

```text
PUBLIC
INTERNAL
CONFIDENTIAL
HIGHLY_SENSITIVE
```

Examples of highly sensitive information:

* Authentication secrets
* KYC documents
* Payment credentials
* Security tokens

Never expose such data through ordinary APIs.

---

# 157. DATA MINIMIZATION

Only store data required for:

* Business operation
* Security
* Legal/compliance
* Analytics with legitimate purpose

Do not collect data merely because the database can store it.

---

# 158. ACCESS CONTROL

Database access should follow:

```text
Application
 ↓
Authorized service
 ↓
Database
```

Frontends never receive direct database credentials.

---

# 159. DATABASE USERS

Production should use separate credentials/roles for:

* Application
* Migration
* Read-only analytics where applicable
* Administrative operations

Least privilege must apply.

---

# 160. MIGRATIONS

Every schema change must be version-controlled.

Migration process:

```text
Schema Change
 ↓
Migration
 ↓
Review
 ↓
Test
 ↓
Staging
 ↓
Production
```

---

# 161. DESTRUCTIVE MIGRATIONS

Destructive migrations require special handling.

Examples:

* Column deletion
* Table deletion
* Data transformation
* Constraint tightening

Prefer multi-step migrations when zero/low downtime matters.

---

# 162. DATABASE SEEDING

Development/test seeds may contain:

* Demo users
* Demo sellers
* Demo products
* Test categories
* Test orders

Production must never depend on fake seeded business data.

---

# 163. TEST DATABASE

Automated tests should use isolated database state.

Tests must be deterministic.

One test must not silently depend on data created by another test.

---

# 164. BACKUP

Production database must have automated backup.

Backup strategy must define:

* Frequency
* Retention
* Encryption
* Restoration
* Verification

---

# 165. RESTORE TESTING

A backup is not considered reliable until restoration has been tested.

At appropriate intervals:

```text
Backup
 ↓
Restore
 ↓
Integrity Check
 ↓
Application Verification
```

---

# 166. DATABASE MONITORING

Monitor:

* CPU
* Memory
* Connections
* Query latency
* Locks
* Deadlocks
* Slow queries
* Index usage
* Storage
* Replication if used
* Failed transactions

---

# 167. QUERY PERFORMANCE

Do not assume an indexed query is automatically fast.

Use query analysis.

Potential process:

```text
Slow Query
 ↓
EXPLAIN / ANALYZE
 ↓
Identify Bottleneck
 ↓
Index / Query / Schema Improvement
 ↓
Benchmark
```

---

# 168. N+1 PREVENTION

Backend data access should avoid uncontrolled N+1 queries.

Examples:

```text
100 orders
+
100 seller queries
+
100 user queries
```

should be replaced with appropriate joins/batching/eager loading strategies.

---

# 169. PAGINATION DATA MODEL

Large tables must support efficient pagination.

Preferred:

```text
created_at + id
```

or another stable cursor.

Avoid deep offset pagination for very large datasets where performance becomes problematic.

---

# 170. ARCHIVAL

High-volume historical data may eventually require archival.

Potential candidates:

* Analytics events
* Notification deliveries
* Old audit data according to policy
* Old operational events

Archival must not break reporting or legal retention requirements.

---

# 171. DATABASE SCALING PATH

Initial:

```text
Primary PostgreSQL
```

Future:

```text
Primary
 ↓
Read Replicas
```

if read load justifies it.

Further analytical workloads may move to separate storage.

---

# 172. READ/WRITE SEPARATION

Critical writes should always target authoritative primary database.

Read replicas may be used only where eventual consistency is acceptable.

Examples:

Good candidates:

* Analytics
* Some catalog reads
* Reporting

Bad candidates:

* Payment confirmation
* Inventory availability during purchase
* Permission checks
* Financial state transition

---

# 173. CACHE INVALIDATION

When cache represents database-derived data, define invalidation rules.

Example:

```text
Product Updated
 ↓
Invalidate Product Cache
 ↓
Publish Event
 ↓
Update Search
```

Never assume cache naturally stays correct.

---

# 174. DATABASE + SEARCH CONSISTENCY

Correct order:

```text
Database
 ↓
Commit
 ↓
Outbox Event
 ↓
Search Update
```

Never:

```text
Search Updated
 ↓
Database Failed
```

without recovery handling.

---

# 175. DATABASE + ANALYTICS CONSISTENCY

Operational transaction should complete independently.

Analytics event can be processed asynchronously.

---

# 176. DATABASE + AI CONSISTENCY

AI may consume derived/authorized data.

AI output must not be treated as authoritative database state without explicit business validation.

---

# 177. CRITICAL RELATIONSHIPS

Important relationships:

```text
users
 ├── organizations
 ├── orders
 ├── carts
 ├── addresses
 ├── sessions
 └── roles

sellers
 ├── applications
 ├── documents
 ├── warehouses
 ├── listings
 └── settlements

products
 ├── categories
 ├── variants
 ├── attributes
 ├── media
 └── listings

orders
 ├── seller_orders
 ├── payments
 ├── addresses
 ├── returns
 └── refunds

seller_orders
 ├── order_items
 └── delivery_assignments
```

---

# 178. ORDER ITEM OWNERSHIP

Order items must retain enough historical data to remain understandable even if:

* Product renamed
* Seller renamed
* SKU changed
* Listing removed
* Category changed
* Product unpublished

---

# 179. SELLER DATA ISOLATION

Seller queries must always be scoped by seller identity.

Example:

```text
WHERE seller_id = authenticatedSellerId
```

Backend authorization must independently verify access.

---

# 180. CUSTOMER DATA ISOLATION

Customer endpoints must scope resources to the authenticated customer.

Example:

```text
WHERE user_id = authenticatedUserId
```

Never trust:

```text
?user_id=
```

from the client.

---

# 181. CONTROL ACCESS

Control users may have broad permissions, but every operation must still:

* Authenticate
* Authorize
* Validate
* Audit

---

# 182. SUPPORT DATA ACCESS

Support agents should receive a controlled projection of customer/order information.

Do not automatically expose complete database entities.

---

# 183. FINANCE DATA ACCESS

Finance APIs should expose purpose-built financial views rather than unrestricted operational tables.

---

# 184. DATABASE VIEW PRINCIPLE

Database views/materialized views may be used for:

* Reporting
* Analytics
* Read-heavy internal dashboards

They must not become hidden sources of business truth.

---

# 185. MATERIALIZED VIEWS

Potential candidates:

* Seller performance
* Daily revenue
* Product performance
* Delivery performance

Refresh strategy must be explicit.

---

# 186. DATA INTEGRITY CHECKS

Periodic jobs may verify:

```text
Order totals
Inventory quantities
Payment/order consistency
Refund limits
Settlement totals
Ledger consistency
```

Detected inconsistencies should create alerts/incidents.

---

# 187. RECONCILIATION JOBS

Background reconciliation may check:

```text
Payments ↔ Orders
Refunds ↔ Payments
Settlements ↔ Seller Payables
Inventory ↔ Stock Movements
```

---

# 188. DATA CORRECTION

Automated correction must be conservative.

For critical financial/inventory data:

```text
Detect
 ↓
Flag
 ↓
Review
 ↓
Correct
 ↓
Audit
```

Do not blindly “fix” production financial records.

---

# 189. DATABASE SECURITY CHECKLIST

* [ ] Strong credentials
* [ ] TLS where applicable
* [ ] Least-privilege users
* [ ] No public unrestricted database access
* [ ] Encrypted backups
* [ ] Sensitive field protection where required
* [ ] Migration controls
* [ ] Audit access
* [ ] Connection limits
* [ ] Monitoring
* [ ] Recovery testing

---

# 190. DATABASE DESIGN NON-NEGOTIABLES

1. PostgreSQL is authoritative for transactional state.
2. Frontends never connect directly to PostgreSQL.
3. Critical financial history is not silently overwritten.
4. Inventory operations are concurrency-safe.
5. Payment webhooks are idempotent.
6. Refunds cannot exceed refundable amounts without controlled adjustment.
7. Seller data is tenant-isolated.
8. Customer data is user-isolated.
9. Audit records are protected.
10. Search is derived.
11. Analytics is derived.
12. Cache is not authoritative.
13. AI is not authoritative.
14. Hardcoded production data is prohibited.
15. Schema changes require migrations.
16. Critical state transitions are backend-controlled.
17. Historical order data uses appropriate snapshots.
18. Financial calculations are reproducible.
19. Sensitive documents remain protected.
20. Database integrity must not depend solely on frontend validation.

---

# 191. DATABASE IMPLEMENTATION RULE

Before creating the production schema, implementation must verify:

```text
Business Workflow
        ↓
Entity
        ↓
Relationship
        ↓
Constraint
        ↓
Transaction Boundary
        ↓
Index
        ↓
Migration
        ↓
Tests
```

---

# 192. FINAL ENTITY RELATIONSHIP OVERVIEW

```text
USER
 │
 ├───────────────┐
 │               │
 ▼               ▼
ORGANIZATION    USER PROFILE
 │
 ▼
SELLER
 │
 ├── APPLICATION
 ├── DOCUMENTS
 ├── WAREHOUSE
 │      │
 │      └── INVENTORY
 │
 └── LISTINGS
        │
        ▼
      PRODUCT
        │
        ├── VARIANT
        ├── ATTRIBUTES
        ├── MEDIA
        └── CATEGORY

CUSTOMER
 │
 ├── CART
 │    └── CART ITEMS
 │
 └── ORDER
      │
      ├── SELLER ORDER
      │      ├── ORDER ITEMS
      │      └── DELIVERY
      │
      ├── PAYMENT
      │
      ├── RETURN
      │      └── REFUND
      │
      └── FINANCE
             └── SETTLEMENT

SYSTEM
 │
 ├── EVENTS
 ├── AUDIT
 ├── NOTIFICATIONS
 ├── ANALYTICS
 └── AI
```

---

# 193. DATABASE STATUS

```text
Identity Model          = DEFINED
Authorization Model     = DEFINED
Seller Model            = DEFINED
Catalog Model            = DEFINED
Product Model            = DEFINED
Listing Model            = DEFINED
Inventory Model          = DEFINED
Cart Model               = DEFINED
Checkout Model           = DEFINED
Order Model              = DEFINED
Payment Model            = DEFINED
COD Model                = DEFINED
Coupon Model             = DEFINED
Delivery Model           = DEFINED
Return Model             = DEFINED
Refund Model             = DEFINED
Support Model            = DEFINED
Finance Model            = DEFINED
Settlement Model         = DEFINED
Notification Model       = DEFINED
Event Model              = DEFINED
Audit Model              = DEFINED
AI Model                  = DEFINED
Analytics Model          = DEFINED
Storage Model             = DEFINED

Production Schema        = NOT IMPLEMENTED
Migrations                = NOT CREATED
Database Tests            = NOT CREATED
```

---

# 194. NEXT DOCUMENT

The next document should be:

```text
04-API-SPECIFICATION.md
```

It must convert the database and business workflows into an implementation-ready API contract.

It should define:

* API versioning
* Authentication endpoints
* User endpoints
* Seller endpoints
* KYC/document endpoints
* Category endpoints
* Attribute endpoints
* Product endpoints
* Listing endpoints
* Inventory endpoints
* Cart endpoints
* Checkout endpoints
* Payment endpoints
* COD endpoints
* Coupon endpoints
* Order endpoints
* Delivery endpoints
* Return endpoints
* Refund endpoints
* Support endpoints
* Finance endpoints
* Settlement endpoints
* Notification endpoints
* Search endpoints
* Analytics endpoints
* AI endpoints
* Control/admin endpoints
* Error format
* Pagination
* Filtering
* Sorting
* Idempotency
* Rate limiting
* Authorization requirements
* Webhook contracts
* Event contracts

No frontend implementation should begin until the required API contracts are sufficiently defined.

**Save as:**

```text
BILOKAT/
└── PROJECT-DOCS/
    ├── 00-MASTER-SPEC.md
    ├── 01-ARCHITECTURE.md
    ├── 02-BUSINESS-WORKFLOWS.md
    └── 03-DATABASE-DESIGN.md   ← यह file
```

