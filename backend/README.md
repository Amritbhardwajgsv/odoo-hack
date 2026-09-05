# Backend

Basic JavaScript Express API.

## Run

```bash
npm run dev
```

The health endpoint is available at `GET /api/health`.

## Database migrations

Database scripts live in `db/migrations`. The first migration, `001_create_users.sql`, creates the `users` table; `001_create_users.down.sql` reverses it.
