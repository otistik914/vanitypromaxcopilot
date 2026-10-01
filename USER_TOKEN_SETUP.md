# 🚀 Discord Vanity Sniper - USER TOKEN SETUP (Tam Rehber)

## ⚠️ UYARI

**Discord Kullanıcı Token'ını kullanan sistem şu riskleri taşır:**
- Discord Terms of Service ihlalidir (ban yiyebilirsin)
- Account security riski (token ifşa olursa hack olabilirsin)
- Hukuki sorunlar olabilir
- Resmi Discord API'nin ruhuna aykırıdır

**Kendi hesabında denemekten önceden devam et.**

---

## 1️⃣ USER TOKEN NASIL ALINIR?

### Yöntem 1: DevTools (En Kolay)

1. **Discord'u tarayıcıda aç**: https://discord.com
2. **F12** tuşuna bas (DevTools açılır)
3. **Network** tab'ını aç
4. Sunucuda herhangi bir kanal'a tıkla
5. Network'te bir request görünecek, ona tıkla
6. **Headers** sekmesine git
7. **Authorization** başlığını bul
8. Değer kopyala (başında "eyJ" ile başlar)

```
Authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token şu şekilde görünür:**
- Çok uzun string (300+ karakter)
- Başında "eyJ" ile başlar
- Nokta (.) ile bölünmüş 3 parça

### Yöntem 2: Console (Alternatif)

1. F12 > Console
2. Şu kodu yapıştır:
```javascript
window.localStorage.getItem('token')
```
3. Enter tuşuna bas
4. Token çıkacak, kopyala

---

## 2️⃣ DISCORD_GUILD_ID NASIL ALINIR?

1. **Discord** aç
2. Ayarlar → **Gelişmiş**
3. **Geliştirici Modu** aç
4. Vanity claim yapmak istediğin sunucunun adına **sağ tıkla**
5. **"Sunucu ID'sini Kopyala"** seç

**Örnek:**
```
1234567890123456789
```

---

## 3️⃣ WEBHOOK NASIL OLUŞTURULUR? (Opsiyonel ama Tavsiye)

Vanity claim sonuçlarını Discord'da alabilmek için:

1. **Sunucu** → bir kanal sağ tıkla
2. **Kanal Düzenle**
3. **İntegrasyonlar** → **Web hookları**
4. **Yeni Web hooku** → **Oluştur**
5. **URL'i kopyala**

**Webhook mesajları şu durumlarda gelecek:**
- ✅ Vanity başarıyla claim edildi
- ❌ Vanity claim başarısız oldu (already taken, forbidden, vb)
- ⏱️ Rate limited (429)
- ⏳ Network hatası / delay

---

## 4️⃣ .ENV DOSYASINI DOLDUR

Proje klasöründe `.env` dosyasını açıp şu şekilde doldur:

### Minimum Setup:
```env
DISCORD_USER_TOKEN=eyJhbGc...(1. adımda kopyaladığın token)
DISCORD_GUILD_ID=1234567890123456789
USE_VANITY_LIST=false
WORKER_CONCURRENCY=2
REQUESTS_PER_SECOND=2
POLL_INTERVAL_MS=8000
```

### Webhook ile Setup (Tavsiye):
```env
DISCORD_USER_TOKEN=eyJhbGc...
DISCORD_GUILD_ID=1234567890123456789
WEBHOOK_URL=https://discord.com/api/webhooks/123.../xyz...
USE_VANITY_LIST=false
WORKER_CONCURRENCY=2
REQUESTS_PER_SECOND=2
POLL_INTERVAL_MS=8000
```

### Vanity Listesi ile Setup:
```env
DISCORD_USER_TOKEN=eyJhbGc...
DISCORD_GUILD_ID=1234567890123456789
WEBHOOK_URL=https://discord.com/api/webhooks/123.../xyz...
USE_VANITY_LIST=true
VANITY_LIST_INTERVAL_MS=5000
WORKER_CONCURRENCY=2
REQUESTS_PER_SECOND=2
```

---

## 5️⃣ VANITY LISTESI DOLDUR (Opsiyonel)

`src/vanity-list.js` dosyasını aç ve şu şekilde doldur:

```javascript
module.exports = {
  vanities: [
    "a3",
    "gotten",
    "cool",
    "epic",
    "pro",
    "vip",
  ],
};
```

Sistem bu vanity'leri sırası ile claim etmeye çalışacak.

---

## 6️⃣ ÇALIŞTIR

```bash
npm install
npm start
```

---

## 7️⃣ LOGLAR

### ✅ Başarılı:
```
🚀 ✅ Claim SUCCESS in 45ms: a3
📊 Worker Stats: Avg 48ms | P95 55ms | Success 1 | Status: ✅ OK
```

### ❌ Başarısız (401):
```
❌ 401 Unauthorized: Invalid or expired user token
```

**Çözüm:** Yeni token al (1. adıma dön)

### ❌ Başarısız (409):
```
⚠️ 409 Conflict - Vanity already taken: a3
```

**Anlamı:** Başka biri almış, başka vanity dene

### ⏱️ Rate Limited (429):
```
⏱️ 429 Rate Limited: Backoff 5s
```

**Çözüm:**
```env
WORKER_CONCURRENCY=1
REQUESTS_PER_SECOND=1
VANITY_LIST_INTERVAL_MS=10000
```

---

## 🎯 WEBHOOK MESAJ FORMATLARI

### ✅ Başarılı Claim
```
Title: 🎯 Vanity Claim: SUCCESS
Description: Vanity URL claimed successfully!
Fields:
  📝 Vanity: a3
  ⏰ Latency: 45ms
  ⏱️ Timestamp: 2024-01-15T10:30:45.123Z
```

### ⏱️ Rate Limited
```
Title: 🎯 Vanity Claim: RATELIMIT
Description: Rate limited! Will retry after delay.
Fields:
  📝 Vanity: a3
  ⏳ Retry After: 5s
  ⏰ Latency: 123ms
```

### ❌ Başarısız
```
Title: 🎯 Vanity Claim: FAILED
Description: Vanity already taken by someone else.
Fields:
  📝 Vanity: a3
  ❌ Error: 409 Conflict
  ⏰ Latency: 89ms
```

---

## ⚙️ PERFORMANCE TUNING

### GÜVENLİ (Rate limit yok):
```env
WORKER_CONCURRENCY=2
REQUESTS_PER_SECOND=1
VANITY_LIST_INTERVAL_MS=8000
```

### BALANCED (Normal):
```env
WORKER_CONCURRENCY=2
REQUESTS_PER_SECOND=2
VANITY_LIST_INTERVAL_MS=5000
```

### AGRESIF (Hızlı, riskli):
```env
WORKER_CONCURRENCY=4
REQUESTS_PER_SECOND=3
VANITY_LIST_INTERVAL_MS=3000
```

---

## 🔐 SECURITY BEST PRACTICES

✅ **Yapılacaklar:**
- `.env` dosyasını `.gitignore`'a ekle
- User token'ı hiç kimseyle paylaşma
- Test account'ta dene önce
- Webhook URL'ini gizli tut

❌ **YAPILMAYACAKLAR:**
- .env dosyasını GitHub'a commit etme
- Token'ı Slack/Discord'a gönderme
- Public repository'de token sakla
- Eski token'ı kullan, yeni al

---

**HAZIR! 🚀**

Eğer logta herhangi bir hata görürsen, tam hatayı söyle, çözeriz.
