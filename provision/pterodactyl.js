import 'dotenv/config';
import fetch from 'node-fetch';

export async function provisionServer({ userId, settings, totalStars, rentalId }) {
  const base = process.env.PTERO_PANEL_URL;
  const key = process.env.PTERO_API_KEY;
  const egg = Number(process.env.PTERO_EGG_ID);
  const location = Number(process.env.PTERO_LOCATION_ID);
  const pUser = Number(process.env.PTERO_USER_ID);
  if (!base || !key || !egg || !location || !pUser) throw new Error('Pterodactyl env is not set');

  const name = `cs16-${userId}-${rentalId}`;
  const startup = "./hlds_run -console -game cstrike -port {{SERVER_PORT}} +map {{SRCDS_MAP}} -strictportbind -norestart +maxplayers 10 +pingboost 2 +sys_ticrate 1200";
  const env = { HLDS_GAME: "cstrike", SRCDS_MAP: (settings?.maps?.[0]) || "de_dust2", SERVER_PORT: "27015", VAC_PORT: "26901" };
  const limits = { memory: 1024, swap: 0, disk: 4096, io: 500, cpu: 0 };
  const feature_limits = { databases: 0, allocations: 1, backups: 1 };

  const r = await fetch(`${base}/api/application/servers`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      name, user: pUser, egg, docker_image: "ghcr.io/ptero-eggs/games:source",
      startup, environment: env, limits, feature_limits,
      deploy: { locations: [location], dedicated_ip: false, port_range: [] },
      start_on_completion: true
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Pterodactyl create error: ${j?.errors?.[0]?.detail || r.statusText}`);

  const server = j.attributes;
  const ip = server.relationships?.allocations?.data?.[0]?.attributes?.ip || 'pending';
  const port = server.relationships?.allocations?.data?.[0]?.attributes?.port || 27015;

  return { ip, port, rcon: 'set separately' };
}
