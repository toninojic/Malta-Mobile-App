# Database Schema

The database is relational and implemented with Prisma over PostgreSQL.

## Entity Relationship Diagram

```mermaid
erDiagram
  User ||--o| UserProfile : has
  User ||--o{ JobRequest : creates
  User ||--o{ Offer : submits
  User ||--o| UserTokenBalance : owns
  User ||--o{ TokenTransaction : receives
  User ||--o{ Payment : pays
  User ||--o{ Notification : receives
  User ||--o{ RefundRequest : requests
  User ||--o{ Message : sends
  User ||--o{ Conversation : participates

  JobRequest ||--o{ JobImage : has
  JobRequest ||--o{ Offer : receives
  JobRequest ||--o{ Chat : unlocks
  JobRequest ||--o{ Review : receives

  Offer ||--o| ContactUnlock : unlocks
  Offer ||--o| Chat : starts
  Offer ||--o| Review : leads_to

  ContactUnlock ||--o| Conversation : starts
  ContactUnlock ||--o| JobCompletion : completes
  ContactUnlock ||--o| Review : reviews
  Conversation ||--o{ Message : contains
  Chat ||--o{ Message : contains
  JobCompletion ||--o| Review : enables

  TokenPackage ||--o{ TokenTransaction : purchased_as
  TokenPackage ||--o{ Payment : purchased_via
  TokenTransaction ||--o| RefundRequest : may_refund
  RefundRequest ||--o| TokenTransaction : creates_refund_ledger

  User {
    uuid id PK
    string email
    string passwordHash
    enum role
    enum status
    string refreshTokenHash
    datetime createdAt
    datetime updatedAt
  }

  UserProfile {
    uuid id PK
    uuid userId FK
    string displayName
    string phone
    string location
    string bio
    string avatarUrl
    string companyName
    string[] tradeCategories
  }

  JobRequest {
    uuid id PK
    uuid employerId FK
    string title
    string description
    string category
    string subcategory
    string location
    enum status
    datetime expiresAt
    datetime contractorMarkedCompletedAt
    datetime employerConfirmedCompletedAt
  }

  Offer {
    uuid id PK
    uuid jobRequestId FK
    uuid contractorId FK
    decimal estimatedPrice
    int estimatedCompletionDays
    string message
    enum status
    boolean selectedByEmployer
    datetime deletedAt
  }

  ContactUnlock {
    uuid id PK
    uuid offerId FK
    uuid jobRequestId FK
    uuid contractorId FK
    uuid employerId FK
    uuid unlockedByContractorId FK
    uuid tokenTransactionId FK
    enum status
    datetime createdAt
    datetime updatedAt
  }

  Conversation {
    uuid id PK
    uuid contactUnlockId FK
    uuid employerId FK
    uuid contractorId FK
    datetime lastMessageAt
    datetime createdAt
    datetime updatedAt
  }

  Chat {
    uuid id PK
    uuid jobRequestId FK
    uuid offerId FK
    uuid employerId FK
    uuid contractorId FK
    datetime unlockedAt
  }

  Message {
    uuid id PK
    uuid chatId FK
    uuid conversationId FK
    uuid senderId FK
    enum type
    string content
    boolean isRead
    json metadata
    datetime deletedAt
    datetime createdAt
    datetime updatedAt
  }

  JobCompletion {
    uuid id PK
    uuid jobRequestId FK
    uuid offerId FK
    uuid contactUnlockId FK
    uuid employerId FK
    uuid contractorId FK
    enum status
    datetime contractorMarkedAt
    datetime employerConfirmedAt
    datetime createdAt
    datetime updatedAt
  }

  Review {
    uuid id PK
    uuid jobRequestId FK
    uuid offerId FK
    uuid contactUnlockId FK
    uuid employerId FK
    uuid contractorId FK
    int rating
    string comment
    string contractorReply
    datetime contractorReplyAt
    enum status
    uuid removedByAdminId FK
    datetime removedAt
  }

  ContractorRatingSummary {
    uuid id PK
    uuid contractorId FK
    decimal averageRating
    int totalReviews
    datetime createdAt
    datetime updatedAt
  }

  TokenPackage {
    uuid id PK
    string title
    int tokenCount
    decimal price
    string currency
    boolean isActive
    datetime createdAt
    datetime updatedAt
  }

  UserTokenBalance {
    uuid id PK
    uuid userId FK
    int balance
    int version
    datetime createdAt
    datetime updatedAt
  }

  TokenTransaction {
    uuid id PK
    uuid userId FK
    uuid packageId FK
    enum type
    int amount
    string description
    int balanceAfter
    uuid relatedRefundRequestId FK
    datetime createdAt
  }

  Payment {
    uuid id PK
    uuid userId FK
    uuid tokenPackageId FK
    string stripeCheckoutSessionId
    string stripePaymentIntentId
    decimal amount
    string currency
    enum status
    string failureReason
    datetime createdAt
    datetime updatedAt
  }

  RefundRequest {
    uuid id PK
    uuid userId FK
    uuid tokenTransactionId FK
    int amount
    string reason
    enum status
    string adminNote
    uuid reviewedByAdminId FK
    datetime reviewedAt
    datetime createdAt
    datetime updatedAt
  }

  Notification {
    uuid id PK
    uuid userId FK
    enum type
    string title
    string body
    json data
    boolean isRead
    datetime readAt
    datetime createdAt
  }
```

