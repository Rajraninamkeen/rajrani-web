# BILOKAT — CUSTOMER UI/UX SPECIFICATION

**Document:** `11-CUSTOMER-UI-UX-SPEC.md`
**Version:** 1.0
**Status:** Production Specification
**Application:** `customer-web`
**Platform:** Bilokat Multi-Seller Marketplace

---

# 1. PURPOSE

This document defines the production-grade customer-facing UI/UX architecture for Bilokat.

The goal is to create a customer experience that is:

* familiar like leading marketplaces
* original to Bilokat
* fast
* responsive
* accessible
* mobile-first
* trustworthy
* personalized
* backend-driven
* secure
* scalable

The UI must never behave like a static demo.

All customer-specific information must come from authenticated backend APIs.

---

# 2. CORE UX PRINCIPLE

Bilokat customer UI follows:

```text
Simple to understand
+
Fast to use
+
Rich when needed
+
Minimal unnecessary complexity
+
Real-time backend state
+
Strong security
+
Consistent visual language
```

The interface should feel immediately familiar to users of large marketplaces while retaining Bilokat's own:

* typography
* spacing
* cards
* icons
* color system
* navigation
* motion
* account architecture
* information hierarchy

No direct visual cloning of Amazon, Flipkart, Meesho or another marketplace.

---

# 3. CUSTOMER APPLICATION

Repository:

```text
customer-web/
```

Responsibilities:

* public marketplace UI
* authentication UI
* customer account UI
* product browsing
* search
* cart
* checkout
* orders
* returns
* wishlist
* addresses
* notifications
* customer AI features

It must not contain:

* seller administration
* finance administration
* control-panel functionality
* support-agent controls
* delivery-partner controls

---

# 4. ROUTE ARCHITECTURE

```text
/
├── /login
├── /register
├── /forgot-password
├── /verify
│
├── /account
├── /account/profile
├── /account/orders
├── /account/orders/[orderId]
├── /account/returns
├── /account/refunds
├── /account/addresses
├── /account/wishlist
├── /account/coupons
├── /account/notifications
├── /account/payments
├── /account/security
├── /account/settings
│
├── /cart
├── /checkout
│
├── /products/[slug]
├── /category/[slug]
├── /search
│
└── /ai
```

Routes may evolve without breaking the public API contract.

---

# 5. AUTHENTICATION STATE

The application must understand:

```text
ANONYMOUS
AUTHENTICATING
AUTHENTICATED
SESSION_EXPIRED
ACCOUNT_RESTRICTED
ACCOUNT_SUSPENDED
```

The UI must respond appropriately to each state.

---

# 6. HEADER — LOGGED OUT

Desktop header should provide:

```text
Bilokat Logo
Search
Location
Login / Account
Wishlist
Cart
```

Mobile:

```text
Logo
Search
Cart
Account
```

Navigation should remain uncluttered.

---

# 7. HEADER — LOGGED IN

The account control should become a meaningful customer entry point.

Example:

```text
Hello, Rahul
Account
```

or an avatar/name presentation.

Hover/click menu may expose:

```text
My Profile
My Orders
Wishlist
Addresses
Coupons
Notifications
Account Settings
Logout
```

The complete account page remains the primary destination.

---

# 8. ACCOUNT ENTRY

Clicking:

```text
Account
```

must navigate to:

```text
/account
```

The user should immediately understand:

* who they are
* what is happening with their orders
* useful shortcuts
* account health
* recent activity
* personalized recommendations

---

# 9. ACCOUNT PAGE — HIGH LEVEL

The page should be structured into visual sections.

```text
┌─────────────────────────────────────────────┐
│ Profile Header                              │
│ Avatar | Name | Verification | Edit        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Order Snapshot                              │
│ To Pay | Processing | Shipped | Delivered   │
└─────────────────────────────────────────────┘

┌──────────────────┬──────────────────────────┐
│ My Orders        │ Wishlist                 │
├──────────────────┼──────────────────────────┤
│ Addresses        │ Coupons & Offers         │
├──────────────────┼──────────────────────────┤
│ Returns/Refunds  │ Notifications             │
├──────────────────┼──────────────────────────┤
│ Security         │ Settings                 │
└──────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────┐
│ Recently Viewed / Reorder                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Recommended For You                         │
└─────────────────────────────────────────────┘
```

Desktop and mobile layouts must adapt rather than simply shrink.

---

# 10. PROFILE HERO

The top section is the customer's identity card.

Display:

* profile image/avatar
* customer name
* verified email indicator
* verified mobile indicator
* member/account information where applicable
* Edit Profile action

Example hierarchy:

```text
[Avatar]

Rahul Sharma
Mobile Verified
Email Verified

[Edit Profile]
```

Do not expose unnecessary personal information.

---

# 11. PROFILE PHOTO

Users may:

