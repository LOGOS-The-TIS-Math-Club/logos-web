# Security Policy

## Supported version

LOGOS Web is pre-release. Security fixes target the current `main` branch until the first tagged release is accepted.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting form in the repository **Security** tab. Do not open a public issue, discussion, or pull request for a suspected vulnerability.

Include the affected path or component, impact, minimal reproduction, and a remediation suggestion when known. Use synthetic values and redact tokens, cookies, student information, deployment URLs that grant access, and other sensitive evidence.

This is a volunteer school-club project and cannot promise a commercial response SLA. Maintainers will acknowledge valid reports as soon as practical, restrict disclosure while remediation is prepared, and coordinate publication after affected users and credentials are protected.

## Scope boundaries

Phase 02 adds PostgreSQL infrastructure, migrations, server-only environment validation, and database role boundaries using synthetic technical data only. Reports about credential exposure, database privilege escalation, environment crossover, migration integrity, or secret leakage are in scope.

Authentication, student or member data, Google Workspace integration, and public production deployment remain unimplemented. Reports about those future systems are out of scope unless they concern committed documentation or delivery configuration.