## Milestone 1 Tables Used

- `User`
- `UserProfile`
- `JobRequest`
- `JobImage`

## Milestone 2 Tables Used

- `Offer`

Milestone 2 also adds a unique `contractorId + jobRequestId` offer constraint, `selectedByEmployer`, and `deletedAt` for offer withdrawal.

## Milestone 3 Tables Used

- `TokenPackage`
- `UserTokenBalance`
- `TokenTransaction`
- `RefundRequest`

Milestone 3 keeps wallet changes ledgered through `TokenTransaction`. Purchases add positive token amounts, approved refunds add negative `REFUND` transactions, and balances are guarded so they never go below zero.

## Milestone 4 Tables Used

- `ContactUnlock`
- `TokenTransaction`
- `UserTokenBalance`

Milestone 4 adds `ContactUnlock.status`, `unlockedByContractorId`, optional `tokenTransactionId` for pending requests, and `updatedAt`. Unlocks are stored as `SPEND` transactions and contact rows are unique by `offerId`.

## Milestone 5 Tables Used

- `Conversation`
- `Message`
- `Notification`
- `ContactUnlock`

Milestone 5 adds one `Conversation` per unlocked contact relationship through a unique `contactUnlockId`. Messages are text-only for MVP, ordered by `createdAt`, and soft-delete ready through `deletedAt`. Notifications are stored in the database with `isRead`, `readAt`, and JSON metadata so push delivery can be added later without changing the product workflow.

Important indexes:

- `Conversation.contactUnlockId` unique
- `Conversation.employerId + lastMessageAt`
- `Conversation.contractorId + lastMessageAt`
- `Message.conversationId + createdAt`
- `Message.senderId`
- `Message.isRead + createdAt`
- `Notification.userId + isRead + createdAt`

## Milestone 6 Tables Used

- `JobCompletion`
- `Review`
- `ContractorRatingSummary`
- `Notification`

Milestone 6 adds a separate completion workflow keyed by `contactUnlockId`. Reviews are also keyed by contact relationship and support one contractor reply plus admin soft removal. `ContractorRatingSummary` stores active-review aggregates only; removed reviews remain stored but are excluded from `averageRating` and `totalReviews`.

Important indexes:

- `JobCompletion.contactUnlockId` unique
- `JobCompletion.offerId` unique
- `JobCompletion.employerId + status`
- `JobCompletion.contractorId + status`
- `Review.contactUnlockId` unique
- `Review.contractorId + status + removedAt`
- `Review.employerId`

## Milestone 8 Tables Used

- `Payment`
- `TokenPackage`
- `UserTokenBalance`
- `TokenTransaction`

Milestone 8 adds `Payment` rows for Stripe Checkout test-mode purchases. A payment starts as `PENDING`; only a valid Stripe webhook can mark it `PAID`, create a `PURCHASE` token transaction, and increase wallet balance. Failed payment intent webhooks mark payments `FAILED` and do not change token balances.

Important indexes:

- `Payment.stripeCheckoutSessionId` unique
- `Payment.stripePaymentIntentId` unique
- `Payment.userId + createdAt`
- `Payment.status + createdAt`