* upload
* replace
* remove

Validation:

* supported image formats
* file size
* MIME validation
* image signature
* dimensions
* safe processing

The frontend must not assume an upload is successful.

Backend response is authoritative.

---

# 12. PROFILE API

Example:

```text
GET /api/v1/me
PATCH /api/v1/me
POST /api/v1/me/avatar
DELETE /api/v1/me/avatar
```

The exact API must follow `04-API-SPECIFICATION.md`.

---

# 13. PROFILE DATA

Potential fields:

```text
id
displayName
firstName
lastName
avatar
email
emailVerified
mobile
mobileVerified
createdAt
```

Optional fields should only be displayed if configured/required.

---

# 14. PROFILE EDIT UX

Editing should be clear and safe.

Example:

```text
Full Name
[________________]

Email
[user@example.com] ✓

Mobile
[********12] ✓

[Save Changes]
```

Sensitive identity changes may require verification.

---

# 15. PROFILE SAVE FLOW

```text
Edit
 ↓
Client Validation
 ↓
API Request
 ↓
Server Validation
 ↓
Authorization
 ↓
Update
 ↓
Audit if applicable
 ↓
Updated Profile
 ↓
UI Refresh
```

Never optimistically show permanent success before server confirmation for important profile changes.

---

# 16. ORDER SNAPSHOT

Account homepage should immediately expose current order activity.

Cards:

```text
To Pay
Processing
Shipped
Delivered
Returns
```

Each card shows a count from backend data.

Example:

```text
Processing
3
```

Clicking opens the appropriate filtered order list.

---

# 17. ORDER DATA

Orders must be fetched from the backend.

Never hardcode:

```text
Order #12345
₹999
Delivered
```

into production UI.

---

# 18. MY ORDERS

Route:

```text
/account/orders
```

Tabs:

```text
All
To Pay
Processing
Shipped
Delivered
Cancelled
Returned
```

Filters:

* date
* seller
* category
* order status
* payment type

---

# 19. ORDER CARD

Each order card should contain:

```text
Order ID
Order Date
Seller
Product Image
Product Name
Variant
Quantity
Price
Order Status
Delivery Estimate
Primary Action
Secondary Actions
```

Possible actions:

```text
Track
View Details
Cancel
Return
Buy Again
Download Invoice
Contact Support
```

Only show actions permitted by backend state.

---

# 20. ORDER STATUS

UI must derive status from backend.

Example:

```text
PLACED
PAYMENT_CONFIRMED
SELLER_ACCEPTED
READY_FOR_PICKUP
PICKED_UP
OUT_FOR_DELIVERY
DELIVERED
```

Exception states must be visually distinguishable.

---

# 21. ORDER TIMELINE

Order details should provide a visual timeline.

```text
✓ Order Placed
   10 Sep

✓ Payment Confirmed
   10 Sep

✓ Seller Accepted
   10 Sep

✓ Picked Up
   11 Sep

● Out for Delivery
   Today

○ Delivered
```

Timeline events come from backend state history.

---

# 22. MULTI-SELLER ORDER

A customer order may contain products from multiple sellers.

UI must clearly separate seller orders.

```text
Order #BK123456

Seller A
 ├── Product A
 └── Product B

Seller B
 ├── Product C
```

Each seller shipment may have:

* separate tracking
* separate delivery estimate
* separate cancellation
* separate return eligibility

---

# 23. ORDER DETAIL

Route:

```text
/account/orders/[orderId]
```

Sections:

```text
Order Header
Delivery Status
Products
Seller Information
Shipping Address
Payment Summary
Price Breakdown
Tracking
Actions
Support
Return/Refund
Invoice
```

---

# 24. PRICE BREAKDOWN

Show:

```text
Product Price
Quantity
MRP
Discount
Coupon Discount
Tax
Delivery Charge
Other Applicable Charges
Final Amount
```

The values must come from backend order snapshots.

Do not recalculate historical order totals from today's product price.

---

# 25. ORDER SNAPSHOT PRINCIPLE

Historical orders must display the values recorded at purchase time.

Changes to current:

* product price
* seller price
* coupon
* tax configuration

must not rewrite historical order presentation.

---

# 26. TRACKING

Tracking should be visually prominent.

Possible states:

```text
Seller Preparing
Ready for Pickup
Rider Assigned
Picked Up
Out for Delivery
Delivered
```

Where available:

* rider status
* ETA
* tracking reference
* last updated timestamp

---

# 27. DELIVERY MAP

If live map tracking is supported, it must be permission-controlled and privacy-safe.

Customer should only receive information intended for customer delivery tracking.

Do not expose unnecessary rider personal information.

---

# 28. RETURNS

Route:

```text
/account/returns
```

Sections:

```text
Active Returns
Awaiting Pickup
Inspection
Refund Processing
Completed
Rejected
```

