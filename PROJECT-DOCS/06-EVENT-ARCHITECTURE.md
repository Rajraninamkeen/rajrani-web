# BILOKAT — EVENT ARCHITECTURE SPECIFICATION

**Document:** `06-EVENT-ARCHITECTURE.md`
**Platform:** Bilokat Multi-Seller Marketplace
**Status:** FINAL SPECIFICATION
**Scope:** Domain Events, Integration Events, Outbox, Event Delivery, Queues, Consumers, Idempotency, Ordering, Retries, Dead-Letter Queues, Event Security, Audit Events, Analytics Events, AI Events, Notification Events and Failure Recovery

---

# 1. Purpose

This document defines how Bilokat communicates business changes between modules, background workers, integrations and derived systems.

Bilokat is a multi-seller marketplace containing:

* Customer commerce
* Seller operations
* Catalog
* Publishing
* Inventory
* Orders
* Payments
* COD
* Delivery
* Returns
* Refunds
* Support
* Finance
* Settlement
* Notifications
* Analytics
* AI

These systems must not depend on fragile direct calls everywhere.

The event architecture provides:

```text id="8m5q3a"
Reliable Business Events
+
Asynchronous Processing
+
Loose Coupling
+
Retryability
+
Idempotency
+
Auditability
+
Observability
+
Scalability
```

---

# 2. Core Principle

The transactional database remains the source of truth.

Events communicate that a state-changing fact occurred.

Example:

```text id="x6v5zq"
Order transaction committed
        ↓
ORDER_CREATED event
        ↓
Event consumers
        ├── Notification
        ├── Analytics
        ├── Delivery
        ├── Seller workflow
        └── AI/Recommendation pipeline
```

An event is not the database itself.

---

# 3. Event Architecture

Conceptual architecture:

```text id="x0x6y5"
Application
    ↓
Domain Service
    ↓
PostgreSQL Transaction
    ↓
Business State Change
    ↓
Outbox Record
    ↓
Event Publisher
    ↓
Message Broker / Queue
    ↓
Consumers
    ├── Notifications
    ├── Analytics
    ├── Search
    ├── AI
    ├── Delivery
    ├── Finance
    └── Other Workers
```

---

# 4. Event Categories

Bilokat uses several event categories.

## 4.1 Domain Events

Represent important business facts.

Examples:

```text id="8ujwbe"
ORDER_CREATED
PAYMENT_CONFIRMED
SELLER_APPROVED
PRODUCT_PUBLISHED
ORDER_DELIVERED
REFUND_COMPLETED
```

## 4.2 Integration Events

Events intended for external systems.

Examples:

```text id="1k4k5a"
PAYMENT_PROVIDER_EVENT
DELIVERY_PROVIDER_EVENT
NOTIFICATION_PROVIDER_EVENT
```

## 4.3 Audit Events

Security and governance events.

Examples:

```text id="3fhf8m"
ROLE_CHANGED
PERMISSION_CHANGED
SELLER_SUSPENDED
PRIVILEGED_ACTION
```

## 4.4 Analytics Events

Behavior/measurement events.

Examples:

```text id="0g0w3m"
PRODUCT_VIEWED
SEARCH_PERFORMED
ITEM_ADDED_TO_CART
CHECKOUT_STARTED
```

## 4.5 AI Events

AI-specific lifecycle events.

Examples:

```text id="o7a0sf"
AI_REQUEST_CREATED
AI_RECOMMENDATION_GENERATED
AI_ACTION_APPROVED
AI_ACTION_REJECTED
AI_FEEDBACK_RECORDED
```

---

# 5. Event vs Command

A command asks for something to happen.

An event states that something happened.

Example command:

```text id="y83p4n"
AcceptOrder
```

Event:

```text id="02o4kq"
ORDER_ACCEPTED
```

Commands may fail.

Events represent completed/recorded facts.

Therefore the system must not treat an event as an instruction unless explicitly designed as a command message.

---

# 6. Event Naming

Event names use:

```text id="hkr6n1"
RESOURCE_ACTION
```

Examples:

```text id="l7k1gs"
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

LISTING_CREATED
LISTING_ACTIVATED
LISTING_SUSPENDED

ORDER_CREATED
ORDER_CONFIRMED
SELLER_ACCEPTED
SELLER_REJECTED
ORDER_PICKED_UP
ORDER_DELIVERED

PAYMENT_INITIATED
PAYMENT_CONFIRMED
PAYMENT_FAILED

RETURN_REQUESTED
RETURN_APPROVED
RETURN_REJECTED

REFUND_INITIATED
REFUND_COMPLETED

SETTLEMENT_CREATED
SETTLEMENT_APPROVED
SETTLEMENT_RELEASED
```

---

# 7. Event Versioning

Every event must have a version.

Example:

```text id="c4ql2y"
event_type:
ORDER_CREATED

event_version:
1
```

Future incompatible changes:

```text id="yglk57"
ORDER_CREATED v2
```

Consumers must explicitly support the versions they understand.

Existing events must not be silently modified in incompatible ways.

---

# 8. Event Envelope

Every event must use a standard envelope.

Conceptual structure:

```text id="t0ag5u"
{
  event_id,
  event_type,
  event_version,
  occurred_at,
  published_at,
  producer,
  aggregate_type,
  aggregate_id,
  organization_id,
  actor_type,
  actor_id,
  correlation_id,
  causation_id,
  request_id,
  idempotency_key,
  schema_version,
  payload,
  metadata
}
```

---

# 9. Event ID

Every event receives a globally unique:

```text id="6j6n7q"
event_id
```

This identifier is immutable.

It is used for:

* tracing
* deduplication
* debugging
* auditing
* consumer processing
* replay

---

# 10. Aggregate

Events should identify the business aggregate they belong to.

Examples:

```text id="h7um9d"
aggregate_type = ORDER
aggregate_id   = ORDER_123
```

or:

```text id="q7v7eu"
aggregate_type = SELLER
aggregate_id   = SELLER_456
```

Possible aggregates:

```text id="7gk8uj"
USER
SELLER
PRODUCT
LISTING
INVENTORY
CART
ORDER
PAYMENT
RETURN
REFUND
DELIVERY
TICKET
SETTLEMENT
```

---

# 11. Correlation ID

Every related workflow must have a:

```text id="9n4gbr"
correlation_id
```

Example:

```text id="x8uxmq"
Checkout
 ↓
Payment
 ↓
Order
 ↓
Delivery
 ↓
Notification
```

All related operations may share the same correlation ID.

This makes distributed troubleshooting possible.

---

# 12. Causation ID

Events may identify the event or command that caused them.

Example:

```text id="v8t4zt"
PAYMENT_CONFIRMED
```

may have:

```text id="qpmf7y"
causation_id =
PAYMENT_PROVIDER_WEBHOOK_EVENT
```

This creates an event lineage.

---

# 13. Transactional Outbox Pattern

Critical events must use the Outbox Pattern.

Without outbox:

```text id="b7e0aw"
DB transaction succeeds
        ↓
Application crashes
        ↓
Event never published
```

This creates inconsistent systems.

With outbox:

```text id="n4r6j4"
DB state change
+
Outbox event
```

are committed in the same transaction.

---

# 14. Outbox Transaction

Example order creation:

```text id="t5v2ey"
BEGIN TRANSACTION

Create Order

Create Order Items

Create Outbox Event:
ORDER_CREATED

COMMIT
```

Either both database changes and the outbox event commit, or neither does.

---

# 15. Outbox Table

Conceptual fields:

```text id="cv0b4r"
outbox_events
 ├── id
 ├── event_id
 ├── event_type
 ├── event_version
 ├── aggregate_type
 ├── aggregate_id
 ├── organization_id
 ├── payload
 ├── headers
 ├── occurred_at
 ├── created_at
 ├── published_at
 ├── status
 ├── attempts
 ├── next_attempt_at
 ├── last_error
 └── locked_at
```

---

# 16. Outbox Status

Possible states:

```text id="cn1q2m"
PENDING
PROCESSING
PUBLISHED
FAILED
DEAD_LETTERED
```

State transitions must be controlled.

---

# 17. Outbox Publisher

A background worker continuously processes:

```text id="f4b6h8"
PENDING outbox events
```

Flow:

```text id="pxv6kd"
Read event
 ↓
Claim safely
 ↓
Publish
 ↓
Mark PUBLISHED
```

Workers must support concurrent processing safely.

---

# 18. Outbox Concurrency

Multiple workers may run simultaneously.

Use database mechanisms such as safe row claiming/locking to prevent conflicting processing.

A worker must never assume it is the only publisher.

---

# 19. At-Least-Once Delivery

Bilokat should generally use:

```text id="w0q6f9"
AT-LEAST-ONCE DELIVERY
```

This means consumers may receive the same event more than once.

Therefore:

> Every important consumer must be idempotent.

Exactly-once processing should not be assumed merely because a broker claims exactly-once delivery semantics.

---

# 20. Idempotency

An operation is idempotent when repeating it produces the same intended final result.

Example:

```text id="wz6b48"
ORDER_DELIVERED
```

received twice must not:

```text id="u9x0ko"
create two refunds
create two notifications
create two settlement records
```

---

# 21. Consumer Idempotency

Maintain a processed-event mechanism.

Conceptual:

```text id="1k0z8m"
processed_events
 ├── consumer
 ├── event_id
 ├── processed_at
 └── result/reference
```

Unique constraint:

```text id="e9n3jq"
UNIQUE(consumer, event_id)
```

---

# 22. Idempotency Scope

Idempotency must be designed according to operation semantics.

For financial operations, event ID alone may not be sufficient.

The system may additionally use:

```text id="9t7r5h"
business reference
payment reference
refund reference
settlement reference
provider event ID
```

---

# 23. Event Processing Flow

Consumer flow:

```text id="0r5rbd"
Receive Event
 ↓
Validate Envelope
 ↓
Validate Version
 ↓
Check Idempotency
 ↓
Check Authorization/Trust Boundary
 ↓
Process
 ↓
Commit Consumer State
 ↓
Mark Processed
```

---

# 24. Consumer Transaction

Where possible:

```text id="zj9w3m"
BEGIN

Apply business change

Record processed event

COMMIT
```

This prevents:

```text id="kw8o7u"
business change succeeds
but processed-event record fails
```

which could cause duplicate processing.

---

# 25. Event Ordering

Some aggregates require ordered processing.

Example:

