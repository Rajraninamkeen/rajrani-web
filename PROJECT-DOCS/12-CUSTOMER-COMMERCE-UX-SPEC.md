# BILOKAT — CUSTOMER COMMERCE UI/UX SPECIFICATION

**Document:** `12-CUSTOMER-COMMERCE-UX-SPEC.md`
**Version:** 1.0
**Status:** Production Specification
**Application:** `customer-web`
**Platform:** Bilokat Multi-Seller Marketplace

---

# 1. PURPOSE

This document defines the complete customer shopping experience of Bilokat.

The journey is:

```text
HOME
 ↓
DISCOVERY
 ↓
SEARCH / CATEGORY
 ↓
PRODUCT LISTING
 ↓
PRODUCT DETAIL
 ↓
CART
 ↓
CHECKOUT
 ↓
PAYMENT
 ↓
ORDER CONFIRMATION
 ↓
ORDER TRACKING
```

The experience should be familiar enough for customers of major marketplaces to understand immediately, while remaining visually and structurally original to Bilokat.

---

# 2. CORE PRINCIPLE

Bilokat Commerce UI must be:

* fast
* intuitive
* mobile-first
* responsive
* accessible
* personalized
* marketplace-aware
* backend-driven
* secure
* scalable

The frontend must never be the source of truth for:

* price
* stock
* seller status
* coupon validity
* delivery charge
* tax
* payment status
* order status

---

# 3. COMMERCE ARCHITECTURE

```text id="4n0p5a"
Customer UI
    ↓
API Client
    ↓
Bilokat API
    ↓
Domain Services
    ↓
PostgreSQL / Transactional Systems
```

Supporting services:

```text id="m1c4x7"
Search
Recommendations
Inventory
Payment Gateway
Delivery
Notification
AI
Analytics
```

All remain behind controlled backend APIs.

---

# 4. HOME PAGE

Route:

```text
/
```

The home page is the primary discovery surface.

It should dynamically combine:

* location
* categories
* promotions
* products
* recommendations
* seller content
* campaigns
* personalized sections

---

# 5. HOME PAGE STRUCTURE

Desktop conceptual layout:

```text id="q6x8r4"
Header
 ↓
Location / Delivery Area
 ↓
Primary Navigation
 ↓
Hero / Campaign Area
 ↓
Categories
 ↓
Personalized Products
 ↓
Deals
 ↓
Popular Products
 ↓
Category Collections
 ↓
Seller/Brand Collections
 ↓
Recently Viewed
 ↓
Recommended For You
 ↓
Footer
```

The exact sections must be CMS/configuration driven where appropriate.

---

# 6. HERO SECTION

Hero content may contain:

* campaign
* promotion
* seasonal collection
* category discovery
* marketplace announcement

Hero data must come from backend content/campaign APIs.

No production campaign should be hardcoded into React components.

---

# 7. HERO SAFETY

Images and links must be validated.

A CMS editor must not be able to create unsafe URLs or arbitrary executable content.

External destinations should be allowlisted where required.

---

# 8. CATEGORY NAVIGATION

Category navigation should support:

* top categories
* subcategories
* dynamic category tree
* icons/images
* discovery

Category hierarchy comes from backend catalog data.

---

# 9. CATEGORY MEGA MENU

Desktop may use a rich mega menu.

Example:

```text id="f5b0f4"
Category
 ├── Subcategory
 │    ├── Child Category
 │    └── Child Category
 └── Subcategory
```

Only categories marked visible/published should appear.

---

# 10. MOBILE CATEGORY NAVIGATION

Mobile should provide a dedicated category experience.

Use:

```text id="7cyqk8"
Categories
 ↓
Category
 ↓
Subcategory
 ↓
Products
```

Avoid excessively deep navigation.

---

# 11. LOCATION

Customer location affects:

* serviceability
* inventory
* seller availability
* delivery estimate
* shipping charge

Location should be visible in the header.

---

# 12. LOCATION SELECTOR

Possible flow:

```text id="u0t0pd"
Current Location
 ↓
Search PIN / City
 ↓
Select Location
 ↓
Validate Serviceability
 ↓
Update Marketplace Context
```

The backend remains authoritative.

---

# 13. SEARCH BAR

Search is a primary commerce interaction.

Desktop:

```text id="z2ydk8"
[ Search products, categories and more... ]
```

Mobile:

```text id="nqj8c3"
[ 🔍 Search ]
```

---

# 14. SEARCH SUGGESTIONS

While typing, suggestions may include:

```text id="f2ks9q"
Recent Searches
Popular Searches
Products
Categories
Brands
```

