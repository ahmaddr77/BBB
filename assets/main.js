// File: /assets/main.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } from '/supabase/supabase-config.js';

// انتبه: ملف supabase-config.js يعرض المفتاحين بنفس القيمة كما طلبت
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM
const paidCodeEl = document.getElementById('paidCode');
const freeCodeEl = document.getElementById('freeCode');
const btnPaid = document.getElementById('btnPaid');
const btnFree = document.getElementById('btnFree');
const subjectsSection = document.getElementById('subjectsSection');
const subjectsGrid = document.getElementById('subjectsGrid');
const lessonSection = document.getElementById('lessonSection');
const lessonContent = document.getElementById('lessonContent');
const lessonTitle = document.getElementById('lessonTitle');
const confirmModal = document.getElementById('confirmModal');
const selectionContainer = document.getElementById('selectionContainer');
const toast = document.getElementById('toast');
const confirmSelectionBtn = document.getElementById('confirmSelection');
const cancelSelectionBtn = document.getElementById('cancelSelection');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

// Metadata مؤقتة (استبدل ببيانات من Supabase عند الحاجة)
let metadata = {
  sections: [
    {
      id: 'section-1',
      name: 'القسم الأول',
      years: [
        { id: 'year1', name: 'السنة الأولى', terms: ['الفصل الأول','الفصل الثاني'] },
        { id: 'year2', name: 'السنة الثانية', terms: ['الفصل الأول','الفصل الثاني'] }
      ]
    },
    {
      id: 'section-2',
      name: 'القسم الثاني',
      years: [
        { id: 'year1', name: 'السنة الأولى', terms: ['الفصل الأول','الفصل الثاني'] }
      ]
    }
  ]
};

// Hardening: منع النسخ والاختيار وفتح أدوات المطورين
(function harden(){
  document.addEventListener('contextmenu', e=>e.preventDefault());
  document.addEventListener('selectstart', e=>e.preventDefault());
  document.addEventListener('keydown', e=>{
    if(e.key === 'F12') e.preventDefault();
    if(e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) e.preventDefault();
    if(e.ctrlKey && (e.key === 'u' || e.key === 'U')) e.preventDefault();
  });
})();

function showToast(msg, ms=2200){
  toast.textContent = msg; toast.classList.remove('hidden');
  setTimeout(()=>toast.classList.add('hidden'), ms);
}

async function getUserIP(){
  try{
    const res = await fetch('https://api.ipify.org?format=json');
    const j = await res.json();
    return j.ip || 'unknown';
  }catch(e){ return 'unknown'; }
}

async function logAnalytics(eventType, payload={}){
  try{
    await supabase.from('analytics').insert([{ event: eventType, payload, created_at: new Date().toISOString() }]);
  }catch(e){ console.error('analytics log failed', e.message || e); }
}

async function validatePaidCode(code, ip){
  const { data, error } = await supabase.from('codes').select('*').eq('code', code).limit(1).maybeSingle();
  if(error){ console.error(error); return { ok:false, reason:'db_error' }; }
  if(!data) return { ok:false, reason:'not_found' };
  if(!data.used){
    const upd = await supabase.from('codes').update({ used: true, bound_ip: ip, used_at: new Date().toISOString() }).eq('id', data.id);
    if(upd.error) return { ok:false, reason:'db_update' };
    return { ok:true, record: data };
  }
  if(data.bound_ip === ip) return { ok:true, record: data };
  return { ok:false, reason:'already_used_elsewhere' };
}

async function logAttempt(code, success, ip){
  try{
    await supabase.from('access_logs').insert([{ code, success, ip, ts: new Date().toISOString() }]);
  }catch(e){ console.error('logAttempt', e); }
}

// أحداث الأزرار
btnPaid.addEventListener('click', async ()=>{
  const code = (paidCodeEl.value||'').trim();
  if(!code){ showToast('ادخل الكود'); return; }
  const ip = await getUserIP();
  const res = await validatePaidCode(code, ip);
  if(res.ok){
    await logAttempt(code, true, ip);
    await logAnalytics('login_success_paid', { code, ip });
    openSelectionModal('paid', res.record);
  } else {
    await logAttempt(code, false, ip);
    await logAnalytics('login_failed_paid', { code, ip, reason: res.reason });
    showToast('الكود غير صالح أو مستخدم');
  }
});

btnFree.addEventListener('click', async ()=>{
  const tag = (freeCodeEl.value||'').trim() || 'free-sample';
  const ip = await getUserIP();
  await logAttempt(tag, true, ip);
  await logAnalytics('login_free', { tag, ip });
  openSelectionModal('free', { sample:true });
});