---

# 29. RETURN REQUEST UX

From an eligible order:

```text
Select Item
 ↓
Select Quantity
 ↓
Select Reason
 ↓
Upload Evidence if required
 ↓
Review
 ↓
Submit
```

Eligibility must be checked server-side.

---

# 30. RETURN REASON

Examples:

```text
Damaged
Wrong Product
Missing Item
Defective
Not as Described
Quality Issue
Other
```

The actual list comes from backend policy configuration.

---

# 31. REFUND STATUS

Show:

```text
Refund Requested
Refund Approved
Refund Initiated
Refund Processing
Refund Completed
Refund Failed
```

Never show:

```text
Refund Successful
```

until the backend confirms completion.

---

# 32. ADDRESS MANAGEMENT

Route:

```text
/account/addresses
```

Features:

* add
* edit
* delete
* set default
* label
* validate

Labels:

```text
Home
Work
Other
```

---

# 33. ADDRESS CARD

Display:

```text
Rahul Sharma
Mobile
House / Building
Area
City
State
PIN
```

Sensitive data should be minimized where not needed.

---

# 34. DEFAULT ADDRESS

Only one address should be the active default per applicable customer scope.

Backend enforces uniqueness.

Frontend reflects backend state.

---

# 35. ADDRESS FORM

Fields may include:

```text
Name
Mobile
Address Line 1
Address Line 2
Landmark
City
State
PIN
Latitude/Longitude where supported
Label
```

Serviceability must be verified during checkout.

---

# 36. WISHLIST

Route:

```text
/account/wishlist
```

Each item:

```text
Image
Name
Seller
Price
MRP
Discount
Rating
Stock Status
Add to Cart
Remove
```

Current price/stock must be fetched from current backend state.

---

# 37. PRICE CHANGE

If wishlist price changes:

```text
Price dropped
Price increased
Currently unavailable
```

may be displayed.

Do not guarantee the previous price.

---

# 38. COUPONS

Route:

```text
/account/coupons
```

Sections:

```text
Available
Applied/Used
Expired
```

Coupon applicability must be backend-authoritative.

---

# 39. COUPON CARD

Show:

```text
Coupon Code
Benefit
Minimum Order
Valid Until
Applicable Products/Categories
Conditions
```

Never expose internal coupon rules that are not customer-facing.

---

# 40. NOTIFICATIONS

Route:

```text
/account/notifications
```

Categories:

```text
Orders
Delivery
Payments
Returns
Offers
Account
Security
```

Features:

* unread count
* mark read
* mark all read
* deep-link to relevant object

---

# 41. NOTIFICATION DATA

Example:

```text
notification_id
type
title
body
created_at
read_at
entity_type
entity_id
```

---

# 42. SECURITY CENTER

Route:

```text
/account/security
```

Sections:

```text
Password
Mobile Verification
Email Verification
Passkeys
Active Sessions
Login Activity
Logout Other Devices
```

---

# 43. ACTIVE SESSIONS

Show authorized session information without exposing secrets.

Example:

```text
Chrome
Windows
Current Session

Android App
Recently Active

Firefox
Last active 2 days ago
```

Actions:

```text
Logout
Logout Other Sessions
```

---

# 44. LOGIN ACTIVITY

Where supported:

```text
Date
Device
Browser
Approximate location
Result
```

Do not reveal sensitive infrastructure data.

---

# 45. PASSKEYS

If supported:

```text
Add Passkey
Rename Passkey
Remove Passkey
```

Use WebAuthn/passkey flows defined by the authentication architecture.

---

# 46. PASSWORD CHANGE

Flow:

```text
Current Verification
 ↓
New Password
 ↓
Strength Validation
 ↓
Server Validation
 ↓
Password Update
 ↓
Session Security Action
```

Password itself is never logged or exposed.

---

# 47. ACCOUNT SETTINGS

Route:

```text
/account/settings
```

Potential sections:

```text
Communication Preferences
Privacy
Language
Region
Accessibility
Personalization
Data Controls
```

---

# 48. COMMUNICATION PREFERENCES

Customer may control supported categories:

```text
Marketing Email
Promotional SMS
Offers
Product Recommendations
Push Notifications
```

Transactional notifications may be mandatory where legally/operationally required.

---

# 49. PERSONALIZATION

The customer can manage relevant personalization controls where implemented.

Examples:

```text
Recommended Products
Recently Viewed
Personalized Offers
Search Personalization
```

---

# 50. RECENTLY VIEWED

Account homepage may show:

```text
Recently Viewed
```

Products must come from actual customer activity.

If there is no history:

```text
Explore products to build your history.
```

---

# 51. REORDER

For eligible previous purchases:

```text
Buy Again
```

The system must verify:

* current availability
* current price
* seller
* serviceability
* product status

before adding/reordering.

---

