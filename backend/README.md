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