Suggestions should be generated from real backend/search data.

---

# 15. SEARCH TYPO TOLERANCE

Search should support:

* spelling mistakes
* synonyms
* common variations
* transliteration where supported

Example:

```text id="g2o8wb"
"ear buds"
→
"earbuds"
```

---

# 16. SEMANTIC SEARCH

The intelligence layer may interpret:

```text id="q1x4km"
"cheap running shoes under 1500"
```

into:

```text id="5n1jfa"
Category = Running Shoes
Price <= ₹1500
```

The actual filtering must be deterministic after interpretation.

---

# 17. SEARCH RESULT PAGE

Route:

```text id="r5xq5j"
/search?q=...
```

Layout:

```text id="m6t3zq"
Search Header
Result Summary
Filters
Sort
Product Grid/List
Pagination / Infinite Scroll
```

---

# 18. SEARCH RESULT SUMMARY

Example:

```text id="9i0k6r"
Running shoes
12,842 results
```

Count must come from backend/search index.

---

# 19. FILTERS

Filters are dynamic based on catalog schema.

Potential:

```text id="2w7w9s"
Category
Brand
Price
Rating
Availability
Seller
Color
Size
Material
Delivery
Offers
```

No universal hardcoded filter list.

---

# 20. DYNAMIC ATTRIBUTE FILTERS

Category-specific attributes must automatically become filters.

Example:

```text id="f1l6jg"
Mobile
→ RAM
→ Storage
→ Screen Size
```

while:

```text id="l2z7h4"
Shoes
→ Size
→ Color
→ Material
```

---

# 21. FILTER URL STATE

Filters should be represented safely in URL state.

Example:

```text id="w4o7u1"
/search?q=shoes&brand=x&price_max=2000
```

The server must still validate all filters.

---

# 22. SORTING

Possible:

```text id="e0q1pk"
Relevance
Price: Low to High
Price: High to Low
Customer Rating
Newest
Popular
```

Sort options must be backend-supported.

---

# 23. PRODUCT GRID

Responsive:

```text id="n7x2q4"
Mobile: 2 columns
Tablet: 3 columns
Desktop: 4+ columns
```

Exact density may adapt to screen size.

---

# 24. PRODUCT CARD

Each card may contain:

```text id="1m0k7z"
Product Image
Wishlist
Badge
Product Name
Rating
Reviews
Current Price
MRP
Discount
Seller
Delivery
Availability
```

---

# 25. PRODUCT CARD ACTIONS

Possible:

```text id="6v4t9d"
Add to Cart
Buy Now
Wishlist
```

Actions must respect product state.

---

# 26. OUT-OF-STOCK CARD

Instead of normal purchase actions:

```text id="r3m5b1"
Out of Stock

[Notify Me]
```

if notification functionality is available.

---

# 27. PRODUCT QUICK VIEW

Optional quick-view can show:

* images
* title
* price
* seller
* key attributes
* delivery
* add to cart

Complex product decisions should still lead to the full PDP.

---

# 28. PRODUCT DETAIL PAGE

Route:

```text id="8s2n5c"
/products/[slug]
```

This is one of the highest-priority pages in the application.

---

# 29. PDP STRUCTURE

```text id="d5g0q8"
Gallery
 ↓
Product Information
 ↓
Price
 ↓
Offers
 ↓
Variants
 ↓
Delivery
 ↓
Seller
 ↓
Purchase Actions
 ↓
Specifications
 ↓
Description
 ↓
Reviews
 ↓
Return Policy
 ↓
Recommendations
```

---

# 30. PRODUCT GALLERY

Support:

* thumbnails
* zoom
* multiple images
* video where available
* responsive gallery
* fullscreen mobile viewer

---

# 31. PRODUCT IMAGE SAFETY

Images must be:

* validated
* optimized
* CDN-delivered where appropriate
* responsive
* lazy loaded

Broken images require graceful fallback.

---

# 32. PRODUCT TITLE

Title must be backend-provided.

Do not inject untrusted HTML.

---

# 33. RATING

Display:

```text id="i8w2z1"
4.4 ★
1,284 ratings
```

Only show verified backend aggregates.

---

# 34. PRICE BLOCK

Display:

```text id="t4h9x2"
₹1,299
MRP ₹1,999
35% off
```

The actual pricing response is authoritative.

---

# 35. PRICE EXPIRY

If a promotion is time-bound, the UI may display:

```text id="r0y5k8"
Offer ends in...
```

But checkout must always revalidate.

---

# 36. MULTIPLE SELLERS

A product may have multiple seller offers.

Example:

```text id="8y0d3m"
Product

Sold by:
Seller A
₹1,299

Seller B
₹1,349

Seller C
₹1,279
```

The selected offer becomes part of cart state.

---

# 37. SELLER SELECTION

Customer may select a seller where the marketplace permits.

Selection must include:

* seller
* price
* availability
* delivery estimate
* seller information

---

# 38. BUY BOX

The primary purchase section should clearly communicate:

```text id="g1v5o8"
Price
Availability
Delivery
Seller
Quantity
Add to Cart
Buy Now
```

---

# 39. ADD TO CART

Flow:

```text id="f4p0k3"
Product + Listing + Variant
 ↓
POST Cart
 ↓
Backend Validation
 ↓
Inventory/Price Validation
 ↓
Cart Updated
 ↓
UI Confirmation
```

---

# 40. BUY NOW

Buy Now should minimize unnecessary steps.

```text id="0d6kq4"
Product
 ↓
Selected Variant
 ↓
Checkout Context
 ↓
Address
 ↓
Payment
 ↓
Order
```

It should not accidentally alter unrelated cart contents.

---

# 41. VARIANT SELECTION

Variants may include:

```text id="j8f4u1"
Size
Color
Storage
Pack Size
Weight
Model
```

The UI must derive variant attributes dynamically.

---

# 42. VARIANT VALIDATION

Changing a variant may change:

* price
* stock
* seller
* delivery
* images

The UI must refresh authoritative data.

---

# 43. DELIVERY ESTIMATE

Customer may enter/select PIN.

Backend returns:

```text id="v3j8s9"
Deliverable
Estimated Date
Delivery Charge
Seller/Fulfillment
```

Do not calculate delivery dates only in frontend.

---

# 44. PRODUCT OFFERS

PDP may show:

```text id="d9z0s6"
Coupon
Bank Offer
Seller Offer
Bundle Offer
Free Delivery
```

Only eligible offers should be presented as applicable.

---

# 45. PRODUCT SPECIFICATIONS

Dynamic attributes:

```text id="p6s5x4"
Brand
Model
Material
Weight
Dimensions
...
```

depending on category schema.

---

# 46. PRODUCT DESCRIPTION

Description must support safe rich text rendering.

Untrusted HTML must be sanitized.

---

# 47. REVIEWS

Reviews may contain:

* rating
* text
* images
* verified purchase indicator
* date
* helpfulness

Review content is untrusted user-generated content.

---

# 48. REVIEW SUMMARY

AI may provide:

```text id="v8s2y7"
Customers commonly praise:
• Quality
• Packaging

Common complaints:
• Size inconsistency
```

Only generate summaries from actual review data.

---

# 49. REVIEW SAFETY

AI must not invent reviews or sentiment.

If insufficient data:

```text id="h3d8n1"
Not enough review data for a reliable summary.
```

---

# 50. PRODUCT RECOMMENDATIONS

PDP may include:

```text id="x5j4p2"
Similar Products
Frequently Bought Together
Customers Also Viewed
You May Also Like
```

These come from recommendation/search systems.

---

# 51. RECENTLY VIEWED

Recently viewed products may be stored through:

* authenticated customer activity
* guest session activity

Privacy rules apply.

---

# 52. CART

Route:

```text id="7v3f2k"
/cart
```

Cart must be a real backend-backed resource.

---

# 53. CART STRUCTURE

```text id="u2n6c7"
Customer Cart
 ├── Seller A
 │    ├── Product
 │    └── Product
 │
 └── Seller B
      └── Product
```

---

# 54. CART ITEM

Each item displays:

```text id="p7y8x1"
Product
Variant
Seller
Quantity
Current Price
MRP
Discount
Availability
Delivery Estimate
```

---

# 55. CART QUANTITY

Quantity changes must call the backend.

Backend validates:

* minimum
* maximum
* stock
* seller listing status
* business limits

---

# 56. CART PRICE CHANGES

If price changes:

```text id="b5f3q0"
Price updated
```

Customer must be informed.

Do not silently hide price changes.

---

# 57. CART STOCK CHANGES

If stock becomes unavailable:

```text id="t1x7w4"
Only 2 units available.
```

or:

```text id="p0k8n3"
This item is currently unavailable.
```

---

# 58. CART REMOVAL

Removal should be immediate but reversible where UX permits.

Backend confirmation remains authoritative.

---

# 59. SAVE FOR LATER

Optional feature:

```text id="j0f4v2"
Save for Later
```

Saved products must remain separate from active cart items.

---

# 60. CART COUPON

Customer can:

```text id="s9r3n5"
View Coupons
Apply Coupon
Remove Coupon
```

