import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Bot, InlineKeyboard } from 'grammy';
import { provisionServer } from './provision/pterodactyl.js';

const app = express();
app.use(express.json());
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/web', express.static(path.join(__dirname, 'web')));

const {
  BOT_TOKEN, WEBAPP_URL,
  BASE_PRICE_STARS = '50', STARS_PER_HOUR = '25', STARS_BOT_PER_SLOT = '2'
} = process.env;
if (!BOT_TOKEN) throw new Error('BOT_TOKEN is required');
const bot = new Bot(BOT_TOKEN);

function parseInitData(initData) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  urlParams.delete('hash');
  const dataCheckString = Array.from(urlParams.entries()).map(([k,v])=>`${k}=${v}`).sort().join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const sign = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (sign !== hash) throw new Error('initData signature mismatch');
  const userJson = urlParams.get('user');
  const user = userJson ? JSON.parse(userJson) : null;
  return { user };
}
function calcPrice(s) {
  const base = Number(BASE_PRICE_STARS);
  const perHour = Number(STARS_PER_HOUR);
  const perBotSlot = Number(STARS_BOT_PER_SLOT);
  const hours = Math.max(1, Math.min(72, Number(s.duration)||1));
  const bots = Math.max(0, Math.min(9, Number(s.bot_quota)||0));
  const total = base + perHour * hours + perBotSlot * bots;
  const breakdown = `base ${base} + hours(${hours})*${perHour} + bots(${bots})*${perBotSlot}`;
  return { total, breakdown };
}
const rentals = new Map();

app.post('/api/price', (req, res)=>{
  try {
    const { initData, settings } = req.body;
    parseInitData(initData);
    const { total, breakdown } = calcPrice(settings || {});
    res.json({ total, breakdown });
  } catch(e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/invoice', async (req, res)=>{
  try {
    const { initData, settings } = req.body;
    const { user } = parseInitData(initData);
    if (!user) throw new Error('user missing');
    const { total, breakdown } = calcPrice(settings || {});
    const rentalId = crypto.randomBytes(6).toString('hex');
    rentals.set(rentalId, { userId: user.id, settings, total });
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'CS 1.6 Server Rental', description: breakdown,
        payload: JSON.stringify({ rentalId }), currency: 'XTR',
        prices: [{ label: 'CS 1.6 rental', amount: total }]
      })
    });
    const j = await r.json();
    if (!j.ok) throw new Error(j.description || 'Telegram API error');
    res.json({ ok: true, link: j.result });
  } catch(e) { res.status(400).json({ ok: false, error: e.message }); }
});

bot.command('start', (ctx)=>{
  const kb = new InlineKeyboard().webApp('Open Mini App', WEBAPP_URL || 'https://example.com/web/index.html');
  return ctx.reply('Open the Mini App to configure and rent your server.', { reply_markup: kb });
});

bot.on('message:successful_payment', async (ctx)=>{
  try {
    const sp = ctx.message.successful_payment;
    const { rentalId } = JSON.parse(ctx.message.invoice_payload || '{}');
    const rec = rentals.get(rentalId);
    if (!rec) { await ctx.reply('Payment received, but rental context not found.'); return; }
    const result = await provisionServer({ userId: rec.userId, settings: rec.settings, totalStars: sp.total_amount, rentalId });
    await ctx.reply(`✅ Server provisioning...
IP: ${result.ip || 'pending'}
Port: ${result.port || '27015'}
RCON: ${result.rcon || 'sent separately'}`);
  } catch(e) { await ctx.reply('Provisioning failed: ' + e.message); }
});

app.get('/healthz', (req,res)=>res.send('ok'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log('HTTP listening on', PORT));
bot.start().then(()=> console.log('Bot polling started'));
