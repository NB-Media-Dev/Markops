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
│   ├── package.json      # Frontend npm dependencies and scripts
│   └── tsconfig.json     # TypeScript configuration
│
├── backend/              # Node.js + Express Backend Server
│   ├── server/           # Express routes, controllers, services, middleware
│   │   ├── app.js        # Express app configuration & middleware
│   │   ├── index.js      # Server entry point & HTTP/Socket.IO listener
│   │   └── db.js         # MySQL DB connection pool & fallback JSON store
│   ├── prisma/           # Prisma schema, migrations, and SQL scripts
│   ├── package.json      # Backend npm dependencies and scripts
│   └── .env.example      # Backend environment configuration template
│
└── package.json          # Root workspace scripts runner
```

---

## Getting Started

### 1. Install Dependencies

You can install dependencies inside each folder:

```bash
# In backend
cd backend
npm install

# In frontend
cd ../frontend
npm install
```

---

### 2. Environment Configuration

Copy the sample environment file in `backend/`:

```bash
cd backend
cp .env.example .env
```

Update your `.env` with your database credentials if connecting to MySQL:
```env
DATABASE_URL="mysql://root:password@localhost:3306/markops"
PORT=4000
```

---

### 3. Running Locally

#### Option A: Running from Root Directory

```bash
# Start backend server (port 4000)
npm run dev:backend

# Start frontend application (port 4200)
npm run dev:frontend
```

#### Option B: Running Individually

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

### 4. Database & Prisma Commands

```bash
cd backend

# Push schema changes to database
npm run db:push

# Open Prisma Studio GUI
npm run db:studio

# Generate Prisma Client
npm run db:generate
```