# 52. RECOMMENDED FOR YOU

Recommendations may use:

* browsing behavior
* purchases
* category interests
* search behavior
* collaborative signals
* product similarity

Recommendations must be generated by the recommendation system defined in the AI architecture.

---

# 53. RECOMMENDATION TRANSPARENCY

Where useful:

```text
Because you viewed...
Similar to your recent purchase...
Popular in your area...
```

AI explanations must be evidence-based.

---

# 54. CUSTOMER AI ASSISTANT

Route:

```text
/ai
```

Potential capabilities:

```text
Find products
Compare products
Explain differences
Suggest alternatives
Help with orders
Explain return policy
Help discover products
```

---

# 55. AI ACCOUNT SAFETY

The customer AI assistant must not:

* access another customer's data
* expose internal seller data
* reveal payment secrets
* bypass return policy
* alter orders without authorization
* issue refunds autonomously
* modify account security without explicit authorized flow

---

# 56. AI ORDER HELP

Example:

```text
Where is my order?
```

AI may retrieve the customer's authorized order information through controlled tools.

Tool authorization must validate:

```text
customer identity
+
order ownership
+
permission
```

---

# 57. LOGIN PAGE

Route:

```text
/login
```

Should support:

* mobile/email
* password
* OTP where configured
* passkey where supported
* forgot password
* registration

---

# 58. LOGIN UX

The page should be:

* minimal
* fast
* trustworthy
* mobile-friendly

Avoid unnecessary distractions.

---

# 59. REGISTRATION

Route:

```text
/register
```

Potential:

```text
Name
Mobile/Email
Password or supported authentication method
OTP verification
Terms acceptance
```

Only collect necessary information.

---

# 60. OTP UX

OTP must be:

* purpose-bound
* short-lived
* rate-limited
* retry controlled
* server validated

UI should display:

```text
Code sent to ******1234
Resend in 00:28
```

Never expose the actual OTP.

---

# 61. SESSION EXPIRATION

If session expires:

```text
Session expired
Please sign in again.
```

The customer should not lose unrelated cart data.

Deep-link restoration should be supported where safe.

---

# 62. CART + ACCOUNT

Guest users can maintain a temporary cart.

After login:

```text
Guest Cart
+
Customer Cart
↓
Merge Rules
↓
Final Cart
```

The UI should explain conflicts where necessary.

---

# 63. CHECKOUT AUTHENTICATION

Checkout may require authentication according to the platform's rules.

The UI must not trust a frontend `isLoggedIn` flag for authorization.

Backend validates the session.

---

# 64. MOBILE-FIRST ACCOUNT

On mobile:

```text
Profile Header
 ↓
Order Snapshot
 ↓
Account Cards
 ↓
Recent Activity
 ↓
Recommendations
```

Cards should use large touch targets.

---

# 65. DESKTOP ACCOUNT

Desktop may use:

```text
Left Account Navigation
+
Main Content Area
```

Example:

```text
Account
├── Overview
├── Orders
├── Profile
├── Addresses
├── Wishlist
├── Coupons
├── Returns
├── Notifications
├── Payments
├── Security
└── Settings
```

---

# 66. RESPONSIVE BEHAVIOR

The UI must support:

```text
Mobile
Tablet
Laptop
Desktop
Large Desktop
```

Do not simply scale desktop layouts down.

Layouts must reorganize.

---

# 67. DESIGN SYSTEM

Bilokat customer UI must have a centralized design system.

Tokens:

```text
Colors
Typography
Spacing
Radius
Shadows
Borders
Motion
Breakpoints
Z-index
Icons
```

---

# 68. VISUAL IDENTITY

The visual system should communicate:

```text
Trust
Modern Marketplace
Speed
Discovery
Quality
Technology
```

The design must be recognizable as Bilokat without resembling a competitor's exact interface.

---

# 69. TYPOGRAPHY

Typography hierarchy should distinguish:

```text
Display
Page Title
Section Title
Card Title
Body
Secondary
Caption
Price
Discount
Status
```

Price typography should be especially readable.

---

# 70. PRODUCT CARD

Product cards should support:

```text
Image
Badge
Product Name
Rating
Review Count
Current Price
MRP
Discount
Seller
Delivery Information
Wishlist
```

Only show data actually returned by API.

---

# 71. IMAGE UX

Product images must support:

* lazy loading
* responsive sizing
* fallback
* skeleton
* error state
* appropriate aspect ratio

Do not distort product images.

---

# 72. LOADING STATES

Every account section must have meaningful loading states.

Example:

```text
Profile Skeleton
Order Skeleton
Address Skeleton
Wishlist Skeleton
```

Avoid a blank screen.

---

# 73. EMPTY STATES

Examples:

### No orders

```text
No orders yet

Discover something you'll love.
[Start Shopping]
```

### No wishlist

