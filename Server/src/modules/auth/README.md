# Auth Module

## Purpose
The auth module handles authentication, session management, OTP flows, password reset, impersonation, and account lifecycle concerns.

## Key models
- `User`
- `RefreshSession`
- `PasswordResetOtp`
- `ActivationToken`
- `StaffModuleAccess`

## Responsibilities
- Validate credentials and issue signed sessions
- Manage refresh-token families and session invalidation
- Handle password reset and OTP verification
- Support impersonation and target-user auditing

## Authorization
- Public auth routes are intentionally open
- Protected routes require valid JWT verification and a valid session record
- IP-level throttling and user/account throttling should both remain active for login and OTP flows
- The auth layer should not replace permission checks on protected business routes

## Security notes
- OTP and login attempts are limited at both IP and user/account levels
- Session ownership is validated before each authenticated call
- Platform and school-level actor rules must remain explicit and auditable
