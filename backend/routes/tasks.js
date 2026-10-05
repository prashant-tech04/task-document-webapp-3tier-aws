// routes/tasks.js - CRUD for tasks
const express = require('express');
const pool = require('../db');

const router = express.Router();
const STATUSES = ['todo', 'in_progress', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const fail = (res, code, error) => res.status(code).json({ success: false, error });

// Validate the fields that were sent. Returns an error string or null.
function validate(body, requireTitle) {
  if (requireTitle || body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) return 'Title is required';
    if (body.title.length > 255) return 'Title is too long (max 255)';
  }
  if (body.status !== undefined && !STATUSES.includes(body.status)) return 'Invalid status';
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) return 'Invalid priority';
  if (body.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.due_date)) return 'due_date must be YYYY-MM-DD';
  return null;
}

// GET /api/tasks?status=todo
router.get('/', wrap(async (req, res) => {
  const params = [];
  let sql = `SELECT t.*, (SELECT COUNT(*) FROM documents d WHERE d.task_id = t.id) AS document_count
             FROM tasks t`;
  if (req.query.status) {
    if (!STATUSES.includes(req.query.status)) return fail(res, 400, 'Invalid status');
    sql += ' WHERE t.status = ?';
    params.push(req.query.status);
  }
  sql += ' ORDER BY t.created_at DESC, t.id DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, tasks: rows });
}));

// POST /api/tasks
router.post('/', wrap(async (req, res) => {
  const err = validate(req.body, true);
  if (err) return fail(res, 400, err);
  const { title, description, status = 'todo', priority = 'medium', due_date } = req.body;
  const [result] = await pool.query(
    'INSERT INTO tasks (title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?)',
    [title.trim(), description || null, status, priority, due_date || null]
  );
  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
  res.status(201).json({ success: true, task: rows[0] });
}));

// PUT /api/tasks/:id  (send only the fields you want to change)
router.put('/:id', wrap(async (req, res) => {
  const err = validate(req.body, false);
  if (err) return fail(res, 400, err);

  const allowed = ['title', 'description', 'status', 'priority', 'due_date'];
  const sets = [];
  const params = [];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      sets.push(`${field} = ?`);
      let value = req.body[field];
      if (field === 'title') value = value.trim();
      if (value === '') value = null;
      params.push(value);
    }
  }
  if (!sets.length) return fail(res, 400, 'Nothing to update');

  params.push(req.params.id);
  const [result] = await pool.query(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, params);
  if (!result.affectedRows) return fail(res, 404, 'Task not found');

  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json({ success: true, task: rows[0] });
}));

// DELETE /api/tasks/:id  (its documents are kept, just unlinked)
router.delete('/:id', wrap(async (req, res) => {
  const [result] = await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return fail(res, 404, 'Task not found');
  res.json({ success: true });
}));

module.exports = router;