```text
Your wishlist is empty.
Save products you want to revisit.
```

### No notifications

```text
You're all caught up.
```

---

# 74. ERROR STATES

Errors must be actionable.

Example:

```text
We couldn't load your orders.

[Try Again]
```

Do not show raw:

```text
500 Internal Server Error
```

to customers.

---

# 75. OFFLINE STATE

If network disappears:

```text
You're offline.
Some account information may be unavailable.
```

Cached non-sensitive information may be displayed where appropriate.

Critical actions must require fresh backend confirmation.

---

# 76. OPTIMISTIC UI

Optimistic updates may be used for low-risk interactions such as:

* wishlist toggle
* notification read state

but must rollback if the API fails.

Do not use unsafe optimistic assumptions for:

* payment
* order creation
* cancellation
* refund
* account security
* financial operations

---

# 77. API STATE MANAGEMENT

Customer UI should use a consistent server-state strategy.

Requirements:

* request deduplication
* caching
* invalidation
* retry policy
* stale handling
* error handling

---

# 78. DATA INVALIDATION

After:

```text
Order cancellation
```

invalidate/update:

```text
Orders
Order detail
Account order counters
```

After:

```text
Wishlist modification
```

update:

```text
Wishlist
Product wishlist state
```

State must remain consistent.

---

# 79. REAL-TIME UPDATES

Where infrastructure supports it, order status may update through:

```text
WebSocket
SSE
Push Notification
Polling fallback
```

Example:

```text
Out for Delivery
```

may update without requiring a full page refresh.

---

# 80. NOTIFICATION DEEP LINKS

Notification:

```text
Your order has been shipped.
```

should open:

```text
/account/orders/[orderId]
```

after authorization validation.

---

# 81. ACCESS CONTROL

Frontend route guards improve UX.

Backend authorization remains authoritative.

Never rely on:

```text
hidden button
```

as security.

---

# 82. OBJECT OWNERSHIP

Customer requests such as:

```text
GET /orders/:id
```

must be checked server-side.

Customer A must never retrieve Customer B's order by changing the URL.

---

# 83. BOLA/IDOR PROTECTION

Every customer resource access must validate:

```text
authenticated customer
+
resource ownership
+
organization context where applicable
+
business state
```

---

# 84. SECURITY ERRORS

The UI must avoid account enumeration.

For example, authentication failures should not unnecessarily reveal whether an email/mobile exists.

---

# 85. XSS PROTECTION

User-generated data such as:

* names
* reviews
* addresses
* support messages

must be safely rendered.

Never inject untrusted HTML directly.

---

# 86. FILE UPLOAD UX

For profile/evidence uploads:

```text
Select File
 ↓
Client Validation
 ↓
Preview
 ↓
Upload
 ↓
Server Validation
 ↓
Success
```

Invalid files must receive understandable feedback.

---

# 87. ACCESSIBILITY

Target:

```text
WCAG 2.2 AA
```

Where applicable.

Requirements:

* keyboard navigation
* visible focus
* semantic HTML
* accessible labels
* sufficient contrast
* screen-reader support
* reduced motion
* proper error messaging

---

# 88. TOUCH UX

Interactive elements should have comfortable touch targets.

Avoid tiny:

```text
icon-only controls
```

without accessible labels.

---

# 89. MOTION

Motion should communicate:

* transition
* confirmation
* hierarchy
* loading
* state change

Avoid excessive animation.

Respect:

```text
prefers-reduced-motion
```

---

# 90. PERFORMANCE

Customer account pages must optimize:

* initial load
* API calls
* image loading
* bundle size
* rendering
* caching

Do not load every account module at once if unnecessary.

---

# 91. DATA FETCHING STRATEGY

Account overview may fetch:

```text
profile
order summary
recent orders
wishlist preview
notifications summary
recommendations
```

Critical information should load first.

Secondary sections can load progressively.

---

# 92. ACCOUNT PAGE PERFORMANCE

Recommended priority:

```text
1. Profile
2. Order status
3. Primary account actions
4. Recent orders
5. Notifications
6. Wishlist
7. Recommendations
```

---

# 93. ERROR ISOLATION

If recommendations fail:

```text
Account page continues working.
```

If wishlist fails:

```text
Orders still work.
```

If notification service fails:

```text
Profile remains usable.
```

One module must not crash the entire account page.

---

# 94. CUSTOMER DATA REFRESH

The application should refresh stale information appropriately.

Examples:

* order status
* delivery ETA
* notifications
* coupon availability

Critical values should be refreshed before critical actions.

---

# 95. PAYMENT HISTORY

If customer payment history is exposed:

Show safe information:

```text
Order
Payment Method Type
Amount
Status
Date
Gateway Reference where appropriate
```

Never display:

* CVV
* raw card number
* payment credentials
* authentication secrets

---

# 96. INVOICE