Coupon validation occurs server-side.

---

# 61. CART PRICE SUMMARY

Show:

```text id="f5h7k2"
Item Total
Discount
Coupon
Delivery
Tax
Other Charges
Total
```

Exact values come from backend cart calculation.

---

# 62. CART SELLER GROUPING

Seller grouping should make multi-seller fulfillment understandable.

Each seller group may have:

* separate delivery
* seller information
* seller-level offers
* seller-level return information

---

# 63. CHECKOUT

Route:

```text id="v6x1p8"
/checkout
```

Checkout should be a focused flow.

Avoid unnecessary navigation.

---

# 64. CHECKOUT STEPS

```text id="s2q4m6"
Address
 ↓
Delivery
 ↓
Review
 ↓
Payment
 ↓
Confirmation
```

Depending on payment type, some steps may be combined.

---

# 65. CHECKOUT CONTEXT

Checkout must use a server-backed checkout/session context.

It should contain references to:

```text id="n1m9x3"
cart
items
seller orders
address
pricing
delivery
coupon
payment intent
```

---

# 66. ADDRESS SELECTION

Display:

```text id="c5w7e0"
Saved Addresses
[Select]

+ Add New Address
```

---

# 67. ADDRESS VALIDATION

Before order creation:

```text id="d4n8q1"
Address
 ↓
PIN Validation
 ↓
Serviceability
 ↓
Delivery Estimate
```

---

# 68. DELIVERY OPTIONS

Where supported:

```text id="x7r2m9"
Standard
Express
Scheduled
```

Availability comes from backend.

---

# 69. CHECKOUT PRICE RE-CALCULATION

Before payment/order creation:

```text id="h8q5k1"
Recalculate
+
Validate Stock
+
Validate Price
+
Validate Coupon
+
Validate Delivery
+
Validate Taxes
```

---

# 70. PRICE INTEGRITY

Frontend must never be able to submit:

```text id="n3q9w6"
total = ₹1
```

and force the backend to accept it.

Backend calculates the final amount.

---

# 71. COUPON VALIDATION

Backend checks:

* expiry
* usage
* customer eligibility
* seller
* category
* minimum amount
* maximum discount
* stacking rules
* abuse limits

---

# 72. COUPON ERROR

Examples:

```text id="j7s1f4"
Coupon expired.
Coupon not applicable to selected items.
Minimum order value not met.
Coupon usage limit reached.
```

---

# 73. PAYMENT METHODS

Depending on gateway support:

```text id="m4k8z2"
UPI
Cards
Net Banking
Wallets
Other Supported Methods
COD
```

The UI should render only methods returned as available.

---

# 74. ONLINE PAYMENT FLOW

```text id="q5d8r1"
Checkout
 ↓
Create Payment Intent
 ↓
Open Gateway
 ↓
Customer Completes Payment
 ↓
Gateway
 ↓
Secure Webhook
 ↓
Backend Verification
 ↓
Payment Confirmed
 ↓
Order Confirmed
```

Frontend payment callback is not authoritative.

---

# 75. PAYMENT FAILURE

Show:

```text id="u7m2p5"
Payment couldn't be completed.

[Try Again]
[Choose Another Method]
```

Do not create duplicate orders.

---

# 76. PAYMENT RETRY

Retry must use the backend payment state.

Existing payment attempts must be preserved.

---

# 77. COD FLOW

COD should follow the business flow defined in the master specification.

```text id="w8f4y2"
Select COD
 ↓
Authentication
 ↓
Address
 ↓
Secondary Mobile
 ↓
OTP Verification
 ↓
COD Verification
 ↓
Confirmation
```

---

# 78. COD SECONDARY MOBILE

If required:

```text id="a1k6t8"
Primary Mobile: ******1234

Secondary Mobile:
[____________]

[Send OTP]
```

OTP must never be displayed.

---

# 79. COD VERIFICATION

Customer may see:

```text id="f9q3r5"
COD verification pending.
Our verification team may contact you.
```

Internal verification details should not be unnecessarily exposed.

---

# 80. ORDER CREATION

Order creation must happen only after all required backend checks pass.

```text id="e2k7v4"
Checkout
 ↓
Validate
 ↓
Authorize
 ↓
Create Order
 ↓
Create Seller Orders
 ↓
Reserve/Commit Inventory
 ↓
Record Payment State
 ↓
Emit Order Event
```

Transactional boundaries are backend-controlled.

---

# 81. DOUBLE SUBMISSION PROTECTION

Repeated clicks must not create duplicate orders.

Use:

