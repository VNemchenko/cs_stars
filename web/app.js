async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' }, ...opts });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function groupByGame(eggs) {
  const groups = new Map();
  for (const e of eggs) {
    const key = (e.slug || '').split('-')[0] || 'other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return groups;
}

function renderVars(container, egg) {
  container.innerHTML = '';
  if (!egg || !egg.variables || egg.variables.length === 0) {
    container.innerHTML = '<div class="muted">Для этого сервера нет настраиваемых параметров.</div>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const v of egg.variables) {
    const wrap = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = `${v.name} (${v.key})`;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = v.default ?? '';
    input.placeholder = v.rules || '';
    input.disabled = v.user_editable === false;
    input.dataset.key = v.key;
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = v.description || '';
    wrap.appendChild(label);
    wrap.appendChild(input);
    if (hint.textContent) wrap.appendChild(hint);
    grid.appendChild(wrap);
  }
  container.appendChild(grid);
}

function readVars(container) {
  const vars = {};
  container.querySelectorAll('input[data-key]').forEach((el) => {
    vars[el.dataset.key] = el.value;
  });
  return vars;
}

async function main() {
  const gameSelect = document.getElementById('gameSelect');
  const serverSelect = document.getElementById('serverSelect');
  const varsBox = document.getElementById('vars');
  const launchBtn = document.getElementById('launchBtn');
  const msg = document.getElementById('msg');

  msg.textContent = 'Загрузка конфигураций...';
  let eggs = [];
  try {
    const data = await fetchJSON('/api/eggs');
    eggs = data.eggs || [];
  } catch (e) {
    msg.textContent = 'Не удалось загрузить список серверов';
    return;
  }

  msg.textContent = '';
  const groups = groupByGame(eggs);
  const gameKeys = Array.from(groups.keys()).sort();
  gameSelect.innerHTML = gameKeys.map((k) => `<option value="${k}">${k.toUpperCase()}</option>`).join('');
  serverSelect.innerHTML = '';
  serverSelect.disabled = true;
  launchBtn.disabled = true;
  varsBox.innerHTML = '';

  function onGameChange() {
    const key = gameSelect.value;
    const list = (groups.get(key) || []).slice().sort((a,b)=> a.name.localeCompare(b.name));
    serverSelect.innerHTML = list.map((e) => `<option value="${e.slug}">${e.name}</option>`).join('');
    serverSelect.disabled = list.length === 0;
    if (list.length) {
      serverSelect.value = list[0].slug;
      onServerChange();
    } else {
      varsBox.innerHTML = '';
      launchBtn.disabled = true;
    }
  }

  async function onServerChange() {
    const slug = serverSelect.value;
    if (!slug) return;
    msg.textContent = '';
    try {
      const { egg } = await fetchJSON(`/api/eggs/${encodeURIComponent(slug)}`);
      renderVars(varsBox, egg);
      launchBtn.disabled = false;
    } catch (e) {
      varsBox.innerHTML = '';
      launchBtn.disabled = true;
      msg.textContent = 'Ошибка загрузки параметров сервера';
    }
  }

  gameSelect.addEventListener('change', onGameChange);
  serverSelect.addEventListener('change', onServerChange);

  launchBtn.addEventListener('click', async () => {
    const slug = serverSelect.value;
    const params = readVars(varsBox);
    launchBtn.disabled = true;
    msg.textContent = 'Запуск...';
    try {
      const res = await fetchJSON('/api/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, params })
      });
      if (res.status === 'dry-run') {
        msg.textContent = `Симуляция запуска. Команда Docker:\n${(res.docker || []).join(' ')}`;
      } else if (res.status === 'started') {
        msg.textContent = `Сервер запущен. Контейнер: ${res.containerName}`;
      } else {
        msg.textContent = 'Неизвестный ответ сервера';
      }
    } catch (e) {
      msg.textContent = `Ошибка запуска: ${e.message}`;
    } finally {
      launchBtn.disabled = false;
    }
  });

  // init
  if (gameKeys.length) {
    gameSelect.value = gameKeys[0];
    onGameChange();
  }
}

main();

