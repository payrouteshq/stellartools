# Security Policy

Stellar Tools is payment infrastructure that self-hosters run with real funds and real customer data. Security reports are taken seriously and prioritized.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Email **odii@stellartools.dev** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (a minimal repro is ideal)
- The affected version or commit

You'll get an acknowledgment as soon as possible, and we'll keep you updated as the issue is investigated and fixed. Reporters are credited in the fix (unless you'd prefer otherwise).

## Scope

In scope:

- The `apps/web` application (dashboard, checkout, API, webhooks)
- The `subscription-engine` Soroban contract in `apps/web/soroban`
- The published packages under `packages/*`

Out of scope:

- Vulnerabilities that require access to a self-hoster's own leaked secrets (`MASTER_ENCRYPTION_KEY`, `KEEPER_SECRET_*`, `JWT_SECRET`, database credentials) — protecting those is the operator's responsibility
- Third-party dependencies — report those upstream, though we'd still like to know

## Supported versions

This project ships as a rolling `main` branch rather than maintained release branches. Security fixes land on `main`; self-hosters should track it and redeploy when a fix ships. If you're running an older commit, update before relying on any fix.

## A note on self-hosted funds

Because every deployment holds its own Stellar keys (`KEEPER_SECRET_*`, organization secrets encrypted with `MASTER_ENCRYPTION_KEY`), a compromise of your own server's environment variables or database is equivalent to a compromise of your funds. Treat `.env` and your database backups with the same care you'd give a hot wallet.
