# Kuratorlar oyligi — boshqaruv paneli

Kuratorlar oyligini **kunlarga mutanosib (pro-rata)** va **tarixni saqlagan holda (snapshot)** avtomatik hisoblaydigan veb-dastur. Buxgalteriya bilimi talab qilinmaydi: siz faqat sanalar va sonlarni kiritasiz, summani tizim o'zi hisoblaydi. Butun interfeys o'zbek tilida.

---

## 1. Dastur nima qiladi?

| Bo'lim | Kim ishlatadi | Vazifasi |
|---|---|---|
| **Kuratorlar** | Admin (tahrir), Boshliq (ko'rish) | Ism, tug'ilgan sana, ishga qabul sanasi, karta raqami (yonidagi tugma raqamni nusxalaydi) |
| **Oylik qoidalari** | Admin | Oylik "shablonlari": qat'iy summa, kunlik stavka, talaba soniga qarab daraja, xabar tekshiruvi narxi, sotuvdan foiz, har bir sotuvga qat'iy summa |
| **Potoklar va guruhlar** | Admin | Potok (boshlanish/tugash sanasi bilan) → guruhlar (potok sanalarini oladi) → kurator biriktirish (ishlagan davri majburiy), **Kuratorni almashtirish** |
| **Potok oyliklari** | Hammasi | Tanlangan oy uchun har kuratorning ishlagan kunlari va oyligi |
| **Rustilida.uz oyliklari** | Hammasi | Guruhlar (boshlanish/tugash sanasi majburiy), har oy talabalar soni, daraja shkalasi: 1 talaba uchun stavka (1–10 ta = X, 11–20 ta = Y …). Oylik = talabalar soni × stavka |
| **Sifat nazorati** | Hammasi | Faqat nazoratchilar (kuratorlar emas): **"+ Xodim qo'shish"**, potok tanlash tugmalari, xabar tekshiruvi (guruhga 4 ta), **yangi potokka o'tish sotuvi (5%)**, har xodim va umumiy jami, **bo'lim rahbarining stabil oyligi**, **Rustilida.uz sotuvi** (guruh + nechanchi oy (1–5) + to'lov qilgan o'quvchilar soni × bir sotuv summasi; kiritish — faqat Admin) |
| **To'lovlar** | Hammasi (holatni faqat Admin) | Potoklar, Rustilida.uz, Sifat nazorati va bonuslar bo'yicha kim, qancha, qaysi sanada o'tkazilishi kerak. **Kutilmoqda / O'tkazildi** tugmasi |
| **Oylik hisobot** | Hammasi | Yuqorida bo'lim (potoklar / Rustilida.uz / Sifat nazorati / bonus), oy va yil tanlanadi; **"Karta / Ism / Potok yoki guruh / Summa"** matni va **Nusxalash** tugmasi; batafsil hisob, **Excel**, **PDF**, oyni yopish (Admin) |

### Ikki rol
- **Admin** — hamma narsa: kuratorlar, qoidalar, potoklar, kurator biriktirish, oyni yopish/qayta ochish.
- **Bo'lim boshlig'i (Operator)** — soddalashtirilgan: talabalar sonini, xabar tekshiruvlari va sotuvlarni kiritadi, hisobotni ko'radi va yuklab oladi.

### Hisoblash qoidasi (oddiy tilda)
**Hisob davri potok (yoki Rustilida guruhi) boshlangan kundan boshlanadi.** Potok 31-oktabrda boshlangan bo'lsa: 1-davr 31.10–29.11 (to'lov 30.11), 2-davr 30.11–30.12 (to'lov 31.12), … Qisqa oylarda boshlanish kuni oyning oxirgi kuniga o'tadi. Potok 1-sanadan boshlangan bo'lsa, davr kalendar oyga teng. Tanlangan oy — davr **boshlanadigan** oy.

- **Kurator butun davr ishlasa — to'liq oylik.** Kunlarga bo'lish faqat davr o'rtasida kurator almashganda (yoki davr o'rtasida boshlaganda) ishlaydi: **ulush = ishlagan kunlar ÷ davr kunlari**, ulushlar yig'indisi doim 100%.
- **Rustilida.uz:** oylik = **talabalar soni × 1 talaba uchun stavka** (talabalar soniga mos daraja bo'yicha).
- **Kunlik stavka** qoidasi tabiatan kunga hisoblanadi (stavka × ishlagan kunlar).
- Bonuslar (xabar tekshiruvi, sotuvlar) tanlangan kalendar oy uchun kiritiladi.

**Oylik beriladigan sanalar (bosh sahifada qizil eslatma bo'lib turadi):**
- **Potoklar** — potok boshlangan kunning sanasida, har oy (hisob davri tugagan kunning ertasi).
- **Rustilida.uz** — guruh tugash sanasining kunida, har oy; guruh boshlangan kun to'lov kuni hisoblanmaydi (masalan, tugash 15-sana bo'lsa — har oyning 15-sanasi).
- **Sifat nazorati** (nazoratchilar, rahbar, 5% va Rustilida sotuvi) — keyingi oyning 1-sanasi.
- **Rustilida.uz guruh oylari (1–5):** har bir oy uchun boshlanish/tugash sanasi (oylik shu tugash sanasida to'lanadi), oy boshi va oxiridagi talabalar soni kiritiladi. Chiqib ketgan talaba o'qigan darslari soniga qarab hisoblanadi: masalan, 13 darsdan 8 tasini o'qigan bo'lsa — 8/13 talaba. Oylik = (oy oxiridagi talabalar + chiqib ketganlarning kasrlari yig'indisi) × 1 talaba uchun stavka; daraja oy boshidagi talabalar soniga qarab tanlanadi.
- Kuratorlar va sifat nazorati **alohida** hisoblanadi: nazoratchilar kuratorlar ro'yxatida chiqmaydi.
- Rustilida.uz sotuvi = to'lov qilgan o'quvchilar soni × qoidadagi summa. Sifat nazorati rahbari har oy stabil oylik oladi (ish boshlagan sana belgilansa — o'sha oydan).
- To'lov o'tkazilgach Admin "To'lovlar" sahifasida holatni "O'tkazildi" qiladi; o'tkazilmaganlar bosh sahifada sanasi bilan ko'rinib turadi (3 kundan kam qolsa yoki kechiksa — qizil).

> Misol: oylik 3 100 000, davr 31 kun. 10 kun Dilnoza, 21 kun Sardor ishladi → Dilnoza 3 100 000 × 10/31 = **1 000 000**, Sardor 3 100 000 × 21/31 = **2 100 000**.
> Rustilida: 23 talaba, daraja 21+ = 70 000 → 23 × 70 000 = **1 610 000**.

### "Tarix saqlanishi" (snapshot) qanday ishlaydi
1. Kuratorga qoida biriktirilganda, qoidaning **o'sha paytdagi nusxasi** biriktirishda saqlanadi. Keyin Admin narxni o'zgartirsa, eski hisoblar **buzilmaydi**. Yangi narxni eski biriktirishga qo'llash kerak bo'lsa — ↻ tugmasi.
2. **Oyni yopish** — butun oy natijasini "muzlatadi". Yopilgan oyga tegishli hech narsani o'zgartirib bo'lmaydi (Admin qayta ochmaguncha).

### Xatolardan himoya
Bir guruhda ikki kurator sanalari kesishmaydi; sanalar guruh muddatidan chiqmaydi; takroriy karta raqami rad etiladi; ishlatilgan kurator/qoida/guruh o'chirilmaydi; kurator belgilanmagan kunlar, talaba soni kiritilmagani, xabar tekshiruvi me'yordan kamligi haqida ogohlantirish chiqadi.

---

## 2. Kompyuteringizda sinab ko'rish (5 daqiqa)

1. [Node.js](https://nodejs.org) (LTS, 20 yoki yangi) ni o'rnating.
2. Papkada terminal oching va yozing:
   ```bash
   npm install
   cp .env.example .env      # Windows: copy .env.example .env
   ```
3. `.env` faylini Bloknotda oching va ikkala parolni hamda `SESSION_SECRET` ni o'zgartiring.
4. Ishga tushiring: `npm start` → brauzerda **http://localhost:3000**.

Baza sifatida avtomatik `data/kurator.db` fayli ishlatiladi (`DATABASE_URL` bo'sh bo'lsa).

---

## 3. Internetga joylash (qadamma-qadam)

> ⚠️ **Vercel va Netlify bu dastur uchun mos emas.** Ular "serverless" — doimiy ishlaydigan server va saqlanadigan baza kerak bo'lgan bunday dasturni to'g'ri ishlatmaydi. Quyidagi **Render** (eng oson) yoki **Railway** dan foydalaning.

### Variant A — BEPUL: Neon (baza) + Render (sayt) — domen va pul kerak emas
Natija: `https://nomingiz.onrender.com` manzili; xodimlar shu manzilni ochib, o'z parolini kiritadi, hamma bir xil ma'lumotni ko'radi.
1. **GitHub**: [github.com](https://github.com) da ro'yxatdan o'ting → **New repository** → *Private* → "uploading an existing file" orqali zip ichidagi `kurator-oylik` papkasidagi **fayllarni** yuklang (`node_modules`, `.env`, `data` papkalarini yuklamang).
2. **Baza (Neon)**: [neon.tech](https://neon.tech) da ro'yxatdan o'ting → loyiha yarating → *Connection string* ni nusxalang (`postgres://…` bilan boshlanadi). Bu baza muddatsiz bepul tarifda turadi (joriy shartlarni saytda tekshiring).
3. **Sayt (Render)**: [render.com](https://render.com) → GitHub orqali kiring → **New → Blueprint** → repozitoriyni tanlang.
4. So'ralgan maydonlar: `DATABASE_URL` — Neon'dan nusxalangan manzil; `ADMIN_PASSWORD` va `OPERATOR_PASSWORD` — o'zingiz o'ylab topgan murakkab parollar. `SESSION_SECRET` o'zi yaratiladi.
5. **Apply** → 3–5 daqiqa kuting → `onrender.com` manzili chiqadi. Shu manzilni xodimlarga yuboring.
6. Birinchi marta kirib, "Oylik qoidalari"dan tayyor namunalarni yarating va ma'lumotlarni kiriting.

**Cheklovlar (bepul tarif).** Sayt 15 daqiqa ishlatilmasa "uxlaydi", keyingi ochilish ~1 daqiqa oladi. Render'ning o'zining bepul bazasi 30 kundan keyin o'chadi — shuning uchun baza Neon'da. Oyda 750 bepul soat beriladi, bitta sayt uchun yetarli.

### Variant B — Railway.app
1. Loyihani GitHub'ga yuklang (yuqoridagidek).
2. [railway.app](https://railway.app) → **New Project → Deploy from GitHub repo**.
3. Loyihada **+ New → Database → PostgreSQL** qo'shing.
4. Veb-xizmat → **Variables** bo'limida qo'shing: `DATABASE_URL` = *Reference → Postgres → DATABASE_URL*, `ADMIN_PASSWORD`, `OPERATOR_PASSWORD`, `SESSION_SECRET`.
5. **Settings → Networking → Generate Domain** bosing — manzilingiz tayyor.

### Variant C — O'z serveringiz (VPS) yoki ofis kompyuteri, Docker bilan
Ubuntu/Debian serverda (masalan, oyiga ~$5 lik VPS):
```bash
git clone <sizning-repozitoriy-manzilingiz> kurator && cd kurator
bash deploy.sh
```
Skript Docker'ni o'rnatadi, parollarni so'raydi, `.env` yaratadi va dasturni ishga tushiradi → `http://SERVER_IP:3000`.
Qo'lda: `.env` ni tayyorlab, `docker compose up -d --build`. Yangilash: `git pull && docker compose up -d --build`. Ma'lumotlar `dbdata` hajmida saqlanadi (konteyner o'chsa ham yo'qolmaydi).
Domen va `https` kerak bo'lsa, serverga Caddy yoki Nginx qo'yib, 3000-portga yo'naltiring.

---

## 4. `.env` sozlamalari

`.env.example` dan nusxa oling (`.env`). Bulutda (Render/Railway) bularni xizmatning **Environment / Variables** bo'limiga kiritasiz.

| O'zgaruvchi | Majburiy | Izoh |
|---|---|---|
| `ADMIN_PASSWORD` | ha | Admin paroli |
| `OPERATOR_PASSWORD` | ha | Bo'lim boshlig'i paroli |
| `SESSION_SECRET` | ha | Uzun tasodifiy matn (kamida 32 belgi) |
| `DATABASE_URL` | yo'q | PostgreSQL manzili: `postgres://user:parol@host:5432/baza`. Bo'sh bo'lsa — SQLite fayli |
| `DATABASE_SSL` | yo'q | Bulutdagi bazalar uchun ko'pincha `true` |
| `SQLITE_PATH` | yo'q | SQLite fayl yo'li (standart `data/kurator.db`) |
| `PORT` | yo'q | Standart 3000 |
| `SESSION_HOURS` | yo'q | Kirish muddati (standart 12 soat) |
| `DB_PASSWORD` | docker-compose | Ichki PostgreSQL paroli |

**Bepul tashqi baza (Neon):** [neon.tech](https://neon.tech) → loyiha yarating → **Connection string** ni nusxalang → `DATABASE_URL` ga qo'ying va `DATABASE_SSL=true` yozing.

---

## 4b. Serversiz variant — faqat HTML faylni ochib ishlatish (`dist/kuratorlar-oflayn.html`)
Hech narsa o'rnatish va internetga joylash shart emas: faylni **Chrome/Edge/Firefox** da oching, tamom. Baza fayl ichida (brauzerda) ishlaydi.
- Kirish parollari: Admin — `admin123`, Bo'lim boshlig'i — `operator123`. Chap menyudagi **"Parollarni o'zgartirish"** orqali almashtiring.
- Ma'lumotlar **shu kompyuterdagi shu brauzerda** saqlanadi. Brauzer tarixi/saytlar ma'lumotini tozalasangiz yoki boshqa brauzer/kompyuterda ochsangiz, ma'lumot ko'rinmaydi.
- Shuning uchun har oy oxirida **"Zaxira nusxa olish"** tugmasini bosing (`.db` fayl yuklanadi). Boshqa kompyuterga o'tish yoki yo'qolganini tiklash uchun **"Zaxiradan tiklash"**.
- Faylni har doim bitta joydan (masalan, Ish stoli) oching — Chrome fayl joylashuviga qarab alohida xotira ishlatishi mumkin.
- Bir nechta kishi bir vaqtda ishlashi kerak bo'lsa, server variantidan (3-bo'lim) foydalaning.
- Yangilash: `npm install && npm run build:offline`.

---

## 4a. Alohida HTML fayl (`dist/dashboard.html`)
Butun interfeys bitta HTML faylga yig'ilgan. Uni ikki mijozning kompyuteriga yuborish, brauzerda ochish yoki istalgan oddiy hostingga qo'yish mumkin.
1. Server (3-bo'lim) ishlab turishi kerak.
2. `dashboard.html` ni brauzerda oching → kirish oynasidagi **Server manzili** ga serveringiz manzilini yozing (masalan `https://kuratorlar-oyligi.onrender.com`) → rol va parolni kiriting.
3. Yangilash: `npm install && npm run build:html` — yangi `dist/dashboard.html` yaratiladi.
Ruxsat etilgan saytlarni cheklash uchun serverda `CORS_ORIGIN=https://sizning-sayt.uz` o'zgaruvchisini qo'ying (standart: hamma).

---

## 5. Muhim maslahatlar
- **Parollarni o'zgartiring.** Standart parollar (`admin123`, `operator123`) faqat sinov uchun; ular bilan kirilsa, tizim ogohlantiradi.
- **Zaxira nusxa.** SQLite ishlatsangiz, `data/kurator.db` faylini har oy nusxalab qo'ying. PostgreSQL'da — xizmat taqdim etadigan backup'dan foydalaning.
- **Oy oxirida tartib:** talabalar soni → xabar tekshiruvlari → sotuvlar → "Oylik hisobot" da ogohlantirishlarni tekshirish → Excel/PDF → **Oyni yopish**.
- **PDF:** "PDF / Chop etish" tugmasi → printer o'rniga **"PDF sifatida saqlash"** ni tanlang.

## 6. Muammolar
| Muammo | Yechim |
|---|---|
| "Parol noto'g'ri" | `.env` / Variables dagi parolni tekshiring; o'zgartirgach xizmatni qayta ishga tushiring |
| "Bu oy yopilgan" | Admin → Oylik hisobot → "Oyni qayta ochish" |
| "Bir guruhda bir vaqtda ikki kurator bo'lmaydi" | Sanalarni to'g'rilang yoki "Almashtirish" tugmasidan foydalaning |
| Saytingiz birinchi ochilishda sekin | Bepul tarif "uyg'onmoqda" — 1 daqiqa kuting |
| `SQLite ishga tushmadi` | `DATABASE_URL` kiriting (PostgreSQL) |

## 7. Texnik tuzilma (dasturchilar uchun)
```
server.js            Express ilovasi
src/calc.js          Hisoblash mexanizmi (sof funksiyalar, pro-rata)
src/rules.js         Qoida turlari va tekshiruv
src/routes/*.js      API (kuratorlar, qoidalar, hub, bonuslar, hisobot)
src/db/              PostgreSQL / SQLite adapteri va jadvallar
src/excel.js         Excel eksport
public/              Interfeys (build kerak emas): js/views/*.js
tests/               npm test
```
