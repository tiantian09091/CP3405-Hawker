# Hawker Forecast Platform

A React customer marketplace and hawker demand-planning dashboard backed by an Express API. Local development uses a JSON data file. When `DATABASE_URL` is present, the same server automatically uses PostgreSQL.

The customer marketplace can be used without an account. Customers may register for convenience, while the hawker planning workspace always requires sign-in.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:4174`.

Demo hawker account:

- Email: `hawker@hawkerforecast.sg`
- Password: `zyy123123`

Set `DEMO_HAWKER_EMAIL` and `DEMO_HAWKER_PASSWORD` to different values in Render before publishing.

## API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service and storage health |
| GET | `/api/auth/me` | Current signed-in account |
| POST | `/api/auth/register` | Register a customer account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out |
| GET | `/api/bootstrap` | Initial app data |
| GET | `/api/forecast` | Current demand forecast |
| PUT | `/api/forecast` | Manual forecast adjustment |
| POST | `/api/forecast/recalculate` | Recalculate from weather, day type and sales trend |
| GET | `/api/preorders` | List reservations |
| POST | `/api/preorders` | Create a reservation |
| GET | `/api/inventory` | List ingredients and stock |
| PUT | `/api/inventory` | Update stock counts |
| GET | `/api/purchase-plan` | Calculated ingredient plan |
| POST | `/api/purchase-plan/confirm` | Confirm the current plan |
| GET | `/api/sales-history` | Last seven days of sales |

## Test and build

```bash
pnpm run test:api
pnpm run test:sites
pnpm run build
```

## Deploy to Render

1. Push this project to a GitHub repository.
2. In Render, choose **New → Blueprint** and select the repository.
3. Render reads `render.yaml` and creates the Node web service and PostgreSQL database.
4. After deployment, check `https://YOUR-SERVICE.onrender.com/api/health`.

The server listens on `process.env.PORT` and serves both the built React app and `/api` routes. Secrets and database URLs belong in Render environment variables, not in source code.

## Data storage

- Local: `server/data/local-state.json` (created automatically and ignored by Git).
- Render: PostgreSQL through `DATABASE_URL`; the required table and seed data are created automatically on first start.
