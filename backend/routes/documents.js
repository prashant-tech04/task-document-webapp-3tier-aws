// routes/documents.js - upload, list, download and delete documents
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const pool = require('../db');

const router = express.Router();
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const bucket = process.env.S3_BUCKET;

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);
const fail = (res, code, error) => res.status(code).json({ success: false, error });

// GET /api/documents?task_id=1  (file content is not returned in the list)
router.get('/', wrap(async (req, res) => {
  const params = [];
  let sql = `SELECT d.id, d.task_id, d.original_name, d.mime_type, d.size, d.created_at, t.title AS task_title
             FROM documents d LEFT JOIN tasks t ON t.id = d.task_id`;
  if (req.query.task_id) {
    sql += ' WHERE d.task_id = ?';
    params.push(req.query.task_id);
  }
  sql += ' ORDER BY d.created_at DESC, d.id DESC';
  const [rows] = await pool.query(sql, params);
  res.json({ success: true, documents: rows });
}));

// POST /api/documents  (multipart/form-data: file, optional task_id)
router.post('/', upload.single('file'), wrap(async (req, res) => {
  if (!req.file) return fail(res, 400, 'No file uploaded');
  if (!bucket) return fail(res, 500, 'S3_BUCKET is not configured');

  let taskId = null;
  if (req.body.task_id) {
    const [tasks] = await pool.query('SELECT id FROM tasks WHERE id = ?', [req.body.task_id]);
    if (!tasks.length) return fail(res, 400, 'Task not found');
    taskId = tasks[0].id;
  }

  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 255);
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `documents/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: req.file.buffer,
    ContentType: req.file.mimetype,
    ServerSideEncryption: 'AES256'
  }));

  try {
    const [result] = await pool.query(
      'INSERT INTO documents (task_id, original_name, mime_type, size, content, s3_key) VALUES (?, ?, ?, ?, NULL, ?)',
      [taskId, name, req.file.mimetype, req.file.size, key]
    );
    res.status(201).json({
      success: true,
      document: { id: result.insertId, task_id: taskId, original_name: name, size: req.file.size }
    });
  } catch (err) {
    // Do not leave an orphaned S3 object if the DB insert fails.
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    throw err;
  }
}));

// GET /api/documents/:id/download
router.get('/:id/download', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!rows.length) return fail(res, 404, 'Document not found');
  const doc = rows[0];

  res.setHeader('Content-Type', doc.mime_type);
  res.setHeader('Content-Length', doc.size);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.original_name)}`);

  if (doc.s3_key) {
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: doc.s3_key }));
    object.Body.pipe(res);
  } else {
    // Backward compatibility for documents created by the original DB-storage version.
    res.send(doc.content);
  }
}));

// DELETE /api/documents/:id
router.delete('/:id', wrap(async (req, res) => {
  const [rows] = await pool.query('SELECT s3_key FROM documents WHERE id = ?', [req.params.id]);
  if (!rows.length) return fail(res, 404, 'Document not found');

  const [result] = await pool.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
  if (!result.affectedRows) return fail(res, 404, 'Document not found');

  if (rows[0].s3_key && bucket) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: rows[0].s3_key }));
  }
  res.json({ success: true });
}));

module.exports = router;