```text id="c6y9r2"
Idempotency Key
```

where required.

UI should also disable duplicate submission temporarily.

---

# 82. ORDER CONFIRMATION

Route may be:

```text id="p7v3n1"
/order-confirmation/[orderId]
```

Display:

```text id="g4q8m2"
✓ Order Confirmed

Order ID
Total
Delivery Estimate

[Track Order]
[View Order]
[Continue Shopping]
```

---

# 83. CONFIRMATION DATA

Only show success after backend confirmation.

Never display a false success screen based solely on frontend state.

---

# 84. ORDER CONFIRMATION FOR MULTI-SELLER CART

Display:

```text id="y5t8k0"
Order #BK12345

Seller A
Shipment 1

Seller B
Shipment 2
```

Customer should understand that different sellers may deliver separately.

---

# 85. ORDER TRACKING

Tracking entry points:

* account
* order confirmation
* notifications
* header/account shortcuts

---

# 86. DELIVERY TIMELINE

```text id="m8q2r6"
Order Placed
✓
Seller Accepted
✓
Packed
✓
Picked Up
✓
Out for Delivery
●
Delivered
○
```

Backend order events are authoritative.

---

# 87. LIVE DELIVERY

If available:

```text id="s3x7v9"
Rider Assigned
ETA
Last Updated
Map
```

Privacy-safe data only.

---

# 88. CUSTOMER CANCELLATION

Cancellation button appears only when backend says cancellation is allowed.

Flow:

```text id="k6n2b8"
Cancel
 ↓
Reason
 ↓
Confirmation
 ↓
Backend Validation
 ↓
Cancellation Result
```

---

# 89. CANCELLATION FAILURE

If seller has already advanced fulfillment:

```text id="d1p5x7"
Cancellation is no longer available for this order.
```

The UI must reflect actual state.

---

# 90. RETURN ENTRY

Eligible delivered items should show:

```text id="q9m4c6"
Return Item
```

Eligibility is checked server-side.

---

# 91. BUY AGAIN

Buy Again must verify:

```text id="b3x8n2"
Current Product Status
Listing Status
Stock
Price
Serviceability
```

before adding to cart.

---

# 92. PRODUCT AVAILABILITY CHANGES

If product was discontinued:

```text id="r6k1v4"
This product is no longer available.
```

Offer alternatives where available.

---

# 93. PERSONALIZATION ENGINE

Commerce UI may consume:

```text id="x4v7m9"
recently viewed
purchase history
category affinity
search behavior
similarity
trending products
seller preferences
```

Personalization must respect privacy and user controls.

---

# 94. RECOMMENDATION FALLBACK

If recommendation service fails:

```text id="t5q8w1"
Use safe popularity/category fallback
```

or hide the section.

Do not fabricate recommendations.

---

# 95. AI SHOPPING ASSISTANT

The customer may ask:

> Mujhe ₹2000 ke andar running shoes chahiye.

AI can interpret the request.

Flow:

```text id="m2r7k9"
Natural Language
 ↓
AI Understanding
 ↓
Structured Search Intent
 ↓
Authorization
 ↓
Search
 ↓
Deterministic Filters
 ↓
Products
```

---

# 96. AI PRODUCT COMPARISON

Customer may select products and ask:

> In dono mein difference kya hai?

AI should compare actual product attributes.

No fabricated specifications.

---

# 97. AI PURCHASE RECOMMENDATION

AI may recommend based on:

* budget
* use case
* product attributes
* reviews
* availability

The final product choice remains the customer's.

---

# 98. AI CHECKOUT RESTRICTION

AI must not autonomously:

* submit payment
* bypass checkout
* change payment security
* create unauthorized orders
* apply unauthorized discounts
* modify seller price

---

# 99. CART SECURITY

Every cart mutation must validate:

```text id="n6p3q8"
Customer/session
+
Cart ownership
+
Product/listing
+
Price
+
Stock
```

---

# 100. GUEST CART

Guest customers receive a temporary cart/session identity.

Guest cart may persist through browser storage/server session as appropriate.

---

# 101. GUEST → LOGIN MERGE

```text id="f7r2k4"
Guest Cart
+
Authenticated Cart
 ↓
Merge Policy
 ↓
Conflict Resolution
 ↓
Final Cart
```

Possible conflict:

```text id="z3m8p1"
Guest quantity = 2
Customer quantity = 3
```

Backend merge policy decides the final result.

---

# 102. CART CONFLICT UI

If conflicts occur:

```text id="q4x7m2"
Your cart was updated because some items changed.
```

Provide details where useful.

---

# 103. SESSION SECURITY

