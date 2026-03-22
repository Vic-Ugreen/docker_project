# Task Manager (Docker)

Táto aplikácia je jednoduchý správca úloh (poznámok) s autentifikáciou používateľov.
Projekt je rozdelený na frontend (UI v prehliadači), backend (REST API) a PostgreSQL databázu, pričom všetko beží v Docker kontajneroch cez Docker Compose.

## 1. Stručný opis architektúry (FE, BE, DB)

Architektúra je 3-vrstvová:

- **Frontend (`frontend/`)**
	- Statická web aplikácia (`index.html`, `script.js`, `style.css`) servovaná cez **Nginx**.
	- Po prihlásení komunikuje s backend API na adrese `http://localhost:5000/api`.
	- Ukladá JWT token a údaje používateľa do `localStorage`.

- **Backend (`backend/`)**
	- **Node.js + Express** API.
	- Rieši registráciu/prihlásenie (`/api/auth/*`), CRUD operácie nad úlohami (`/api/tasks/*`) a overovanie JWT tokenu.
	- Komunikuje s PostgreSQL cez knižnicu `pg`.

- **Databáza (`database/`)**
	- **PostgreSQL 17**.
	- Pri prvom štarte sa inicializuje SQL skriptom `database/init.sql` (tabuľky `users`, `tasks`, FK väzba s `ON DELETE CASCADE`).

## 2. Zoznam použitých technológií

### Backend
- Node.js 20 (image `node:20-alpine`)
- Express
- pg (PostgreSQL client)
- jsonwebtoken (JWT)
- bcrypt (hash hesiel)
- cors
- dotenv

### Frontend
- HTML5
- CSS3
- Vanilla JavaScript (Fetch API, DOM)
- Nginx 1.28 (image `nginx:1.28-alpine`)

### Databáza a infra
- PostgreSQL 17
- pgAdmin 4 (kontajner `dpage/pgadmin4`)
- Docker
- Docker Compose

## 3. Štruktúra projektu

```text
docker_project/
├── docker-compose.yml
├── start-app.sh
├── end-app.sh
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── server.js
│   ├── db.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   └── routes/
│       ├── authRoutes.js
│       └── taskRoutes.js
├── database/
│   └── init.sql
└── frontend/
		├── Dockerfile
		├── nginx.conf
		├── index.html
		├── script.js
		└── style.css
```

## 4. Popis sietí a volume

V `docker-compose.yml` sú definované 2 siete a 1 named volume:

- **`fe_be_net`**
	- prepája `frontend` ↔ `backend`
	- frontend je publikovaný na porte `8081`, backend na `5000`

- **`be_db_net`**
	- prepája `backend` ↔ `db` (+ `pgadmin`)
	- databáza nie je publikovaná priamo na host porte, je dostupná v internej Docker sieti

- **Volume `postgres_data`**
	- mount do `/var/lib/postgresql/data`
	- zabezpečuje perzistenciu dát PostgreSQL aj po reštarte kontajnerov

Okrem toho sa používa bind mount:

- `./database/init.sql:/docker-entrypoint-initdb.d/init.sql:ro`
	- inicializačný SQL skript sa vykoná pri prvom štarte DB kontajnera

## 5. Ako je implementovaný backend (ako to funguje)

### 5.1 Spustenie API servera

V `backend/server.js` sa inicializuje Express aplikácia, middleware a routy:

```js
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
```

Obsahuje aj health endpoint:

```js
app.get('/api/health', async (req, res) => {
	await pool.query('SELECT 1');
	res.json({ message: 'API and database are working' });
});
```

### 5.2 Pripojenie na databázu

Súbor `backend/db.js` vytvára PostgreSQL pool z premenných prostredia:

```js
const pool = new Pool({
	host: process.env.DB_HOST,
	port: Number(process.env.DB_PORT),
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
});
```

### 5.3 Autentifikácia (register/login/JWT)

V `backend/routes/authRoutes.js`:

- **`POST /api/auth/register`**
	- validuje vstup
	- skontroluje unikátnosť emailu
	- heslo hashuje cez `bcrypt.hash(password, 10)`
	- uloží používateľa do tabuľky `users`