```text id="o5hx8c"
ORDER_CREATED
 ↓
SELLER_ACCEPTED
 ↓
READY_FOR_PICKUP
 ↓
ORDER_PICKED_UP
 ↓
OUT_FOR_DELIVERY
 ↓
ORDER_DELIVERED
```

The system must prevent an event from incorrectly causing an earlier state after a later state has already been committed.

---

# 26. Ordering Strategy

Ordering may be enforced using:

```text id="my6d2h"
aggregate_id
```

as the partition/routing key.

Example:

```text id="4mm6ec"
ORDER_123
```

all order lifecycle events are routed consistently.

---

# 27. Ordering Is Not Global

Bilokat must not require one global event order.

For example:

```text id="m5z4w1"
ORDER_A
ORDER_B
ORDER_C
```

can process independently.

Only workflows that require ordering should be serialized.

---

# 28. Retry Policy

Temporary failures should be retried.

Examples:

```text id="9i4s4c"
network failure
temporary provider outage
database connection issue
rate limit
temporary queue failure
```

Use exponential backoff with jitter.

Example conceptual schedule:

```text id="e6a5kx"
Attempt 1 → short delay
Attempt 2 → longer delay
Attempt 3 → longer
Attempt 4 → longer
...
```

Exact values must be configurable.

---

# 29. Retry Classification

Errors should be classified:

```text id="xk7f4d"
TRANSIENT
PERMANENT
UNKNOWN
```

Transient:

```text id="q3q5ob"
retry
```

Permanent:

```text id="s7d5mj"
do not endlessly retry
```

Unknown:

```text id="i5p4aj"
controlled retry
+
monitoring
```

---

# 30. Dead-Letter Queue

After configured retry attempts:

```text id="9d0w5b"
Event
 ↓
Retry exhausted
 ↓
Dead Letter Queue
```

DLQ record must retain enough information to investigate and replay safely.

---

# 31. DLQ Metadata

Store:

```text id="m9k3y1"
event_id
event_type
consumer
payload reference
attempt count
first failure
last failure
error class
error message
stack/reference where safe
timestamps
correlation_id
```

Secrets and sensitive data must be redacted.

---

# 32. DLQ Recovery

Operations team must be able to:

```text id="4uv7j8"
inspect
classify
fix underlying problem
retry
replay
discard
```

Discarding critical events requires authorization and audit.

---

# 33. Poison Messages

A poison event repeatedly fails because of malformed or incompatible data.

It must not block the entire queue indefinitely.

Flow:

```text id="1gy2h7"
Event
 ↓
Failure
 ↓
Retry
 ↓
Failure
 ↓
DLQ
 ↓
Continue processing other events
```

---

# 34. Event Schema Validation

Consumers must validate incoming event structure.

Validation includes:

```text id="3q8qpd"
event_type
event_version
required envelope fields
payload schema
data types
allowed values
```

Malformed events must not be blindly executed.

---

# 35. Event Security

Events are trusted only within their defined trust boundary.

Consumers must verify:

```text id="q2j5lq"
producer identity
event authenticity where applicable
schema
version
event source
organization scope
```

External events must never be treated as internally trusted without verification.

---

# 36. Sensitive Data in Events

Events should contain only data required by consumers.

Avoid unnecessary:

```text id="h4x9u3"
passwords
OTP
payment secrets
private credentials
full KYC documents
unnecessary PII
```

Prefer IDs and controlled references where possible.

---

# 37. PII Event Handling

Events containing customer PII require:

```text id="i4n2mc"
data minimization
access controls
retention policy
encryption where appropriate
secure logs
consumer restrictions
```

Consumers should not copy PII unnecessarily into multiple systems.

---

# 38. Event Encryption

Sensitive event transport/storage must use encryption appropriate to the deployment.

At minimum:

```text id="v7x3cb"
TLS in transit
encrypted storage where supported
secure secret management
```

---

# 39. Event Retention

Different events may require different retention.

Examples:

```text id="n7e8ap"
financial events → longer retention
audit events → policy-defined long retention
analytics events → analytics retention policy
temporary operational events → shorter retention
```

Retention must comply with applicable legal/business requirements.

---

# 40. Core User Events

```text id="t5b4pj"
USER_REGISTERED
USER_VERIFIED
USER_LOGIN
USER_LOGOUT
USER_SUSPENDED
USER_DEACTIVATED
USER_REACTIVATED
PASSWORD_CHANGED
PASSWORD_RESET
```

---

# 41. Seller Events

```text id="r6h0se"
SELLER_REGISTERED
SELLER_APPLICATION_SUBMITTED
SELLER_VALIDATION_STARTED
SELLER_REVIEW_STARTED
SELLER_CORRECTION_REQUIRED
SELLER_RESUBMITTED
SELLER_APPROVED
SELLER_REJECTED
SELLER_ACTIVATED
SELLER_SUSPENDED
SELLER_DEACTIVATED
```

---

# 42. Catalog Events

```text id="m6j2fy"
CATEGORY_CREATED
CATEGORY_UPDATED
ATTRIBUTE_CREATED
ATTRIBUTE_UPDATED
SCHEMA_CREATED
SCHEMA_UPDATED

PRODUCT_CREATED
PRODUCT_UPDATED
PRODUCT_SUBMITTED
PRODUCT_APPROVED
PRODUCT_REJECTED
PRODUCT_PUBLISHED
PRODUCT_UNPUBLISHED
PRODUCT_SUSPENDED

VARIANT_CREATED
VARIANT_UPDATED

LISTING_CREATED
LISTING_UPDATED
LISTING_ACTIVATED
LISTING_SUSPENDED
```

