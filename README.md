# RSVP — Wedding & Dinner Invitation Pages

Multi-mode RSVP system. Same codebase, two modes:

| Mode | Frontend | Admin | Theme |
|---|---|---|---|
| **Wedding** | `/` | `/admin` | Liquid Glass + Romantic Gold |
| **Dinner** | `/dinner` | `/dinner/admin` | Dark Navy + Gold |

## Architecture

```
rsvp/                       ← this repo (CF Pages)
├── index.html              → wedding frontend
├── admin.html              → wedding admin
├── dinner/
│   ├── index.html          → dinner frontend
│   └── admin.html          → dinner admin
├── music.mp3
└── README.md

jayibrahimwebsitev3/        ← JIAI repo (API + D1)
├── functions/api/
│   ├── rsvp.js             → wedding RSVP API
│   ├── dinner-rsvp.js      → dinner RSVP + CHIP payment
│   ├── wedding-config.js   → editable wedding content
│   └── dinner-config.js    → editable dinner content
└── D1: jayibrahim-db
    ├── wedding_rsvp
    ├── wedding_config
    ├── dinner_rsvp
    └── dinner_config
```

## Deploy

```bash
npx wrangler pages deploy . --project-name wedding-rsvp --branch main
```

## Edit Content

1. Buka `wedding-rsvp-yfa.pages.dev/admin` (wedding) atau `.../dinner/admin` (dinner)
2. Password: ***

3. Tab ✏️ Edit Kandungan
4. Ubah → Simpan
5. Front page auto update
