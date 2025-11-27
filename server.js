// trainee-routes.js
cb(null, name);
}
});
const upload = multer({storage});


// ------- Routes -------


// احصل على ملف تعريف متدرب
router.get('/trainee/:id', (req,res)=>{
const id = req.params.id;
db.get(`SELECT * FROM trainees WHERE id = ?`, [id], (err,row)=>{
if(err) return res.status(500).json({error:'DB error'});
if(!row) return res.status(404).json({error:'Not found'});
// جلب التقدّم
db.all(`SELECT * FROM progress WHERE trainee_id = ? ORDER BY date ASC`, [id], (err2,rows)=>{
if(err2) return res.status(500).json({error:'DB error'});
res.json({trainee:row, progress:rows});
});
});
});


// إنشاء/تحديث متدرب (post لcreate أو put لتحديث)
router.post('/trainee', (req,res)=>{
const {name,email,age,weight,height,goal,membership} = req.body;
db.run(`INSERT INTO trainees (name,email,age,weight,height,goal,membership) VALUES (?,?,?,?,?,?,?)`,
[name,email,age||null,weight||null,height||null,goal||'',membership||''], function(err){
if(err){
if(err.message.includes('UNIQUE')) return res.status(409).json({error:'Email exists'});
return res.status(500).json({error:'DB'});
}
res.json({id:this.lastID});
});
});


router.put('/trainee/:id', (req,res)=>{
const id = req.params.id;
const {name,age,weight,height,goal,membership} = req.body;
db.run(`UPDATE trainees SET name=?, age=?, weight=?, height=?, goal=?, membership=? WHERE id=?`,
[name,age,weight,height,goal,membership,id], function(err){
if(err) return res.status(500).json({error:'DB'});
res.json({updated:true});
});
});


// إضافة سجل تقدّم
router.post('/trainee/:id/progress', (req,res)=>{
const id = req.params.id;
const {date,weight,chest,back,legs,notes} = req.body;
db.run(`INSERT INTO progress (trainee_id,date,weight,chest,back,legs,notes) VALUES (?,?,?,?,?,?,?)`,
[id,date,weight,chest,back,legs,notes||''], function(err){
if(err) return res.status(500).json({error:'DB'});
res.json({id:this.lastID});
});
});


// رفع صورة قبل/بعد
router.post('/trainee/:id/upload', upload.single('image'), (req,res)=>{
const id = req.params.id;
const type = req.body.type || 'before'; // before|after
if(!req.file) return res.status(400).json({error:'No file'});
const filepath = `/uploads/${req.file.filename}`; // Served statically
db.run(`INSERT INTO uploads (trainee_id,type,filepath,uploaded_at) VALUES (?,?,?,datetime('now'))`,
[id,type,filepath], function(err){
if(err) return res.status(500).json({error:'DB'});
res.json({ok:true,filepath});
});
});


// جلب صور المتدرب
router.get('/trainee/:id/uploads', (req,res)=>{
const id = req.params.id;
db.all(`SELECT * FROM uploads WHERE trainee_id = ? ORDER BY uploaded_at DESC`, [id], (err,rows)=>{
if(err) return res.status(500).json({error:'DB'});
res.json({uploads:rows});
});
});


module.exports = router;
