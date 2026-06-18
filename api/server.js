import express from 'express';
import cors from 'cors';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const TOKEN = process.env.API_TOKEN;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_DIR = process.env.WEB_DIR || path.join(__dirname, 'web');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || true }));

// Health check (no auth) — useful to test reachability from the browser/curl
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Auth: every other /api route requires the bearer token (single-user)
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!TOKEN || token !== TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
});

// Wrap async handlers so rejections become 500s instead of crashing the process
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: 'server_error', detail: err.message });
});

// ---- People (persistent roster) ----
app.get('/api/people', wrap(async (req, res) => {
  const { rows } = await pool.query('select id, name, last_name, come_carne from people order by name, last_name');
  res.json(rows);
}));

app.post('/api/people', wrap(async (req, res) => {
  const { id, name, last_name = '', come_carne = true } = req.body;
  await pool.query(
    `insert into people (id, name, last_name, come_carne) values ($1, $2, $3, $4)
     on conflict (id) do update set name = excluded.name, last_name = excluded.last_name, come_carne = excluded.come_carne`,
    [id, name, last_name, come_carne]
  );
  res.json({ ok: true, id });
}));

app.put('/api/people/:id', wrap(async (req, res) => {
  const { name, last_name = '', come_carne } = req.body;
  await pool.query('update people set name = $2, last_name = $3, come_carne = $4 where id = $1',
    [req.params.id, name, last_name, come_carne]);
  res.json({ ok: true });
}));

app.delete('/api/people/:id', wrap(async (req, res) => {
  await pool.query('delete from people where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---- Asados ----
app.get('/api/asados', wrap(async (req, res) => {
  const { rows } = await pool.query(
    `select id, name, event_date, updated_at from asados
     order by coalesce(event_date, created_at::date) desc, created_at desc`
  );
  res.json(rows);
}));

app.post('/api/asados', wrap(async (req, res) => {
  const { id, name, event_date = null } = req.body;
  await pool.query('insert into asados (id, name, event_date) values ($1, $2, $3)', [id, name, event_date]);
  res.json({ ok: true, id });
}));

app.get('/api/asados/:id', wrap(async (req, res) => {
  const a = await pool.query('select id, name, event_date from asados where id = $1', [req.params.id]);
  if (!a.rows.length) return res.status(404).json({ error: 'not_found' });
  const expenses = await pool.query(
    'select id, description, price, es_carne, position from expenses where asado_id = $1 order by position',
    [req.params.id]
  );
  const participants = await pool.query(
    'select id, person_id, name, come_carne, pagado, position from asado_participants where asado_id = $1 order by position',
    [req.params.id]
  );
  res.json({ ...a.rows[0], expenses: expenses.rows, participants: participants.rows });
}));

// Full replace of an asado's contents — mirrors the frontend's "save whole state" flow.
// Everything happens in one transaction so a save is all-or-nothing.
app.put('/api/asados/:id', wrap(async (req, res) => {
  const { name, event_date = null, expenses = [], participants = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `insert into asados (id, name, event_date, updated_at) values ($1, $2, $3, now())
       on conflict (id) do update set name = excluded.name, event_date = excluded.event_date, updated_at = now()`,
      [req.params.id, name, event_date]
    );

    await client.query('delete from expenses where asado_id = $1', [req.params.id]);
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      await client.query(
        'insert into expenses (id, asado_id, description, price, es_carne, position) values ($1, $2, $3, $4, $5, $6)',
        [e.id, req.params.id, e.description ?? '', e.price ?? 0, !!e.es_carne, i]
      );
    }

    await client.query('delete from asado_participants where asado_id = $1', [req.params.id]);
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      await client.query(
        `insert into asado_participants (id, asado_id, person_id, name, come_carne, pagado, position)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [p.id, req.params.id, p.person_id ?? null, p.name ?? '', !!p.come_carne, !!p.pagado, i]
      );
    }

    await client.query('commit');
    res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}));

app.delete('/api/asados/:id', wrap(async (req, res) => {
  await pool.query('delete from asados where id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---- Serve the frontend (same-origin) with auto-injected config ----
// /config.js hands the browser the shared token so a shared URL "just works"
// with no setup. LAN/VPN only: anyone who can load the page can already reach
// the API, so exposing the token here doesn't widen the trust boundary.
app.get('/config.js', (req, res) => {
  res.type('application/javascript')
     .send(`window.ASADO_CONFIG = ${JSON.stringify({ token: TOKEN || '' })};`);
});
app.use(express.static(WEB_DIR));

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`asado-api listening on :${port}`));
