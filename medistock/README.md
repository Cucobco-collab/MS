# 💊 MediStock Pro

Sistem de Management Farmaceutic — ASEM Moldova 2026  
Creat de **Cucobco Alexandru** · Grupa TI-241

---

## 🚀 Deploy Rapid (Render.com — GRATUIT)

1. Urcă proiectul pe GitHub (repo nou)
2. Mergi pe [render.com](https://render.com) → **New Web Service**
3. Conectează repo-ul GitHub
4. Configurează:
   - **Build Command:** *(lasă gol)*
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Click **Deploy** — în ~2 minute site-ul e live!

---

## 🚀 Deploy pe Railway.app

1. Mergi pe [railway.app](https://railway.app) → **New Project** → Deploy from GitHub
2. Selectează repo-ul
3. Railway detectează automat Node.js și rulează `npm start`
4. Done! Domeniu gratuit `.up.railway.app`

---

## ▶️ Local

```bash
node server.js
# → http://localhost:3000
```

**Login:**
- Admin: `admin` / `ASEMTI241`
- Guest: `guest` / *(fără parolă)*

---

## 📁 Structură

```
medistock/
├── server.js          # Backend Node.js (API REST)
├── package.json       # Configurare proiect
├── data/
│   └── db.json        # Baza de date (auto-creată)
└── public/
    └── index.html     # Frontend SPA
```

> **Notă:** Nu sunt necesare dependențe npm. Proiectul rulează cu Node.js nativ.
