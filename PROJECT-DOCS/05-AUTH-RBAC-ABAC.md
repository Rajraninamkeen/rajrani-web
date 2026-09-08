
# BILOKAT — AUTHENTICATION, RBAC & ABAC SPECIFICATION

**Document:** `05-AUTH-RBAC-ABAC.md`
**Platform:** Bilokat Multi-Seller Marketplace
**Status:** FINAL SPECIFICATION
**Scope:** Authentication, Sessions, Tokens, Roles, Permissions, RBAC, ABAC, Ownership, Step-Up Authentication, Privileged Access, Service Authentication, AI Authorization and Authorization Auditing

---

# 1. Purpose

This document defines the complete authentication and authorization architecture for Bilokat.

The objective is not merely to provide login functionality.

Bilokat must provide a security architecture capable of safely controlling access across:

* Customers
* Sellers
* Catalog teams
* Support teams
* Delivery teams
* Finance teams
* Control/administration teams
* Analytics teams
* Internal services
* External providers
* AI agents

The authorization system must ensure:

> Authentication proves who the actor is.
> Authorization determines what that actor is allowed to do.

No frontend application, UI state, hidden button, client-side role check or AI decision is considered a security boundary.

The backend remains the final authority.

---

# 2. Security Model

Bilokat uses a layered authorization model:

```text
IDENTITY
   ↓
AUTHENTICATION
   ↓
SESSION
   ↓
TOKEN VALIDATION
   ↓
USER STATUS
   ↓
ORGANIZATION / TENANT CONTEXT
   ↓
ROLE
   ↓
EXPLICIT PERMISSION
   ↓
SCOPE
   ↓
RESOURCE OWNERSHIP
   ↓
ABAC POLICY
   ↓
BUSINESS STATE
   ↓
RISK / STEP-UP AUTHENTICATION
   ↓
AUDIT REQUIREMENTS
   ↓
ALLOW / DENY
```

Every protected operation must pass all applicable layers.

Failure at any mandatory layer results in denial.

Default policy:

```text
DENY BY DEFAULT
FAIL CLOSED
LEAST PRIVILEGE
EXPLICIT AUTHORIZATION
AUDIT PRIVILEGED ACTIONS
```

---

# 3. Actor Types

Bilokat supports the following actor classes:

```text
CUSTOMER
SELLER_USER
CATALOG_USER
SUPPORT_USER
DELIVERY_USER
FINANCE_USER
CONTROL_USER
ANALYTICS_USER
SYSTEM_SERVICE
AI_AGENT
EXTERNAL_PROVIDER
```

An actor may have multiple roles where business policy allows it, but dangerous combinations must be prevented through separation-of-duties rules.

---

# 4. Identity Model

A user identity is separate from business roles.

Minimum conceptual model:

```text
User
 ├── Identity
 ├── Credentials
 ├── Sessions
 ├── Organizations
 ├── Roles
 ├── Permissions
 ├── Security Events
 └── Audit History
```

A user account must not be automatically considered authorized merely because it exists.

Possible account states:

```text
PENDING
ACTIVE
RESTRICTED
SUSPENDED
DEACTIVATED
BLOCKED
DELETED
```

Each state has explicit authorization consequences.

---

# 5. User Lifecycle

Customer lifecycle:

```text
REGISTERED
   ↓
EMAIL/PHONE VERIFIED
   ↓
ACTIVE
```

Seller user lifecycle may additionally depend on seller organization state.

Example:

```text
USER CREATED
   ↓
EMAIL/PHONE VERIFIED
   ↓
SELLER ORGANIZATION CREATED
   ↓
SELLER APPLICATION
   ↓
SELLER APPROVAL
   ↓
SELLER ACTIVE
```

Account authentication and seller business approval are separate concepts.

A valid login does not automatically mean the user can perform seller operations.

---

# 6. Authentication Methods

Bilokat may support:

```text
PASSWORD
OTP
PASSKEY / WEBAUTHN
REFRESH TOKEN
STEP-UP AUTHENTICATION
SERVICE CREDENTIALS
API KEYS
```

Authentication methods must be configurable by actor type and risk level.

Examples:

Customer:

```text
OTP
Password
Passkey
```

Seller:

```text
Password
OTP
Passkey
Step-up authentication
```

Control/Finance:

```text
Strong primary authentication
+
Step-up authentication for privileged operations
```

---

# 7. Password Security

Passwords must never be stored in plaintext.

Password storage must use a modern adaptive password hashing algorithm such as:

```text
Argon2id
```

or an equivalent currently approved secure password hashing implementation.

Requirements:

* unique password hash
* appropriate work factor
* secure password reset
* rate limiting
* brute-force protection
* credential stuffing detection
* password change invalidation policy
* no password logging
* no password in analytics
* no password in audit metadata

Passwords must never be returned by any API.

---

# 8. OTP Security

OTP must be:

* short-lived
* single-use
* rate limited
* purpose-bound
* session/context-bound where applicable
* stored only as a secure hash/reference where practical
* protected from brute-force attempts

OTP purposes must be separated.

Examples:

```text
LOGIN_OTP
PHONE_VERIFICATION
PASSWORD_RESET
SECONDARY_MOBILE_VERIFICATION
STEP_UP_AUTH
HIGH_RISK_ACTION
```

An OTP generated for one purpose must not automatically authorize another operation.

---

# 9. Passkey / WebAuthn

Passkey authentication may be supported for:

* customers
* sellers
* privileged internal users

Credential records must maintain:

```text
credential_id
user_id
public_key
sign_count
device metadata
created_at
last_used_at
revoked_at
```

Private keys remain on the user's authenticator/device.

Bilokat must never receive or store the user's private passkey key.

---

# 10. Session Architecture

Authentication creates a server-recognized session.

Conceptual session model:

```text
Session
 ├── id
 ├── user_id
 ├── organization_id
 ├── refresh_token_hash / token family reference
 ├── token_version
 ├── created_at
 ├── last_used_at
 ├── expires_at
 ├── revoked_at
 ├── revoke_reason
 ├── device metadata
 └── security metadata
```

A session represents an authenticated context.

Sessions must be independently revocable.

---

# 11. Session Contract

Every authenticated session must follow explicit rules.

The implementation must define:

### Session creation

```text
Successful authentication
→ create session
→ issue access token
→ issue refresh token
```

### Session expiration

Sessions must have:

* absolute lifetime
* inactivity policy where required
* refresh policy
* privileged-session restrictions

### Session revocation

A session can be revoked because of:

```text
USER_LOGOUT
ADMIN_REVOCATION
PASSWORD_CHANGED
ACCOUNT_SUSPENDED
ACCOUNT_BLOCKED
REFRESH_TOKEN_REUSE
SECURITY_INCIDENT
SESSION_EXPIRED
DEVICE_REVOKED
```

### Session listing

Users may be allowed to view their active sessions.

Example:

```text
Chrome - Windows
Android Phone
Firefox - Linux
```

Sensitive device metadata should be minimized.

---

# 12. Token Architecture

Bilokat uses short-lived access tokens and controlled refresh tokens.

Conceptual flow:

```text
LOGIN
 ↓
SESSION CREATED
 ↓
ACCESS TOKEN
+
REFRESH TOKEN
```

Access tokens should be short-lived.

Refresh tokens must have stronger lifecycle controls.

---

# 13. Access Token Contract

Access token must contain only information necessary for authorization and request processing.

Example claims:

```text
sub
session_id
organization_id
roles / role references
token_version
iat
exp
issuer
audience
```

Sensitive personal information must not be embedded unnecessarily.

The API must validate:

```text
signature
issuer
audience
expiration
issued-at constraints
token version
session state where required
```

---

# 14. Access Token Lifetime

Access tokens should have a short lifetime appropriate to risk.

Example baseline:

```text
Access Token:
5–15 minutes
```

The exact production value must be configurable.

Privileged applications may use stricter limits.

Long-lived access tokens are prohibited unless explicitly justified and approved.

---

# 15. Refresh Token Contract

Refresh tokens must:

* be long random secrets
* be securely stored client-side
* never be logged
* be bound to a session/token family
* support rotation
* support revocation
* support reuse detection

Flow:

```text
Refresh Token A
      ↓
Validate
      ↓
Rotate
      ↓
Access Token B
+
Refresh Token C
```

Old refresh token A must no longer be accepted according to the rotation policy.

---

# 16. Refresh Token Reuse Detection

If a previously rotated refresh token is presented again:

```text
Possible token theft
        ↓
Detect reuse
        ↓
Invalidate token family/session
        ↓
Create security event
        ↓
Require re-authentication
```

The implementation must prevent an attacker from continuing to refresh stolen sessions indefinitely.

---

# 17. Logout

Logout must invalidate the authenticated session.

Recommended flow:

```text
Client Logout
 ↓
Backend
 ↓
Revoke Session
 ↓
Invalidate Refresh Token Family
 ↓
Record Security Event
```

Access tokens that have already been issued may remain valid only until their short expiration unless a centralized token-version/revocation mechanism is used to invalidate them earlier.

High-risk applications may use stronger immediate revocation mechanisms.

---

# 18. Password Change

Password change must trigger appropriate session security.

Recommended policy:

```text
Password Changed
 ↓
Invalidate existing refresh-token families
 ↓
Revoke sessions according to security policy
 ↓
Require fresh authentication
```

The current session may optionally remain active only if explicitly allowed by security policy and protected by reauthentication.

---

# 19. Account Suspension

When an account is suspended:

```text
User Status
     ↓
SUSPENDED
     ↓
Authorization Denied
```

Depending on severity:

```text
Revoke active sessions
Invalidate refresh tokens
Terminate privileged access
Create security event
Create audit record
```

Frontend restrictions alone are insufficient.

---

# 20. Explicit Permission Model

Permissions must be explicit.

Example:

```text
product.read
product.create
product.update
product.delete
product.submit
product.approve
product.publish
product.suspend
```

Seller permissions:

```text
seller.read
seller.review
seller.approve
seller.reject
seller.suspend
seller.activate
```

Orders:

```text
order.read
order.accept
order.reject
order.cancel
order.update
```

Finance:

```text
refund.read
refund.create
refund.approve
settlement.read
settlement.approve
settlement.release
```

No permission may be inferred from UI visibility.

---

# 21. Permission Naming Convention

Permission format:

```text
resource.action
```

Examples:

```text
product.read
product.create
product.update
product.approve

listing.read
listing.create
listing.update
listing.publish

order.read
order.cancel

refund.read
refund.approve
```

For highly specialized operations:

```text
seller.kyc.review
seller.kyc.approve
catalog.schema.manage
control.platform.configure
audit.read
```

Permissions must be granular enough to prevent privilege overreach.

---

# 22. Roles

Roles are collections of permissions.

Example:

```text
CATALOG_EDITOR
CATALOG_REVIEWER
SELLER_OPERATOR
SUPPORT_AGENT
DELIVERY_OPERATOR
FINANCE_OPERATOR
FINANCE_APPROVER
CONTROL_OPERATOR
CONTROL_ADMIN
ANALYTICS_VIEWER
```

A role must not automatically mean unrestricted access.

---

# 23. Example: Catalog Roles

### Catalog Editor

```text
product.read
product.create
product.update
product.submit

listing.read
listing.create
listing.update
```

Cannot:

```text
product.approve
product.publish
seller.approve
seller.suspend
refund.approve
settlement.approve
```

### Catalog Reviewer

May have:

```text
product.read
product.review
product.approve
product.reject
```

But publication may require a separate permission:

```text
product.publish
```

Approval and publication should remain distinct when business policy requires it.

---

# 24. Role Scope

Roles may be scoped.

Possible scopes:

```text
GLOBAL
ORGANIZATION
SELLER
WAREHOUSE
CITY
REGION
TEAM
RESOURCE
```

Example:

A seller user may have:

```text
product.update
```

but only for:

```text
seller_id = SELLER_A
```

A warehouse operator may have:

```text
inventory.update
```

only for:

```text
warehouse_id = WAREHOUSE_12
```

---

# 25. RBAC

Role-Based Access Control determines what permissions an actor receives through roles.

Example:

```text
User
 ↓
SELLER_OPERATOR
 ↓
Permissions
 ├── listing.read
 ├── listing.create
 ├── listing.update
 ├── inventory.read
 └── inventory.update
```

RBAC alone is insufficient for Bilokat.

Therefore it must be combined with ABAC and ownership checks.

---

# 26. ABAC

Attribute-Based Access Control evaluates contextual attributes.

Possible attributes:

```text
user.id
user.status
user.role
organization.id
organization.status
seller.id
warehouse.id
resource.owner_id
resource.status
order.status
payment.status
risk.level
request.ip
request.device
request.time
approval.state
```

Example:

```text
Permission:
product.update

AND

Seller status = ACTIVE

AND

User status = ACTIVE

AND

Product belongs to seller

AND

Product state allows modification
```

Only then:

```text
ALLOW
```

---

# 27. Resource Ownership

Ownership must be checked server-side.

Example:

Seller A:

```text
seller_id = A
```

