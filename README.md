# Wedding RSVP Invitation — Setup Guide

## Apa yang dah siap:
✅ Single HTML page dengan Islamic theme (emas + emerald)  
✅ Countdown timer ke tarikh majlis  
✅ "Buka Jemputan" button reveal dengan background music  
✅ RSVP form untuk kehadiran (compulsory)  
✅ Google Maps embed  
✅ Photo gallery  
✅ Doa section (Arabic + BM)  
✅ Mobile-first responsive design  
✅ Music toggle button  

---

## 🔧 Setup Steps:

### 1. Ganti Content dalam `index.html`

| Yang perlu diganti | Kod cari | Contoh |
|---|---|---|
| **Nama pengantin** | `Pengantin Perempuan` & `Pengantin Lelaki` | "Nurul & Hafiz" |
| **Tarikh kahwin** | `WEDDING_DATE = new Date('2026-11-01T10:00:00+08:00')` | Tukar tarikh |
| **Lokasi & event details** | `event-card` sections | Akad Nikah, Resepsi |
| **Gambar** | Ganti `gallery-placeholder` dengan `<img>` | `<img src="url-gambar">` |
| **Muzik latar** | `<source src="" type="audio/mpeg">` | Ganti dengan URL mp3 |
| **Google Maps embed** | `iframe src="..."` | Ganti dengan lokasi sebenar |

### 2. Setup Google Sheets untuk RSVP

1. Buka [sheets.google.com](https://sheets.google.com) — login guna Google account
2. Create new sheet → rename ke **"RSVP"**
3. Extensions → **Apps Script**
4. Paste code dari file `apps-script.gs`
5. Klik **Deploy** → **New Deployment**
6. Pilih **Web App**
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Klik **Deploy** → **Authorize** → copy URL
8. Paste URL dalam `index.html` → cari `RSVP_API_URL = ''`

### 3. Hosting

#### Option A: GitHub Pages (Percuma, paling senang)
```bash
# Create repo di GitHub, then:
git init
git add .
git commit -m "Wedding RSVP"
git push origin main
# Settings → Pages → Deploy from main → Save
```

#### Option B: Cloudflare R2 (Percuma, CDN)
```bash
# Upload ke R2 bucket (jiai-uploads)
# Atau guna Workers untuk static serve
```

#### Option C: Static hosting lain
- Netlify (drag-drop, free)
- Vercel (free)
- Surge.sh (1 command)

### 4. Share ke Jemaah

Selepas deploy, share URL dengan WhatsApp:
```
Assalamualaikum! Jemput ke majlis kami:
🌐 https://nama-kau.github.io/wedding
```

---

## 📱 Preview sekarang:

**http://100.95.59.98:8888** (Tailscale)
