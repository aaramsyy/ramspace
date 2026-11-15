# Account API Worker migration (experimental)

This separate deployment target removes the Container requirement for account
requests while retaining existing Hono routes, WorkOS identity, and PostgreSQL.
It is not qualified for production or release yet. The existing Container target
remains available during migration.

Configure DATABASE_URL with a TLS-enabled PostgreSQL connection, WORKOS_API_KEY,
WORKOS_CLIENT_ID, API_SIGNING_KEY, ACCOUNT_BASE_URL, and API_PUBLIC_URL as Worker
secrets. Use the signing-key format and WorkOS redirect configuration documented
in the API README. Never commit credentials. Run existing database migrations
from a controlled environment before sending traffic; requests do not migrate
the database. Back up existing databases before running migrations.

The entry point creates and closes database resources per invocation and uses a
five-minute Cron for cleanup. APNs, tunnel coordination, and billing configuration
are rejected until their background delivery semantics have been ported.

Remaining release gates: Worker bundling and runtime startup; PostgreSQL TLS and
connection-limit verification; OTP, authorization, refresh, revocation, and
concurrent-request tests; initialization failure cleanup; accurate client-IP
handling; CPU and subrequest usage under the Free plan; maintenance behavior;
and deployment/rollback instructions validated against a real staging account.
A Free plan is a usage limit, not a guarantee that this application's workloads
fit within it. Do not switch production traffic or release clients to this
endpoint before these gates pass.
