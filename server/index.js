const { createServer } = require('node:http');
const { app, setupSocketIO } = require('./app');

const httpServer = createServer(app);
setupSocketIO(httpServer);

const port = process.env.PORT || 4000;
httpServer.listen(port, () => {
  console.log(`Node Express server listening on http://localhost:${port}`);
});
