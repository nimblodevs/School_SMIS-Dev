# Auth Module

## Purpose
The auth module manages identity, session lifecycle, impersonation, password handling, and user authentication for the school application.

## Responsibilities
- User login, logout, and refresh-token handling
- Password reset and OTP flows
- Session validation and impersonation authorization
- Current-user profile retrieval
- Support for school-scoped user identity and platform operator access

## Database models owned
- `User`
- `RefreshSession`
- `PasswordResetOtp`
- `ActivationToken`

## API endpoints
- Login and credential-based authentication
- Logout and refresh flows
- Password reset and OTP endpoints
- Current-user profile endpoint
- Optional support/impersonation flows

## Authorization requirements
- Public auth endpoints are intentionally open
- All protected routes require a valid JWT and session context
- Impersonation is restricted to approved actors and eligible target users
- School-scoped actions must respect the authenticated user’s tenant context

## Transactions
- Token/session updates should be transactional when invalidating prior sessions
- Password updates must atomically replace password hashes and revoke active sessions
- Login and refresh flows should preserve single-device session integrity

## Events
- Login success/failure
- Password change/reset
- Logout and session revocation
- Impersonation started or ended

## External integrations
- JWT-based auth tokens
- Google OAuth verification
- Email delivery for OTPs and password reset notices
