const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

const { ADMIN_USER = 'admin', ADMIN_PASS, PORT = 3000 } = process.env;
if (!ADMIN_PASS) { console.error('Defina ADMIN_PASS. Ex: ADMIN_PASS=minhasenha npm start'); process.exit(1); }
const MAX_POR_ENVIO = 200;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let client = null;
let state = { status: 'desconectado', qr: null, code: null };
let job = { running: false, total: 0, done: 0, failed: [] };

function connect(phone) {
  if (client) return;
  const opts = { authStrategy: new LocalAuth(), puppeteer: { headless: true, args: ['--no-sandbox'] } };
  if (phone) opts.pairWithPhoneNumber = { phoneNumber: phone.replace(/\D/g, ''), showNotification: true };
  client = new Client(opts);
  client.on('qr', async (q) => { state = { status: 'aguardando', qr: await QRCode.toDataURL(q), code: null }; });
  client.on('code', (c) => { state = { status: 'aguardando', qr: null, code: c }; });
  client.on('ready', () => { state = { status: 'conectado', qr: null, code: null }; });
  client.on('disconnected', () => { state = { status: 'desconectado', qr: null, code: null }; client = null; });
  state.status = 'iniciando';
  client.initialize().catch((e) => { console.error(e); state.status = 'desconectado'; client = null; });
}

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  const [u, p] = Buffer.from((req.headers.authorization || '').split(' ')[1] || '', 'base64').toString().split(':');
  if (u === ADMIN_USER && p === ADMIN_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="zap-qr"').sendStatus(401);
});
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/connect', (req, res) => { connect(req.body.phone); res.json({ ok: true }); });
app.get('/api/status', (req, res) => res.json({ ...state, job }));
app.post('/api/logout', async (req, res) => {
  if (client) { await client.logout().catch(() => {}); await client.destroy().catch(() => {}); client = null; }
  state = { status: 'desconectado', qr: null, code: null };
  res.json({ ok: true });
});

app.get('/api/contacts', async (req, res) => {
  if (state.status !== 'conectado') return res.status(400).json({ error: 'WhatsApp não conectado.' });
  const all = await client.getContacts();
  const list = all.filter((c) => c.isMyContact && !c.isGroup && c.number)
    .map((c) => ({ name: c.name || c.pushname || c.number, number: c.number }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  res.json(list);
});

app.post('/api/send', (req, res) => {
  const { contacts, text } = req.body;
  if (state.status !== 'conectado') return res.status(400).json({ error: 'WhatsApp não conectado.' });
  if (job.running) return res.status(400).json({ error: 'Já existe um envio em andamento.' });
  if (!text?.trim() || !contacts?.length) return res.status(400).json({ error: 'Escolha contatos e escreva a mensagem.' });
  if (contacts.length > MAX_POR_ENVIO) return res.status(400).json({ error: `Máximo de ${MAX_POR_ENVIO} contatos por envio.` });
  job = { running: true, total: contacts.length, done: 0, failed: [] };
  (async () => {
    for (const c of contacts) {
      if (!job.running) break;
      try {
        const id = await client.getNumberId(c.number);
        if (!id) throw new Error('sem WhatsApp');
        await client.sendMessage(id._serialized, text.replaceAll('{nome}', c.name.split(' ')[0]));
      } catch (e) { job.failed.push(`${c.name}: ${e.message}`); }
      job.done++;
      await sleep(8000 + Math.random() * 12000); // 8–20 s entre mensagens
    }
    job.running = false;
  })();
  res.json({ ok: true });
});
app.post('/api/stop', (req, res) => { job.running = false; res.json({ ok: true }); });

app.listen(PORT, () => console.log(`Abra http://localhost:${PORT}`));
