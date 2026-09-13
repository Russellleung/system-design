# Spec: Authentication & Authorization For API Platforms

## 1. Objective

Design an authentication and authorization model for a B2B API platform where customers and partner integrations call backend APIs securely.

The design should answer:

* Who is calling?
* Are they allowed to call this API?
* Which account / organization are they acting on?
* What permissions do they have?
* How do we limit damage if credentials leak?
* How do we audit and revoke access?

---

## 2. Core Concepts

| Concept | Meaning |
| :--- | :--- |
| Authentication | Proves caller identity |
| Authorization | Checks what the caller is allowed to do |
| API key | Long-lived secret credential issued to customer/integration |
| Client ID | Public identifier for the integration/key |
| Access token | Short-lived bearer token used on API calls |
| Scope | Permission attached to token/key, e.g. `spend.expenses.read` |
| Account / Organization | Resource owner context |
| Principal | The authenticated caller: user, app, service, or partner |

Phrase:

```text
Authentication tells us who you are. Authorization tells us what you can do.
```

---

## 3. Basic API Key To Bearer Token Flow

This is common for server-to-server API integrations.

```text
Customer Backend / ERP Integration
    |
    | x-client-id + x-api-key
    v
Authentication Service
    |
    | validates key, scope, account, environment
    v
Short-lived access token
    |
    | Authorization: Bearer <token>
    v
Product APIs
```

Example:

```http
POST /api/v1/authentication/login
x-client-id: client_123
x-api-key: secret_key_abc
```

Response:

```json
{
  "token": "eyJhbGciOi...",
  "expires_at": "2026-09-13T12:30:00Z"
}
```

API call:

```http
GET /api/v1/spend/expenses
Authorization: Bearer eyJhbGciOi...
```

Important:

```text
The API key is the long-lived credential.
The access token is short-lived and reused until expiry.
```

---

## 4. Why Use Bearer Tokens Instead Of API Key On Every Request?

Benefits:

* short-lived token limits blast radius
* token can encode scopes/account/context
* API key does not need to hit every product service
* easier central auth service
* product services validate token instead of raw API key
* token expiry forces periodic re-authentication

Tradeoff:

* stolen bearer token can be used until expiry
* customers must cache/refresh tokens correctly

Rule:

```text
API key stays server-side. Bearer token is used for API requests.
```

---

## 5. How Do We Know Token Request Is Not Malicious?

The token request must include valid secret credentials:

```text
client_id identifies the integration
api_key proves the caller has the secret
```

Authentication Service checks:

* client ID exists
* API key hash matches stored key hash
* key is active
* key is not expired
* key belongs to environment: sandbox vs production
* key has required scopes
* account/org access is allowed
* IP/network restriction if configured
* rate limits and anomaly checks

If someone steals the API key, they can request tokens. That is why API keys need:

* backend-only storage
* least privilege scopes
* rotation
* IP allowlisting
* audit logs
* alerting
* revocation

Phrase:

```text
The bearer token is short-lived, but the API key is the real long-lived secret.
```

---

## 6. JWT Bearer Token vs Opaque Token

### JWT Token

JWT contains signed claims:

```json
{
  "sub": "client_123",
  "org_id": "org_456",
  "account_id": "acct_789",
  "scopes": ["spend.expenses.read", "spend.expenses.write"],
  "iat": 1720000000,
  "exp": 1720001800
}
```

Pros:

* product services can validate locally
* no DB lookup on every request
* good for distributed APIs

Cons:

* revocation before expiry is harder
* token size larger
* claims can become stale

### Opaque Token

Token is random:

```text
tok_live_abc123...
```

API service introspects with auth service/cache.

Pros:

* easy revocation
* claims always current
* smaller token

Cons:

* needs introspection/cache
* auth service dependency

Practical choice:

```text
Use short-lived JWT for high-throughput APIs.
Use opaque tokens when immediate revocation and central control matter more.
```

---

## 7. JWT vs HMAC Per-Request Signing

### Bearer JWT

Caller sends:

```http
Authorization: Bearer <token>
```

Server verifies:

```text
signature
expiry
issuer
audience
scopes
account context
```

### HMAC Per-Request Signing

Caller computes:

```text
signature = HMAC(secret, method + path + timestamp + body_hash)
```

Request:

```http
X-Client-Id: client_123
X-Timestamp: 2026-09-13T12:00:00Z
X-Signature: abc...
```

Pros:

* each request is signed
* protects against body/path tampering
* can prevent replay with timestamp/nonce

Cons:

* more complex for developers
* every service needs canonical signing logic
* harder API ergonomics

Rule of thumb:

```text
Bearer tokens are simpler for general APIs.
HMAC signing is useful for webhooks, high-security callbacks, or request integrity.
```

---

## 8. OAuth2 Flow For Third-Party Apps

Use OAuth when an app acts on behalf of a customer/user.

```text
User authorizes app
    |
    v
authorization_code
    |
    v
app exchanges code + client_secret / PKCE
    |
    v
access_token + refresh_token
```

API call:

```http
Authorization: Bearer <access_token>
```

Refresh:

```text
access token expires
app uses refresh token
auth service returns new access token + rotated refresh token
```