- **`POST /api/auth/login`**
	- overí email + heslo (`bcrypt.compare`)
	- vytvorí JWT token (`expiresIn: '24h'`)
	- vráti token + základné user údaje

### 5.4 Ochrana endpointov

`backend/middleware/authMiddleware.js` očakáva hlavičku:

```http
Authorization: Bearer <token>
```

Následne token overí cez `jwt.verify(...)` a vloží payload do `req.user`.

### 5.5 CRUD nad úlohami (taskRoutes)

V `backend/routes/taskRoutes.js` sú endpointy:

- `GET /api/tasks` – zoznam úloh prihláseného používateľa
- `POST /api/tasks` – vytvorenie novej úlohy
- `PUT /api/tasks/:id` – úprava úlohy
- `DELETE /api/tasks/:id` – odstránenie úlohy

Ukážka z implementácie CREATE:

```js
const result = await pool.query(
	`INSERT INTO tasks (user_id, title, contents)
	 VALUES ($1, $2, $3)
	 RETURNING id, title, contents, is_done, created_at`,
	[req.user.id, title, contents || '']
);
```

Ukážka z implementácie UPDATE:

```js
const result = await pool.query(
	`UPDATE tasks
	 SET title = $1,
			 contents = $2,
			 is_done = $3
	 WHERE id = $4 AND user_id = $5
	 RETURNING id, title, contents, is_done, created_at`,
	[title, contents || '', Boolean(is_done), id, req.user.id]
);
```

## 6. Ako je implementovaný frontend (ako to funguje)

Frontend je SPA-like statická stránka:

- `frontend/index.html` definuje 2 hlavné stavy UI:
	- `authView` (login/register)
	- `dashboardView` (prehľad úloh)
- `frontend/script.js` riadi:
	- prepínanie login/register,
	- volania API (`/auth/register`, `/auth/login`, `/tasks`),
	- render kariet poznámok,
	- otvorenie editora, uloženie zmien, mazanie,
	- prácu s tokenom v `localStorage`.
- `frontend/style.css` obsahuje kompletný vizuál (glass efekt, karty, editor, responzívnosť).

Kľúčová API URL vo FE:

```js
const API_URL = 'http://localhost:5000/api';
```

Po úspešnom logine sa token uloží:

```js
localStorage.setItem('token', token);
localStorage.setItem('user', JSON.stringify(currentUser));
```

Pri každom volaní chránených endpointov sa posiela:

```js
headers: {
	Authorization: `Bearer ${token}`
}
```

## 7. Ako je implementovaná databáza

Skript `database/init.sql` vytvára tabuľky:

- `users`
	- `id`, `username`, `email` (UNIQUE), `password_hash`, `created_at`
- `tasks`
	- `id`, `user_id`, `title`, `contents`, `is_done`, `created_at`
	- cudzie kľúče na `users(id)` s `ON DELETE CASCADE`

To znamená, že pri vymazaní používateľa sa automaticky vymažú aj jeho úlohy.

## 8. Premenné prostredia

`docker-compose.yml` očakáva tieto premenné (v `.env` súbore v root priečinku projektu):

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `JWT_SECRET`
- `BACKEND_PORT`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `POSTGRES_DB`

Príklad `.env`:

```env
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=task_manager

JWT_SECRET=super_secret_key
BACKEND_PORT=5000

POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=task_manager
```

## 9. Presný postup spustenia aplikácie

### 9.1 Požiadavky

- Nainštalovaný Docker
- Nainštalovaný Docker Compose plugin (`docker compose`)

### 9.2 Spustenie

V root priečinku projektu:

```bash
chmod +x start-app.sh end-app.sh
./start-app.sh
```

Skript spustí:

```bash
docker compose up --build -d
```

Ak používateľ nie je na Linuxe/WSL (napr. Windows PowerShell/Command Prompt) a nemá príkaz `chmod`, má 2 možnosti:

1. **Odporúčané (bez skriptu):** spustiť priamo Docker Compose príkaz:

```powershell
docker compose up --build -d
```

2. **Spustiť `.sh` skript cez Bash kompatibilný shell** (napr. Git Bash):

```bash
./start-app.sh
```