Product:

```text
seller_id = A
```

Request:

```text
product.update
```

Allowed.

But:

```text
seller_id = B
```

must result in:

```text
403 FORBIDDEN
```

or an appropriate non-enumerating response where resource existence itself should not be disclosed.

This prevents BOLA/IDOR vulnerabilities.

---

# 28. Organization / Tenant Isolation

Bilokat must enforce organization boundaries.

Every organization-scoped request must verify:

```text
authenticated organization
        ==
resource organization
```

Cross-organization access must be denied unless an explicit platform-level permission and approved scope allow it.

Database queries must include organization/seller scope where required.

Authorization must not depend only on URL parameters.

---

# 29. Business-State Authorization

Permission alone is insufficient.

Example:

A seller may have:

```text
order.accept
```

but cannot accept:

```text
CANCELLED order
```

Therefore:

```text
Permission
+
Ownership
+
Business State
```

must all pass.

Examples:

```text
Product APPROVED → may publish if authorized
Product REJECTED → cannot publish

Order PLACED → seller may accept
Order DELIVERED → seller cannot accept

Refund ELIGIBLE → may initiate
Refund already COMPLETED → cannot initiate again
```

---

# 30. State-Based Authorization

Every state machine must define allowed actions.

Example:

```text
SELLER_PENDING
 ├── accept
 └── reject

SELLER_ACCEPTED
 └── prepare

READY_FOR_PICKUP
 └── pickup

DELIVERED
 └── return-request
```

The authorization layer must not allow invalid state transitions merely because a permission exists.

---

# 31. High-Risk Actions

High-risk actions include:

```text
seller.approve
seller.suspend
seller.activate
product.approve
product.publish
refund.approve
settlement.approve
settlement.release
permission.assign
role.assign
platform.configure
security.policy.change
```

The exact list must remain configurable.

---

# 32. Step-Up Authentication

High-risk operations may require fresh authentication.

Flow:

```text
User authenticated
       ↓
Attempts high-risk action
       ↓
Risk / policy check
       ↓
Step-up required
       ↓
OTP / Passkey / Strong authentication
       ↓
Temporary authorization context
       ↓
Action
```

Step-up authorization must be:

* short-lived
* purpose-bound
* non-transferable
* audited

---

# 33. Four-Eyes / Dual Approval

Critical operations may require two authorized actors.

Example:

```text
Finance Operator
      ↓
Settlement Release Request
      ↓
Finance Approver
      ↓
Approval
      ↓
Execution
```

The same user must not satisfy both sides where separation-of-duties is required.

Potential operations:

```text
large refund
settlement release
permission escalation
seller suspension override
platform security changes
```

Thresholds should be configurable.

---

# 34. Permission Assignment

Assigning permissions is itself a privileged operation.

Examples:

```text
role.create
role.update
role.assign
permission.assign
```

A normal user must never be able to grant themselves additional permissions.

Backend must enforce:

```text
Actor Permission
+
Target Permission Authority
+
Scope
+
Separation-of-Duties
+
Audit
```

---

# 35. Permission Escalation Protection

The system must prevent:

```text
User A
 ↓
modifies own role
 ↓
becomes Control Admin
```

or:

```text
Seller User
 ↓
changes organization ID
 ↓
accesses another seller
```

or:

```text
Catalog Editor
 ↓
changes API request
 ↓
calls product.approve directly
```

Every authorization decision happens server-side.

---

# 36. Permission Cache

Permission data may be cached for performance.

However:

```text
Permission Change
 ↓
Cache Invalidation
 ↓
New Authorization Evaluation
```

must be reliable.

High-risk permission changes should have stronger cache invalidation guarantees.

Authorization cache failures must fail closed where necessary.

---

# 37. Emergency / Break-Glass Access

Break-glass access may exist for genuine emergencies.

Requirements:

```text
Explicit activation
Strong authentication
Reason required
Time-limited access
Minimum required scope
Full audit
Automatic expiration
Post-event review
```

Break-glass must never become a permanent super-admin bypass.

---

# 38. Just-In-Time Privileged Access

For extremely privileged roles, access may be granted temporarily.

Example:

```text
Control Operator
 ↓
Requests elevated permission
 ↓
Approval
 ↓
30-minute privileged window
 ↓
Automatic expiration
```

Every activation and use must be audited.

---

# 39. Impersonation

Support/control staff may require limited customer/seller impersonation for troubleshooting.

Impersonation must:

* require explicit permission
* require reason
* be time limited
* show clearly that impersonation is active
* never expose passwords
* never expose payment secrets
* restrict sensitive operations
* create audit events

Example:

```text
Support Agent
 ↓
Impersonate Customer
 ↓
Read-only troubleshooting
```

Default impersonation should be read-only unless explicitly approved.

---

# 40. Service-to-Service Authentication

Internal services must not rely on human JWTs.

Use service identity.

Conceptually:

```text
Service A
 ↓
Service Credential / mTLS / approved service token
 ↓
Service B
```

Each service receives minimum permissions.

Example:

```text
payment-service
```

should not automatically receive:

```text
seller.suspend
permission.assign
```

---

# 41. API Keys

API keys may be supported for approved integrations.

Requirements:

* hashed storage where appropriate
* scoped permissions
* expiration
* rotation
* revocation
* rate limiting
* audit
* owner organization
* last-used metadata

API keys must never grant unrestricted platform access by default.

---

# 42. External Providers

External systems may authenticate through:

```text
signed requests
OAuth
API keys
mTLS
provider-specific credentials
webhook signatures
```

Every provider integration must have an explicit trust boundary.

External provider input must never automatically become trusted internal authorization.

---

# 43. Webhook Authorization

Payment/delivery/provider webhooks must verify:

```text
signature
timestamp
provider identity
event type
event ID
idempotency
payload integrity
```

Replay protection must be implemented.

A webhook must not be able to arbitrarily change internal state without validation and business-rule checks.

---

# 44. AI Agent Authorization

AI agents are not administrators.

AI must receive explicitly scoped capabilities.

Example:

```text
AI Agent
 ├── product.read
 ├── category.read
 ├── search.read
 └── recommendation.generate
```

It must not automatically receive:

```text
payment.refund
settlement.release
permission.assign
seller.suspend
inventory.adjust
```

---

# 45. AI Action Boundary

AI architecture:

```text
AI Recommendation
       ↓
Deterministic Business Logic
       ↓
Authorization
       ↓
Validation
       ↓
Risk Check
       ↓
Human Approval if Required
       ↓
Execution
       ↓
Audit
```

AI cannot bypass authorization.

---

# 46. AI Tool Permissions

