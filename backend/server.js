// server.js - entry point of the backend tier
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Health check used by the App ALB target group
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (err) {
    res.status(500).json({ status: 'db_error' });
  }
});

app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/documents', require('./routes/documents'));

// Error handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, error: 'File too large (max 10 MB)' });
  }
  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on port ${port}`));
