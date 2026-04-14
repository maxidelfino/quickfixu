# QuickFixU Monorepo

QuickFixU is a marketplace platform that connects clients with trusted service professionals such as electricians, plumbers, and gas technicians. This repository groups the backend API, the mobile application, and the product documentation in a single monorepo.

## Repository Structure

```text
quickfixu/
|- backend/   # Node.js + Express + Prisma + PostgreSQL API
|- mobile/    # Expo + React Native mobile app
|- docs/      # Product, narrative, and phase documentation
```

## Tech Stack

- `backend/`: Node.js, Express, TypeScript, Prisma, PostgreSQL, PostGIS, Redis
- `mobile/`: Expo, React Native, TypeScript
- `docs/`: PRD, business context, narrative, and phased planning

## Prerequisites

Minimum requirements:

- Node.js `18+`
- npm `9+`
- PostgreSQL `15+`
- PostGIS extension enabled in PostgreSQL
- Redis available for backend runtime
- Expo Go or Android/iOS simulator for mobile testing

Optional integrations depending on the environment:

- Cloudinary for file uploads
- Google and Facebook OAuth credentials
- Supabase project for mobile client services

## Getting Started

This monorepo does not currently expose a single root-level dev command. Start each app independently.

### Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run migrate
npm run seed
npm run dev
```

Useful commands:

- `npm run dev`: start the API in development mode
- `npm run migrate`: run Prisma migrations locally
- `npm run migrate:deploy`: apply migrations in deployment environments
- `npm run seed`: seed initial categories

Default local API URL: `http://localhost:3000`

### Mobile

```bash
cd mobile
npm install
npm start
```

Useful commands:

- `npm start`: start Expo
- `npm run android`: open Android flow
- `npm run ios`: open iOS flow
- `npm run web`: run Expo web

For physical-device testing, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP instead of `localhost`.

## Environment Variables

Copy each app's example file before running locally:

- `backend/.env.example`
- `mobile/.env.example`

High-level environment groups:

### Backend

- Database: `DATABASE_URL`
- JWT keys and app runtime: `JWT_*`, `PORT`, `NODE_ENV`
- Infrastructure: `REDIS_URL`, `CORS_ORIGINS`
- Uploads: `CLOUDINARY_*`
- OAuth: `GOOGLE_*`, `FACEBOOK_*`
- Geocoding/location: `NOMINATIM_USER_AGENT`, `GOOGLE_GEOCODING_API_KEY`
- Upload and rate-limit controls: `MAX_FILE_SIZE`, `ALLOWED_*`, `RATE_LIMIT_*`

### Mobile

- API base URL: `EXPO_PUBLIC_API_URL`
- Supabase public client config: `EXPO_PUBLIC_SUPABASE_*`
- OAuth public client IDs: `EXPO_PUBLIC_GOOGLE_*`, `EXPO_PUBLIC_FACEBOOK_APP_ID`

Do not commit real credentials, local `.env` files, or generated private keys.

## Documentation

Product and planning artifacts live in `docs/`, including:

- `docs/PRD.md`
- `docs/BusinessCase.md`
- `docs/Narrative.md`
- `docs/phases/`

## Deployment and Immediate Roadmap

- Backend: deploy `backend/` as an independent service with PostgreSQL, PostGIS, Redis, migrations, and environment-based secrets.
- Mobile: produce separate Android and iOS builds from `mobile/`, pointing to the deployed backend API.
- Monorepo: keep shared documentation and planning in `docs/` while backend and mobile evolve independently.

## Status

QuickFixU is currently organized as a product-focused monorepo prepared for GitHub publication, separate backend deployment, and native mobile delivery.
