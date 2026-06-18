# Asado Calculator — Project Plan

> Self-contained handoff doc. This project is **independent** from the bullmedia
> (`bullmg-admin`) software. Open a Claude/dev session **in this folder**
> (`asado-calculator/`), not in the work repo.

## What this is

A tool to split the cost of an asado: enter expenses, mark who eats meat and who
paid, and it calculates what each person owes. Meat expenses are split only among
meat-eaters; everything else is split among everyone. Amounts round **up** to whole
pesos.

Currently a single-file frontend with `localStorage`. We're adding a small backend
so data is **portable** (not trapped in one browser), supports **multiple asados**,
and keeps a **persistent people roster** to recall for future events.

## Goals

1. Store multiple asados (events) server-side, not in localStorage.
2. Persistent people roster — reuse the same people across asados.
3. Portable: open the app from anywhere on the LAN/VPN and see the same data.
4. Single user (just the owner). LAN/VPN only — no public exposure.

## Architecture (decided)

| Piece | Decision |
|---|---|
| Frontend | Single HTML file (`web/index.html`), vanilla JS. Talks to the API via `fetch`, with a localStorage fallback when no API is configured. |
| Backend | Tiny Node + Express API (`api/`). |
| Backend hosting | **Docker container on the existing Docker VM** (the one running Karakeep etc.) — no new LXC. |
| Database | New `asado` database on the **existing Postgres LXC** (reuse it; don't spin up a new DB). |
| Access | LAN / VPN (Tailscale) only. Bind the published port to the VM's LAN/tailnet IP. |
| Auth | Single shared bearer token (`API_TOKEN`). |

Reference environment: `containers` box is Debian 13 / Node 22 — the Docker image
uses `node:22-alpine`.

## Folder structure

```
asado-calculator/
├── plan.md            ← this file
├── api/               ← Node + Express backend
│   ├── server.js          API (people + asados CRUD, bearer auth, txn save)
│   ├── schema.sql         tables: people, asados, expenses, asado_participants
│   ├── migrate.js         `npm run migrate` applies schema.sql
│   ├── package.json
│   ├── Dockerfile         node:22-alpine
│   ├── docker-compose.yml builds + runs on the Docker VM
│   ├── .dockerignore
│   ├── .env.example       copy to .env and fill in
│   ├── asado-api.service  (alt: systemd, if NOT using Docker)
│   └── README.md          endpoint reference + non-Docker runbook
└── web/
    └── index.html      ← the app (frontend)
```

## Data model

- **people**: `id` (client text id), `name`, `come_carne`
- **asados**: `id`, `name`, `event_date`, timestamps
- **expenses**: `id`, `asado_id`→asados, `description`, `price`, `es_carne`, `position`
- **asado_participants**: `id`, `asado_id`→asados, `person_id`→people (nullable, the
  roster link), `name`, `come_carne`, `pagado`, `position`

Primary keys are **client-supplied text ids** (frontend already generates them), so
"save the whole asado" stays simple and stable.

## API (built — see `api/README.md` for details)

- `GET /api/health` — no auth, reachability check
- People: `GET/POST /api/people`, `PUT/DELETE /api/people/:id`
- Asados: `GET/POST /api/asados`, `GET/PUT/DELETE /api/asados/:id`
- `PUT /api/asados/:id` does a **full transactional replace** of that asado's
  expenses + participants — mirrors the frontend's whole-state save.
- All `/api/*` except health require `Authorization: Bearer <API_TOKEN>`.

## Status

- [x] Backend code (server, schema, migration)
- [x] Docker packaging (Dockerfile, compose, .dockerignore)
- [x] Deploy runbook (`api/README.md`)
- [x] Project split into its own folder
- [x] **Frontend rework** — settings, asado selector, debounced server save,
      roster recall + datalist, one-time localStorage migration (see below)
- [x] git repo for this folder (pushed to GitHub: `martomarzo/asado`)
- [x] **Created `asado` DB + role on the Postgres LXC** (`postgresql`, PG17). No
      `pg_hba` edit needed — the existing `host all all 0.0.0.0/0 md5` catch-all
      already permits it (auth auto-upgrades to SCRAM).
- [x] **Deployed the API container on the Docker VM** (`docker`, `containers/asado`).
      Bound to `0.0.0.0:8787`, `restart: unless-stopped`, tables migrated.
- [x] Confirmed `/api/health` + authed `/api/people` reachable over LAN and Tailscale
- [ ] (optional) host `web/index.html` somewhere on the LAN

## Frontend rework — DONE

All built into `web/index.html` (still a single vanilla-JS file):

1. **Settings** ✅ — gear (⚙️) opens a modal to set API base URL + token (saved in
   localStorage under `asado-api-config`), with a "Probar conexión" test and a
   "Modo offline" button. Unset → app runs in offline localStorage mode (unchanged).
2. **Asado selector** ✅ — toolbar `<select>` to pick an asado, plus ＋ new / ✎ rename
   / 🗑 delete. Loads `GET /api/asados/:id` into state; remembers the last one.
3. **Save** ✅ — `save()` writes a localStorage cache immediately, then debounces
   (700ms) a `PUT /api/asados/:id` of the whole state. A status dot shows
   saving/saved/error; on error it falls back to the local cache.
4. **Roster recall** ✅ — participant name inputs autocomplete from `GET /api/people`
   via a `<datalist>`; an exact name match links `person_id` and copies `come_carne`
   (● marks linked rows). A "📒 Roster" tab (online only) manages saved people.
5. **Migration** ✅ — Settings → "Importar datos locales" creates a new "Importado"
   asado from the old localStorage data (non-destructive).

Preserved: tabs, always-visible Resumen, round-up math, paid-row styling,
Enter-to-add, accessibility (aria labels / pressed states).

## Live deployment (as built)

| Piece | Value |
|---|---|
| Postgres LXC | `postgresql` — LAN `192.168.0.98`, tailnet `100.85.111.8`, PG 17 |
| DB / role | `asado` / `asado` (password in the VM's `api/.env`) |
| Docker VM | `docker` — LAN `192.168.0.105`, tailnet `100.114.36.91` |
| App dir | `/root/containers/asado` (alongside `karakeep`) |
| API URL (LAN) | `http://192.168.0.105:8787` |
| API URL (Tailscale) | `http://100.114.36.91:8787` |

`DATABASE_URL` points at the Postgres LAN IP (`192.168.0.98`); the API binds
`0.0.0.0:8787` so it answers on both LAN and tailnet.

**Updating later** (repo is private, VM has no git creds — push code over SSH):
```bash
# from this folder, on a machine that can reach the VM:
tar czf - --exclude=.git --exclude=node_modules --exclude=api/.env . \
  | ssh root@docker 'tar xzf - -C /root/containers/asado'
ssh root@docker 'cd /root/containers/asado/api && docker compose up -d --build'
```
(Or add a read-only deploy key / make the repo public to use `git pull`.)

## Deploy (reference runbook)

### Step 1 — Postgres LXC: create DB + user
```bash
sudo -u postgres psql <<'SQL'
CREATE USER asado WITH PASSWORD 'PICK_A_STRONG_PASSWORD';
CREATE DATABASE asado OWNER asado;
SQL
```
Allow the Docker VM to connect (adjust subnet):
- `postgresql.conf`: `listen_addresses = '*'`
- `pg_hba.conf`: `host  asado  asado  <DOCKER_VM_SUBNET> scram-sha-256`
- `sudo systemctl restart postgresql`

### Step 2 — Docker VM: run the API
```bash
# get the code onto the VM (git clone or rsync this folder), then:
cd asado-calculator/api
cp .env.example .env
nano .env            # DATABASE_URL → PG LXC IP; API_TOKEN → openssl rand -hex 32; HOST_IP → VM LAN/tailnet IP
docker compose up -d --build
docker compose exec asado-api npm run migrate   # create tables (first run only)
docker compose logs -f asado-api
```

### Step 3 — Test
```bash
curl -s http://<DOCKER_VM_IP>:8787/api/health                 # {"ok":true}
curl -s -H "Authorization: Bearer <TOKEN>" http://<DOCKER_VM_IP>:8787/api/people   # []
```

## Open questions / to confirm
- Postgres LXC IP + whether to create the DB myself (need access) or you will.
- Docker VM IP / how you reach it (LAN IP vs Tailscale).
- git repo for this folder? (recommended, standalone — not inside bullmg-admin)
