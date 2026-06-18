# Asado API

Tiny single-user backend for the Asado calculator. Node + Express + Postgres.
Stores a persistent **people roster** and multiple **asados** (events), each with its
own expenses and participants. The pay-split math stays in the frontend.

- Runtime: Node 18+ (the target LXC mirrors `containers`: Debian 13, Node 22)
- Auth: one shared bearer token (`API_TOKEN`)
- Network: LAN/VPN only (no public exposure)

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | reachability check (no auth) |
| GET | `/api/people` | list roster |
| POST | `/api/people` | add/upsert a roster person `{id,name,come_carne}` |
| PUT | `/api/people/:id` | update a roster person |
| DELETE | `/api/people/:id` | remove a roster person |
| GET | `/api/asados` | list asados |
| POST | `/api/asados` | create asado `{id,name,event_date}` |
| GET | `/api/asados/:id` | full asado (expenses + participants) |
| PUT | `/api/asados/:id` | **full replace** of an asado (the frontend's save) |
| DELETE | `/api/asados/:id` | delete asado (cascades) |

All `/api/*` calls except `/api/health` require:
`Authorization: Bearer <API_TOKEN>`

---

## Deploy with Docker (recommended — runs on the existing Docker VM)

### 1. Postgres LXC — create the database + user
```bash
sudo -u postgres psql <<'SQL'
CREATE USER asado WITH PASSWORD 'PICK_A_STRONG_PASSWORD';
CREATE DATABASE asado OWNER asado;
SQL
```
Allow the Docker VM to connect (adjust subnet):
- `postgresql.conf`: `listen_addresses = '*'`
- `pg_hba.conf`: `host  asado  asado  <DOCKER_VM_SUBNET>  scram-sha-256`
- `sudo systemctl restart postgresql`

### 2. Docker VM — run the API
```bash
# get this folder onto the VM (git clone or rsync), then:
cd asado-calculator/api
cp .env.example .env
nano .env        # DATABASE_URL → PG LXC IP; API_TOKEN → openssl rand -hex 32; HOST_IP → VM LAN/tailnet IP
docker compose up -d --build
docker compose exec asado-api npm run migrate   # first run only — creates tables
docker compose logs -f asado-api
```

### 3. Test
```bash
curl -s http://<DOCKER_VM_IP>:8787/api/health                                   # {"ok":true}
curl -s -H "Authorization: Bearer <TOKEN>" http://<DOCKER_VM_IP>:8787/api/people # []
```

### Updating later
```bash
cd asado-calculator/api && git pull
docker compose up -d --build
```

---

## Alternative: bare Node on a dedicated LXC (systemd)

Use this only if you'd rather not use Docker.

### 1. Postgres LXC — create the database + a limited user

On the Postgres LXC:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER asado WITH PASSWORD 'PICK_A_STRONG_PASSWORD';
CREATE DATABASE asado OWNER asado;
SQL
```

Allow the new services LXC to connect (adjust the subnet to your LAN):
- `postgresql.conf`: `listen_addresses = '*'`  (or the specific LAN IP)
- `pg_hba.conf`: `host  asado  asado  10.0.0.0/24  scram-sha-256`
- then: `sudo systemctl restart postgresql`

### 2. Services LXC — provision

Create a Debian LXC (mirror `containers`), then on it:

```bash
# Node 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt-get install -y nodejs git

# dedicated service user + app dir
sudo useradd --system --create-home --home-dir /opt/asado-api asado
```

### 3. Deploy the code

```bash
sudo -u asado git clone <your-repo-url> /opt/asado-api      # or rsync this folder
cd /opt/asado-api
sudo -u asado npm install --omit=dev

# configure
sudo -u asado cp .env.example .env
sudo -u asado nano .env        # set DATABASE_URL (point at the PG LXC IP) and API_TOKEN
#   generate a token with: openssl rand -hex 32

# create the tables
sudo -u asado npm run migrate
```

### 4. Run as a service

```bash
sudo cp asado-api.service /etc/systemd/system/asado-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now asado-api
sudo systemctl status asado-api
```

### 5. Lock it to the LAN

```bash
sudo apt-get install -y ufw
sudo ufw allow from 10.0.0.0/24 to any port 8787 proto tcp   # adjust subnet
sudo ufw enable
```

(If you use Tailscale, you can instead bind/allow only the tailnet and skip exposing it on the LAN.)

### 6. Test

```bash
# from the services LXC
curl -s localhost:8787/api/health
# from your laptop on the LAN
curl -s http://SERVICES_LXC_IP:8787/api/health
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://SERVICES_LXC_IP:8787/api/people
```

You should get `{"ok":true}` and `[]`.

---

## Updating later

```bash
cd /opt/asado-api && sudo -u asado git pull && sudo -u asado npm install --omit=dev
sudo systemctl restart asado-api
```
