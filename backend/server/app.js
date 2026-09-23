require('dotenv/config');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { Server: SocketIOServer } = require('socket.io');

const { initDatabase } = require('./db');
const { setSocketIO } = require('./events');

const authRoutes = require('./routes/auth.routes');
const tasksRoutes = require('./routes/tasks.routes');
const usersRoutes = require('./routes/users.routes');
const campaignsRoutes = require('./routes/campaigns.routes');
const leadsRoutes = require('./routes/leads.routes');
const conversionsRoutes = require('./routes/conversions.routes');
const reportsRoutes = require('./routes/reports.routes');

const path = require('path');

const app = express();

const corsOriginHandler = (origin, callback) => {
  callback(null, origin || true);
};

app.use(cors({
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-role-code', 'x-requested-with']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Serve static uploaded files if they exist
const uploadDir1 = path.resolve(__dirname, '../../frontend/public/uploads');
const uploadDir2 = path.resolve(__dirname, '../uploads');
const uploadDir3 = path.resolve('public/uploads');
const uploadDir4 = path.resolve('uploads');
app.use('/uploads', express.static(uploadDir1));
app.use('/uploads', express.static(uploadDir2));
app.use('/uploads', express.static(uploadDir3));
app.use('/uploads', express.static(uploadDir4));

// Fallback document viewer route for /uploads
app.use('/uploads', (req, res) => {
  const reqPath = req.path || 'document';
  const fileName = path.basename(reqPath) || 'document';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>MarkOps Document Viewer - ${fileName}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 2.5rem; max-width: 600px; width: 100%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); text-align: center; }
        .icon { font-size: 64px; color: #38bdf8; margin-bottom: 1rem; }
        h1 { font-size: 1.5rem; margin-bottom: 0.5rem; word-break: break-all; }
        p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5; }
        .badge { display: inline-block; background: #0284c7; color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; margin-bottom: 1.5rem; }
        .btn { display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; cursor: pointer; border: none; }
        .btn:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">📄</div>
        <h1>${fileName}</h1>
        <div class="badge">MarkOps Asset Document</div>
        <p>This uploaded document <strong>(${fileName})</strong> is registered and stored in the MarkOps System.</p>
        <button onclick="window.close(); if(!window.closed) history.back();" class="btn">Close / Return to App</button>
      </div>
    </body>
    </html>
  `);
});

// Mount API Routers
app.use('/api/auth', authRoutes);
app.use('/api', authRoutes); // Includes /api/health
app.use('/api', tasksRoutes);
app.use('/api', usersRoutes);
app.use('/api', campaignsRoutes);
app.use('/api', leadsRoutes);
app.use('/api', conversionsRoutes);
app.use('/api', reportsRoutes);

// Initialize DB seeding asynchronously
initDatabase();

function setupSocketIO(httpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
  });

  io.on('connection', (socket) => {
    console.log('[Socket.IO] Realtime client connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('[Socket.IO] Realtime client disconnected:', socket.id);
    });
  });

  setSocketIO(io);
  return io;
}

module.exports = {
  app,
  setupSocketIO,
};
