# ⚡ DoneFast Admin — Sistem Distribusi Order Otomatis Real-Time

**DoneFast** adalah platform distribusi order joki (freelance task) otomatis. Ketika ada order masuk, sistem secara otomatis mencari penjoki (pekerja) yang sedang online lalu mengirim notifikasi real-time. Penjoki dapat menerima atau menolak order dengan countdown timer — distribusi berjalan sepenuhnya otomatis.

---

## 📋 Daftar Isi

- [Arsitektur Teknologi](#-arsitektur-teknologi)
- [Fitur Utama](#-fitur-utama)
- [Database Schema](#-database-schema)
- [Struktur Project](#-struktur-project)
- [Alur Distribusi Order](#-alur-distribusi-order)
- [API Endpoints](#-api-endpoints)
- [Setup & Instalasi](#-setup--instalasi)
- [Deployment ke Vercel](#-deployment-ke-vercel)
- [Screenshot & Tampilan](#-screenshot--tampilan)
- [Konfigurasi Lanjutan](#-konfigurasi-lanjutan)
- [Lisensi](#-lisensi)

---

## 🏗️ Arsitektur Teknologi

| Layer | Teknologi | Keterangan |
|-------|-----------|------------|
| **Frontend** | Next.js 16 + TypeScript + Tailwind CSS v4 | App Router, Server/Client Components |
| **Backend** | Next.js API Routes (Serverless) | 10 endpoint RESTful API |
| **Database** | PostgreSQL via Prisma ORM 7 | 6 model, 5 enum, relasi lengkap |
| **Real-time** | Pusher Channels (WebSocket) | Notifikasi order instan ke penjoki |
| **Authentication** | JWT + bcrypt | Token via cookie & localStorage |
| **Hosting** | Vercel (Serverless) | Auto-deploy dari GitHub |
| **Icons** | Lucide React | Icon library modern |

### Mengapa Teknologi Ini?

- **Next.js 16 App Router** — SSR, API routes, dan frontend dalam satu project. Tidak perlu backend terpisah.
- **Prisma ORM 7** — Type-safe database access. Schema jadi satu sumber kebenaran untuk tipe TypeScript dan tabel database.
- **Pusher** — Solusi WebSocket managed. Tidak perlu setup server WebSocket sendiri. Free tier mendukung 200K pesan/hari.
- **Supabase/Neon** — PostgreSQL managed gratis. Cocok untuk MVP hingga production awal.
- **Vercel** — Zero-config deployment untuk Next.js. Serverless = tidak perlu kelola server.

---

## 🎯 Fitur Utama

### 1. Sistem Distribusi Order Otomatis

Inti dari DoneFast. Ketika admin membuat order baru:

1. Order masuk ke database dengan status `WAITING`
2. Sistem mengubah status menjadi `SEARCHING` dan mulai mencari penjoki
3. Penjoki yang memenuhi kriteria (online, tidak suspended, aktif) dipilih berdasarkan strategi
4. Notifikasi real-time dikirim ke penjoki terpilih via Pusher WebSocket
5. Penjoki punya waktu respon (default 30 detik) untuk menerima atau menolak
6. **Jika diterima** → order terkunci ke penjoki, status jadi `ACCEPTED`
7. **Jika ditolak** → otomatis kirim ke penjoki berikutnya
8. **Jika timeout** (tidak merespons) → otomatis kirim ke penjoki berikutnya
9. Proses berulang hingga ada yang menerima atau mencapai batas maksimum percobaan

### 2. Empat Strategi Distribusi

| Strategi | Cara Kerja | Cocok Untuk |
|----------|-----------|-------------|
| **By Rating** ⭐ | Prioritas penjoki rating tertinggi | Kualitas terjamin |
| **By Workload** 📊 | Prioritas penjoki dengan order paling sedikit | Pemerataan beban |
| **By Level** 🏆 | Prioritas penjoki level tertinggi | Tugas sulit/prioritas |
| **Random** 🎲 | Distribusi acak (berdasarkan last online) | Distribusi adil |

### 3. Dashboard Penjoki (Mobile-First)

Dashboard penjoki didesain mobile-first:

- **Toggle Online/Offline** — Satu tombol untuk mulai menerima order
- **Order Offer Modal** — Pop-up real-time dengan detail order + countdown circle
- **Accept/Reject** — Tombol besar untuk terima/tolak order
- **Stats Cards** — Saldo, rating, total order, order selesai
- **Level Badge** — Penanda level penjoki
- **Order Tabs** — Tab aktif, semua, dan riwayat order
- **Profil** — Upload foto, edit spesialisasi (Pemrograman/Akademik/dll)
- **Browser Notification** — Notifikasi di luar browser window
- **Notification Sound** — Suara saat ada order masuk
- **Bottom Navigation** — Navigasi mobile-friendly

### 4. Panel Admin (Desktop)

Panel admin dengan sidebar navigation:

- **Overview** — 4 stat cards (total order, order aktif, penjoki online, revenue)
- **Manajemen Order** — Tabel order dengan filter, buat order baru, detail + log distribusi
- **Manajemen Penjoki** — Kartu penjoki, suspend/unsuspend, monitor status
- **Live Monitoring** — Leaderboard, activity feed, distribusi real-time
- **Manual Assign** — Assign order manual ke penjoki tertentu
- **Redistribute** — Redistribusi order yang gagal ke penjoki baru

### 5. Fitur Lanjutan

- **Auto-Suspend** — Penjoki otomatis di-suspend selama 24 jam setelah 10x penolakan
- **Sistem Komisi** — Komisi otomatis dihitung (default 80% dari harga order)
- **Saldo & Earnings** — Saldo penjoki bertambah otomatis saat order selesai
- **Rating System** — Rating otomatis berdasarkan jumlah order selesai dan ketepatan waktu, admin juga bisa override manual
- **Level System** — Level penjoki (1-10) mempengaruhi prioritas distribusi
- **Activity Log** — Semua aksi tercatat: order dibuat, diterima, ditolak, selesai
- **Countdown Timer** — Visual countdown circle + progress bar saat offer
- **Multi-tab Auth** — Token disimpan di cookie + localStorage (kompatibel Codespaces)

---

## 🗄️ Database Schema

### Entity Relationship

```
┌──────────┐     1:1      ┌──────────┐     1:N      ┌──────────┐
│   User   │─────────────▶│  Penjoki │◀────────────│  Order   │
│          │              │          │              │          │
│ id       │              │ id       │              │ id       │
│ name     │              │ name     │              │ orderNum │
│ email    │              │ status   │              │ status   │
│ password │              │ rating   │              │ price    │
│ role     │              │ level    │              │ penjokiId│
└──────────┘              │ balance  │              └─────┬────┘
                          └─────┬────┘                    │
                                │                         │
                                │         1:N             │
                                ├────────────────────────▶│
                                │                         │
                          ┌─────▼─────────────────────────▼────┐
                          │       OrderDistribution            │
                          │                                    │
                          │ id, orderId, penjokiId, status     │
                          │ sentAt, respondedAt, responseTime  │
                          └────────────────────────────────────┘
```

### Model Detail

#### `User` — Tabel autentikasi
| Field | Tipe | Keterangan |
|-------|------|------------|
| id | String (CUID) | Primary key |
| name | String | Nama lengkap |
| email | String (unique) | Email login |
| password | String | Hashed bcrypt |
| role | UserRole | `ADMIN` atau `PENJOKI` |

#### `Penjoki` — Profil pekerja
| Field | Tipe | Keterangan |
|-------|------|------------|
| id | String (CUID) | Primary key |
| userId | String (unique) | FK ke User |
| status | PenjokiStatus | `ONLINE`, `OFFLINE`, `BUSY`, `AVAILABLE` |
| rating | Float | Default 5.0 |
| totalOrder | Int | Total order diterima |
| completedOrder | Int | Total order selesai |
| rejectedOrder | Int | Total order ditolak |
| level | Int | Level 1-10 |
| balance | Float | Saldo saat ini |
| totalEarnings | Float | Total pendapatan |
| commissionRate | Float | Persentase komisi (default 0.8 = 80%) |
| isSuspended | Boolean | Status suspend |
| suspendReason | String? | Alasan suspend |
| suspendUntil | DateTime? | Batas waktu suspend |
| lastOnline | DateTime? | Terakhir online |

#### `Order` — Data order customer
| Field | Tipe | Keterangan |
|-------|------|------------|
| id | String (CUID) | Primary key |
| orderNumber | String (unique) | Nomor order (format: DF-YYMMDD-XXXX) |
| customerName | String | Nama customer |
| serviceType | String | Jenis layanan (Skripsi, Tugas, dll) |
| description | Text | Deskripsi detail |
| price | Float | Harga order |
| commission | Float | Komisi penjoki |
| status | OrderStatus | `WAITING` → `SEARCHING` → `ACCEPTED` → `PROCESSING` → `COMPLETED` |
| penjokiId | String? | FK ke Penjoki (terisi setelah accepted) |
| distributionAttempts | Int | Jumlah percobaan distribusi |
| maxAttempts | Int | Maks percobaan (default 10) |
| responseTimeout | Int | Timeout respon dalam detik (default 30) |
| distributionStrategy | DistributionStrategy | Strategi distribusi |

#### `OrderDistribution` — Log setiap percobaan distribusi
| Field | Tipe | Keterangan |
|-------|------|------------|
| id | String (CUID) | Primary key |
| orderId | String | FK ke Order |
| penjokiId | String | FK ke Penjoki |
| status | DistributionStatus | `SENT`, `ACCEPTED`, `REJECTED`, `TIMEOUT` |
| sentAt | DateTime | Waktu dikirim |
| respondedAt | DateTime? | Waktu direspon |
| reason | String? | Alasan penolakan |
| responseTime | Int? | Waktu respon (detik) |

#### `SystemConfig` — Konfigurasi sistem
| Field | Tipe | Keterangan |
|-------|------|------------|
| key | String (unique) | Nama konfigurasi |
| value | String | Nilai konfigurasi |
| description | String? | Deskripsi |

#### `ActivityLog` — Catatan aktivitas
| Field | Tipe | Keterangan |
|-------|------|------------|
| action | String | Aksi yang dilakukan |
| entity | String | Entitas terkait |
| entityId | String? | ID entitas |
| details | Text? | Detail tambahan |

---

## 📁 Struktur Project

```
DoneFastAdmin/
├── prisma/
│   └── schema.prisma              # Database schema (6 model, 5 enum)
├── prisma.config.ts               # Konfigurasi Prisma CLI
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root layout (AuthProvider + PusherProvider)
│   │   ├── page.tsx               # Halaman utama (login/redirect)
│   │   ├── globals.css            # Tailwind + custom animations
│   │   ├── admin/
│   │   │   └── page.tsx           # Halaman admin (protected)
│   │   ├── penjoki/
│   │   │   └── page.tsx           # Halaman penjoki (protected)
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── route.ts       # POST: login/register, DELETE: logout
│   │       │   └── me/
│   │       │       └── route.ts   # GET: data user saat ini + penjoki detail
│   │       ├── orders/
│   │       │   ├── route.ts       # GET: list order, POST: buat + auto distribute
│   │       │   └── [id]/
│   │       │       └── route.ts   # GET: detail, PATCH: redistribute/complete/assign
│   │       ├── penjoki/
│   │       │   ├── route.ts       # GET: list penjoki
│   │       │   └── [id]/
│   │       │       └── route.ts   # PATCH: toggle status, suspend/unsuspend
│   │       ├── distribution/
│   │       │   └── respond/
│   │       │       └── route.ts   # POST: accept/reject/timeout
│   │       ├── stats/
│   │       │   └── route.ts       # GET: statistik dashboard
│   │       ├── pusher/
│   │       │   └── auth/
│   │       │       └── route.ts   # POST: Pusher channel authorization
│   │       └── seed/
│   │           └── route.ts       # POST: seed data awal
│   ├── components/
│   │   ├── LoginPage.tsx          # Form login/register (dark theme)
│   │   ├── AdminDashboard.tsx     # Panel admin lengkap (sidebar + 4 view)
│   │   ├── PenjokiDashboard.tsx   # Dashboard penjoki mobile-first
│   │   └── providers/
│   │       ├── AuthProvider.tsx   # Context auth (login/logout/refresh)
│   │       └── PusherProvider.tsx # Context Pusher (subscribe/unsubscribe)
│   └── lib/
│       ├── prisma.ts              # Prisma client singleton + PG adapter
│       ├── pusher.ts              # Pusher server & client + channels/events
│       ├── auth.ts                # JWT: hash, verify, generateToken, getCurrentUser
│       ├── distribution-engine.ts # Otak distribusi: strategi, accept, reject, timeout
│       └── fetch.ts               # authFetch wrapper (auto-inject Bearer token)
├── .env.example                   # Template environment variables
├── vercel.json                    # Konfigurasi deployment Vercel
├── package.json                   # Dependencies & scripts
└── tsconfig.json                  # TypeScript configuration
```

### Penjelasan File Penting

#### `src/lib/distribution-engine.ts` — Otak Distribusi
File terpenting dalam sistem. Berisi logika:
- `startDistribution(orderId)` — Mulai proses distribusi order
- `distributeToNextPenjoki(orderId)` — Kirim offer ke penjoki berikutnya
- `findNextPenjoki(strategy, excludeIds, serviceType)` — Cari penjoki sesuai strategi
- `acceptOrder(distributionId, penjokiId)` — Proses penerimaan order
- `rejectOrder(distributionId, penjokiId, reason)` — Proses penolakan + auto-suspend
- `handleTimeout(distributionId, orderId, penjokiId)` — Tangani timeout
- `completeOrder(orderId, penjokiId)` — Selesaikan order + hitung komisi
- `generateOrderNumber()` — Generate nomor order unik (DF-YYMMDD-XXXX)

#### `src/lib/auth.ts` — Autentikasi JWT
- `hashPassword(password)` — Hash password dengan bcrypt (12 rounds)
- `verifyPassword(password, hash)` — Verifikasi password
- `generateToken(payload)` — Buat JWT token (expired 7 hari)
- `getCurrentUser(request)` — Ambil user dari cookie ATAU Authorization header
- `requireAdmin(request)` — Middleware: hanya admin
- `requirePenjoki(request)` — Middleware: hanya penjoki

#### `src/lib/pusher.ts` — Real-time Events
Channels dan events yang digunakan:
- Channel `distribution` — Broadcast distribusi order
- Channel `private-admin` — Events khusus admin
- Channel `private-penjoki-{id}` — Events per penjoki
- Channel `orders` — Update status order

Events: `order-offer`, `order-accepted`, `order-rejected`, `order-timeout`, `order-completed`, `penjoki-status-changed`, `distribution-update`

---

## 🔄 Alur Distribusi Order

### Diagram Alur Lengkap

```
 ┌─────────────────────────────────────────────────────────┐
 │                    ADMIN DASHBOARD                       │
 │  Admin membuat order baru (isi form + pilih strategi)   │
 └─────────────────────┬───────────────────────────────────┘
                       │
                       ▼
              POST /api/orders
              ┌────────────────┐
              │  Order dibuat  │
              │ Status: WAITING│
              └───────┬────────┘
                      │ (autoDistribute: true)
                      ▼
           startDistribution(orderId)
              ┌────────────────┐
              │ Status berubah │
              │ → SEARCHING    │
              └───────┬────────┘
                      │
                      ▼
         findNextPenjoki(strategy)
         ┌──────────────────────┐
         │ Cari penjoki yang:   │
         │ • Status = AVAILABLE │
         │ • isActive = true    │
         │ • isSuspended = false│
         │ • Belum ditawari     │
         └──────────┬───────────┘
                    │
          ┌─────────┴──────────┐
          │ Penjoki ditemukan?  │
          └─────────┬──────────┘
               ┌────┴────┐
              YES        NO
               │          │
               ▼          ▼
    Kirim Offer via   Status kembali
    Pusher WebSocket  ke WAITING
    (30s countdown)   (perlu manual assign)
               │
               ▼
    ┌──────────────────┐
    │ PENJOKI DASHBOARD │
    │  Modal muncul:    │
    │  ┌──────────────┐ │
    │  │ Order Baru!  │ │
    │  │  28 detik    │ │
    │  │              │ │
    │  │ [ TERIMA ]   │ │
    │  │ [ TOLAK  ]   │ │
    │  └──────────────┘ │
    └─────────┬────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
  ACCEPT    REJECT    TIMEOUT
    │         │         │
    ▼         ▼         ▼
  Order     Cari       Cari
  locked    next       next
  ke        penjoki    penjoki
  penjoki   (ulangi)   (ulangi)
    │
    ▼
 ACCEPTED → PROCESSING → COMPLETED
 (penjoki    (penjoki      (admin/penjoki
  terima)    kerjakan)      selesaikan)
                               │
                               ▼
                         Komisi dihitung
                         Saldo bertambah
                         Stats update
```

### Status Order

| Status | Keterangan | Aksi Berikutnya |
|--------|------------|-----------------|
| `WAITING` | Order baru dibuat, belum didistribusikan | Distribute / Manual Assign |
| `SEARCHING` | Sedang mencari penjoki yang tersedia | Otomatis oleh sistem |
| `ACCEPTED` | Penjoki sudah menerima order | Start Processing |
| `PROCESSING` | Penjoki sedang mengerjakan | Complete |
| `COMPLETED` | Order selesai dikerjakan | - |
| `CANCELLED` | Order dibatalkan | - |

---

## 🌐 API Endpoints

### Authentication

| Method | Endpoint | Body | Response | Keterangan |
|--------|----------|------|----------|------------|
| `POST` | `/api/auth` | `{ email, password }` | `{ success, user, token }` | Login |
| `POST` | `/api/auth` | `{ email, password, name, action: "register" }` | `{ success, user, token }` | Register |
| `DELETE` | `/api/auth` | - | `{ success }` | Logout (hapus cookie) |
| `GET` | `/api/auth/me` | - | `{ id, name, email, role, penjoki }` | Data user saat ini |

### Orders

| Method | Endpoint | Query/Body | Response | Keterangan |
|--------|----------|------------|----------|------------|
| `GET` | `/api/orders` | `?status=WAITING&limit=20&page=1` | `{ orders, total, page }` | List order + filter |
| `POST` | `/api/orders` | `{ customerName, serviceType, description, price, ... }` | `{ success, order }` | Buat order + auto distribute |
| `GET` | `/api/orders/[id]` | - | `{ order, distributions }` | Detail order + log distribusi |
| `PATCH` | `/api/orders/[id]` | `{ action: "redistribute" }` | `{ success, message }` | Redistribusi order |
| `PATCH` | `/api/orders/[id]` | `{ action: "start-processing" }` | `{ success }` | Mulai pengerjaan |
| `PATCH` | `/api/orders/[id]` | `{ action: "complete" }` | `{ success }` | Selesaikan order |
| `PATCH` | `/api/orders/[id]` | `{ action: "assign-manual", penjokiId }` | `{ success }` | Assign manual ke penjoki |

### Penjoki

| Method | Endpoint | Query/Body | Response | Keterangan |
|--------|----------|------------|----------|------------|
| `GET` | `/api/penjoki` | `?status=AVAILABLE&online=true` | `{ penjokis, total }` | List penjoki + filter |
| `GET` | `/api/penjoki/[id]` | - | `{ penjoki, orders, distributions }` | Detail penjoki |
| `PATCH` | `/api/penjoki/[id]` | `{ status: "AVAILABLE" }` | `{ success, penjoki }` | Toggle online/offline |
| `PATCH` | `/api/penjoki/[id]` | `{ action: "suspend", suspendReason }` | `{ success }` | Suspend penjoki |
| `PATCH` | `/api/penjoki/[id]` | `{ action: "unsuspend" }` | `{ success }` | Aktifkan kembali |

### Distribution

| Method | Endpoint | Body | Response | Keterangan |
|--------|----------|------|----------|------------|
| `POST` | `/api/distribution/respond` | `{ distributionId, action: "accept" }` | `{ success }` | Terima order |
| `POST` | `/api/distribution/respond` | `{ distributionId, action: "reject", reason }` | `{ success }` | Tolak order |
| `POST` | `/api/distribution/respond` | `{ distributionId, action: "timeout" }` | `{ success }` | Timeout handler |

### Lainnya

| Method | Endpoint | Keterangan |
|--------|----------|------------|
| `GET` | `/api/stats` | Statistik dashboard (orders, penjoki, revenue, leaderboard, activity) |
| `POST` | `/api/pusher/auth` | Otorisasi channel Pusher (private channels) |
| `POST` | `/api/seed?secret=donefast-seed-2025` | Seed data awal (admin + 5 penjoki + config) |

---

## 🚀 Setup & Instalasi

### Prasyarat

- **Node.js 18+** (disarankan v20 atau lebih baru)
- **PostgreSQL** — Gunakan layanan managed gratis:
  - [Supabase](https://supabase.com) (recommended)
  - [Neon](https://neon.tech)
  - [Railway](https://railway.app)
- **Pusher** — Akun gratis di [pusher.com](https://pusher.com) (200K pesan/hari gratis)

### Langkah 1: Clone & Install

```bash
git clone https://github.com/MUHULILAMRI/DoneFastAdmin.git
cd DoneFastAdmin
npm install
```

### Langkah 2: Setup Database (Supabase)

1. Buat project baru di [supabase.com](https://supabase.com)
2. Setelah project siap, klik **Connect** (tombol hijau kanan atas)
3. Pilih tab **ORMs** → pilih **Prisma**
4. Copy `DATABASE_URL` dan `DIRECT_URL`

### Langkah 3: Setup Pusher

1. Buat akun di [pusher.com](https://pusher.com)
2. Buat **Channels app** baru
3. Pilih cluster terdekat (misalnya `ap1` untuk Singapore)
4. Catat: **App ID**, **Key**, **Secret**, **Cluster**

### Langkah 4: Environment Variables

```bash
cp .env.example .env
```

Isi `.env` dengan nilai yang sesuai:

```env
# Database
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# JWT (ganti dengan string random)
JWT_SECRET="random-string-minimal-32-karakter-super-aman"

# Pusher
PUSHER_APP_ID="1234567"
NEXT_PUBLIC_PUSHER_KEY="abcdef1234567890"
PUSHER_SECRET="abcdef1234567890"
NEXT_PUBLIC_PUSHER_CLUSTER="ap1"

# Seed
SEED_SECRET="donefast-seed-2025"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Langkah 5: Push Schema ke Database

```bash
npx prisma db push
```

Perintah ini akan membuat semua tabel, enum, dan index di database PostgreSQL kamu.

### Langkah 6: Jalankan Aplikasi

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Langkah 7: Seed Data Awal

Di terminal baru:

```bash
curl -X POST "http://localhost:3000/api/seed?secret=donefast-seed-2025"
```

Atau via npm script:

```bash
npm run db:seed
```

Ini akan membuat:
- 1 akun **Super Admin**
- 1 akun **Admin Pemantau**
- 5 akun **Penjoki**
- System config default (response timeout, max attempts, dll)

---

## 🌍 Deployment ke Vercel

### Langkah 1: Push ke GitHub

```bash
git add .
git commit -m "feat: DoneFast Admin - Sistem Distribusi Order Otomatis"
git push origin main
```

### Langkah 2: Import di Vercel

1. Buka [vercel.com](https://vercel.com) dan login dengan GitHub
2. Klik **Import Project** → pilih repository `DoneFastAdmin`
3. Framework akan auto-detect sebagai **Next.js**

### Langkah 3: Set Environment Variables

Di Vercel dashboard, tambahkan semua env vars:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Connection string dari Supabase |
| `DIRECT_URL` | Direct connection string dari Supabase |
| `JWT_SECRET` | String random kamu |
| `PUSHER_APP_ID` | App ID dari Pusher |
| `NEXT_PUBLIC_PUSHER_KEY` | Key dari Pusher |
| `PUSHER_SECRET` | Secret dari Pusher |
| `NEXT_PUBLIC_PUSHER_CLUSTER` | Cluster (misal: `ap1`) |
| `SEED_SECRET` | Secret untuk seed (misal: `donefast-seed-2025`) |

### Langkah 4: Deploy

Klik **Deploy**. Vercel akan:
1. Install dependencies (`npm install`)
2. Generate Prisma Client (`npx prisma generate`)
3. Build Next.js (`next build`)
4. Deploy ke edge network global

### Langkah 5: Seed Production

Setelah deploy berhasil, seed database production:

```bash
curl -X POST "https://your-app.vercel.app/api/seed?secret=donefast-seed-2025"
```

---

## ️ Screenshot & Tampilan

### Halaman Login
- Dark theme gradient (biru-abu)
- Form login/register toggle

### Dashboard Penjoki (Mobile)
- Header dengan status online/offline dan tombol toggle
- Stats cards: Saldo, Rating, Total Order, Selesai
- Level badge
- Tabs: Dashboard / Orders / History / Profil
- Tab Profil: Upload foto, edit spesialisasi
- Modal order offer dengan countdown circle
- Bottom navigation bar

### Panel Admin (Desktop)
- Sidebar navigasi: Overview, Orders, Penjoki, Monitoring
- Overview: 4 stat cards + leaderboard + activity feed
- Orders: Tabel dengan filter + form buat order + detail modal
- Penjoki: Grid kartu penjoki + suspend/unsuspend
- Monitoring: Live distribution tracking

---

## ⚙️ Konfigurasi Lanjutan

### NPM Scripts

| Script | Perintah | Keterangan |
|--------|----------|------------|
| `dev` | `next dev` | Jalankan development server |
| `build` | `prisma generate && next build` | Build production |
| `start` | `next start` | Jalankan production server |
| `db:generate` | `prisma generate` | Generate Prisma Client |
| `db:push` | `prisma db push` | Sync schema ke database |
| `db:migrate` | `prisma migrate dev` | Buat migration |
| `db:studio` | `prisma studio` | Buka Prisma Studio (GUI database) |
| `db:seed` | `curl POST /api/seed` | Seed data awal |

### Konfigurasi Sistem (via SystemConfig)

Setelah seed, config ini tersedia di database:

| Key | Default | Keterangan |
|-----|---------|------------|
| `response_timeout` | `30` | Waktu respon penjoki (detik) |
| `max_distribution_attempts` | `10` | Maks percobaan distribusi per order |
| `auto_suspend_threshold` | `10` | Jumlah reject sebelum auto-suspend |
| `auto_suspend_duration` | `24` | Durasi auto-suspend (jam) |
| `default_commission_rate` | `0.8` | Rate komisi default (80%) |

### Pusher Channels & Events

| Channel | Event | Keterangan |
|---------|-------|------------|
| `distribution` | `order-offer` | Offer ke penjoki spesifik |
| `distribution` | `order-accepted` | Order diterima |
| `distribution` | `order-rejected` | Order ditolak |
| `distribution` | `order-timeout` | Order timeout |
| `distribution` | `order-completed` | Order selesai |
| `distribution` | `penjoki-status-changed` | Status penjoki berubah |
| `private-admin` | `distribution-update` | Update distribusi ke admin |
| `private-admin` | `order-status-changed` | Status order berubah |
| `private-admin` | `stats-update` | Update statistik |

---

## 🛠️ Troubleshooting

### Error: "Can't reach database server"
- Pastikan `DATABASE_URL` benar
- Untuk Supabase, gunakan connection string dari tab **ORMs > Prisma** (yang ada `pooler.supabase.com`)

### Error: "PrismaClientConstructorValidationError: adapter required"
- Prisma 7 memerlukan driver adapter. File `src/lib/prisma.ts` sudah menggunakan `@prisma/adapter-pg`
- Pastikan `@prisma/adapter-pg` dan `pg` terinstall

### Login gagal / 401 di Codespaces
- Codespaces proxy bisa memblokir httpOnly cookies
- Sistem sudah menghandle ini dengan menyimpan token di localStorage + mengirim Authorization header

### Pusher tidak real-time
- Pastikan credentials Pusher sudah benar di `.env`
- Cek browser console untuk error Pusher connection
- Pastikan cluster sesuai (`ap1` untuk Singapore)

---

## 📄 Lisensi

MIT License — Bebas digunakan untuk keperluan apapun.

---

**Dikerjakan sepenuhnya oleh MUH. ULIL AMRI, S.Kom**

Kami terbuka untuk setiap masukan dan juga kritik. Jangan ragu untuk menghubungi kami atau membuka issue di repository ini.