Every AI tool must have an explicit capability definition.

Example:

```text
catalog.search
catalog.read
seller.performance.read
support.ticket.summarize
analytics.query
```

Critical mutation tools must either:

```text
not exist
```

or require deterministic authorization and approval.

---

# 47. PII Access

Personally identifiable information must be protected by least privilege.

Examples:

```text
Customer name
Phone
Email
Address
Order information
```

A delivery user may require:

```text
name
phone
delivery address
```

but must not automatically receive:

```text
payment credentials
full financial history
unrelated customer information
```

---

# 48. KYC Access

KYC information must have separate permissions.

Examples:

```text
seller.kyc.read
seller.kyc.review
seller.kyc.approve
seller.kyc.reject
```

KYC documents must not be visible to ordinary seller operators.

Access must be logged.

---

# 49. Payment Data

Bilokat must not store raw:

```text
card numbers
CVV
bank credentials
UPI PIN
```

unless a specifically compliant architecture legally and technically requires it.

Payment integrations should use provider references/tokens.

Payment information access must be tightly scoped.

---

# 50. Storage Authorization

Uploaded objects must use authorization-aware access.

Examples:

```text
seller-documents/private/
customer-private/
kyc/
product-media/
support-attachments/
```

Private objects must not be publicly writable.

Access should use:

```text
authorization
+
signed URL
+
expiration
+
scope
```

where appropriate.

---

# 51. File Access

Before allowing file access:

```text
Authenticated
 ↓
Permission
 ↓
Organization
 ↓
Resource ownership
 ↓
File policy
 ↓
Access
```

File URLs must not become permanent unrestricted access tokens.

---

# 52. API Authorization Flow

Every protected API endpoint should conceptually execute:

```text
REQUEST
 ↓
Request ID
 ↓
Authentication
 ↓
Token Validation
 ↓
Session Validation
 ↓
User Status
 ↓
Organization Context
 ↓
Permission Check
 ↓
Scope Check
 ↓
Ownership Check
 ↓
ABAC Policy
 ↓
Business State
 ↓
Risk / Step-Up
 ↓
Audit Requirement
 ↓
CONTROLLER
 ↓
SERVICE
 ↓
DATABASE
```

Controllers must not contain random ad-hoc authorization logic.

Authorization should be centralized through guards/policies/services.

---

# 53. NestJS Authorization Architecture

Conceptual backend structure:

```text
src/
├── auth/
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── authentication/
│   ├── sessions/
│   ├── tokens/
│   ├── refresh/
│   ├── otp/
│   └── passkeys/
│
├── authorization/
│   ├── authorization.module.ts
│   ├── permissions/
│   ├── roles/
│   ├── policies/
│   ├── scopes/
│   ├── guards/
│   ├── decorators/
│   └── ownership/
│
├── security/
│   ├── risk/
│   ├── step-up/
│   ├── security-events/
│   └── audit/
│
└── common/
    ├── decorators/
    ├── guards/
    └── exceptions/
```

---

# 54. Authorization Decorators

Endpoints may declare required permissions explicitly.

Conceptual example:

```text
@RequirePermission("product.approve")
```

Then authorization infrastructure evaluates:

```text
permission
scope
ownership
ABAC
business state
risk
```

The decorator is only a declaration.

The actual enforcement occurs server-side.

---

# 55. Policy Architecture

Policies should be composable.

Conceptual:

```text
PermissionPolicy
OwnershipPolicy
OrganizationPolicy
StatePolicy
RiskPolicy
StepUpPolicy
```

Example:

```text
product.update
AND
seller owns product
AND
seller ACTIVE
AND
product editable
```

---

# 56. Authorization Decision

Authorization engine should produce a structured internal decision.

Conceptual:

```text
decision:
  allowed: true/false
  reason: ...
  policy: ...
  requiredStepUp: true/false
  auditRequired: true/false
```

Detailed denial reasons must not leak sensitive information to untrusted clients.

Internal logs may contain richer diagnostic information.

---

# 57. HTTP Responses

Typical behavior:

```text
401 Unauthorized
```

when authentication is missing/invalid.

```text
403 Forbidden
```

when the actor is authenticated but not authorized.

Resource enumeration risks must be considered; some endpoints may intentionally return a generic response.

---

# 58. Frontend Authorization

Frontend may use permissions for UX:

```text
show button
hide button
disable action
display read-only state
```

But:

> Frontend authorization is UX, not security.

Backend must independently verify every protected operation.

---

# 59. Customer Authorization

Customers may access:

```text
their profile
their addresses
their carts
their orders
their returns
their refunds
their tickets
```

They must not access another customer's resources.

Example:

```text
GET /orders/order-B
```

from Customer A:

```text
DENY
```

even if Customer A knows the order ID.

---

# 60. Seller Authorization

Seller users are restricted to their seller organization.

Example:

```text
Seller A
```

may manage:

```text
Seller A listings
Seller A inventory
Seller A orders
Seller A warehouse data
Seller A seller profile
```

but not Seller B.

---

# 61. Catalog Authorization

Catalog access must separate:

```text
Create
Edit
Submit
Review
Approve
Publish
Suspend
Delete
```

These must not be collapsed into one unrestricted permission.

---

# 62. Support Authorization

Support agents may access customer/seller information required for ticket resolution.

They must not automatically have:

```text
refund.approve
settlement.release
seller.suspend
permission.assign
```

unless explicitly authorized.

Support actions must be audited.

---

# 63. Delivery Authorization

Delivery users may access operational delivery information.

Typical permissions:

```text
delivery.read
delivery.accept
delivery.pickup
delivery.update
delivery.proof.submit
```

They should not access unrelated financial or control functions.

---

# 64. Finance Authorization

Finance must use separate permissions.

Example:

```text
finance.read
refund.read
refund.create
refund.approve
settlement.read
settlement.approve
settlement.release
reconciliation.read
```

Approval and release may require separation-of-duties.

---

# 65. Control Authorization

Control users have the highest legitimate operational authority but still operate under explicit permissions.

Example:

```text
seller.suspend
seller.activate
product.suspend
platform.configure
role.manage
permission.manage
audit.read
```

Even control users should be subject to:

```text
step-up
audit
reason
approval
risk controls
```

where required.

---

# 66. Security Event Model

Security events should include:

```text
LOGIN_SUCCESS
LOGIN_FAILURE
OTP_REQUESTED
OTP_FAILED
PASSWORD_CHANGED
PASSWORD_RESET
SESSION_CREATED
SESSION_REVOKED
REFRESH_ROTATION
REFRESH_REUSE_DETECTED
PASSKEY_REGISTERED
PASSKEY_REVOKED
ACCOUNT_SUSPENDED
PERMISSION_CHANGED
ROLE_CHANGED
PRIVILEGED_ACTION
STEP_UP_SUCCESS
STEP_UP_FAILURE
IMPERSONATION_STARTED
IMPERSONATION_ENDED
BREAK_GLASS_ACTIVATED
```

---

# 67. Audit Requirements

Privileged actions must create immutable/auditable records containing where applicable:

```text
actor
actor_type
organization
action
resource
resource_id
previous_state
new_state
reason
timestamp
request_id
correlation_id
source
risk information
approval reference
```

Sensitive values must be redacted.

Passwords, OTPs, tokens and payment secrets must never appear in logs.

---

# 68. Authorization Audit Example

Example:

```text
Actor:
CONTROL_USER_123

Action:
seller.suspend

Resource:
SELLER_456

Reason:
Policy violation

Approval:
APPROVAL_789

Step-up:
SUCCESS

Result:
SUCCESS

Timestamp:
UTC timestamp

Request ID:
REQ_123
```

---

# 69. Security Logging

Security logs should support detection of:

* brute-force attacks
* credential stuffing
* impossible session behavior
* token reuse
* privilege escalation
* mass authorization failures
* unusual impersonation
* excessive sensitive-data access
* repeated step-up failures
* suspicious API usage

---

# 70. Rate Limiting

Authentication endpoints require strict rate limiting.

Examples:

```text
login
OTP request
OTP verification
password reset
refresh
passkey authentication
step-up
```

Limits may be applied using combinations of:

```text
IP
account
device/session
endpoint
risk score
```

Rate limiting must not create easy denial-of-service attacks against legitimate users.

---

# 71. Brute Force Protection

Repeated authentication failures may trigger:

```text
progressive delay
temporary lock
additional verification
risk scoring
security alert
```

Account lockout strategy must avoid allowing attackers to intentionally lock other users' accounts indefinitely.

---

# 72. Token Theft Protection

Controls include:

```text
short access-token lifetime
refresh rotation
reuse detection
session revocation
secure storage
TLS
device/session visibility
risk monitoring
```

Where appropriate, stronger sender-constrained mechanisms may be considered.

---

# 73. CSRF

If authentication uses cookies, CSRF protection must be implemented.

Possible controls:

```text
SameSite cookies
CSRF tokens
Origin validation
secure cookie configuration
```

If bearer tokens are used in Authorization headers, CSRF characteristics differ, but XSS/token theft risks must still be addressed.

---

# 74. XSS

Authentication architecture must assume XSS is dangerous.

Controls:

* output encoding
* input validation
* CSP
* secure headers
* safe rendering
* no token exposure in DOM
* avoid unnecessary browser storage of long-lived credentials

---

# 75. Token Storage

Browser applications should avoid unsafe long-term storage of sensitive tokens where possible.

Recommended architecture should prefer secure mechanisms appropriate to the deployment model, such as:

```text
short-lived access token
+
secure HttpOnly refresh/session mechanism
```

The final implementation must explicitly evaluate:

```text
XSS
CSRF
cross-origin architecture
mobile clients
PWA
static hosting
API domain separation
```

---

# 76. Mobile Authentication

Mobile applications must use platform-appropriate secure storage.

Refresh credentials must not be stored in plaintext application storage.

Possible mechanisms:

```text
iOS Keychain
Android Keystore-backed storage
secure platform credential storage
```

---

# 77. Session Concurrency

Bilokat may enforce configurable session limits.

Examples:

```text
Customer:
multiple devices allowed

Seller:
limited concurrent sessions

Control:
strict concurrent session policy
```

Security-sensitive accounts may have stricter rules.

---

# 78. Device Revocation

Users or authorized security staff may revoke a specific session/device.

Example:

```text
Android Phone
 ↓
Revoke
 ↓
Session invalidated
```

Other sessions remain active unless policy requires global revocation.

---

# 79. Global Logout

Global logout should:

```text
revoke all refresh sessions
invalidate session families
create security event
```

It may be triggered by:

```text
user request
password reset
security incident
account suspension
administrator action
```

---

# 80. Risk-Based Authorization

High-risk behavior may trigger additional checks.

Signals may include:

```text
new device
new location
abnormal IP reputation
impossible travel pattern
rapid permission changes
unusual transaction amount
unusual refund behavior
mass operations
```

Risk systems should assist authorization but must not silently override deterministic security requirements.

---

# 81. Sensitive Operation Confirmation

For critical actions:

```text
permission check
+
step-up
+
explicit confirmation
+
reason
```

Example:

```text
Suspend Seller
```

UI asks:

```text
Reason:
[________________]

Confirm suspension:
[ YES ]
```

Backend independently validates the same requirements.

---

# 82. Bulk Operations

Bulk operations are high-risk because one request may affect many resources.

Example:

```text
Suspend 500 listings
```

Authorization must consider:

```text
bulk permission
resource count
scope
risk
approval threshold
audit
```

Bulk operations must not bypass per-resource authorization.

---

# 83. Background Jobs

Background workers must use service identities.

A worker must not run with unrestricted database privileges.

Example:

```text
notification-worker
```

may:

```text
notification.read
notification.send
```

but not:

```text
seller.suspend
settlement.release
```

---

# 84. Database-Level Protection

Application authorization is primary.

However, sensitive tables may additionally use database-level controls where justified.

Examples:

```text
database roles
restricted credentials
schema permissions
row-level security where appropriate
```

Database credentials must never be exposed to frontends.

---

# 85. Direct Database Access

No frontend application may directly connect to PostgreSQL.

Architecture:

```text
Frontend
 ↓
Bilokat API
 ↓
Authorization
 ↓
Service
 ↓
Database
```

Never:

```text
Frontend
 ↓
PostgreSQL
```

---

# 86. Mass Assignment Protection

API DTOs must explicitly define writable fields.

A request such as:

```text
{
  "name": "Test",
  "role": "CONTROL_ADMIN",
  "organizationId": "OTHER_ORG"
}
```

must not automatically update fields merely because they exist in the database model.

Use:

```text
DTO allowlists
validation
authorization
service-level field restrictions
```

---

# 87. Object-Level Authorization

Every object access must be checked.

Never assume:

```text
valid JWT
=
access to any object
```

Instead:

```text
JWT
+
permission
+
object scope
+
ownership
```

---

# 88. Field-Level Authorization

Some resources require field-level restrictions.

Example customer object:

```text
Support:
name
phone
address

Finance:
financial information required for settlement

Control:
broader operational fields
```