> Na Windows bez WSL je najuniverzálnejší postup používať priamo `docker compose` príkazy.

### 9.3 Overenie, že všetko beží

```bash
docker compose ps
```

### 9.4 Zastavenie aplikácie

```bash
./end-app.sh
```

Skript vykoná:

```bash
docker compose down
```

Ak nie je dostupné spúšťanie `.sh` skriptov (napr. PowerShell/Command Prompt bez Bash), zastavenie sprav priamo:

```powershell
docker compose down
```

## 10. Presný postup používania aplikácie

1. Otvor prehliadač a choď na frontend URL (nižšie).
2. Vytvor konto cez **Register** (username, email, password).
3. Prihlás sa cez **Login**.
4. Po prihlásení sa zobrazí dashboard s poznámkami.
5. Klikni na **Add new note** pre vytvorenie novej úlohy.
6. Kliknutím na menu (⋮) na karte otvoríš editor úlohy.
7. Uprav názov/popis/stav a daj **Save note**.
8. Na zmazanie úlohy použi **Delete note**.
9. Odhlásenie cez **Logout**.

## 11. URL adresy po spustení

- **Frontend (aplikácia v prehliadači):** `http://localhost:8081`
- Backend API: `http://localhost:5000`
- Health endpoint: `http://localhost:5000/api/health`
- pgAdmin: `http://localhost:5050`

> Poznámka: po spustení aplikácie (`docker compose up --build -d`) môže byť `pgAdmin4` dostupný až po niekoľkých sekundách až približne 1 minúte. Kontajner sa po štarte ešte inicializuje.

> Hlavná URL, kde je aplikácia dostupná v prehliadači: **http://localhost:8081**

### 11.1 Dôležitá poznámka k portom (musia byť voľné)

Aby pri vytvorení a spustení aplikácie nevznikli konflikty portov, na hostiteľovi musia byť voľné tieto porty:

- `8081` (frontend)
- `5000` (backend API)
- `5050` (pgAdmin)

Ak je niektorý z týchto portov už obsadený inou aplikáciou, Docker Compose skončí chybou pri štarte kontajnerov.

## 12. Ako prehliadať databázu cez pgAdmin

pgAdmin je web UI pre správu PostgreSQL. Po spustení aplikácie je dostupný na `http://localhost:5050`.

### 12.1 Prihlásenie do pgAdmin

1. Otvor `http://localhost:5050` v prehliadači.
2. Prihláš sa s údajmi z `.env` súboru:
   - Email: `PGADMIN_DEFAULT_EMAIL`
   - Heslo: `PGADMIN_DEFAULT_PASSWORD`

Aktuálne hodnoty nájdeš v súbore `.env` v root priečinku projektu.

### 12.2 Pripojenie databázy (Server) v pgAdmin

1. V ľavom paneli klikni na **Add New Server**.
2. Vyplň formulár:

   **Záložka "General":**
   - Name: `task_manager` (alebo ľubovoľné meno)

   **Záložka "Connection":**
   - Hostname/address: zisti IP adresu kontajnera spustením:
   
   ```bash
   docker inspect task_manager_db
   ```
   
   Vyhľadaj riadok `"IPAddress"` a skopíruj jeho hodnotu (napr. `172.21.0.2`).

   - Port: `5432`
   - Maintenance database: `postgres`
   - Username: `user` (z `.env` – `DB_USER`)
   - Password: `pass` (z `.env` – `DB_PASSWORD`)

3. Klikni **Save**.

### 12.3 Prehliadanie tabuliek

Po úspešnom pripojení:
- V ľavom paneli: **Servers** → **task_manager** → **Databases** → **taskdb** → **Schemas** → **public** → **Tables**
- Tam nájdeš tabuľky `users` a `tasks`.

## 13. Poznámky k bezpečnosti a prevádzke

- Heslá používateľov sú hashované (`bcrypt`) a neukladajú sa v plain texte.
- Chránené endpointy používajú JWT token overovaný v middleware.
- Dáta PostgreSQL sú perzistentné cez `postgres_data` volume.
- Ak chceš vymazať aj dáta databázy, použi:

```bash
docker compose down -v
```