---

# 43. Inventory Events

```text id="j0h1ar"
INVENTORY_CREATED
INVENTORY_UPDATED
INVENTORY_RESERVED
INVENTORY_RELEASED
INVENTORY_ADJUSTED
INVENTORY_DEPLETED
STOCK_LOW
STOCK_OUT
WAREHOUSE_CREATED
WAREHOUSE_UPDATED
STOCK_TRANSFER_CREATED
STOCK_TRANSFER_COMPLETED
```

Inventory events must never bypass transactional inventory controls.

---

# 44. Cart Events

```text id="w5f3ko"
CART_CREATED
ITEM_ADDED_TO_CART
ITEM_REMOVED_FROM_CART
CART_UPDATED
CART_ABANDONED
```

Analytics consumers may use these events for behavior analysis.

---

# 45. Checkout Events

```text id="2w9h0c"
CHECKOUT_STARTED
CHECKOUT_VALIDATED
CHECKOUT_FAILED
CHECKOUT_COMPLETED
```

Checkout validation must remain authoritative in the transactional backend.

---

# 46. Payment Events

```text id="b4l3r9"
PAYMENT_INITIATED
PAYMENT_ATTEMPTED
PAYMENT_CONFIRMED
PAYMENT_FAILED
PAYMENT_CANCELLED
PAYMENT_EXPIRED
PAYMENT_RECONCILIATION_REQUIRED
```

Payment state must be verified through secure provider mechanisms.

---

# 47. COD Events

```text id="w5t1cn"
COD_SELECTED
COD_SECONDARY_MOBILE_REQUIRED
COD_OTP_SENT
COD_OTP_VERIFIED
COD_VERIFICATION_STARTED
COD_CALL_ASSIGNED
COD_CALL_COMPLETED
COD_APPROVED
COD_REJECTED
COD_ON_HOLD
```

---

# 48. Order Events

```text id="4b5n6z"
ORDER_CREATED
ORDER_CONFIRMED
ORDER_PAYMENT_CONFIRMED
ORDER_CANCELLED
SELLER_ORDER_CREATED
SELLER_ACCEPTED
SELLER_REJECTED
ORDER_READY_FOR_PICKUP
ORDER_PICKUP_REQUESTED
ORDER_PICKED_UP
ORDER_OUT_FOR_DELIVERY
ORDER_DELIVERED
ORDER_DELIVERY_FAILED
```

---

# 49. Return Events

```text id="0n8t7v"
RETURN_REQUESTED
RETURN_ELIGIBILITY_CHECKED
RETURN_APPROVED
RETURN_REJECTED
RETURN_PICKUP_REQUESTED
RETURN_PICKED_UP
RETURN_INSPECTED
RETURN_ACCEPTED
RETURN_COMPLETED
```

---

# 50. Refund Events

```text id="5p8j7k"
REFUND_INITIATED
REFUND_APPROVAL_REQUIRED
REFUND_APPROVED
REFUND_REJECTED
REFUND_PROCESSING
REFUND_COMPLETED
REFUND_FAILED
REFUND_RECONCILIATION_REQUIRED
```

Refund events must be idempotent and financially traceable.

---

# 51. Delivery Events

```text id="q0f7hm"
RIDER_AVAILABLE
RIDER_UNAVAILABLE
DELIVERY_ASSIGNMENT_CREATED
RIDER_ASSIGNED
RIDER_ACCEPTED
RIDER_REJECTED
PICKUP_STARTED
PICKUP_COMPLETED
DELIVERY_STARTED
DELIVERY_COMPLETED
DELIVERY_FAILED
PROOF_OF_DELIVERY_SUBMITTED
```

---

# 52. Support Events

```text id="s1y4k8"
TICKET_CREATED
TICKET_ASSIGNED
TICKET_MESSAGE_ADDED
TICKET_ESCALATED
TICKET_WAITING
TICKET_RESOLVED
TICKET_CLOSED
```

---

# 53. Finance Events

```text id="3f8k2v"
FINANCIAL_TRANSACTION_CREATED
COMMISSION_CALCULATED
SELLER_PAYABLE_CREATED
ADJUSTMENT_CREATED
SETTLEMENT_CREATED
SETTLEMENT_APPROVED
SETTLEMENT_RELEASED
RECONCILIATION_STARTED
RECONCILIATION_COMPLETED
RECONCILIATION_FAILED
```

Financial event processing must be strongly auditable.

---

# 54. Notification Events

Notification consumers may react to:

```text id="8k2c7s"
ORDER_CREATED
PAYMENT_CONFIRMED
SELLER_ACCEPTED
ORDER_OUT_FOR_DELIVERY
ORDER_DELIVERED
RETURN_APPROVED
REFUND_COMPLETED
TICKET_UPDATED
```

Notification delivery must itself be idempotent.

---

# 55. Notification Pipeline

```text id="8g0q2x"
Domain Event
 ↓
Notification Rule
 ↓
Template Resolution
 ↓
Preference Check
 ↓
Channel Selection
 ↓
Provider
 ↓
Delivery Result
```