Customer may access invoice where available.

Example:

```text
Download Invoice
View Invoice
```

The backend must authorize access.

---

# 97. SUPPORT ENTRY

Every relevant order should provide:

```text
Need Help?
Contact Support
```

Support request should automatically carry permitted context:

```text
order_id
seller_order_id
issue category
```

Customer should not need to manually type the order ID.

---

# 98. SUPPORT CHAT

If implemented:

```text
Customer
 ↓
Support Conversation
 ↓
Agent
```

AI may assist classification/summarization.

Customer-visible answers must follow support policy.

---

# 99. ACCOUNT DELETION

If supported:

```text
/account/settings
```

Flow:

```text
Request Deletion
 ↓
Explain consequences
 ↓
Identity Verification
 ↓
Confirmation
 ↓
Backend Request
 ↓
Status
```

Deletion must follow platform retention/legal rules.

---

# 100. PRIVACY CONTROLS

Customer should be able to access available:

* privacy settings
* communication preferences
* data controls
* personalization settings

without exposing internal security architecture.

---

# 101. ACCOUNT SECURITY EVENTS

Security-sensitive events may generate:

```text
New Login
Password Changed
Email Changed
Mobile Changed
Passkey Added
Session Revoked
```

Notifications should use approved channels.

---

# 102. DESIGN OF HIGH-RISK ACTIONS

High-risk actions should use:

```text
Clear warning
+
Explicit confirmation
+
Verification where required
+
Server authorization
+
Audit where applicable
```

Examples:

* account deletion
* changing sensitive credentials
* cancelling certain orders
* initiating certain financial actions

---

# 103. ACCOUNT NAVIGATION

Desktop:

```text
Overview
Orders
Profile
Addresses
Wishlist
Coupons
Returns & Refunds
Notifications
Payments
Security
Settings
```

Mobile may use grouped sections:

```text
Shopping
Account
Payments
Security
Preferences
```

---

# 104. BOTTOM NAVIGATION

On mobile marketplace pages, optional persistent navigation:

```text
Home
Categories
Search
Cart
Account
```

The active account state should be visually clear.

---

# 105. SEARCH EXPERIENCE

Search must support:

* suggestions
* recent searches
* popular searches
* filters
* sorting
* typo tolerance
* semantic understanding where supported

Search analytics feed the backend intelligence layer.

---

# 106. CATEGORY EXPERIENCE

Category pages should dynamically use:

```text
Category Schema
Attributes
Filters
Sort
Products
```

No category-specific frontend hardcoding should be required for every new category.

---

# 107. PRODUCT DETAIL

Product page should contain:

```text
Images
Title
Rating
Price
Discount
Seller
Availability
Delivery
Variants
Attributes
Description
Reviews
Return Policy
Offers
Recommendations
```

---

# 108. SELLER INFORMATION

For marketplace trust, PDP should clearly identify the seller where applicable.

Potential:

```text
Sold by
Seller Name
Seller Rating
Fulfillment Information
```

Only backend-approved seller data is displayed.

---

# 109. PRODUCT AVAILABILITY

Customer UI should distinguish:

```text
In Stock
Low Stock
Out of Stock
Temporarily Unavailable
Not Deliverable to Location
```

Availability is backend authoritative.

---

# 110. PRICE DISPLAY

Display:

```text
Current Price
MRP
Discount
Applicable Offer
```

Do not infer discount from stale cached data if the backend provides an authoritative price.

---

# 111. LOCATION

Customer may set delivery location.

Location affects:

* availability
* delivery estimate
* shipping fee
* serviceability
* seller selection

The UI should make location state visible but not intrusive.

---

# 112. CHECKOUT UI

Checkout must clearly show:

```text
Address
Products
Seller
Delivery
Coupon
Payment
Final Total
```

Backend recalculates the final total.

---

# 113. CHECKOUT ERROR

If price/stock changes:

```text
Some items were updated.
Please review your cart before continuing.
```

Do not silently proceed with stale values.

---

# 114. ORDER CONFIRMATION

After successful order creation:

```text
Order Confirmed
Order ID
Amount
Expected Delivery
Products
Track Order
Continue Shopping
```

The success screen should only appear after backend confirmation.

---

# 115. CUSTOMER ACCOUNT DESIGN PRINCIPLE

The account should not feel like an administrative dashboard.

It should feel like:

```text
Personal Shopping Command Center
```

with:

* identity
* orders
* convenience
* discovery
* security
* personalized shopping

---

# 116. PERSONALIZATION WITHOUT CREEPINESS

Personalized content must be useful and explainable.

Prefer:

```text
Because you viewed...
You may also like...
Buy again...
Popular in...
```

Avoid unnecessary exposure of inferred sensitive characteristics.

---

# 117. RESPONSIVE ACCOUNT LAYOUT

## Mobile

