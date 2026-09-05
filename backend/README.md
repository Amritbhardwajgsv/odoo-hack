# Backend

Basic JavaScript Express API.

## Run

```bash
npm run dev
```

The health endpoint is available at `GET /api/health`.

## Database migrations

Database scripts live in `db/migrations`. The first migration, `001_create_users.sql`, creates the `users` table; `001_create_users.down.sql` reverses it.

`db/pool.js` exports a shared `pg` `Pool`, configured from `DATABASE_URL` or the discrete `PG*` env vars (see `.env.example`).

`db/migrate.js` applies pending migrations in order, tracking what's been run in a `schema_migrations` table.

```bash
npm run migrate       # apply all pending migrations
npm run migrate:down  # roll back the most recently applied migration
```

## Payslip email queue

`POST /api/payruns/:id/send-payslips` doesn't send anything itself - it puts
one `send-payslip` job per payslip onto a BullMQ queue (`payslip-mail`,
backed by Redis) and returns `202` with the queued count.

Delivery runs in a **separate worker process**. `npm run dev` / `npm start`
forks `src/queue/mailWorker.js` as a child process automatically (only when
SMTP is configured), restarting it if it dies. To run the worker on its own
- e.g. to scale it apart from the API - use:

```bash
npm run worker
```

`docker-compose up` brings up Redis alongside Postgres. Configure `REDIS_URL`
(or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`), the `SMTP_*` vars, and
optionally `MAIL_WORKER_CONCURRENCY` - see `.env.example`. Failed sends are
retried with exponential backoff (4 attempts) before landing in the failed
set.

- `src/queue/connection.js` - shared Redis connection factory + queue name
- `src/queue/mailQueue.js` - the producer side (`enqueuePayslips`)
- `src/queue/mailWorker.js` - the consumer, run as a child process
- `src/queue/startWorker.js` - forks and supervises the worker from the API
