# MarkOps Workspace

A full-stack marketing operations management platform cleanly split into **frontend** and **backend** workspaces.

---

## Directory Structure

```text
.
├── frontend/             # Angular 22 Frontend Application
│   ├── src/              # Application source code (components, services, state)
│   ├── public/           # Static assets (images, icons, uploads)
│   ├── angular.json      # Angular workspace configuration
│   ├── proxy.conf.json   # Local dev proxy config (/api, /uploads, /socket.io -> :4000)
│   ├── vercel.json       # Vercel SPA deployment config
│   ├── netlify.toml      # Netlify deployment config
│   ├── package.json      # Frontend npm dependencies and scripts
│   └── tsconfig.json     # TypeScript configuration
│
├── backend/              # Node.js + Express Backend Server
│   ├── server/           # Express routes, controllers, services, middleware
│   │   ├── app.js        # Express app configuration & middleware
│   │   ├── index.js      # Server entry point & HTTP/Socket.IO listener
│   │   └── db.js         # MySQL DB connection pool & fallback JSON store
│   ├── prisma/           # Prisma schema, migrations, and SQL scripts
│   ├── Dockerfile        # Production container definition
│   ├── render.yaml       # Render.com Blueprint config
│   ├── Procfile          # Process manager config
│   ├── package.json      # Backend npm dependencies and scripts
│   └── .env.example      # Backend environment configuration template
│
├── DEPLOYMENT.md         # Step-by-Step Cloud Deployment Guide
└── package.json          # Root workspace scripts runner
```

---

## Getting Started

### 1. Install Dependencies

```bash
# In backend
cd backend
npm install

# In frontend
cd ../frontend
npm install
```

---

## Running Locally

#### From Root Directory
```bash
# Start backend server (port 4000)
npm run dev:backend

# Start frontend application (port 4200)
npm run dev:frontend
```

#### Running Individually
**Backend (`http://localhost:4000`):**
```bash
cd backend
npm run dev
```

**Frontend (`http://localhost:4200`):**
```bash
cd frontend
npm run dev
```

---

## Cloud Deployment

See [**`DEPLOYMENT.md`**](./DEPLOYMENT.md) for full deployment instructions for **Vercel**, **Netlify**, **Render**, and **Railway**.