Cart and checkout sessions must not allow:

* IDOR
* session fixation
* unauthorized cart access
* cross-user data exposure

---

# 104. CUSTOMER ANALYTICS

Commerce UI emits approved events:

```text id="a9k5r3"
PAGE_VIEWED
SEARCH_PERFORMED
PRODUCT_VIEWED
PRODUCT_CLICKED
WISHLIST_ADDED
CART_CREATED
ITEM_ADDED_TO_CART
ITEM_REMOVED_FROM_CART
CHECKOUT_STARTED
PAYMENT_INITIATED
PAYMENT_FAILED
PAYMENT_CONFIRMED
ORDER_CREATED
```

Events follow the event architecture.

---

# 105. EVENT DEDUPLICATION

Frontend analytics events must avoid accidental duplicate emission.

Backend analytics remains responsible for event processing/deduplication.

---

# 106. PERFORMANCE

Critical commerce paths must be optimized.

Priority:

```text id="j7x2p5"
Home
Search
PDP
Cart
Checkout
```

---

# 107. IMAGE PERFORMANCE

Use:

* responsive images
* lazy loading
* CDN
* optimized formats
* placeholders
* correct dimensions

Above-the-fold images should receive appropriate loading priority.

---

# 108. SEARCH PERFORMANCE

Search interaction should feel immediate.

Use:

* debouncing
* cached suggestions
* request cancellation
* pagination
* efficient API calls

---

# 109. CART PERFORMANCE

Cart should not refetch unrelated marketplace data.

Only relevant cart/price/inventory information should be requested.

---

# 110. CHECKOUT PERFORMANCE

Checkout must prioritize:

```text id="r4m8x2"
Address
Price
Delivery
Payment
```

Non-critical recommendations should not block checkout.

---

# 111. OFFLINE BEHAVIOR

If the customer loses network during checkout:

```text id="w2n6q9"
Connection lost.
Please reconnect before continuing.
```

Do not claim payment/order success.

---

# 112. PAYMENT RETURN FROM GATEWAY

After returning from gateway:

```text id="p8q3m5"
Fetch backend payment/order status
 ↓
Determine final state
```

Never rely solely on URL query parameters.

---

# 113. REFRESH SAFETY

Refreshing checkout must not:

* duplicate payment
* duplicate order
* lose cart unexpectedly

Server-side checkout/payment state handles this.

---

# 114. PRICE STALENESS

If cart data is stale:

```text id="x6r1v8"
Refresh required
```

The backend must revalidate before final order.

---

# 115. STOCK RESERVATION

Where inventory reservation is used:

```text id="v3n7k2"
Checkout
 ↓
Inventory Reservation
 ↓
Payment
 ↓
Order
```

Reservation expiry must be reflected in UI.

---

# 116. RESERVATION EXPIRY

Example:

```text id="k8m2p6"
Your checkout session expires in 04:32.
```

The backend remains authoritative.

---

# 117. ERROR ISOLATION

If:

```text id="t7q4x1"
Recommendations fail
```

checkout must continue.

If:

```text id="m5r8n2"
reviews fail
```

PDP must still function.

---

# 118. LOADING STATES

Every major page requires meaningful skeletons.

Required:

* home skeleton
* search skeleton
* PDP skeleton
* cart skeleton
* checkout skeleton

---

# 119. EMPTY STATES

### Search

```text id="x2q6m8"
No products found.

Try a different search.
```

### Cart

```text id="f7n3k5"
Your cart is empty.

[Start Shopping]
```

### Wishlist

Use account empty state.

---

# 120. ERROR STATES

Example:

```text id="q8m4r1"
We couldn't load this product.

[Try Again]
```

No raw backend stack traces.

---

# 121. ACCESSIBILITY

Commerce UI targets:

```text id="b5x7n9"
WCAG 2.2 AA
```

Required:

* keyboard navigation
* semantic elements
* screen-reader labels
* accessible forms
* visible focus
* sufficient contrast
* reduced motion

---

# 122. MOBILE UX

Mobile shopping must prioritize:

```text id="k4q8m2"
Search
Discovery
Product
Cart
Checkout
Account
```

Persistent bottom navigation may contain:

```text id="y6n2r5"
Home
Categories
Search
Cart
Account
```

---

# 123. MOBILE PRODUCT PAGE

Recommended order:

```text id="r8m3q7"
Gallery
Title
Rating
Price
Offers
Variant
Delivery
Seller
Buy Actions
Description
Specifications
Reviews
Recommendations
```

---

# 124. MOBILE CART

Cart should make:

* seller grouping
* price
* quantity
* delivery
* coupon
* total

