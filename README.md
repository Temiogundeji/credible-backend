# Credible backend

NestJS backend foundation for Credible.

The current slice contains configuration, validation, health, shared primitives, and the framework-independent identity policy/port layer. Authentication adapters, persistence, and HTTP endpoints are added only against the approved contracts; no in-memory or placeholder authentication implementation is used.

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL and Redis using the project development environment.
3. Install dependencies with the approved package manager.
4. Run `npm run prisma:generate`.
5. Apply reviewed local migrations with `npm run prisma:migrate:dev`.
6. Run `npm run typecheck`, `npm run lint`, and `npm test`.
7. Run `npm run start:dev` (or `npm start` after building).

Prisma is the only approved ORM and migration tool. Domain and application code must depend on repository ports, never on generated Prisma client types.
