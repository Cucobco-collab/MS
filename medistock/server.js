/**
 * MediStock Pro — Server
 * Creat de: Cucobco Alexandru | Grupa TI-241 | ASEM Moldova 2026
 */
'use strict';

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const crypto  = require('crypto');

const PORT    = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

// ─── Auto-init DB dacă nu există ──────────────────────────────
const DEFAULT_DB = {
  medicamente: [
    { id:1, name:'Paracetamol 500mg', dci:'Paracetamol', categorie:'Analgezice', stoc:50, stoc_minim:20, data_expirare:'2027-06-01', pret:34.85, producator:'Terapia', lot:'LOT001', descriere:'Analgezic și antipiretic.' },
    { id:2, name:'Nurofen 200mg', dci:'Ibuprofen', categorie:'Analgezice', stoc:30, stoc_minim:15, data_expirare:'2027-08-15', pret:62.32, producator:'Reckitt', lot:'LOT002', descriere:'Antiinflamator nesteroidian.' },
    { id:3, name:'Augmentin 875mg', dci:'Amoxicilina+Clavulanat', categorie:'Antibiotice', stoc:20, stoc_minim:10, data_expirare:'2027-05-02', pret:172.20, producator:'GSK', lot:'LOT003', descriere:'Antibiotic cu spectru larg.' },
    { id:4, name:'Vitamina C 1000mg', dci:'Acid ascorbic', categorie:'Vitamine', stoc:60, stoc_minim:20, data_expirare:'2027-12-01', pret:92.25, producator:'Bayer', lot:'LOT004', descriere:'Supliment vitamina C.' },
    { id:5, name:'Diclofenac 50mg', dci:'Diclofenac sodium', categorie:'Antiinflamatoare', stoc:35, stoc_minim:10, data_expirare:'2027-03-18', pret:40.18, producator:'Terapia', lot:'LOT005', descriere:'Antiinflamator.' },
  ],
  miscari: [],
  comenzi: [],
  next_id_med: 6,
  next_id_miscare: 1,
  next_id_comanda: 1
};

function initDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2));
    console.log('  [DB] db.json creat cu date implicite.');
  }
}

function readDB()       { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); }
function writeDB(data)  { fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2)); }

const USERS = {
  admin: { password: 'ASEMTI241', role: 'admin' },
  guest: { password: null,        role: 'guest'  }
};

const sessions = new Map();

function createSession(username, role) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, role, createdAt: Date.now() });
  return token;
}

function getSession(req) {
  const auth  = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '').trim();
  return sessions.get(token) || null;
}

function requireAdmin(req, res) {
  const sess = getSession(req);
  if (!sess || sess.role !== 'admin') { json(res, { error: 'Acces interzis. Doar admin.' }, 403); return false; }
  return sess;
}