Sensitive fields must not be returned simply because the user can read the parent object.

---

# 89. Response Minimization

API responses must return only necessary fields.

Do not expose:

```text
password hashes
refresh token hashes
internal secrets
private provider credentials
internal security metadata
unnecessary PII
```

---

# 90. Authorization and Caching

Authorization-sensitive data must not be incorrectly cached across users.

Examples:

```text
private API responses
seller-specific inventory
customer orders
KYC information
support tickets
```

Cache keys must include required authorization context.

---

# 91. Authorization and Search

Search results must respect authorization.

Example:

A seller searching products must not retrieve another seller's private drafts merely by manipulating search filters.

Search index access must enforce visibility rules.

---

# 92. Authorization and Analytics

Analytics queries must respect data scope.

Example:

```text
Seller A
```

may access Seller A metrics.

A platform-wide analytics user may access aggregate platform metrics if explicitly permitted.

Customer-level sensitive analytics requires additional restrictions.

---

# 93. Authorization and Exports

Exports can contain large quantities of data and therefore require additional controls.

Example:

```text
customer.export
seller.export
finance.export
```

Exports should support:

* permission checks
* scope
* audit
* rate limits
* asynchronous processing
* secure temporary download
* expiration
* access logging

---

# 94. Authorization and Notifications

Notification content must respect ownership and privacy.

A user must not receive another user's private notification through manipulated IDs.

---

# 95. Authorization and Returns

Return operations must verify:

```text
customer ownership
order state
return eligibility
time window
item relationship
permission
```

A customer cannot create a return against another customer's order merely by knowing its ID.

---

# 96. Authorization and Refunds

Refunds are high-risk.

Required checks may include:

```text
authenticated actor
refund permission
order relationship
refund eligibility
amount validation
payment state
existing refund state
approval policy
step-up
audit
```

AI cannot independently approve a refund.

---

# 97. Authorization and Settlements

Settlement operations must enforce:

```text
finance role
seller scope
settlement state
financial rules
approval policy
step-up
audit
```

Financial records must not be silently overwritten.

---

# 98. Authorization and Inventory

Inventory mutation requires:

```text
inventory.update
+
warehouse scope
+
product/variant scope
+
business state
+
concurrency controls
```

AI recommendations must not directly mutate stock.

---

# 99. Security Boundary for AI

AI is considered an untrusted decision-support component unless explicitly constrained.

AI output:

```text
Recommendation
```

must not be treated as:

```text
Authorization
```

Example:

```text
AI says seller is fraudulent
```

does not itself authorize:

```text
seller.suspend
```

The deterministic risk/policy system and authorized human workflow must decide.

---

# 100. Authorization Failure Handling

Authorization failures must:

* fail closed
* avoid sensitive information leakage
* produce appropriate security logs
* maintain stable API contracts
* avoid stack traces in production

Client-facing error:

```text
Forbidden
```

Internal logs may contain diagnostic policy information.

---

# 101. Security Headers

Applications must use appropriate security headers such as:

```text
Content-Security-Policy
Strict-Transport-Security
X-Content-Type-Options
Referrer-Policy
```

Exact configuration depends on deployment architecture.

---

# 102. Transport Security

Authentication and authorization traffic must use HTTPS/TLS.

Sensitive credentials must never be transmitted over plaintext HTTP.

Production cookies, where used, must use:

```text
Secure
HttpOnly
appropriate SameSite
```

---

# 103. Time Synchronization

Authentication systems depend on accurate timestamps.

Production infrastructure must maintain reliable time synchronization.

JWT validation, OTP expiry, replay protection and signed requests depend on correct time handling.

---

# 104. Authorization Testing

Minimum tests:

### Authentication

```text
valid login
invalid password
expired OTP
reused OTP
brute-force protection
password reset
session expiration
logout
refresh rotation
refresh reuse detection
```

### Authorization

```text
valid permission
missing permission
wrong role
wrong organization
wrong seller
wrong warehouse
wrong resource
wrong state
suspended user
revoked session
expired token
```

---

# 105. BOLA / IDOR Tests

Test:

```text
Customer A → Customer B order
Seller A → Seller B product
Seller A → Seller B inventory
Support → unauthorized financial object
```

Every unauthorized object access must fail.

---

# 106. Privilege Escalation Tests

Test attempts such as:

```text
seller → control
catalog editor → reviewer
support → finance
customer → seller
user → self-admin
```

through:

```text
API manipulation
JWT manipulation
request body fields
URL IDs
query parameters
headers
```

All must fail.

---

# 107. Token Security Tests

Test:

```text
expired access token
tampered token
wrong issuer
wrong audience
invalid signature
revoked session
old refresh token
refresh token reuse
wrong token version
cross-organization token use
```

---

# 108. Session Security Tests

Test:

```text
logout
global logout
session revocation
password change
account suspension
device revocation
expired session
concurrent sessions
stolen refresh token
```

---

# 109. Step-Up Tests

Test:

```text
high-risk action without step-up
expired step-up
wrong step-up purpose
reused step-up
wrong user
wrong session
successful step-up
```

---

# 110. Separation-of-Duties Tests

Test:

```text
requester == approver
```

for operations requiring dual approval.

It must be rejected when policy requires two independent actors.

---

# 111. AI Authorization Tests

Test that AI cannot:

```text
grant permissions
approve refunds
release settlements
suspend sellers
modify inventory
change prices
change roles
```

unless a specifically designed and approved workflow exists with deterministic authorization and required human approval.

---

# 112. Security Regression Suite

Every authorization vulnerability discovered in production must become a permanent regression test.

Example:

```text
BOLA-001
PrivilegeEscalation-002
RefreshReuse-003
CrossTenant-004
```

The issue must remain covered after refactoring.

---

# 113. Observability

Authentication/authorization metrics should include:

```text
login success/failure
OTP success/failure
refresh failures
refresh reuse detections
session revocations
authorization denials
privileged actions
step-up challenges
step-up failures
impersonation
break-glass use
```

Metrics must avoid exposing secrets or unnecessary PII.

---

# 114. Alerts

Security monitoring should alert on patterns such as:

```text
large authentication failure spike
refresh token reuse
mass permission denial
rapid privilege changes
unexpected break-glass activation
unusual impersonation
suspicious session behavior
mass sensitive-data access
```

---

# 115. Configuration Management

Security policies should be centrally configurable where appropriate.

Examples:

```text
access token lifetime
refresh token lifetime
session lifetime
OTP expiry
OTP attempt limits
step-up validity
session limits
dual approval thresholds
```

Security-sensitive configuration changes require authorization and audit.

---

# 116. Secret Management