```text
Header
Profile
Orders
Quick Actions
Account Sections
Activity
Recommendations
```

## Tablet

Hybrid card/grid layout.

## Desktop

```text
Sidebar
+
Main Content
```

---

# 118. SKELETON DESIGN

Skeletons should match actual component shape.

Example:

```text
Avatar circle
Name lines
Order cards
Product cards
```

Avoid generic full-page spinners.

---

# 119. TOASTS

Use toast notifications for lightweight feedback:

```text
Added to wishlist
Address updated
Notification marked as read
```

Important errors remain visible in context.

---

# 120. MODALS

Use modals only when focused confirmation is needed.

Examples:

* delete address
* remove wishlist item
* logout other sessions
* sensitive action confirmation

Avoid excessive modal navigation.

---

# 121. URL STATE

Filters should be URL-addressable where useful.

Example:

```text
/account/orders?status=shipped
```

This enables:

* refresh persistence
* sharing where appropriate
* browser navigation

Sensitive account data must not be exposed through unsafe URLs.

---

# 122. DEEP LINK SAFETY

A deep link to:

```text
/account/orders/ORDER_ID
```

must still perform backend authorization.

Knowing an order ID is not authorization.

---

# 123. CUSTOMER ANALYTICS EVENTS

UI should emit approved events such as:

```text
PRODUCT_VIEWED
SEARCH_PERFORMED
ITEM_ADDED_TO_CART
CHECKOUT_STARTED
ACCOUNT_VIEWED
ORDER_VIEWED
WISHLIST_ADDED
WISHLIST_REMOVED
RETURN_STARTED
```

Events must follow `06-EVENT-ARCHITECTURE.md`.

---

# 124. EVENT PRIVACY

Analytics events must not unnecessarily contain:

* passwords
* OTPs
* payment credentials
* sensitive personal data

---

# 125. OBSERVABILITY

Frontend should support:

* error tracking
* performance monitoring
* API latency tracking
* route performance
* failed interactions

Do not log secrets or sensitive customer data.

---

# 126. API ERROR MAPPING

Backend errors should map to customer-friendly states.

Example:

```text
401 → Session expired
403 → You don't have permission
404 → Information unavailable
409 → Data changed; refresh required
422 → Fix highlighted fields
429 → Please try again later
5xx → Temporary service issue
```

---

# 127. RETRY POLICY

Safe GET requests may retry automatically.

Mutation retries must consider idempotency.

Never blindly retry:

```text
payment creation
order creation
refund
```

without the appropriate idempotency contract.

---

# 128. CUSTOMER UI SECURITY CHECKLIST

* [ ] HTTPS
* [ ] secure authentication
* [ ] protected routes
* [ ] backend authorization
* [ ] BOLA protection
* [ ] XSS protection
* [ ] CSRF protection where applicable
* [ ] secure file upload
* [ ] safe error handling
* [ ] no secrets in frontend
* [ ] no direct DB access
* [ ] no hardcoded production credentials
* [ ] no sensitive logs

---

# 129. NO HARDCODED PRODUCTION DATA

The following are prohibited:

```text
fake user profile
fake orders
fake addresses
fake notification counts
fake wishlist products
fake seller information
fake payment history
fake delivery status
```

Production UI must consume real APIs.

Development fixtures are allowed only under explicit development/test configuration.

---

# 130. API FALLBACK PRINCIPLE

Do not hide backend failures by silently replacing real data with fake data.

Bad:

```text
API failed
↓
Show demo orders
```

Correct:

```text
API failed
↓
Show error state
↓
Retry
```

---

# 131. CUSTOMER DATA CACHE

Cached customer data must:

* respect authorization
* expire appropriately
* be invalidated after mutations
* never cross customer boundaries

---

# 132. ACCOUNT SWITCHING

If multiple account identities are ever supported, switching must:

```text
clear/invalidate previous scope
+
establish new authenticated context
+
refresh customer data
```

No stale account data may remain visible.

---

# 133. LOGOUT

Logout must:

```text
Invalidate session
Clear appropriate client state
Clear sensitive cached data
Return to public experience
```

---

# 134. ACCOUNT SUSPENSION

If backend reports:

```text
ACCOUNT_SUSPENDED
```

the UI should show:

```text
Your account is currently restricted.
Please contact support for assistance.
```

Do not expose internal enforcement details.

---

# 135. ACCOUNT RESTRICTIONS

Certain features may be unavailable while an account is restricted.

Backend remains authoritative.

The frontend should reflect:

```text
Available
Restricted
Unavailable
```

states.

---

# 136. DESIGN QA

Every major customer screen must be reviewed for:

```text
Visual hierarchy
Spacing
Alignment
Typography
Responsiveness
Accessibility
Loading
Empty
Error
Security
API integration
Performance
```

---

# 137. BROWSER TESTING