function requireAuth(req, res) {
  const sess = getSession(req);
  if (!sess) { json(res, { error: 'Neautentificat.' }, 401); return false; }
  return sess;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

function json(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function daysUntil(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const exp   = new Date(dateStr); exp.setHours(0,0,0,0);
  return Math.floor((exp - today) / 86400000);
}

function calcStatus(med) {
  const d = daysUntil(med.data_expirare);
  if (d < 0)                      return 'expirat';
  if (med.stoc === 0)             return 'epuizat';
  if (d <= 30)                    return 'expira';
  if (med.stoc <= med.stoc_minim) return 'stoc_redus';
  return 'ok';
}

function chatbotReply(message, role) {
  const msg = message.toLowerCase().trim();
  if (/^(salut|buna|hello|hi|hey|bun[aă] ziua)/.test(msg))
    return 'Bună ziua! 👋 Sunt Medi, asistentul tău farmaceutic virtual. Cum te pot ajuta astăzi?';
  if (/locati|adres|unde|harta|map|asem/.test(msg))
    return '📍 Farmacia noastră se află în apropierea ASEM Moldova, str. Mitropolit Gavriil Bănulescu-Bodoni, Chișinău. Program: Luni-Vineri 08:00-20:00, Sâmbătă 09:00-17:00.';
  if (/comand/.test(msg) && role === 'guest')
    return '🛒 Mergi la **Medicamente**, adaugă produsele în coș și completează formularul. Comenzile sunt procesate în 24h de admin.';
  if (/comand/.test(msg) && role === 'admin')
    return '📋 Gestionează comenzile din secțiunea **Comenzi** — poți aproba, respinge sau marca ca livrate.';
  if (/medicament|produs|catalog|stoc/.test(msg))
    return '💊 Catalogul este disponibil în **Medicamente**. Caută după nume, categorie sau producător.';
  if (/parola|password|login|autentific/.test(msg))
    return '🔐 Login: username **admin** (parolă necesară) sau **guest** (fără parolă).';
  if (/dashboard|statistici|raport/.test(msg))
    return '📊 Dashboard-ul arată statistici în timp real: total medicamente, alerte stoc, valoare inventar.';
  if (/categori/.test(msg))
    return '🏷️ Categorii disponibile: Analgezice, Antibiotice, Antiinflamatoare, Vitamine, Cardiologie.';
  if (/contact|telefon|email/.test(msg))
    return '📞 Contact: Tel. +373 22 XXX XXX | Email: contact@medistock.md | lângă ASEM Moldova, Chișinău.';
  if (/ajutor|help|cum|ghid/.test(msg))
    return '🆘 Pot ajuta cu: medicamente, comenzi, locație, statistici. Ce dorești?';
  if (/multu|mersi|thank/.test(msg))
    return 'Cu plăcere! 😊 Sănătate multă!';
  return '🤔 Încearcă să reformulezi. Scrie **ajutor** pentru opțiuni disponibile.';
}

async function router(req, res) {
  const url      = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;
  const method   = req.method;

  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' });
    return res.end();
  }

  if (pathname === '/api/login' && method === 'POST') {
    const { username, password } = await parseBody(req);
    const user = USERS[username];
    if (!user) return json(res, { error: 'Utilizator invalid.' }, 401);
    if (user.password !== null && user.password !== password) return json(res, { error: 'Parolă incorectă.' }, 401);
    const token = createSession(username, user.role);
    return json(res, { ok: true, role: user.role, username, token });
  }

  if (pathname === '/api/logout' && method === 'POST') {
    const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    sessions.delete(auth);
    return json(res, { ok: true });
  }

  if (pathname === '/api/me' && method === 'GET') {
    const sess = getSession(req);
    if (!sess) return json(res, { authenticated: false });
    return json(res, { authenticated: true, username: sess.username, role: sess.role });
  }

  if (pathname === '/api/medicamente' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const db = readDB();
    return json(res, db.medicamente.map(m => ({ ...m, status: calcStatus(m) })));
  }

  if (pathname === '/api/medicamente' && method === 'POST') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const body = await parseBody(req);
    const db = readDB();
    const med = {
      id: db.next_id_med++,
      name: body.name || '', dci: body.dci || '', categorie: body.categorie || '',
      stoc: Number(body.stoc) || 0, stoc_minim: Number(body.stoc_minim) || 10,
      data_expirare: body.data_expirare || '', pret: Number(body.pret) || 0,
      producator: body.producator || '', lot: body.lot || '', descriere: body.descriere || ''
    };
    db.medicamente.push(med);
    writeDB(db);
    return json(res, { ...med, status: calcStatus(med) }, 201);
  }

  if (pathname.startsWith('/api/medicamente/') && method === 'PUT') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const db = readDB();
    const idx = db.medicamente.findIndex(m => m.id === id);
    if (idx === -1) return json(res, { error: 'Nu a fost găsit.' }, 404);
    const cur = db.medicamente[idx];
    db.medicamente[idx] = {
      id,
      name:          body.name          !== undefined ? String(body.name)          : cur.name,
      dci:           body.dci           !== undefined ? String(body.dci)           : cur.dci,
      categorie:     body.categorie     !== undefined ? String(body.categorie)     : cur.categorie,
      stoc:          body.stoc          !== undefined ? Number(body.stoc)  || 0    : cur.stoc,
      stoc_minim:    body.stoc_minim    !== undefined ? Number(body.stoc_minim)||0 : cur.stoc_minim,
      data_expirare: body.data_expirare !== undefined ? String(body.data_expirare) : cur.data_expirare,
      pret:          body.pret          !== undefined ? Number(body.pret)  || 0    : cur.pret,
      producator:    body.producator    !== undefined ? String(body.producator)    : cur.producator,
      lot:           body.lot           !== undefined ? String(body.lot)           : cur.lot,
      descriere:     body.descriere     !== undefined ? String(body.descriere)     : (cur.descriere || '')
    };
    writeDB(db);
    return json(res, { ...db.medicamente[idx], status: calcStatus(db.medicamente[idx]) });
  }

  if (pathname.startsWith('/api/medicamente/') && method === 'DELETE') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const id = parseInt(pathname.split('/')[3]);
    const db = readDB();
    db.medicamente = db.medicamente.filter(m => m.id !== id);
    writeDB(db);
    return json(res, { ok: true });
  }

  if (pathname === '/api/miscari' && method === 'GET') {
    const sess = requireAdmin(req, res); if (!sess) return;
    return json(res, readDB().miscari.slice().reverse());
  }

  if (pathname === '/api/miscari' && method === 'POST') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const body = await parseBody(req);
    const db = readDB();
    const med = db.medicamente.find(m => m.id === Number(body.medicament_id));
    if (!med) return json(res, { error: 'Medicament inexistent.' }, 400);
    const cantitate = Number(body.cantitate);
    if (!cantitate || cantitate < 1) return json(res, { error: 'Cantitate invalidă.' }, 400);
    if (body.tip === 'iesire' && med.stoc < cantitate) return json(res, { error: `Stoc insuficient. Disponibil: ${med.stoc} buc.` }, 400);
    if (body.tip === 'intrare') med.stoc += cantitate; else med.stoc -= cantitate;
    const miscare = { id: db.next_id_miscare++, tip: body.tip, medicament_id: med.id, medicament_name: med.name, cantitate, user: sess.username, data: new Date().toISOString(), note: body.note || '' };
    db.miscari.push(miscare);
    writeDB(db);
    return json(res, miscare, 201);
  }

  if (pathname === '/api/comenzi' && method === 'GET') {
    const sess = requireAuth(req, res); if (!sess) return;
    const db = readDB();
    if (!db.comenzi) db.comenzi = [];
    let comenzi = db.comenzi.slice().reverse();
    if (sess.role === 'guest') comenzi = comenzi.filter(c => c.user === sess.username);
    return json(res, comenzi);
  }

  if (pathname === '/api/comenzi' && method === 'POST') {
    const sess = requireAuth(req, res); if (!sess) return;
    const body = await parseBody(req);
    const db = readDB();
    if (!db.comenzi) db.comenzi = [];
    if (!db.next_id_comanda) db.next_id_comanda = 1;
    const nume = String(body.nume || '').trim();
    const telefon = String(body.telefon || '').trim();
    const adresa = String(body.adresa || '').trim();
    const items = Array.isArray(body.items) ? body.items : [];
    if (!nume) return json(res, { error: 'Numele clientului este obligatoriu.' }, 400);
    if (!telefon) return json(res, { error: 'Numărul de telefon este obligatoriu.' }, 400);
    if (!adresa) return json(res, { error: 'Adresa este obligatorie.' }, 400);
    if (!items.length) return json(res, { error: 'Comanda trebuie să conțină cel puțin un medicament.' }, 400);
    const liniiValide = []; let total = 0;
    for (const it of items) {
      const med = db.medicamente.find(m => m.id === Number(it.medicament_id));
      if (!med) return json(res, { error: 'Medicament inexistent.' }, 400);
      const cant = Number(it.cantitate);
      if (!cant || cant < 1) return json(res, { error: `Cantitate invalidă pentru ${med.name}.` }, 400);
      if (cant > med.stoc) return json(res, { error: `Stoc insuficient pentru ${med.name}. Disponibil: ${med.stoc} buc.` }, 400);
      liniiValide.push({ medicament_id: med.id, medicament_name: med.name, cantitate: cant, pret: med.pret });
      total += med.pret * cant;
    }
    const comanda = { id: db.next_id_comanda++, user: sess.username, role: sess.role, nume, telefon, adresa, items: liniiValide, total: Math.round(total * 100) / 100, status: 'in_asteptare', data: new Date().toISOString() };
    db.comenzi.push(comanda);
    writeDB(db);
    return json(res, comanda, 201);
  }

  if (pathname.startsWith('/api/comenzi/') && method === 'PUT') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const id = parseInt(pathname.split('/')[3]);
    const body = await parseBody(req);
    const db = readDB();
    if (!db.comenzi) db.comenzi = [];
    const idx = db.comenzi.findIndex(c => c.id === id);
    if (idx === -1) return json(res, { error: 'Comandă inexistentă.' }, 404);
    const newStatus = body.status;
    if (!['aprobata','respinsa','in_asteptare','livrata'].includes(newStatus)) return json(res, { error: 'Status invalid.' }, 400);
    if (newStatus === 'aprobata' && db.comenzi[idx].status !== 'aprobata') {
      for (const it of db.comenzi[idx].items) {
        const med = db.medicamente.find(m => m.id === it.medicament_id);
        if (med) { if (med.stoc < it.cantitate) return json(res, { error: `Stoc insuficient pentru ${med.name}.` }, 400); med.stoc -= it.cantitate; }
      }
    }
    if (newStatus === 'respinsa' && db.comenzi[idx].status === 'aprobata') {
      for (const it of db.comenzi[idx].items) {
        const med = db.medicamente.find(m => m.id === it.medicament_id);
        if (med) med.stoc += it.cantitate;
      }
    }
    db.comenzi[idx].status = newStatus;
    db.comenzi[idx].updatedAt = new Date().toISOString();
    db.comenzi[idx].updatedBy = sess.username;
    writeDB(db);
    return json(res, db.comenzi[idx]);
  }

  if (pathname.startsWith('/api/comenzi/') && method === 'DELETE') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const id = parseInt(pathname.split('/')[3]);
    const db = readDB();
    if (db.comenzi) db.comenzi = db.comenzi.filter(c => c.id !== id);
    writeDB(db);
    return json(res, { ok: true });
  }

  if (pathname === '/api/dashboard' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const db = readDB();
    let expira=0, expirat=0, stocRedus=0, epuizat=0, valoare=0;
    const perCat = {};
    db.medicamente.forEach(m => {
      const diff = daysUntil(m.data_expirare);
      if (diff < 0) expirat++; else if (diff <= 30) expira++;
      if (m.stoc === 0) epuizat++; else if (m.stoc <= m.stoc_minim) stocRedus++;
      valoare += m.pret * m.stoc;
      perCat[m.categorie] = (perCat[m.categorie] || 0) + m.stoc;
    });
    const comenzi = db.comenzi || [];
    return json(res, {
      total: db.medicamente.length, expira, expirat, stocRedus, epuizat,
      valoare: Math.round(valoare*100)/100, perCat,
      comenziStats: { total: comenzi.length, in_asteptare: comenzi.filter(c=>c.status==='in_asteptare').length, aprobate: comenzi.filter(c=>c.status==='aprobata').length, respinse: comenzi.filter(c=>c.status==='respinsa').length }
    });
  }

  if (pathname === '/api/alerte' && method === 'GET') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const db = readDB();
    const expira=[], stocRedus=[];
    db.medicamente.forEach(m => {
      const d = daysUntil(m.data_expirare);
      if (d <= 30) expira.push({ ...m, zile_ramase: d });
      if (m.stoc <= m.stoc_minim) stocRedus.push(m);
    });
    expira.sort((a,b)=>a.zile_ramase-b.zile_ramase);
    stocRedus.sort((a,b)=>a.stoc-b.stoc);
    return json(res, { expira, stocRedus });
  }

  if (pathname === '/api/rapoarte' && method === 'GET') {
    const sess = requireAdmin(req, res); if (!sess) return;
    const db = readDB();
    const month=new Date().getMonth(), year=new Date().getFullYear();
    let intrari=0, iesiri=0; const medVanzari={};
    db.miscari.forEach(m => {
      const d = new Date(m.data);
      if (d.getMonth()===month && d.getFullYear()===year) {
        if (m.tip==='intrare') intrari+=m.cantitate;
        else { iesiri+=m.cantitate; medVanzari[m.medicament_name]=(medVanzari[m.medicament_name]||0)+m.cantitate; }
      }
    });
    const topVanzari=Object.entries(medVanzari).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,v])=>({name,v}));
    const perCat={}; db.medicamente.forEach(m=>{perCat[m.categorie]=(perCat[m.categorie]||0)+m.stoc;});
    return json(res, { intrari, iesiri, topVanzari, distCat: Object.entries(perCat).map(([name,v])=>({name,v})) });
  }

  if (pathname === '/api/chat' && method === 'POST') {
    const sess = requireAuth(req, res); if (!sess) return;
    const { message } = await parseBody(req);
    if (!message || !message.trim()) return json(res, { error: 'Mesaj gol.' }, 400);
    return json(res, { message: chatbotReply(message, sess.role), timestamp: new Date().toISOString() });
  }

  // ── Serve static files sau SPA fallback ──────────────────────
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, (e, data) => {
    if (e) {
      // SPA fallback: orice rută necunoscută → index.html
      const indexPath = path.join(__dirname, 'public', 'index.html');
      fs.readFile(indexPath, (e2, d2) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(d2);
      });
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}

// ─── Start ─────────────────────────────────────────────────────
initDB();
http.createServer(router).listen(PORT, '0.0.0.0', () => {
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log(`  ║  MediStock Pro — port ${PORT}            ║`);
  console.log('  ║  Creat de: Cucobco Alexandru         ║');
  console.log('  ║  Grupa TI-241 | ASEM Moldova 2026    ║');
  console.log('  ╚══════════════════════════════════════╝\n');
});
