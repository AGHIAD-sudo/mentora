# Mentora — نسخة Firebase المتزامنة

نسخة Mobile-First عربية RTL لإدارة الطلاب والجلسات والمدفوعات والديون، مع مزامنة Firebase بين الأجهزة وحفظ محلي للعمل عند ضعف الاتصال.

## ما الذي تغير في هذه النسخة؟

- ربط المشروع بـ Firebase Project: `mentora-481ad`.
- تسجيل دخول بالبريد وكلمة المرور عبر Firebase Authentication.
- تخزين الطلاب في: `users/{uid}/students`.
- تخزين الجلسات والمدفوعات في: `users/{uid}/sessions`.
- مزامنة لحظية بين الجهازين باستخدام Firestore listeners.
- دمج البيانات المحلية الموجودة مسبقاً عند أول تسجيل دخول، بدلاً من حذفها.
- الاحتفاظ بنسخة محلية في `localStorage` كطبقة أمان إضافية.
- تفعيل Firestore Offline Persistence على المتصفحات المدعومة؛ عند عودة الإنترنت تُرسل التغييرات تلقائياً.
- مؤشر مزامنة أعلى التطبيق + زر تسجيل خروج.
- تم تغيير Cache الخاص بالـPWA إلى `mentora-mobile-v3` حتى تصل التحديثات إلى النسخة المثبتة.

## إعداد Firebase المطلوب مرة واحدة

1. Authentication > Sign-in method > Email/Password = Enabled.
2. Authentication > Users: أنشئ الحساب الذي سيستخدم على الجهازين.
3. Authentication > Settings > Authorized domains: أضف `aghiad-sudo.github.io`.
4. Firestore > Security/Rules: استخدم محتوى الملف `firestore.rules.txt` ثم اضغط Publish.
5. لا ترسل كلمة المرور لأي شخص.

## الرفع على GitHub Pages

ارفع **محتويات هذا المجلد** إلى جذر مستودع `mentora`، واستبدل الملفات القديمة، خصوصاً:

- `index.html`
- `app.js`
- `styles.css`
- `firebase-cloud.js`
- `service-worker.js`
- `manifest.webmanifest`
- مجلد `icons`

بعد Commit انتظر GitHub Pages حتى ينشر النسخة، ثم افتح:

`https://aghiad-sudo.github.io/mentora/`

إذا كانت نسخة PWA القديمة مثبتة على الهاتف، أغلقها وافتح الرابط في Chrome مرة واحدة وانتظر التحديث. عند الحاجة امسح Cache الموقع أو احذف الاختصار وثبته من جديد.

## أول تشغيل ومزامنة البيانات القديمة

1. افتح التطبيق على الجهاز الذي يحتوي على البيانات الأهم أولاً.
2. سجّل الدخول بحساب Firebase الذي أنشأته.
3. انتظر حتى يصبح مؤشر المزامنة أخضر ويظهر `متزامن`.
4. افتح نفس الرابط على الجهاز الثاني وسجّل بنفس الحساب.
5. إذا كان على الجهاز الثاني جلسات محلية قديمة مختلفة، سيحاول Mentora دمج السجلات ذات المعرفات المختلفة مع السحابة.
6. بعد أن يصبح المؤشر أخضر على الجهازين، جرّب إضافة جلسة تجريبية على جهاز وتأكد أنها تظهر على الآخر.

## ملاحظة أمنية

`firebaseConfig` الخاص بتطبيق الويب موجود في الواجهة وهذا طبيعي في Firebase؛ حماية البيانات تعتمد على Authentication وFirestore Security Rules. لا تضع Service Account أو Private Key أو كلمة المرور داخل ملفات المشروع.

## ملفات المشروع

- `index.html` — الواجهة + شاشة تسجيل الدخول.
- `styles.css` — التصميم والاستجابة للموبايل.
- `app.js` — منطق التطبيق وربط عمليات الحفظ بالمزامنة.
- `firebase-cloud.js` — إعداد Firebase وطبقة المزامنة.
- `firestore.rules.txt` — قواعد Firestore المقترحة.
- `manifest.webmanifest` — إعداد PWA.
- `service-worker.js` — Cache ملفات الواجهة.
- `icons/` — أيقونات التطبيق.

> استخدم `index.html` عبر GitHub Pages للحصول على المزامنة. ملف `tutoring-dashboard-standalone.html` القديم ليس هو النسخة السحابية المعتمدة.

## تحديث المزامنة اللحظية R2
- يبدأ مستمع Firestore فور تسجيل الدخول ولا ينتظر دمج البيانات القديمة.
- دمج البيانات المحلية القديمة يتم في الخلفية.
- تم تغيير Service Worker إلى network-first لملفات التطبيق لمنع بقاء نسخة قديمة على أحد الجهازين.
- تم تحديث cache version وإضافة version query لملفات CSS/JS.
- بعد رفع التحديث إلى GitHub Pages: افتح الرابط في Chrome على الجهازين، حدّث الصفحة، ثم تأكد أن الحالة تظهر «متزامن لحظياً».
