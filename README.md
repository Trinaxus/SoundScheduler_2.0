SoundScheduler-App
 
# Überblick
Die SoundScheduler-App ist ein leichtgewichtiges Scheduling- und Soundboard-Tool. Backend ist eine kleine PHP-API, die alle Metadaten in einer JSON-Datei speichert. Das Frontend ist eine React/Vite-App.

# Architektur
- Backend (PHP): `server/api/*`
  - Persistenz: `server/data/manifest.json` (wird nur von der API gelesen/geschrieben; direkter Webzugriff per `.htaccess` gesperrt)
  - Uploads: Audiodateien in `uploads/sounds` (Pfad über `server/.env` → `UPLOAD_DIR`)
  - Versionierung: Das Manifest enthält `version` (ETag). Jede Änderung erhöht die Version.
- Frontend (React/Vite): `src/*`
  - Kommuniziert ausschließlich mit der PHP-API (kein Supabase).

# Wichtige Dateien & Ordner
- `server/.env`: Serverkonfiguration (CORS, BASE_URL, Cookie, Pfade, Admin-Login)
- `server/api/*.php`: REST-ähnliche Endpunkte
- `server/data/manifest.json`: Zentrale Daten (Sounds, Kategorien, Schedules, Version)
- `src/components/`: UI-Komponenten (u. a. `SoundboardView`, `TimelineView`, `SoundList`)
- `src/context/SoundContext.tsx`: State/Actions (Play/Pause/Stop, CRUD via API, Kategorien)
- `src/lib/api.ts`: API-Helper (FormData für POST, um CORS-Preflights zu minimieren)

# Datenmodell (Manifest)
`server/data/manifest.json` enthält:
- `version`: Ganzzahl, erhöht sich bei jeder Änderung
- `sounds`: Liste der Sounds inkl. Feldern wie `id`, `name`, `url`, `file_path`, `size`, `type`, `duration`, `display_order`, `is_favorite`, `category_id`
- `categories`: Liste von Kategorien `{ id, name, display_order }`
- `schedules`: Liste der Zeitpläne `{ id, sound_id, time, active, last_played }`

# API-Endpunkte (Auszug)
- `GET /server/api/manifest.php` → gesamtes Manifest (mit ETag)
- `POST /server/api/sounds.php?action=insert|update|delete|reorder` → Sounds CRUD
- `POST /server/api/schedules.php?action=insert|update|delete` → Schedules CRUD
- `POST /server/api/categories.php?action=insert|update|delete` → Kategorien CRUD
- `POST /server/api/resync.php` → Upload-Ordner scannen und fehlende Dateien ins Manifest ergänzen
- `GET /server/api/me.php` → Auth-Status (Session)

Alle POSTs werden als `multipart/form-data` gesendet (FormData), um CORS-Preflights zu vermeiden. Authentifizierung erfolgt per Server-Session.

# Features
- Soundliste (kompakte Karten):
  - Umbenennen, Löschen, Daueranzeige (Dauer in Pink)
  - Zwei Zeilen pro Karte: 1) links Name + Edit, rechts Dauer; 2) Zeitfenster-Chips (falls vorhanden) und Aktionen (Zeitpläne, Löschen)
  - Kategorie-Farbpunkt links vor dem Namen (kleiner Dot)
  - Karten mit Zeitfenstern werden in einem eigenen Abschnitt „Geplant“ angezeigt und nach frühester Zeit aufsteigend sortiert; darunter Abschnitt „Ohne Zeit“
  - Play/Pause links, vertikal mittig; schneller Wechsel zwischen Sounds stoppt den vorherigen und startet den neuen sofort
- Timeline: Zeitpläne anlegen/anzeigen, Play aus der Timeline
- Soundboard:
  - Favoriten, Drag&Drop-Reihenfolge
  - Kategorien: Anlegen/Umbenennen/Löschen über Zahnrad (Modal), Sounds zuweisen, Filter-Pills über dem Grid
- Remote-Ansicht: zeigt alle Kategorien außer „Ausgeblendet“; Filter-Pills sind auch dort sichtbar
- Header (mobil): Hamburger-Menü mit Uhr, Host/Remote-Umschalter und Logout; kompakte Topbar
- Resync-Button: Scannt Uploads und ergänzt fehlende Manifest-Einträge