immediately understandable.

---

# 125. MOBILE CHECKOUT

Use a focused, low-distraction layout.

Sticky bottom CTA may be used:

```text id="f3q8m6"
₹2,499

[Continue]
```

But backend validation must happen before final submission.

---

# 126. DESKTOP CHECKOUT

Possible layout:

```text id="x5n2r7"
Main:
Address
Products
Delivery
Payment

Sidebar:
Price Summary
```

---

# 127. STICKY PRICE SUMMARY

Desktop may keep price summary visible.

Mobile may use a sticky bottom total/action.

---

# 128. RESPONSIVE BREAKPOINTS

Design system must define breakpoints centrally.

Do not scatter arbitrary pixel values across components.

---

# 129. DESIGN SYSTEM

Components should be reusable:

```text id="j2x8m4"
Button
Input
Select
Modal
Drawer
Card
Badge
Tabs
Accordion
Toast
Skeleton
Pagination
ProductCard
SellerCard
PriceBlock
OrderStatus
```

---

# 130. COMPONENT STATES

Each component must support relevant:

```text id="m4q7x9"
default
hover
focus
active
disabled
loading
error
selected
```

---

# 131. VISUAL CONSISTENCY

Spacing, typography, buttons and cards must follow the Bilokat design system.

Do not build every page with a different visual language.

---

# 132. TRUST UX

Marketplace UI should clearly communicate:

* seller identity
* delivery
* returns
* secure payment
* product authenticity where applicable
* customer reviews

Avoid fake trust signals.

---

# 133. BADGE GOVERNANCE

Badges such as:

```text id="q8x2m5"
Best Seller
Popular
New
Limited Offer
```

must be generated from real backend rules.

Never manually label random products "Best Seller".

---

# 134. PROMOTIONAL URGENCY

Countdowns and urgency indicators must be truthful.

Do not create fake:

```text id="n5r7k2"
Only 1 left!
Sale ending in 02:00!
```

unless supported by actual data/rules.

---

# 135. SELLER TRUST

Seller information must use approved marketplace data.

Potential:

```text id="x3m8q1"
Seller Name
Rating
Fulfillment
Return Information
```

---

# 136. CONTENT GOVERNANCE

Homepage banners, campaigns and promotional copy should be controlled by the content/campaign system.

Frontend should render configured content.

---

# 137. SEO

Public commerce pages should support:

* semantic URLs
* metadata
* canonical URLs
* structured data where appropriate
* crawlability
* optimized images

---

# 138. SEO + DYNAMIC PRODUCTS

Product pages should not depend entirely on client-only rendering if SEO is a requirement.

Architecture must align with the selected deployment/rendering strategy.

---

# 139. ANALYTICS PRIVACY

Commerce events should avoid sending:

* passwords
* OTPs
* payment credentials
* unnecessary PII

---

# 140. SECURITY CHECKLIST

* [ ] HTTPS
* [ ] authentication
* [ ] authorization
* [ ] cart ownership validation
* [ ] order ownership validation
* [ ] BOLA protection
* [ ] XSS protection
* [ ] CSRF protection where applicable
* [ ] secure cookies/session
* [ ] no secrets in frontend
* [ ] no direct DB access
* [ ] secure uploads
* [ ] payment webhook validation
* [ ] idempotency
* [ ] rate limiting

---

# 141. CRITICAL PAYMENT RULE

The customer UI must never determine:

```text id="b4m9x2"
payment success
```

Payment success comes from backend verification.

---

# 142. CRITICAL ORDER RULE

The customer UI must never determine:

```text id="k7r3n5"
order status
```

Order status comes from the backend.

---

# 143. CRITICAL INVENTORY RULE

The customer UI must never determine:

```text id="p2x8m4"
available quantity
```

Inventory service is authoritative.

---

# 144. CRITICAL PRICE RULE

The customer UI must never determine:

```text id="n6q1r8"
final payable amount
```

Backend pricing engine is authoritative.

---

# 145. CRITICAL COUPON RULE

The customer UI must never determine:

```text id="x4m7k2"
coupon validity
discount amount
```

Backend coupon engine is authoritative.

---

# 146. END-TO-END CUSTOMER FLOW

The complete successful flow:

```text id="z7q3m8"
Open Bilokat
 ↓
Select Location
 ↓
Browse/Search
 ↓
Open Product
 ↓
Select Variant
 ↓
Select Seller
 ↓
Add to Cart
 ↓
Open Cart
 ↓
Review Price
 ↓
Checkout
 ↓
Select Address
 ↓
Validate Delivery
 ↓
Review Price
 ↓
Select Payment
 ↓
Payment Verification
 ↓
Create Order
 ↓
Order Confirmation
 ↓
Track Order
 ↓
Delivery
 ↓
Review / Return if applicable
```