Security controls:

* redirect URI validation
* PKCE
* consent screen
* scopes
* refresh token rotation
* revocation

Use OAuth when:

* partner app connects to customer account
* user/customer consent is required
* app should not receive raw customer API key

---

## 9. Authorization Model

Authorization checks should happen after authentication.

Check:

```text
token is valid
scope permits endpoint
caller can access account/org
resource belongs to account/org
operation is allowed in current state
```

Example:

```text
GET /spend/expenses/{id}
```

Checks:

* token has `spend.expenses.read`
* token belongs to org/account
* expense belongs to that org/account
* expense is not deleted/hidden

For write:

```text
POST /spend/expenses/{id}/sync
```

Checks:

* token has `spend.expenses.write` or `spend.expenses.sync`
* expense belongs to org/account
* state transition is valid
* idempotency key if operation is retryable

---

## 10. Scope Design

Good scopes are specific but not too granular.

Examples:

```text
spend.expenses.read
spend.expenses.write
spend.reimbursements.read
spend.reimbursements.write
spend.bills.read
spend.bills.write
webhooks.manage
```

Avoid:

```text
admin_everything
read_everything
write_everything
```

unless intentionally issued to trusted admin integrations.

Phrase:

```text
Scopes should map to product capabilities, not internal tables.
```

---

## 11. Account / Organization Context

B2B APIs often have multiple resource contexts:

```text
organization
account
legal entity
connected account
user
```

Token should identify:

```text
org_id
account_id
authorized accounts
scopes
environment
```

If a key can access multiple accounts, request may include:

```http
x-login-as: acct_123
```

or:

```http
x-on-behalf-of: connected_acct_456
```

Validation:

```text
Is this caller allowed to act on this account?
```

---

## 12. Token Lifetime

Recommended:

```text
access token: 15-60 minutes
refresh token: days/months, rotated
API key: long-lived but rotatable/revocable
```

Shorter access tokens reduce risk if leaked.

Clients should:

* cache token
* track expiry
* refresh before expiry
* not request token before every API call

---

## 13. API Key Storage

Store API keys securely:

```text
never plaintext
store hash of key
show secret only once
support rotation
support revoke
audit every use
```

Hashing:

```text
stored_key_hash = HMAC(server_secret, api_key)
```

or strong keyed hash. Need lookup prefix:

```text
api_key = ak_live_prefix.secret
lookup by prefix
verify by hash
```

---

## 14. Request Processing Flow

```text
Request enters API Gateway
    |
    v
Extract bearer token
    |
    v
Validate signature / introspect token
    |
    v
Check expiry, issuer, audience
    |
    v
Check scopes
    |
    v
Check account/org authorization
    |
    v
Check resource ownership
    |
    v
Execute business logic
    |
    v
Audit log
```

---

## 15. Idempotency For Authenticated APIs

For retryable write APIs:

```http
Idempotency-Key: abc-123
```

Store:

```text
account_id
idempotency_key
request_hash
status
response_body
created_at
expires_at
```

Check:

```text
same key + same request -> return same response
same key + different request -> reject
```

---

## 16. Webhook Authentication

For webhooks, HMAC signing is common.

Sender signs:

```text
signature = HMAC(webhook_secret, timestamp + body)
```

Receiver checks:

* signature valid
* timestamp within tolerance
* event_id not processed

Webhook handling:

```text
verify signature
store event_id
process idempotently
return 2xx only after durable accept
```

Phrase:

```text
API calls often use bearer tokens; webhooks often use HMAC signatures.
```

---

## 17. Security Controls

Use layers:

* TLS everywhere
* scoped API keys
* short-lived tokens
* IP allowlists
* rate limits
* anomaly detection
* audit logs
* key rotation
* key revocation
* environment separation
* least privilege
* secret scanning

---

## 18. Failure Modes

| Failure | Handling |
| :--- | :--- |
| Access token expired | Return 401; client refreshes token |
| API key revoked | Login fails |
| Scope missing | Return 403 |
| Wrong account context | Return 403 |
| Token stolen | Short expiry, revoke key/session, audit |
| API key leaked | Revoke/rotate key, investigate audit logs |
| Auth service down | Existing JWTs may still validate; new tokens fail |
| Clock skew | Allow small leeway on `iat` / `exp` |
| Replay attack | short token TTL or HMAC timestamp/nonce |

---

## 19. Observability

Metrics:

* token requests/sec
* token failure rate
* 401 count
* 403 count
* scope denial count
* API key usage by client/account
* suspicious IP count
* token refresh rate

Audit:

* key created
* key rotated
* key revoked
* token issued
* privileged endpoint called
* failed auth attempt

---

## 20. Interview Summary

Good answer:

```text
For B2B APIs, I would use client_id + API key to obtain a short-lived bearer token. Product APIs validate the token, scopes, account context, and resource ownership. The API key is the long-lived secret, so it must be scoped, stored securely, rotated, and optionally IP-restricted. For user-authorized partner apps, I would use OAuth2 with authorization code + PKCE and refresh token rotation. For webhooks, I would use HMAC signatures because the receiver needs to verify message integrity and prevent spoofing.
```

