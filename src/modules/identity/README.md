# Identity module boundaries

The identity module is intentionally split into three layers:

- `domain/` contains authentication policy, session policy, identity types, and provider interfaces. It has no NestJS, database, Redis, JWT, or vendor dependency.
- `application/` contains commands, results, and application errors. Use cases coordinate ports and are the only layer allowed to decide transaction boundaries.
- `infrastructure/` and `presentation/` are reserved for concrete adapters and HTTP mappings. They must not be added until the approved database and API contracts are implemented.

The current infrastructure adapter is Prisma-backed. `PrismaService` uses `AsyncLocalStorage` to keep repository calls inside the active Prisma transaction. The generated Prisma client is not exported beyond the infrastructure module.

`IDENTITY_PORTS` is the dependency-injection token catalog. Prisma repositories implement the interfaces in `domain/identity-ports.ts`; they do not expose Prisma models or generated client types to application code.

Security boundaries:

- Passwords are passed only to `PasswordHasher`; no application service stores or logs plaintext passwords.
- Refresh tokens are represented by hashes at the persistence boundary. Rotation and reuse detection belong in one transaction in the session adapter.
- Authentication events are append-only through `AuthenticationEventWriter`.
- Tenant identity comes from the authenticated session and request context, never from a caller-controlled financial resource identifier.
- MFA policy is evaluated by `AuthPolicyService`; controllers must not duplicate role checks.
- Login attempts pass through `AuthenticationRateLimiter` before identity lookup so account enumeration and credential-stuffing controls remain application concerns, not controller concerns.

The current implementation intentionally stops at ports and policy. An in-memory auth implementation would create false security evidence and is not permitted for this financial system.