Channels:

```text id="5r9p1e"
IN_APP
EMAIL
SMS
OTP
WHATSAPP / APPROVED CHANNEL
```

---

# 56. Analytics Events

Analytics events may include:

```text id="p8n5g4"
PRODUCT_VIEWED
SEARCH_PERFORMED
FILTER_USED
ITEM_ADDED_TO_CART
ITEM_REMOVED_FROM_CART
CHECKOUT_STARTED
CHECKOUT_COMPLETED
PURCHASE_COMPLETED
RETURN_REQUESTED
```

Analytics must remain derived data.

It must never become the source of truth for orders or payments.

---

# 57. AI Events

AI lifecycle events:

```text id="e6q9f7"
AI_REQUEST_CREATED
AI_REQUEST_STARTED
AI_RESPONSE_GENERATED
AI_RECOMMENDATION_GENERATED
AI_TOOL_CALL_REQUESTED
AI_TOOL_CALL_APPROVED
AI_TOOL_CALL_REJECTED
AI_ACTION_EXECUTED
AI_ACTION_FAILED
AI_FEEDBACK_RECORDED
AI_EVALUATION_COMPLETED
```

---

# 58. AI Event Security

AI events must record where appropriate:

```text id="v7d8g5"
model/provider reference
prompt version
request ID
actor
tool
permission context
confidence
latency
cost
human approval
final outcome
```

Sensitive prompts/responses must be protected according to data policy.

---

# 59. Event-Driven Search

When a product changes:

```text id="u5r3v1"
PRODUCT_UPDATED
 ↓
Search indexing worker
 ↓
Update search index
```

Search index is derived.

If indexing fails:

```text id="c3p5s7"
Database remains correct
 ↓
Retry indexing
```

---

# 60. Event-Driven Recommendations

Examples:

```text id="j7h5p3"
PRODUCT_VIEWED
ITEM_ADDED_TO_CART
PURCHASE_COMPLETED
```

may feed recommendation systems.

Recommendation failure must never block checkout or order creation.

---

# 61. Event-Driven Inventory Intelligence

Events such as:

```text id="4f8w6z"
INVENTORY_UPDATED
ORDER_CREATED
ORDER_CANCELLED
ORDER_DELIVERED
```

may feed:

* demand forecasting
* replenishment suggestions
* seller insights
* stock alerts

These systems are advisory/derived.

---

# 62. Event-Driven Fraud Detection

Events may feed risk systems:

```text id="1s9h3g"
LOGIN_FAILURE
PAYMENT_FAILED
ORDER_CREATED
COD_REJECTED
REFUND_REQUESTED
```

Risk detection must not directly override critical state without deterministic policy and required authorization.

---

# 63. Event-Driven Support

Examples:

```text id="q8n5c3"
PAYMENT_FAILED
DELIVERY_FAILED
REFUND_FAILED
SELLER_REJECTED
```

may automatically create or enrich support workflows.

Automated ticket creation must remain traceable to the source event.

---

# 64. Event Replay

The architecture must support controlled replay where necessary.

Replay may be used for:

```text id="v5s7j1"
failed consumer
new derived system
search reindexing
analytics rebuild
AI evaluation
migration
```

Replay must not blindly repeat irreversible financial mutations.

---

# 65. Replay Safety

Consumers must distinguish:

```text id="w7g5j9"
REPLAYABLE
```

from:

```text id="n6p4b2"
NON_REPLAYABLE
```

Financial/payment side effects require special handling.

---

# 66. Event Ordering During Replay

Replay systems must preserve required aggregate ordering.

Example:

```text id="3z8g1c"
ORDER_CREATED
SELLER_ACCEPTED
READY_FOR_PICKUP
ORDER_PICKED_UP
ORDER_DELIVERED
```

must not be replayed in arbitrary order if the consumer depends on sequence.

---

# 67. Event Backpressure

If consumers process slower than producers:

```text id="u8c7p5"
Queue grows
```

The system must monitor:

* queue depth
* processing rate
* consumer lag
* failure rate
* retry count

Scaling should add workers where safe.

---

# 68. Consumer Scaling

Consumers should be horizontally scalable.

Example:

```text id="b4f7x2"
Notification Worker × 10
Analytics Worker × 5
Search Worker × 5
```

Processing must remain safe under concurrency.

---

# 69. Queue Isolation

Critical workflows should not depend on a single overloaded queue.

Separate logical queues/topics may be used for:

```text id="d7k5n3"
payments
orders
notifications
analytics
search
AI
support
```

The exact broker topology may evolve.

---

# 70. Priority

Where required, event processing may use priorities.

Example:

High priority:

```text id="q3f6w9"
payment reconciliation
order operational event
delivery exception
```

Lower priority:

```text id="k8m2s5"
analytics enrichment
recommendation refresh
non-critical AI analysis
```

Priority must not bypass authorization or transactional integrity.

---

# 71. Failure Isolation

Failure of a derived system must not break core commerce.

Example:

```text id="c9w5v4"
AI unavailable
```

must not prevent:

```text id="m3j7k1"
order placement
payment
inventory reservation
```

Similarly:

```text id="y8q4n6"
analytics unavailable
```

must not stop checkout.

---

# 72. Event Consumer Boundaries

