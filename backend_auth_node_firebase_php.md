# Backend كامل لتسجيل الدخول وإنشاء حساب — Node / Firebase / PHP

في الملف ده حطيت دليلك الكامل مع أمثلة كود جاهزة تقدر ترفعها أو تجربها محلياً. هعمل لك 3 حلول منفصلة — اختار اللي تفضله أو نفّذهم كلهم.

---

## 1) حل **Node.js + Express + SQLite + JWT** (خيار سريع وآمن)

**مميزات:** تحكّم كامل، مناسب لو بتحب Node، سهل ربطه مع الموقع الحالي.

### ملفات المشروع (كلها في مجلد `node-auth`)

`package.json`

```json
{
  "name": "elitegym-auth",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "bcrypt": "^5.1.0",
    "body-parser": "^1.20.2",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.0",
    "sqlite3": "^5.1.6"
  }
}
```

`server.js`

```js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));

// init db
const dbFile = path.join(__dirname,'auth.db');
const db = new sqlite3.Database(dbFile);

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT DEFAULT 'user'
  )`);
});

const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_secret';
const SALT_ROUNDS = 10;

// تسجيل حساب
app.post('/api/register', async (req,res)=>{
  try{
    const {email,password,name} = req.body;
    if(!email || !password) return res.status(400).json({error:'Email and password required'});
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    db.run(`INSERT INTO users (email,password,name) VALUES (?,?,?)`, [email,hashed,name||null], function(err){
      if(err){
        if(err.message.includes('UNIQUE')) return res.status(409).json({error:'Email already exists'});
        return res.status(500).json({error:'DB error'});
      }
      const user = {id:this.lastID,email,name};
      const token = jwt.sign({id:user.id,email:user.email}, JWT_SECRET, {expiresIn:'7d'});
      res.json({user,token});
    });
  }catch(e){console.error(e);res.status(500).json({error:'Server error'});}
});

// تسجيل دخول
app.post('/api/login', (req,res)=>{
  const {email,password} = req.body;
  if(!email || !password) return res.status(400).json({error:'Email and password required'});
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err,row)=>{
    if(err) return res.status(500).json({error:'DB error'});
    if(!row) return res.status(401).json({error:'Invalid credentials'});
    const ok = await bcrypt.compare(password,row.password);
    if(!ok) return res.status(401).json({error:'Invalid credentials'});
    const token = jwt.sign({id:row.id,email:row.email,role:row.role}, JWT_SECRET, {expiresIn:'7d'});
    res.json({user:{id:row.id,email:row.email,name:row.name},token});
  });
});

// حماية مسارات
function authMiddleware(req,res,next){
  const header = req.headers.authorization;
  if(!header) return res.status(401).json({error:'Missing token'});
  const token = header.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err,payload)=>{
    if(err) return res.status(401).json({error:'Invalid token'});
    req.user = payload; next();
  });
}

// مثال ل route محمي
app.get('/api/profile', authMiddleware, (req,res)=>{
  db.get(`SELECT id,email,name,role FROM users WHERE id = ?`, [req.user.id], (err,row)=>{
    if(err) return res.status(500).json({error:'DB error'});
    res.json({user:row});
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log('Node auth running on',PORT));
```

### تشغيل محلي
1. تحتاج Node.js مثبت (v16+).
2. حفظ الملفات، ثم `npm install`.
3. أنشئ `.env` وضع `JWT_SECRET=your_long_secret`
4. `node server.js` أو `npm run dev` مع nodemon.

### ربط الواجهة (frontend)
استبدل فورم تسجيل الدخول ليعمل `fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email, password})})` وخزن الـtoken في `localStorage` أو `httpOnly cookie` (أمان أفضل).

---

## 2) حل **Firebase Authentication + Firestore** (أسهل للبدء، لا حاجة للسيرفر)

**مميزات:** إعداد سريع، إدارة كلمات مرّكزة، تسجيل عبر Google/Phone، مناسب لويب بسيط.

### خطوات سريعة
1. افتح https://console.firebase.google.com وأنشئ مشروع جديد.
2. فعل Authentication → Email/Password (وأي مزود تاني تحب Google/Phone).
3. فعل Firestore لو عايز تخزن بيانات إضافية (الاسم، المستوى، حجوزات، الخ).
4. انسخ config للـ Web app.

### مثال client-side (HTML + JS) — فقط front-end

```html
<!-- ضع هذا في صفحة الـ HTML -->
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js';
  import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.5.0/firebase-auth.js';

  const firebaseConfig = {
    apiKey: "YOUR_APIKEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT",
    // ... الباقي
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);

  async function register(email,password){
    const userCred = await createUserWithEmailAndPassword(auth,email,password);
    console.log('Registered',userCred.user);
  }

  async function login(email,password){
    const uc = await signInWithEmailAndPassword(auth,email,password);
    console.log('Logged in',uc.user);
  }