Secrets must not be committed to source control.

Examples:

```text
JWT signing keys
database passwords
Redis credentials
payment provider secrets
OAuth client secrets
webhook secrets
storage credentials
AI provider keys
```

Use environment/secret management infrastructure appropriate to deployment.

Secrets require:

```text
rotation
access control
audit
minimum privilege
```

---

# 117. Key Rotation

Cryptographic signing keys must support controlled rotation.

The system should support:

```text
current signing key
previous verification key
key identifier
rotation procedure
```

Rotation must not unnecessarily invalidate all legitimate sessions unless required by the security event.

---

# 118. Incident Response

If authentication infrastructure is compromised:

```text
Identify incident
 ↓
Contain
 ↓
Revoke affected sessions
 ↓
Rotate compromised credentials/keys
 ↓
Invalidate affected tokens
 ↓
Investigate audit logs
 ↓
Restore secure state
 ↓
Regression testing
```

---

# 119. Authorization Design Principles

Bilokat authorization must always follow:

```text
DENY BY DEFAULT
```

```text
LEAST PRIVILEGE
```

```text
EXPLICIT PERMISSIONS
```

```text
SERVER-SIDE ENFORCEMENT
```

```text
RESOURCE OWNERSHIP
```

```text
TENANT ISOLATION
```

```text
BUSINESS-STATE VALIDATION
```

```text
FAIL CLOSED
```

```text
AUDIT PRIVILEGED OPERATIONS
```

```text
AI NEVER BYPASSES AUTHORIZATION
```

---

# 120. Non-Negotiable Security Rules

The following are mandatory:

1. Frontend must never be the final authorization authority.
2. JWT claims alone must not grant unrestricted access.
3. Every protected resource must have server-side authorization.
4. Every seller operation must respect seller/organization scope.
5. Every customer private resource must respect ownership.
6. Permission names must be explicit.
7. Roles must be collections of permissions, not magic superpowers.
8. RBAC must be supplemented with ABAC/ownership/business-state checks.
9. Access tokens must be short-lived.
10. Refresh tokens must support rotation.
11. Refresh-token reuse must be detected.
12. Sessions must be revocable.
13. Suspended users must not continue receiving unrestricted access.
14. Passwords must never be stored plaintext.
15. OTPs must be short-lived and single-use.
16. Sensitive operations must support step-up authentication.
17. Critical operations may require dual approval.
18. AI must not independently perform critical business mutations.
19. Secrets must never be logged.
20. Payment credentials must not be stored unnecessarily.
21. KYC/PII must use least privilege.
22. Cross-tenant access must be impossible by ID manipulation.
23. Bulk operations must not bypass authorization.
24. Service accounts must have minimum permissions.
25. All critical authorization changes must be auditable.

---

# 121. Implementation Checklist

Before implementation is considered complete:

## Authentication

```text
[ ] User authentication
[ ] Password hashing
[ ] OTP
[ ] Password reset
[ ] Passkey/WebAuthn where enabled
[ ] Access tokens
[ ] Refresh tokens
[ ] Refresh rotation
[ ] Reuse detection
```

## Sessions

```text
[ ] Session creation
[ ] Session listing
[ ] Session expiration
[ ] Session revocation
[ ] Device revocation
[ ] Global logout
[ ] Password-change invalidation
[ ] Suspension invalidation
```

## Authorization

```text
[ ] Permission registry
[ ] Role registry
[ ] Role-permission mapping
[ ] Scope mapping
[ ] ABAC policies
[ ] Ownership checks
[ ] Organization isolation
[ ] Business-state policies
[ ] Field-level restrictions
```

## Privileged Access

```text
[ ] Step-up authentication
[ ] High-risk action policy
[ ] Dual approval
[ ] Break-glass
[ ] JIT access where required
[ ] Impersonation controls
```

## Services

```text
[ ] Service identity
[ ] Service permissions
[ ] API key management
[ ] Webhook authentication
```

## AI

```text
[ ] AI identity
[ ] AI tool permissions
[ ] AI capability scopes
[ ] Critical-action restrictions
[ ] Human approval workflow
```

## Security

```text
[ ] Rate limiting
[ ] Brute-force protection
[ ] CSRF protection where applicable
[ ] XSS protection
[ ] Secure headers
[ ] Secret management
[ ] Key rotation
[ ] Security logging
[ ] Audit logging
```

## Testing

```text
[ ] Unit tests
[ ] Integration tests
[ ] Authorization tests
[ ] BOLA/IDOR tests
[ ] Privilege escalation tests
[ ] Token tests
[ ] Session tests
[ ] Step-up tests
[ ] Cross-tenant tests
[ ] AI authorization tests
[ ] Regression tests
```

---

# 122. Completion Gate

`05-AUTH-RBAC-ABAC.md` is considered implemented only when:

```text
Authentication
        +
Token Contract
        +
Session Contract
        +
Explicit Permissions
        +
RBAC
        +
ABAC
        +
Ownership
        +
Tenant Isolation
        +
Business-State Authorization
        +
Step-Up
        +
Privileged Access
        +
Service Authentication
        +
AI Authorization
        +
Audit
        +
Security Testing
```

are implemented and verified.

Documentation alone does not satisfy completion.

The implementation must be:

```text
CODED
INTEGRATED
TESTED
SECURED
AUDITED
OBSERVABLE
PRODUCTION-VERIFIED
```

---

# 123. Final Authorization Contract

The final Bilokat authorization contract is:

```text
WHO ARE YOU?
      ↓
ARE YOU AUTHENTICATED?
      ↓
IS YOUR SESSION VALID?
      ↓
IS YOUR TOKEN VALID?
      ↓
IS YOUR ACCOUNT ACTIVE?
      ↓
WHICH ORGANIZATION DO YOU BELONG TO?
      ↓
WHICH ROLE DO YOU HAVE?
      ↓
WHICH EXPLICIT PERMISSION DO YOU HAVE?
      ↓
WHAT IS YOUR SCOPE?
      ↓
DO YOU OWN / CONTROL THIS RESOURCE?
      ↓
DO ABAC POLICIES ALLOW THIS?
      ↓
DOES THE BUSINESS STATE ALLOW THIS ACTION?
      ↓
IS STEP-UP REQUIRED?
      ↓
IS APPROVAL REQUIRED?
      ↓
IS THE ACTION SAFE TO EXECUTE?
      ↓
AUDIT
      ↓
ALLOW
```

If any mandatory condition fails:

```text
DENY
```

This contract is the authoritative security boundary for Bilokat.

---

# 124. Dependency With Other Specifications

This document depends on:

```text
00-MASTER-SPEC.md
01-ARCHITECTURE.md
03-DATABASE-DESIGN.md
04-API-SPECIFICATION.md
```

It directly influences:

```text
06-EVENT-ARCHITECTURE.md
07-AI-INTELLIGENCE.md
08-UI-ROUTES.md
09-SECURITY-SPEC.md
```

Authentication and authorization decisions must remain consistent across all other Bilokat specifications.

---

# 125. Next Specification

After this document is implemented and verified, the next architecture document is:

```text
06-EVENT-ARCHITECTURE.md
```

It will define:

```text
Domain Events
Event Contracts
Event Versioning
Outbox Pattern
Idempotency
Event Consumers
Queues
Retries
Dead Letter Queues
Ordering
Event Security
Audit Events
Analytics Events
AI Events
Notification Events
Cross-Service Communication
Observability
Failure Recovery
```



---

# Session 14 addendum — Seller onboarding / KYC (orgs, applications, REVIEWER)

Role gates that changed this session:

- A dedicated `REVIEWER` staff role was added with **onboarding-only scope**. A REVIEWER
  may list/read seller applications and reviews, verify KYC documents, and activate an
  APPROVED seller to ACTIVE. A REVIEWER is **denied** finance (`/finance/**`),
  settlement, fulfilment (`/fulfilment/**`), returns operator (`/return-requests/**`),
  seller order ops (`/seller/orders/**`), and seller admin-create routes.
- `OPERATOR`/`ADMIN` retain operational control: `adminCreateSeller`, and setting
  ACTIVE/SUSPENDED/DEACTIVATED via the seller status route.
- `ADMIN` inherits REVIEWER capabilities (list/review/verify/activate) in addition to its
  own.

New/auth-touched endpoints:

- `POST /auth/seller-register` (public) — self-service seller signup. Creates a SELLER-type
  `Organization`, a PENDING `Seller`, a DRAFT `SellerApplication`, an ACTIVE SELLER user and an
  OWNER `OrganizationMember`, then returns `{ user, tokens, seller }`.
- `GET/PATCH /seller/onboarding/me|profile`, `POST /seller/onboarding/documents`,
  `POST /seller/onboarding/submit` (SELLER-role owner only; bound to the caller's own seller).
- `POST /seller-onboarding/sellers` (OPERATOR/ADMIN) — operator-managed seller creation.
- `GET /seller-onboarding/applications`, `GET .../applications/:id`,
  `POST .../applications/:id/review` (REVIEWER/ADMIN).
- `POST /seller-onboarding/documents/:id/verify` (REVIEWER/ADMIN).
- `POST /seller-onboarding/sellers/:id/activate` (REVIEWER/ADMIN/OPERATOR).
- `POST /seller-onboarding/sellers/:id/status` (OPERATOR/ADMIN).

Seller lifecycle used by onboarding (state machine):

```
REGISTERED -> PENDING -> UNDER_REVIEW --(approve)--> APPROVED --(activate)--> ACTIVE
                                \--(correction/additional info)--> PENDING (resubmit loop)
                                \--(reject)--> REJECTED
ACTIVE --(operator)--> SUSPENDED | DEACTIVATED  ;  SUSPENDED/DEACTIVATED --(operator)--> ACTIVE
```

Owner editing/submission is allowed only while the seller is REGISTERED/PENDING/UNDER_REVIEW;
once ACTIVE the owner's onboarding surface is read-only (`409 Onboarding is not editable`).

Document uploads record **storage intent only** (`storageObjectId`, `fileName`, `mimeType`,
`sizeBytes`); no real object store is contacted. Bank details are stored as holder name,
account last-4 and IFSC only.


---

# Session 15 addendum — DELIVERY role + per-slice courier delivery

A new `DELIVERY` role (courier / delivery partner) was added with courier-task-only scope. A
DELIVERY user has exactly one bound `DeliveryPartner` profile (registered by OPERATOR/ADMIN).
A DELIVERY user may only read and act on its own delivery assignments; it is denied finance,
fulfilment/returns operator, seller, and admin-delivery routes. OPERATOR/ADMIN register and
manage partners + assignments; REVIEWER/OPERATOR/SELLER/CUSTOMER are denied the courier task
surface.

Endpoints added (all under `/api/v1`):
- OPERATOR/ADMIN `POST /delivery/partners`, `GET /delivery/partners`,
  `PATCH /delivery/partners/:partnerId/status`, `GET /delivery/assignments`,
  `GET /delivery/assignments/:id`, `POST /delivery/slices/:sellerOrderId/assign`,
  `POST /delivery/slices/:sellerOrderId/reassign`, `POST /delivery/assignments/:id/cancel`.
- DELIVERY `GET /delivery/tasks`, and per assignment `POST /delivery/tasks/:id/accept |
  reject | pickup | out-for-delivery | deliver | fail` (reject/fail require a reason).

Slice assignment lifecycle: ASSIGNED → ACCEPTED → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED,
with REJECTED / FAILED / CANCELLED. Assign requires the slice ACCEPTED + not delivered and the
order SHIPPED or OUT_FOR_DELIVERY. Delivering the last outstanding slice finalizes the order to
DELIVERED (order `deliveredAt`, COD_PAID for COD, `order_status_history`) and auto-earns the
accepted slices' seller payables — the Session 12/13 money trigger is unchanged (order-level,
per owner decision). `delivery_events` audit every step.

# Session 16 addendum — Return replacement vs refund + evidence upload (access)

No new roles. Role gates that changed this session:

- Customer evidence upload `POST /api/v1/orders/:orderId/returns/:returnRequestId/evidence`
  is **CUSTOMER, own-order/own-request only** (service enforces the caller owns the order →
  cross-owner 404). No cross-tenant upload.
- Operator evidence upload `POST /api/v1/return-requests/:returnRequestId/evidence` is
  **OPERATOR/ADMIN only** (RolesGuard) — CUSTOMER (and DELIVERY/REVIEWER) are 403.
- The REPLACEMENT issuance decision rides the existing operator inspection endpoint
  `POST /api/v1/return-requests/:returnRequestId/inspection` which stays **OPERATOR/ADMIN
  only**; DELIVERY and REVIEWER remain denied the operator returns surface (`/return-requests/**`).
- Refund endpoints (`/return-requests/:id/refund`, `/refund/complete`) remain
  OPERATOR/ADMIN; a `REPLACEMENT_ISSUED` request cannot enter them (409) so no money path
  is reachable from a replacement.
- No DELIVERY/REVIEWER surface was opened for evidence or replacement; Session 15/14 RBAC
  negatives remain valid.
