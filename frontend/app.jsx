// app.jsx - React frontend (presentation tier)
const { useState, useEffect, useCallback } = React;
const API = window.APP_CONFIG.API_BASE;

const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
const FILTERS = ['all', 'todo', 'in_progress', 'done'];

// Small helper around fetch that throws on API errors
async function api(path, options) {
  const res = await fetch(API + path, options);
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Request failed');
  return data;
}

const jsonRequest = (method, body) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isOverdue(task) {
  return task.due_date && task.status !== 'done' && task.due_date < new Date().toISOString().slice(0, 10);
}

/* ---------- Task form ---------- */
function TaskForm({ onCreated, onError }) {
  const empty = { title: '', description: '', priority: 'medium', due_date: '' };
  const [form, setForm] = useState(empty);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    try {
      await api('/tasks', jsonRequest('POST', form));
      setForm(empty);
      onCreated();
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Add task</h2>
      <div className="form-group">
        <label>Title</label>
        <input value={form.title} onChange={set('title')} placeholder="What needs to be done?" required />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea value={form.description} onChange={set('description')} rows="2" />
      </div>
      <div className="row">
        <div className="form-group">
          <label>Priority</label>
          <select value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="form-group">
          <label>Due date</label>
          <input type="date" value={form.due_date} onChange={set('due_date')} />
        </div>
      </div>
      <button type="submit">Add task</button>
    </form>
  );
}

/* ---------- Task list ---------- */
function TaskItem({ task, onChange, onDelete }) {
  return (
    <li className={'task ' + (task.status === 'done' ? 'done' : '')}>
      <div className="task-main">
        <div className="task-title">
          {task.title}
          <span className={'badge priority-' + task.priority}>{task.priority}</span>
        </div>
        {task.description && <p className="task-desc">{task.description}</p>}
        <div className="task-meta">
          {task.due_date && (
            <span className={isOverdue(task) ? 'overdue' : ''}>
              Due {task.due_date}{isOverdue(task) ? ' (overdue)' : ''}
            </span>
          )}
          {task.document_count > 0 && <span>{task.document_count} document(s)</span>}
        </div>
      </div>
      <div className="task-actions">
        <select value={task.status} onChange={(e) => onChange(task.id, { status: e.target.value })}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button className="danger" onClick={() => onDelete(task.id)}>Delete</button>
      </div>
    </li>
  );
}

function TaskList({ tasks, filter, setFilter, onChange, onDelete }) {
  const visible = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  return (
    <div className="card">
      <h2>Tasks</h2>
      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="empty">No tasks here.</p>
      ) : (
        <ul className="list">
          {visible.map((t) => (
            <TaskItem key={t.id} task={t} onChange={onChange} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Documents ---------- */
function DocumentPanel({ tasks, documents, onUploaded, onDelete, onError }) {
  const [file, setFile] = useState(null);
  const [taskId, setTaskId] = useState('');
  const [uploading, setUploading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    if (taskId) body.append('task_id', taskId);
    setUploading(true);
    try {
      await api('/documents', { method: 'POST', body });
      setFile(null);
      setTaskId('');
      e.target.reset();
      onUploaded();
    } catch (err) {
      onError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="card">
      <h2>Documents</h2>
      <form onSubmit={submit} className="upload-form">
        <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} required />
        <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          <option value="">Not linked to a task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        <button type="submit" disabled={uploading || !file}>{uploading ? 'Uploading...' : 'Upload'}</button>
      </form>
      <p className="hint">Max file size: 10 MB</p>

      {documents.length === 0 ? (
        <p className="empty">No documents yet.</p>
      ) : (
        <ul className="list">
          {documents.map((d) => (
            <li key={d.id} className="doc">
              <div className="task-main">
                <div className="task-title">{d.original_name}</div>
                <div className="task-meta">
                  <span>{formatSize(d.size)}</span>
                  <span>{d.created_at}</span>
                  {d.task_title && <span>Task: {d.task_title}</span>}
                </div>
              </div>
              <div className="task-actions">
                <a className="button" href={`${API}/documents/${d.id}/download`}>Download</a>
                <button className="danger" onClick={() => onDelete(d.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- App ---------- */
function App() {
  const [tasks, setTasks] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([api('/tasks'), api('/documents')]);
      setTasks(t.tasks);
      setDocuments(d.documents);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Run an API action, then refresh the lists
  const run = (fn) => async (...args) => {
    try {
      await fn(...args);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateTask = run((id, changes) => api('/tasks/' + id, jsonRequest('PUT', changes)));
  const deleteTask = run((id) => {
    if (!window.confirm('Delete this task? Its documents will be kept.')) return;
    return api('/tasks/' + id, { method: 'DELETE' });
  });
  const deleteDocument = run((id) => {
    if (!window.confirm('Delete this document?')) return;
    return api('/documents/' + id, { method: 'DELETE' });
  });

  const counts = {
    todo: tasks.filter((t) => t.status === 'todo').length,
    in_progress: tasks.filter((t) => t.status === 'in_progress').length,
    done: tasks.filter((t) => t.status === 'done').length
  };

  return (
    <div className="container">
      <h1>Task &amp; Document Manager</h1>
      <p className="subtitle">Three-tier architecture on AWS: React, Node.js and MySQL</p>

      {error && <div className="error" onClick={() => setError('')}>{error} (click to dismiss)</div>}

      <div className="stats">
        <div><strong>{counts.todo}</strong> To do</div>
        <div><strong>{counts.in_progress}</strong> In progress</div>
        <div><strong>{counts.done}</strong> Done</div>
        <div><strong>{documents.length}</strong> Documents</div>
      </div>

      {loading ? (
        <p className="empty">Loading...</p>
      ) : (
        <div className="grid">
          <div>
            <TaskForm onCreated={loadAll} onError={setError} />
            <DocumentPanel
              tasks={tasks}
              documents={documents}
              onUploaded={loadAll}
              onDelete={deleteDocument}
              onError={setError}
            />
          </div>
          <TaskList tasks={tasks} filter={filter} setFilter={setFilter} onChange={updateTask} onDelete={deleteTask} />
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