# Demo / Screenshots
- Soundliste (Geplant/Ohne Zeit), kompakte Karten, pinke Dauer, Kategorie-Dot
- Mobiler Header mit Hamburger-Menü, Uhr, Host/Remote
- Remote-Ansicht mit Filter-Pills (ohne „Ausgeblendet“)

Hinweis: Screenshots können in `docs/` abgelegt und hier verlinkt werden (z. B. `docs/soundliste.png`).

# Lokale Entwicklung
1) Abhängigkeiten installieren
```
npm install
```
2) Dev-Server starten
```
npm run dev
```
3) Frontend greift per `VITE_API_BASE` (in Projekt-`.env`) auf die PHP-API zu.

## Deployment (Vercel)
- Repository-Link: GitHub (auch private Repos unterstützt). Nach Umstellung auf „Private“ ggf. Vercel ↔ GitHub neu autorisieren (App braucht „repo“-Zugriff).
- Build Command: `npm run build`
- Output Directory: `dist`
- Production Branch: `main`
- Falls kein neuer Build nach Push: im Vercel-Project „Trigger Deploy“/„Redeploy“ auslösen und Logs prüfen.

### Release/Deploy-Checkliste (Vercel)
1) Änderungen committen und pushen auf `main`.
2) Vercel → Project → Deployments: neuer Build sollte automatisch starten.
3) Falls nicht: „Trigger Deploy“ klicken oder GitHub-Verknüpfung neu autorisieren (Private-Repo → App braucht „repo“-Zugriff).
4) Build-Settings prüfen: Build `npm run build`, Output `dist`.
5) Deployment testen über die Preview-URL und ggf. „Promote to Production“.

# Server-Konfiguration
Datei: `server/.env`
- `CORS_ALLOWED_ORIGINS` → z. B.:
```
CORS_ALLOWED_ORIGINS=https://tonbandleipzig.de,https://tonbandleipzig.de.w01fc61e.kasserver.com,http://localhost:5173,https://localhost:5173,http://127.0.0.1:5173
```
- `BASE_URL` → öffentliche Basis-URL (z. B. `https://tonbandleipzig.de`)
- `DATA_DIR`, `UPLOAD_DIR` → echte Serverpfade
- `SESSION_NAME`, `COOKIE_SECURE=true`, `COOKIE_SAMESITE=None`
- Admin: `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`

Zusätzlich kann `server/api/.htaccess` CORS-Header und OPTIONS-204 setzen (falls Apache AllowOverride aktiv ist).

# CORS-Hinweise
- Der Server setzt `Access-Control-Allow-Origin` nur, wenn der Origin exakt in `CORS_ALLOWED_ORIGINS` steht. Für lokale Entwicklung ggf. alle Varianten (`http://localhost:5173`, `https://localhost:5173`, `http://127.0.0.1:5173`) eintragen.
- Das Frontend nutzt FormData für POST, um Preflights (OPTIONS) zu vermeiden.



# Kategorien
- CRUD über `categories.php` und Zuweisung von `category_id` in Sounds (`sounds.php`).
- UI: Zahnrad im Soundboard → Modal zum Verwalten + Zuweisung. Filter-Pills über dem Grid.

# Sicherheit
- Admin-Session via Cookie (Secure, SameSite=None).
- `server/data/` ist per `.htaccess` vor direktem Zugriff geschützt.

# Troubleshooting
- CORS: Origin exakt in `server/.env` → `CORS_ALLOWED_ORIGINS` aufnehmen. Danach hart neu laden/Cache leeren.
- Preflight (OPTIONS) ohne ACAO: Prüfe, ob `server/api/.htaccess` greift (Apache) oder ob `bootstrap.php` CORS-Header setzt (passender Origin nötig).
- Resync findet Datei nicht: Prüfe `UPLOAD_DIR` in `server/.env` und Dateinamen.

## Bekannte Limitationen
- Ein gleichzeitiger Audiotrack; Start eines anderen Sounds stoppt den vorherigen.
- Browser-Audioverhalten kann sich je nach Plattform/Autoplay-Policy unterscheiden (z. B. iOS erfordert User-Interaktion).

## Häufige Admin-Tasks
- Kategorien verwalten: Soundboard → Zahnrad → Kategorien anlegen/umbenennen/löschen, Sounds zuweisen.
- Uploads scannen: Menü → „Uploads scannen“; ergänzt fehlende Dateien im Manifest.
- Neu laden/Sync: Menü → „Aktualisieren“ lädt Manifest neu.

# Lizenz / Hinweise
Interne Projektbasis. Bei Bedarf ergänzen.