Every consumer must define:

```text id="f2c8n5"
input events
output effects
permissions
data required
retry policy
idempotency strategy
failure behavior
```

Consumers should have minimum required access.

---

# 73. Consumer Authorization

A consumer/service must not assume that receiving an event grants unrestricted database access.

Example:

```text id="w5g8j2"
notification-worker
```

receives:

```text id="x2d9m4"
ORDER_CREATED
```

but only performs its approved notification operation.

---

# 74. Event Auditability

For important events, the system must be able to answer:

```text id="u7p5q3"
What happened?
When?
Who caused it?
Which resource?
Which organization?
Which request?
Which event?
Which consumer processed it?
Did it succeed?
Did it retry?
Was it replayed?
```

---

# 75. Distributed Tracing

Events must propagate tracing metadata where supported:

```text id="p6r3v8"
trace_id
span_id
correlation_id
causation_id
request_id
```

This allows:

```text id="z7n5c4"
Customer request
 ↓
API
 ↓
Order service
 ↓
Outbox
 ↓
Queue
 ↓
Notification
```

to be traced as one logical workflow.

---

# 76. Event Metrics

Monitor:

```text id="f5w8c1"
events published
events failed
consumer success rate
consumer failure rate
retry count
DLQ count
queue depth
consumer lag
processing latency
event age
replay count
```

---

# 77. Alerts

Alerts should exist for:

```text id="g8p5d2"
rapid DLQ growth
high consumer lag
payment event failures
order event failures
outbox backlog
stuck processing
repeated poison messages
unexpected event schema failures
```

---

# 78. Outbox Monitoring

Monitor:

```text id="m5v8q1"
pending count
oldest pending event
publisher failures
processing duration
dead-letter count
```

A growing outbox indicates an integration/publishing problem.

---

# 79. Event Schema Registry

For larger-scale deployment, event schemas should be centrally documented/versioned.

Each event must define:

```text id="y5t7c8"
name
version
producer
aggregate
required fields
optional fields
data types
compatibility rules
PII classification
retention
consumers
```

---

# 80. Backward Compatibility

New event versions should prefer additive compatible changes.

Avoid silently:

```text id="k6r4p9"
renaming fields
changing types
removing required fields
changing semantic meaning
```

without versioning.

---

# 81. Event Contract Testing

Producer and consumer contracts must be tested.

Tests should verify:

```text id="r5m8j2"
event envelope
schema
required fields
version
consumer compatibility
```

Breaking event changes should fail CI/CD where possible.

---

# 82. Event Testing

Minimum test categories:

### Unit

```text id="d8n3w7"
event creation
schema validation
routing
idempotency logic
retry classification
```

### Integration

```text id="v6p4s1"
DB + outbox
outbox + publisher
publisher + broker
broker + consumer
```

### E2E

```text id="a5j8q2"
Order
→ event
→ notification
→ delivery
→ analytics
```

---

# 83. Critical Event E2E Tests

### Order

```text id="r7m3v5"
Create order
 ↓
ORDER_CREATED
 ↓
Seller workflow
 ↓
Notification
 ↓
Analytics
```

### Payment

```text id="u8n4c6"
Payment confirmation
 ↓
PAYMENT_CONFIRMED
 ↓
Order confirmation
 ↓
Notification
```

### Delivery

```text id="b6q2x9"
Rider assigned
 ↓
RIDER_ASSIGNED
 ↓
Customer notification
 ↓
Tracking update
```

### Refund

```text id="p4k7s8"
Refund completed
 ↓
REFUND_COMPLETED
 ↓
Customer notification
 ↓
Finance update
```

---

# 84. Duplicate Event Tests

Every important consumer must be tested with:

```text id="t9x3b7"
same event once
same event twice
same event multiple times
```

Expected result:

```text id="c7v4m1"
one logical side effect
```

---

# 85. Failure Tests

Test:

```text id="k5n8r2"
DB unavailable
broker unavailable
consumer crash
network timeout
provider timeout
schema mismatch
duplicate event
out-of-order event
poison message
```

System must recover according to defined policy.

---

# 86. Data Consistency

Eventual consistency is acceptable for derived systems.

Examples:

```text id="g4q8v6"
search index
recommendations
analytics
notifications
AI insights
```

Strong consistency is required where appropriate for:

```text id="x5m7p2"
orders
inventory reservations
payments
refunds
settlements
financial ledger
```

---

# 87. Eventual Consistency UX

Frontend must handle temporary propagation delay.

Example:

```text id="n8r4k6"
Product published
 ↓
Search index updating
```

The product should still be correctly represented by the source-of-truth API.

UI must not claim indexing is complete unless the backend knows it is complete.

---

# 88. Transactional Boundaries

Do not place external network calls inside critical database transactions unnecessarily.

Bad:

```text id="j5q7p8"
BEGIN
 ↓
DB change
 ↓
Call payment provider
 ↓
Call SMS provider
 ↓
COMMIT
```

Preferred:

```text id="u6m8c2"
BEGIN
 ↓
DB change
 ↓
Outbox event
 ↓
COMMIT
 ↓
Async external processing
```

---

# 89. External Side Effects

External calls should use:

```text id="q7v5n2"
idempotency
timeouts
retries
circuit breakers
provider references
reconciliation
```

especially for:

```text id="a8c3x6"
payments
refunds
notifications
delivery providers
```

---

# 90. Event Circuit Breakers

If an external provider repeatedly fails:

```text id="w4k7p9"
Provider failure
 ↓
Circuit opens
 ↓
Temporary requests paused
 ↓
Recovery check
 ↓
Circuit closes
```

Core commerce should degrade gracefully.

---

# 91. Event-Based Reconciliation

Events must not be the only financial truth.

Periodic reconciliation should compare:

```text id="v6m8r2"
internal transactions
vs
external provider records
```

Differences create:

```text id="s7p4k1"
RECONCILIATION_REQUIRED
```

workflows.

---

# 92. Event Retention and Archival

Old events may be archived according to retention policy.

Archival must preserve:

```text id="d5n8q3"
event identity
event type
version
aggregate
timestamp
audit requirements
```

---

# 93. Privacy and Deletion

Where personal-data deletion is legally/business-policy required, event architecture must support appropriate data minimization/redaction/retention handling.

Immutable audit requirements must be reconciled with applicable data-retention rules.

No blanket “delete everything” approach should compromise financial/audit integrity.

---

# 94. Event Governance

Every event must have an owner.

Example:

```text id="f7m4x8"
ORDER_CREATED
Owner: Order Domain

PAYMENT_CONFIRMED
Owner: Payment Domain

PRODUCT_PUBLISHED
Owner: Catalog Domain
```

Event ownership prevents uncontrolled event creation.

---

# 95. Avoid Event Explosion

Not every database field change needs an event.

Events should represent meaningful business facts.

Bad:

```text id="q8m2f5"
USER_TABLE_ROW_UPDATED
```

Better:

```text id="y5c7n3"
PASSWORD_CHANGED
```

or:

```text id="r4v8k2"
SELLER_APPROVED
```

---

# 96. Domain Ownership

Domains own their state.

Example:

```text id="c7m5q9"
Order Domain
    owns order state

Payment Domain
    owns payment state

Inventory Domain
    owns inventory state
```

Other consumers react to events rather than directly modifying another domain's internal state without an approved contract.

---

# 97. Event Contract Ownership

A producer owns the meaning of its events.

Consumers must not reinterpret an event in a way that contradicts the producer's contract.

---

# 98. Event Evolution

When business logic changes:

```text id="x4p7m9"
Update producer
 ↓
Evaluate consumers
 ↓
Version if incompatible
 ↓
Contract tests
 ↓
Deploy
 ↓
Monitor
```

---

# 99. Operational Replay Controls

Replay tools must require authorization.

Potential permissions:

```text id="m8q3v6"
event.read
event.replay
event.dlq.manage
event.discard
event.inspect
```

Critical event replay may require step-up/dual approval.

---

# 100. Manual Event Publishing

Production manual event publishing should be restricted.

Operators must not casually inject:

```text id="f7c4m2"
PAYMENT_CONFIRMED
ORDER_DELIVERED
REFUND_COMPLETED
```

because these can cause real financial/business effects.

If manual publishing exists:

```text id="z5n8q1"
permission
+
reason
+
validation
+
approval where required
+
audit
```

---

# 101. Event Security Boundary

Final trust model:

```text id="n7c4x8"
Database State
      ↓
Outbox
      ↓
Authenticated Event Infrastructure
      ↓
Validated Consumer
      ↓
Consumer Authorization
      ↓
Business Rules
      ↓
Side Effect
```

No event should bypass normal business invariants.

---

# 102. Recommended Event Flow

Example: Customer completes online order.

```text id="q8m5v3"
CUSTOMER
 ↓
Checkout
 ↓
Payment Intent
 ↓
Payment Provider
 ↓
Verified Webhook
 ↓
PAYMENT_CONFIRMED
 ↓
Order Transaction
 ↓
ORDER_CREATED
 ↓
Outbox
 ↓
Message Broker
 ├── Seller Consumer
 ├── Notification Consumer
 ├── Analytics Consumer
 ├── Delivery Consumer
 └── AI/Recommendation Consumer
```

---

# 103. Example: Seller Approval

```text id="v4n7c5"
Reviewer
 ↓
Seller Approval API
 ↓
Authorization
 ↓
Business Validation
 ↓
Seller = APPROVED
 ↓
Outbox
 ↓
SELLER_APPROVED
 ↓
Notification
 ↓
Analytics
 ↓
Seller onboarding workflow
```

---

# 104. Example: Product Publication

```text id="x6m3p8"
Catalog Reviewer
 ↓
Publish request
 ↓
Permission
 ↓
Scope
 ↓
Product validation
 ↓
Seller validation
 ↓
Listing validation
 ↓
Product = PUBLISHED
 ↓
PRODUCT_PUBLISHED
 ↓
Search indexing
 ↓
Cache invalidation
 ↓
Analytics
 ↓
Customer visibility
```

---

# 105. Example: Order Delivery

```text id="c8q5m7"
ORDER_READY_FOR_PICKUP
 ↓
Delivery matching
 ↓
RIDER_ASSIGNED
 ↓
RIDER_ACCEPTED
 ↓
PICKUP_COMPLETED
 ↓
ORDER_OUT_FOR_DELIVERY
 ↓
ORDER_DELIVERED
 ↓
Notification
 ↓
Finance
 ↓
Settlement workflow
 ↓
Analytics
```