function openSelectionModal(mode, record){
  selectionContainer.innerHTML = '';
  metadata.sections.forEach(sec=>{
    const secEl = document.createElement('div');
    secEl.className = 'secItem';
    secEl.innerHTML = `<strong>${sec.name}</strong>`;
    sec.years.forEach(y=>{
      const yEl = document.createElement('div');
      yEl.className = 'yearItem';
      yEl.innerHTML = `<em>${y.name}</em>`;
      y.terms.forEach(term=>{
        const tBtn = document.createElement('button');
        tBtn.className = 'small-btn';
        tBtn.textContent = `${term} — افتح`;
        tBtn.addEventListener('click', ()=>{
          loadSubjectsFor({ section: sec, year: y, term, mode, record });
          closeModal();
        });
        yEl.appendChild(tBtn);
      });
      secEl.appendChild(yEl);
    });
    selectionContainer.appendChild(secEl);
  });
  confirmModal.classList.remove('hidden');
  confirmModal.style.display = 'flex';
}

function closeModal(){ confirmModal.classList.add('hidden'); confirmModal.style.display = 'none'; }

async function loadSubjectsFor({ section, year, term, mode, record }){
  subjectsGrid.innerHTML = '';
  const materials = [];
  for(let i=1;i<=7;i++) materials.push({ id:`m${i}`, title:`المادة ${i}` });
  materials.forEach((m, idx)=>{
    const card = document.createElement('div');
    card.className = 'subject-card';
    if(mode==='free' && idx>0) card.classList.add('locked');
    card.innerHTML = `<div class="subject-number">${idx+1}</div><div class="subject-title">${m.title}</div>`;
    card.addEventListener('click', ()=>{ if(card.classList.contains('locked')){ showToast('مقفل — اشترك للوصول'); return; } openLesson({ section, year, term, material: m }); });
    subjectsGrid.appendChild(card);
  });
  subjectsSection.classList.remove('hidden');
  lessonSection.classList.add('hidden');
}

function openLesson({ section, year, term, material }){
  subjectsSection.classList.add('hidden');
  lessonSection.classList.remove('hidden');
  lessonTitle.textContent = `${material.title} — ${section.name} / ${year.name} / ${term}`;
  lessonContent.innerHTML = '';
  const para = document.createElement('div');
  para.innerHTML = `<h4>مقدمة</h4><p>هذا درس نموذجي. اضغط الأزرار لعرض المحتوى أو الأسئلة أو البنوك.</p>`;
  lessonContent.appendChild(para);

  document.getElementById('btnContent').onclick = ()=>{ showLessonContentSample(); };
  document.getElementById('btnQuestions').onclick = ()=>{ showQuestionsSample(); };
  document.getElementById('btnBanks').onclick = ()=>{ showBanksSample(); };
}

function showLessonContentSample(){
  lessonContent.innerHTML = `<h4>المحتوى</h4><p>فقرة 1</p><p>فقرة 2</p>`;
}

function showQuestionsSample(){
  lessonContent.innerHTML = '<h4>الأسئلة</h4>';
  const q = document.createElement('div');
  q.innerHTML = `<div class="qtext">سؤال نموذجي: ما هو؟</div>`;
  const choices = ['أ','ب','ج','د'];
  choices.forEach((c,i)=>{
    const btn = document.createElement('button');
    btn.className='answer-btn';
    btn.textContent = c + ') إجابة ' + (i+1);
    btn.addEventListener('click', ()=>{
      if(i==1){ btn.classList.add('answer-correct'); showToast('إجابة صحيحة'); }
      else{ btn.classList.add('answer-wrong'); showCorrectAnswer(); }
    });
    q.appendChild(btn);
  });
  lessonContent.appendChild(q);
}

function showCorrectAnswer(){
  const all = document.querySelectorAll('.answer-btn');
  all.forEach((b,idx)=>{ if(idx==1) b.classList.add('answer-correct'); });
}

function showBanksSample(){
  lessonContent.innerHTML = '<h4>بنوك الأسئلة</h4><p>قائمة بنوك الأسئلة وملفات تحميل.</p>';
}

async function incrementVisit(){
  const ip = await getUserIP();
  try{
    await supabase.from('visitors').insert([{ ip, ts: new Date().toISOString() }]);
  }catch(e){ console.error(e); }
}

(async function init(){
  await incrementVisit();
})();
