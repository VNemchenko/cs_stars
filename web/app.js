;(function () {
  const tg = window.Telegram.WebApp;
  tg.expand();
  tg.MainButton.hide();

  const qs = (id) => document.getElementById(id);
  const fields = ['duration', 'bot_dif', 'bot_quota', 'roundtime', 'c4timer', 'freezetime', 'buytime'];

  function collect() {
    const maps = Array.from(qs('mapcycle').selectedOptions).map((o) => o.value);
    return {
      duration: +qs('duration').value,
      bot_dif: +qs('bot_dif').value,
      bot_quota: +qs('bot_quota').value,
      roundtime: +qs('roundtime').value,
      c4timer: +qs('c4timer').value,
      freezetime: +qs('freezetime').value,
      buytime: +qs('buytime').value,
      maps,
    };
  }

  async function updatePrice() {
    try {
      const res = await fetch('/api/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: collect(), initData: tg.initData }),
      });
      const j = await res.json();
      qs('price_xtr').textContent = j.total ?? '—';
      qs('price_breakdown').textContent = j.breakdown ?? '';
      return j;
    } catch (e) {
      console.error(e);
      qs('price_xtr').textContent = '—';
      qs('price_breakdown').textContent = '';
      return null;
    }
  }

  fields.forEach((id) => qs(id).addEventListener('input', updatePrice));
  qs('mapcycle').addEventListener('change', updatePrice);
  updatePrice();

  qs('payBtn').addEventListener('click', async () => {
    const settings = collect();
    const btn = qs('payBtn');
    btn.disabled = true;
    try {
      const res = await fetch('/api/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, initData: tg.initData }),
      });
      const { ok, link, error } = await res.json();
      if (!ok) throw new Error(error);
      tg.openInvoice(link, (status) => {
        if (status === 'paid') {
          tg.showPopup({ title: 'Payment received', message: 'Provisioning your server. Bot will DM you shortly.' });
        } else if (status === 'cancelled') {
          btn.disabled = false;
        }
      });
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
    }
  });
})();