---

# 106. Event Architecture Non-Negotiables

1. PostgreSQL remains transactional source of truth.
2. Critical state changes use transactional outbox.
3. Events have globally unique IDs.
4. Events are versioned.
5. Consumers are idempotent.
6. At-least-once delivery is assumed.
7. Required aggregate ordering is explicitly designed.
8. Retries use controlled backoff.
9. Poison messages go to DLQ.
10. DLQ supports safe investigation and replay.
11. External events require verification.
12. Sensitive data is minimized.
13. Secrets never enter events.
14. Consumers use least-privilege service identities.
15. Financial events remain fully traceable.
16. Event replay cannot blindly repeat irreversible side effects.
17. Analytics/search/AI are derived systems.
18. AI cannot bypass authorization.
19. Event failures must not unnecessarily break core commerce.
20. Critical event flows are observable and tested.

---

# 107. Implementation Checklist

## Event Infrastructure

```text id="q7m4x8"
[ ] Event envelope
[ ] Event IDs
[ ] Versioning
[ ] Correlation IDs
[ ] Causation IDs
[ ] Schema validation
[ ] Producer identity
```

## Outbox

```text id="c5n8v2"
[ ] Outbox table
[ ] Transactional write
[ ] Publisher
[ ] Safe claiming
[ ] Retry
[ ] Failure tracking
[ ] Monitoring
```

## Broker / Queue

```text id="m7q4p9"
[ ] Topics/queues
[ ] Consumer groups
[ ] Partition/routing strategy
[ ] Retry mechanism
[ ] DLQ
[ ] Backpressure
[ ] Scaling
```

## Consumers

```text id="x8c5n3"
[ ] Consumer contracts
[ ] Idempotency
[ ] Transactional processing
[ ] Error classification
[ ] Retry
[ ] Logging
[ ] Metrics
```

## Security

```text id="v4m7q1"
[ ] Event authentication
[ ] Authorization
[ ] PII minimization
[ ] Encryption
[ ] Secret filtering
[ ] Replay controls
[ ] Audit
```

## Observability

```text id="n5c8x2"
[ ] Event metrics
[ ] Consumer lag
[ ] Outbox backlog
[ ] DLQ alerts
[ ] Distributed tracing
[ ] Failure dashboards
```

## Testing

```text id="p7m4v9"
[ ] Unit tests
[ ] Integration tests
[ ] Contract tests
[ ] Duplicate-event tests
[ ] Ordering tests
[ ] Retry tests
[ ] DLQ tests
[ ] Replay tests
[ ] Failure tests
[ ] Critical E2E tests
```

---

# 108. Completion Gate

Event architecture is considered complete only when:

```text id="f8m5q3"
EVENT CONTRACTS
+
OUTBOX
+
PUBLISHER
+
BROKER
+
CONSUMERS
+
IDEMPOTENCY
+
RETRY
+
DLQ
+
ORDERING
+
SECURITY
+
OBSERVABILITY
+
TESTING
+
RECOVERY
```

are implemented and verified.

Documentation alone does not satisfy completion.

---

# 109. Final Event Architecture Contract

The authoritative Bilokat event model is:

```text id="x7m4p2"
TRANSACTION
    ↓
BUSINESS STATE CHANGE
    ↓
OUTBOX EVENT
    ↓
COMMIT
    ↓
PUBLISH
    ↓
BROKER
    ↓
CONSUMER
    ↓
VALIDATE
    ↓
IDEMPOTENCY CHECK
    ↓
AUTHORIZATION / TRUST CHECK
    ↓
BUSINESS RULE
    ↓
SIDE EFFECT
    ↓
AUDIT / METRICS
    ↓
SUCCESS
```

Failure:

```text id="q5v8n3"
FAIL
 ↓
CLASSIFY
 ↓
RETRY
 ↓
RETRY EXHAUSTED
 ↓
DLQ
 ↓
INVESTIGATE
 ↓
SAFE REPLAY / RESOLVE
```

This is the authoritative event-processing contract for Bilokat.

---

# 110. Dependency With Other Specifications

This document depends on:

```text id="g6m3v8"
00-MASTER-SPEC.md
01-ARCHITECTURE.md
03-DATABASE-DESIGN.md
04-API-SPECIFICATION.md
05-AUTH-RBAC-ABAC.md
```

It directly influences:

```text id="r7c5m2"
07-AI-INTELLIGENCE.md
08-UI-ROUTES.md
09-SECURITY-SPEC.md
```

---

# 111. Next Specification

After Event Architecture is implemented and verified, the next specification is:

```text id="x8m4q7"
07-AI-INTELLIGENCE.md
```

It will define the Bilokat Central Intelligence Layer:

```text id="c5v7n3"
AI Gateway
AI Orchestrator
Model/Provider Abstraction
RAG
Semantic Search
Recommendations
Ranking
Shopping Assistant
Product Intelligence
Seller Intelligence
Support AI
Fraud/Risk Intelligence
Demand Forecasting
Review Intelligence
Marketing Intelligence
Natural-Language Analytics
AI Tool Permissions
Human Approval
AI Safety
AI Observability
Evaluation
Cost Controls
Privacy
Fallbacks
```

**End of `06-EVENT-ARCHITECTURE.md`**