Support current major versions of:

* Chrome
* Firefox
* Safari
* Edge

Responsive testing must include real mobile dimensions.

---

# 138. CUSTOMER E2E TESTS

Required:

```text
Register
→ Verify
→ Login
→ Account
→ Profile
→ Edit Profile
→ Orders
→ Order Detail
→ Address
→ Wishlist
→ Notifications
→ Security
→ Logout
```

---

# 139. ORDER E2E

Required:

```text
Browse
→ Product
→ Add Cart
→ Login
→ Checkout
→ Payment
→ Order
→ Account
→ Track
```

---

# 140. RETURN E2E

```text
Delivered Order
→ Return
→ Eligibility
→ Reason
→ Submit
→ Return Status
→ Refund
```

---

# 141. SECURITY E2E

Test:

```text
Customer A
→ Customer B Order URL
→ Denied

Expired Session
→ Account
→ Reauthentication

Unauthorized Mutation
→ Denied
```

---

# 142. PERFORMANCE TESTING

Measure:

* first load
* account page load
* order list load
* product image performance
* API response latency
* search interaction
* mobile performance

---

# 143. ACCESSIBILITY TESTING

Test:

* keyboard navigation
* screen readers
* focus management
* forms
* errors
* modals
* contrast
* reduced motion

---

# 144. FINAL CUSTOMER EXPERIENCE

The final experience should communicate:

```text
"I know where I am."
"I know what is happening with my order."
"I can manage my account easily."
"I can find what I need quickly."
"My information is secure."
"The marketplace understands my shopping needs."
```

---

# 145. FINAL CUSTOMER UI CONTRACT

Bilokat Customer UI is complete only when:

```text
1. Login works with the real authentication system.
2. Account data comes from backend APIs.
3. Profile is dynamically loaded.
4. Profile editing is real and validated.
5. Order data is real.
6. Order states come from backend.
7. Multi-seller orders are represented correctly.
8. Order history preserves historical snapshots.
9. Tracking reflects backend state.
10. Returns are policy-driven.
11. Refund status is backend-authoritative.
12. Addresses are real and manageable.
13. Wishlist is real.
14. Coupons are backend-authoritative.
15. Notifications are real.
16. Security/session controls are real.
17. Payments never expose sensitive credentials.
18. Recommendations use approved intelligence systems.
19. AI cannot bypass authorization.
20. No production fake data exists.
21. No frontend-only authorization exists.
22. BOLA/IDOR protections are enforced server-side.
23. Loading/empty/error/offline states exist.
24. Responsive behavior works across devices.
25. Accessibility requirements are implemented.
26. Performance is measured and optimized.
27. Analytics events follow the event architecture.
28. Sensitive data is minimized.
29. Account data is tenant/user isolated.
30. Critical actions require backend confirmation.
31. UI failures do not break unrelated account modules.
32. All critical customer journeys have E2E tests.
33. Security testing passes.
34. Production API integration is verified.
35. Visual QA passes on mobile and desktop.
```

---

# 146. IMPLEMENTATION RULE

Do not build the account UI as one giant component.

Use domain-oriented components.

Conceptual structure:

```text
customer-web/
├── app/
│   ├── account/
│   │   ├── page
│   │   ├── profile/
│   │   ├── orders/
│   │   ├── addresses/
│   │   ├── wishlist/
│   │   ├── coupons/
│   │   ├── returns/
│   │   ├── notifications/
│   │   ├── payments/
│   │   ├── security/
│   │   └── settings/
│
├── components/
│   ├── account/
│   ├── orders/
│   ├── profile/
│   ├── addresses/
│   ├── wishlist/
│   ├── notifications/
│   ├── security/
│   └── recommendations/
│
├── features/
│   ├── auth/
│   ├── account/
│   ├── orders/
│   ├── wishlist/
│   ├── returns/
│   └── notifications/
│
├── lib/
│   ├── api/
│   ├── auth/
│   ├── validation/
│   └── analytics/
│
└── design-system/
```

Actual implementation may differ, but responsibilities must remain separated.

---

# 147. PRODUCTION GATE

Before calling Customer UI complete:

```text
DESIGN
   ↓
COMPONENTS
   ↓
ROUTES
   ↓
API INTEGRATION
   ↓
AUTHORIZATION
   ↓
REAL DATA
   ↓
LOADING/ERROR/EMPTY
   ↓
RESPONSIVE
   ↓
ACCESSIBILITY
   ↓
SECURITY
   ↓
ANALYTICS
   ↓
TESTING
   ↓
VISUAL QA
   ↓
PRODUCTION VERIFICATION
```

Only then:

```text
CUSTOMER UI = COMPLETE
```

---

# END OF DOCUMENT

**File:** `PROJECT-DOCS/11-CUSTOMER-UI-UX-SPEC.md`

**Status:** Production Specification