---

# 147. CRITICAL FAILURE FLOW

Every major step must have a defined failure path.

```text id="x5r2n9"
Search Failure
→ Retry

Product Failure
→ Retry / Browse Similar

Cart Failure
→ Retry

Price Change
→ Review Cart

Stock Change
→ Adjust Quantity

Payment Failure
→ Retry / Other Method

Order Conflict
→ Refresh State

Delivery Failure
→ Support
```

---

# 148. CUSTOMER E2E TEST MATRIX

## Discovery

* [ ] Home loads
* [ ] Categories load
* [ ] Search works
* [ ] Suggestions work
* [ ] Filters work
* [ ] Sorting works

## Product

* [ ] PDP loads
* [ ] Images work
* [ ] Variant selection works
* [ ] Seller selection works
* [ ] Delivery check works
* [ ] Add to cart works
* [ ] Buy Now works

## Cart

* [ ] Add item
* [ ] Remove item
* [ ] Quantity update
* [ ] Seller grouping
* [ ] Price update
* [ ] Coupon
* [ ] Stock conflict
* [ ] Guest cart

## Checkout

* [ ] Address
* [ ] Delivery
* [ ] Price calculation
* [ ] Coupon validation
* [ ] Payment
* [ ] COD
* [ ] Idempotency

## Order

* [ ] Order creation
* [ ] Confirmation
* [ ] Tracking
* [ ] Cancellation
* [ ] Return

---

# 149. SECURITY E2E

Test:

```text id="g3x8m1"
Customer A
→ Access Customer B Cart
→ Denied

Customer A
→ Access Customer B Order
→ Denied

Tampered Price
→ Backend Rejects

Tampered Coupon
→ Backend Rejects

Tampered Payment Success
→ Backend Rejects

Duplicate Order Request
→ One Order

Duplicate Payment Callback
→ One Final Payment State
```

---

# 150. PERFORMANCE GATE

Before production:

```text id="k8q2m4"
Home Performance
Search Performance
PDP Performance
Cart Performance
Checkout Performance
```

must be measured on:

* desktop
* mid-range mobile
* slower network

---

# 151. FINAL COMMERCE UI CONTRACT

Bilokat Commerce UI is complete only when:

```text id="w4n7x2"
1. Home is backend-driven.
2. Categories are dynamic.
3. Search is real.
4. Filters are dynamic.
5. Product cards use real data.
6. Product pages use real catalog data.
7. Seller offers are real.
8. Variant data is dynamic.
9. Delivery estimates come from backend.
10. Cart is backend-backed.
11. Guest cart works.
12. Guest-to-authenticated cart merge works.
13. Cart price is backend-authoritative.
14. Cart stock is backend-authoritative.
15. Coupons are backend-authoritative.
16. Checkout is server validated.
17. Multi-seller checkout works.
18. Payment is gateway-backed.
19. Payment success is webhook/backend verified.
20. COD verification flow works.
21. Duplicate orders are prevented.
22. Order confirmation is backend-confirmed.
23. Tracking uses real order state.
24. Cancellation is state-driven.
25. Return entry is eligibility-driven.
26. Recommendations are real.
27. AI uses actual platform data.
28. AI cannot perform unauthorized critical actions.
29. No production fake data exists.
30. No frontend-only security exists.
31. BOLA/IDOR protections exist.
32. Loading states exist.
33. Empty states exist.
34. Error states exist.
35. Offline handling exists.
36. Mobile UX is production-ready.
37. Desktop UX is production-ready.
38. Accessibility is tested.
39. Analytics events are implemented.
40. Performance is measured.
41. Security testing passes.
42. Critical E2E flows pass.
43. Payment/order/inventory integrity passes.
44. Visual QA passes.
45. Production API integration is verified.
```

---

# 152. IMPLEMENTATION GATE

Implementation must follow:

```text id="c6m9q2"
API Contract
 ↓
Data Model
 ↓
Business Rules
 ↓
Frontend State
 ↓
UI Components
 ↓
Error Handling
 ↓
Security
 ↓
Analytics
 ↓
Testing
 ↓
Production Verification
```

Never:

```text id="p8x3m1"
Design first
+
hardcode data
+
connect API later
```

---

# END OF DOCUMENT

**File:** `PROJECT-DOCS/12-CUSTOMER-COMMERCE-UX-SPEC.md`

**Status:** Production Specification
