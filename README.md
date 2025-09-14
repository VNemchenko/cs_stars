Game Server Launcher (cs_stars)

What it does
- Reads game server "eggs" from `cs_stars/eggs/*.json` and builds a catalog.
- Serves a small web UI to choose a game, then a server, then its parameters.
- On launch:
  - Dry-run by default: shows the `docker run ...` command it would execute.
  - If `ENABLE_DOCKER_RUN=true`, runs the container detached via Docker.

Project layout
- `cs_stars/server.mjs`: HTTP server with API and static hosting.
- `cs_stars/web/index.html`: UI to select game/server and parameters.
- `cs_stars/web/app.js`: UI logic fetching eggs and launching.
- `cs_stars/eggs/catalog.mjs`: Reads egg JSON files and exposes catalog helpers.
- `cs_stars/eggs/*.json`: Put your egg definitions here (Pterodactyl-style JSON).
- `cs_stars/.env.example`: Example environment config.

Run locally
1) Add eggs: place JSON files in `cs_stars/eggs`. Each should include at least:
   - `name`: human-readable name
   - `startup`: command line with variables like `${SERVER_PORT}` or `{{SERVER_PORT}}`
   - `docker_images`: object of images (first is used), e.g. `{ "ghcr.io/game:latest": "Game" }`
   - `variables`: array with `{ env_variable, name, description, default_value, rules, user_editable }`

2) Configure env (optional):
   - Copy `cs_stars/.env.example` to `.env` and adjust values.
   - Or set env vars directly when starting the server.

3) Start server:
   - `node cs_stars/server.mjs`
   - Open `http://localhost:3010`

Launch behavior
- Dry-run (default): returns a JSON response with the `docker run` command. UI displays it.
- Real run: set `ENABLE_DOCKER_RUN=true` and ensure Docker is installed and available in PATH.
- Port mapping: if a variable `SERVER_PORT` (or `PORT`/`GAME_PORT`) is present, it maps TCP and UDP on the same number.

Notes
- Grouping in the UI is by the slug prefix (before first `-`). Adjust easily in `web/app.js` if your eggs provide an explicit game field.
- Windows paths are handled; catalog uses `fileURLToPath` for reliability.