</script>
```

### تخزين بيانات إضافية (Firestore)
عند `onCreate` للمستخدم أو بعد التسجيل، أضف مستند `users/{uid}` يحتوي `name, role, createdAt`.

### ملاحظات أمان
- استخدم قواعد Firestore لأمن الوصول.
- Firebase يوفر إرسال بريد تفعيل وكلمات مرور منسية بسهولة.

---

## 3) حل **PHP (MySQL)** — مناسب لو عندك استضافة PHP

**مميزات:** يعمل على أي استضافة مشتركة، بسيط.

### مثال مبسّط (PDO + prepared statements)

`register.php`
```php
<?php
// register.php
require 'config.php'; // يحتوي على PDO $pdo
$data = json_decode(file_get_contents('php://input'), true);
$email = $data['email'] ?? null;
$pass = $data['password'] ?? null;
$name = $data['name'] ?? null;
if(!$email || !$pass) { http_response_code(400); echo json_encode(['error'=>'Missing']); exit; }
$hash = password_hash($pass, PASSWORD_DEFAULT);
try{
 $stmt = $pdo->prepare('INSERT INTO users (email,password,name) VALUES (?, ?, ?)');
 $stmt->execute([$email,$hash,$name]);
 echo json_encode(['ok'=>true]);
}catch(PDOException $e){
 if($e->errorInfo[1] == 1062) { http_response_code(409); echo json_encode(['error'=>'Email exists']); }
 else { http_response_code(500); echo json_encode(['error'=>'DB']); }
}
```

`login.php`
```php
<?php
require 'config.php';
$data = json_decode(file_get_contents('php://input'), true);
$email = $data['email'] ?? null;
$pass = $data['password'] ?? null;
if(!$email || !$pass){ http_response_code(400); exit; }
$stmt = $pdo->prepare('SELECT id,email,password,name FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if(!$user || !password_verify($pass, $user['password'])){ http_response_code(401); echo json_encode(['error'=>'Invalid']); exit; }
// يمكنك إنشاء جلسة PHP أو إصدار JWT هنا
session_start();
$_SESSION['user_id'] = $user['id'];
echo json_encode(['ok'=>true,'user'=>['id'=>$user['id'],'email'=>$user['email'],'name'=>$user['name']]]);
```

`config.php`
```php
<?php
$host='127.0.0.1'; $db='elitegym'; $user='dbuser'; $pass='dbpass';
$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$pdo = new PDO($dsn,$user,$pass,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
```

### ملاحظات
- استخدم HTTPS.
- استعمل `password_hash` و `password_verify` (موجود في المثال).
- لتخزين الجلسات بشكل آمن استخدم `session_set_cookie_params` و cookie flags.

---

## ماذا أعمل لك الآن؟
اختر واحد من الخيارات التالية أو اطلبني أطبقهم كلهم:

1. **أنفذ Node.js backend كامل** (أرفَع الملفات، أو أقدملك ملف واحد `server.js` جاهز وتوجيهات التشغيل).
2. **أربط الموقع بـ Firebase Auth** (أعمل لك نسخة من الـ frontend تتعامل مع Firebase + ملفات إعداد).
3. **أعمل سكربتات PHP كاملة** (register/login + تعليمات لقاعدة بيانات MySQL).
4. **أنفّذ الحلين Node + Firebase** (هخليهم متوازيين).

اكتب لي رقم الاختيار أو قلّي "نفّذ الكل" وسأرفع الأكواد والتوجيهات مباشرة في الـ Canvas.



<!-- Trainer Dashboard Section -->
<section id="trainer-dashboard" class="py-16 bg-gray-900 text-white animate-fadeIn">
  <div class="container mx-auto px-6 text-center">
    <h2 class="text-4xl font-bold mb-6 text-blue-400">لوحة المدرب</h2>
    <p class="mb-8 text-gray-300">إدارة المتدربين – جدول الحصص – متابعة التقدم</p>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="p-6 bg-gray-800 rounded-xl shadow-xl hover:scale-105 transition">
        <h3 class="text-2xl font-semibold text-blue-300 mb-3">عدد المتدربين</h3>
        <p class="text-5xl font-bold">24</p>
      </div>
      <div class="p-6 bg-gray-800 rounded-xl shadow-xl hover:scale-105 transition">
        <h3 class="text-2xl font-semibold text-blue-300 mb-3">حصص اليوم</h3>
        <p class="text-5xl font-bold">6</p>
      </div>
      <div class="p-6 bg-gray-800 rounded-xl shadow-xl hover:scale-105 transition">
        <h3 class="text-2xl font-semibold text-blue-300 mb-3">التقييمات</h3>
        <p class="text-5xl font-bold">4.9★</p>
      </div>
    </div>
  </div>
</section>

<!-- Membership Section -->
<section id="memberships" class="py-16 bg-black text-white animate-fadeIn">
  <div class="container mx-auto px-6 text-center">
    <h2 class="text-4xl font-bold mb-8 text-green-400">العضويات الشهرية والسنوية</h2>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="border border-gray-700 p-8 rounded-2xl bg-gray-900 hover:scale-105 transition shadow-lg">
        <h3 class="text-2xl font-semibold mb-3">شهري</h3>
        <p class="text-4xl font-bold mb-4 text-green-300">299 جنيه</p>
        <ul class="text-gray-300 mb-6 space-y-2">
          <li>✔ دخول غير محدود</li>
          <li>✔ متابعة مدرب</li>
          <li>✔ نظام غذائي</li>
        </ul>
        <button class="bg-green-500 px-6 py-3 rounded-lg text-black font-bold hover:bg-green-400 transition">اشتراك الآن</button>
      </div>

      <div class="border border-yellow-500 p-8 rounded-2xl bg-gray-900 hover:scale-105 transition shadow-xl">
        <h3 class="text-2xl font-semibold mb-3 text-yellow-300">سنوي</h3>
        <p class="text-4xl font-bold mb-4 text-yellow-300">2599 جنيه</p>
        <ul class="text-gray-300 mb-6 space-y-2">
          <li>✔ خصم 30%</li>
          <li>✔ جلسات خاصة شهرياً</li>
          <li>✔ Hoodie هدية</li>
        </ul>
        <button class="bg-yellow-400 px-6 py-3 rounded-lg text-black font-bold hover:bg-yellow-300 transition">اشتراك الآن</button>
      </div>

      <div class="border border-purple-500 p-8 rounded-2xl bg-gray-900 hover:scale-105 transition shadow-lg">
        <h3 class="text-2xl font-semibold mb-3 text-purple-300">VIP</h3>
        <p class="text-4xl font-bold mb-4 text-purple-300">4999 جنيه</p>
        <ul class="text-gray-300 mb-6 space-y-2">
          <li>✔ مدرب شخصي يومي</li>
          <li>✔ خطة مخصصة تماماً</li>
          <li>✔ دخول VIP</li>
        </ul>
        <button class="bg-purple-400 px-6 py-3 rounded-lg text-black font-bold hover:bg-purple-300 transition">اشتراك الآن</button>
      </div>
    </div>
  </div>
</section>

<!-- Style Enhancements -->
<style>
  .animate-fadeIn { animation: fadeIn 1.2s ease-in-out; }
  @keyframes fadeIn { from {opacity:0; transform: translateY(20px);} to {opacity:1; transform: translateY(0);} }
</style>
