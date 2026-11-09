# أسرار Excel 🟩

سيريز شورتس معمولة كلها بالكود (Remotion + Three.js). GitHub Actions بيرندر الحلقات كل يوم الصبح وبيجدولها على قناتك.

## كيف بيشتغل
- `episodes.json`: لائحة الحلقات. أي حلقة `"status": "ready"` بتنزل بأقرب وقت فاضي.
- كل يوم الساعة 8 الصبح (بيروت) بينرفع **فيديوين Private ومجدولين**: حلقة Excel الساعة `13:00` وحلقة أمان للأهل الساعة `20:00` (من `slots` بـ `episodes.json`).
- بيحط كل فيديو بالـPlaylist تبعو إذا حطّيت الـID بـ `playlists`، وبيكتب `stats.json` بمشاهدات كل فيديو.
- يعني عندك وقت تشوف كل فيديو بـYouTube Studio قبل ما يصير Public، وإذا ما عجبك بتلغيه.
- الفيديوهات كمان بتنحفظ 7 أيام بـActions → Artifacts.

## الإعداد (مرة وحدة)

### 1. Google Cloud (حوالي 10 دقايق)
1. افتح https://console.cloud.google.com واعمل Project جديد.
2. **APIs & Services → Library** ← فتّش على **YouTube Data API v3** ← Enable.
3. **OAuth consent screen**: نوع External، حط اسمك وإيميلك، وزيد إيميلك بـ **Test users**. بعدين اكبس **Publish app** حتى المفتاح ما ينتهي بعد 7 أيام.
4. **Credentials → Create credentials → OAuth client ID** ← نوع **Desktop app** ← Download JSON.
5. سمّي الملف `client_secret.json` وحطّو بمجلد `scripts/`.

### 2. المفتاح (على كمبيوترك)
```
pip install google-auth-oauthlib
python scripts/auth_setup.py
```
بتفتح صفحة Google، بتختار حساب القناة وبتوافق. بيطلعلك 3 قيم.

### 3. GitHub Secrets
**Settings → Secrets and variables → Actions → New repository secret**، وحط الـ3:
`YT_CLIENT_ID`، `YT_CLIENT_SECRET`، `YT_REFRESH_TOKEN`

### 4. تجربة
**Actions → Publish Shorts → Run workflow**. علّم على `dry_run` أول مرة للتجربة بدون رفع.

## أوامر مفيدة
| شو بدك | الأمر |
|---|---|
| تشوف الحلقات وتعدّل عليها | `npm run studio` |
| تغيّر السيريز والساعات | `slots` بـ `episodes.json` |
| توقف النشر | Actions → Publish Shorts → Disable workflow |
