import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const EGGS_DIR = path.dirname(fileURLToPath(import.meta.url));

function toSlug(name) {
  return String(name)
    .toLowerCase()
    .replace(/^egg-/, '')
    .replace(/\.(json|yml|yaml)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickDockerImage(dockerImages) {
  if (!dockerImages) return null;
  const keys = Object.keys(dockerImages);
  return keys.length ? keys[0] : null;
}

function readEggFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

let cachedCatalog = null;

export function getEggCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const files = fs
    .readdirSync(EGGS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .map((f) => path.join(EGGS_DIR, f));

  const items = [];
  for (const file of files) {
    const data = readEggFile(file);
    if (!data || !data.name) continue;
    const slug = toSlug(path.basename(file));
    const variables = Array.isArray(data.variables)
      ? data.variables.map((v) => ({
          key: v.env_variable,
          name: v.name || v.env_variable,
          description: v.description || '',
          default: v.default_value,
          rules: v.rules || '',
          user_editable: v.user_editable !== false,
        }))
      : [];
    items.push({
      slug,
      name: data.name,
      startup: data.startup || '',
      docker_image: pickDockerImage(data.docker_images),
      variables,
    });
  }
  cachedCatalog = items;
  return items;
}

export function getEggBySlug(slug) {
  return getEggCatalog().find((e) => e.slug === slug) || null;
}

export function getEggIdForSlug(slug) {
  // Expect an env JSON mapping: { "cs-1-6-rehlds": 123, "counter-strike-global-offensive": 456 }
  const raw = process.env.PTERO_EGG_ID_MAP || '';
  try {
    const map = raw ? JSON.parse(raw) : {};
    const id = map[slug];
    return typeof id === 'number' ? id : Number(id);
  } catch (e) {
    return undefined;
  }
}
