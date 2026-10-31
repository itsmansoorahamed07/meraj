/* =========================================================
   AM Associates – Clinic Manager
   Single-doctor clinic CRM. All data is stored in this
   browser (localStorage). Use Settings → Backup regularly.
   ========================================================= */
'use strict';

/* ---------- tiny helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => toISO(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return toISO(d); };
const fmtDate = (iso) => (iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const money = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

/* ---------- workflow steps (chronological order) ---------- */
const STEPS = [
  { key: 'patients', label: 'Patient Details', short: 'Patients', icon: '👤', color: '#7c3aed', grad: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', singular: 'Patient' },
  { key: 'diagnostics', label: 'Diagnostics', short: 'Diagnostics', icon: '🩺', color: '#2563eb', grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', singular: 'Diagnosis / Check-up' },
  { key: 'results', label: 'Results', short: 'Results', icon: '🧪', color: '#0d9488', grad: 'linear-gradient(135deg,#14b8a6,#0f766e)', singular: 'Test Result' },
  { key: 'prescriptions', label: 'Prescriptions', short: 'Prescriptions', icon: '💊', color: '#db2777', grad: 'linear-gradient(135deg,#ec4899,#be185d)', singular: 'Prescription' },
  { key: 'followups', label: 'Follow-ups', short: 'Follow-ups', icon: '📅', color: '#ea580c', grad: 'linear-gradient(135deg,#fb923c,#c2410c)', singular: 'Follow-up' },
  { key: 'bills', label: 'Consultation Bills', short: 'Bills', icon: '🧾', color: '#16a34a', grad: 'linear-gradient(135deg,#22c55e,#15803d)', singular: 'Bill' },
];
const STEP = Object.fromEntries(STEPS.map((s, i) => [s.key, { ...s, n: i + 1 }]));

const BILL_TYPES = {
  Consultation: { color: '#7c3aed', icon: '👨‍⚕️' },
  'X-Ray': { color: '#0284c7', icon: '🦴' },
  Diagnostic: { color: '#0d9488', icon: '🔬' },
  Procedure: { color: '#ea580c', icon: '🩹' },
  Medicines: { color: '#db2777', icon: '💊' },
  Other: { color: '#64748b', icon: '📄' },
};

const COMMON_MEDS = [
  'Tab. Paracetamol 650 mg', 'Tab. Paracetamol 500 mg', 'Tab. Azithromycin 500 mg', 'Tab. Amoxicillin + Clavulanic Acid 625 mg',
  'Cap. Amoxicillin 500 mg', 'Tab. Cefixime 200 mg', 'Tab. Ciprofloxacin 500 mg', 'Tab. Metronidazole 400 mg', 'Tab. Cetirizine 10 mg',
  'Tab. Levocetirizine 5 mg', 'Tab. Montelukast 10 mg + Levocetirizine 5 mg', 'Tab. Pantoprazole 40 mg', 'Cap. Omeprazole 20 mg',
  'Tab. Ondansetron 4 mg', 'Tab. Domperidone 10 mg', 'ORS Sachet', 'Tab. Ibuprofen 400 mg', 'Tab. Diclofenac 50 mg',
  'Tab. Aceclofenac + Paracetamol', 'Tab. Metformin 500 mg', 'Tab. Glimepiride 1 mg', 'Tab. Amlodipine 5 mg', 'Tab. Telmisartan 40 mg',
  'Tab. Atorvastatin 10 mg', 'Tab. Vitamin B-Complex', 'Tab. Calcium + Vitamin D3', 'Cap. Vitamin D3 60,000 IU', 'Tab. Iron + Folic Acid',
  'Syp. Cough (Dextromethorphan)', 'Syp. Ambroxol', 'Syp. Paracetamol 250 mg/5 ml', 'Inj. Diclofenac 75 mg', 'Inj. Ondansetron 4 mg',
  'Oint. Mupirocin 2%', 'Cream Clotrimazole 1%', 'Drops Ciprofloxacin (Eye/Ear)', 'Nebulization – Salbutamol + Budesonide',
];
const FREQS = ['1-0-1', '1-1-1', '1-0-0', '0-0-1', '0-1-0', '1-1-1-1', 'SOS', 'Once a week', 'Stat'];
const WHEN = ['After food', 'Before food', 'With food', 'At bedtime', 'Empty stomach', 'As directed'];
const COMMON_TESTS = ['Hemoglobin', 'Total WBC Count', 'Platelet Count', 'Random Blood Sugar', 'Fasting Blood Sugar', 'Post-Prandial Blood Sugar', 'HbA1c', 'Serum Creatinine', 'Blood Urea', 'SGPT (ALT)', 'SGOT (AST)', 'Total Cholesterol', 'Triglycerides', 'HDL', 'LDL', 'TSH', 'Urine Routine', 'ESR', 'CRP', 'Dengue NS1', 'Malaria Antigen', 'Widal Test', 'ECG', 'X-Ray Chest PA'];

/* ---------- database ---------- */
const DB_KEY = 'amassociates_clinic_db_v1';
const defaultSettings = () => ({
  clinicName: 'AM Associates',
  doctorName: 'Dr. Meraj Ahamed',
  qualification: 'MBBS',
  regNo: '',
  phone: '',
  email: '',
  address: '',
  timings: 'Mon – Sat: 10:00 AM – 1:00 PM & 5:00 PM – 9:00 PM',
  followupDays: 7,
  services: [
    { cat: 'Consultation', name: 'Doctor Consultation Fee', price: 300 },
    { cat: 'Consultation', name: 'Follow-up / Review Consultation', price: 150 },
    { cat: 'Consultation', name: 'Emergency / Night Consultation', price: 500 },
    { cat: 'X-Ray', name: 'X-Ray Chest PA View', price: 400 },
    { cat: 'X-Ray', name: 'X-Ray Knee AP & Lateral', price: 500 },
    { cat: 'X-Ray', name: 'X-Ray Lumbar Spine', price: 600 },
    { cat: 'X-Ray', name: 'X-Ray Hand / Wrist', price: 400 },
    { cat: 'Diagnostic', name: 'ECG', price: 250 },
    { cat: 'Diagnostic', name: 'Random Blood Sugar (RBS)', price: 80 },
    { cat: 'Diagnostic', name: 'Complete Blood Count (CBC)', price: 300 },
    { cat: 'Diagnostic', name: 'HbA1c', price: 450 },
    { cat: 'Diagnostic', name: 'Lipid Profile', price: 500 },
    { cat: 'Diagnostic', name: 'Liver Function Test (LFT)', price: 600 },
    { cat: 'Diagnostic', name: 'Kidney Function Test (KFT)', price: 600 },
    { cat: 'Diagnostic', name: 'Thyroid Profile', price: 500 },
    { cat: 'Diagnostic', name: 'Urine Routine', price: 150 },
    { cat: 'Procedure', name: 'Dressing', price: 150 },
    { cat: 'Procedure', name: 'Injection Charges', price: 100 },
    { cat: 'Procedure', name: 'Nebulization', price: 150 },
    { cat: 'Procedure', name: 'Suturing', price: 500 },
  ],
});
const emptyDB = () => ({ settings: defaultSettings(), patients: [], diagnostics: [], results: [], prescriptions: [], followups: [], bills: [], counters: { patient: 0, bill: 0 } });

let db = load();
function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return emptyDB();
    const d = JSON.parse(raw);
    const base = emptyDB();
    return { ...base, ...d, settings: { ...base.settings, ...(d.settings || {}) }, counters: { ...base.counters, ...(d.counters || {}) } };
  } catch (e) {
    console.error(e);
    return emptyDB();
  }
}
function save() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    localStorage.setItem(DB_KEY + '_lastsave', new Date().toISOString());
  } catch (e) {
    alert('Could not save data: ' + e.message + '\nPlease download a backup from Settings.');
  }
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

const P = (id) => db.patients.find((p) => p.id === id);
const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0);
const forPatient = (type, pid) => db[type].filter((r) => r.patientId === pid).sort(byDateDesc);
const billTotal = (b) => Math.max(0, (b.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0) - (Number(b.discount) || 0));
const patientLabel = (p) => (p ? `${p.name} · ${p.code}` : 'Unknown patient');
const phoneDigits = (ph) => { let d = String(ph || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; return d; };

/* ---------- number to words (Indian system) ---------- */
function inWords(num) {
  let n = Math.round(Number(num) || 0);
  if (n === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
  const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x));
  const parts = [];
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(three(cr) + ' Crore');
  if (lk) parts.push(two(lk) + ' Lakh');
  if (th) parts.push(two(th) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ') + ' Rupees Only';
}

/* ---------- toasts ---------- */
function toast(msg, actions) {
  const list = actions ? (Array.isArray(actions) ? actions : [actions]) : [];
  $$('#toasts .toast').forEach((x) => x.remove()); // one message at a time
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span>${esc(msg)}</span>`;
  list.forEach((a) => {
    const b = document.createElement('button');
    b.className = 'toast-btn';
    b.textContent = a.label;
    b.onclick = () => { t.remove(); a.fn(); };
    t.appendChild(b);
  });
  const x = document.createElement('button');
  x.className = 'toast-x';
  x.textContent = '✕';
  x.onclick = () => t.remove();
  t.appendChild(x);
  $('#toasts').appendChild(t);
  const life = list.length ? 9000 : 2800;
  setTimeout(() => t.classList.add('out'), life);
  setTimeout(() => t.remove(), life + 500);
}

/* ---------- form field builders ---------- */
function fld(label, name, value = '', o = {}) {
  const cls = `fld ${o.span ? 'span-' + o.span : ''}`;
  const req = o.required ? 'required' : '';
  const ph = o.ph ? `placeholder="${esc(o.ph)}"` : '';
  const list = o.list ? `list="${o.list}"` : '';
  let input;
  if (o.type === 'textarea') {
    input = `<textarea name="${name}" rows="${o.rows || 2}" ${ph} ${req}>${esc(value)}</textarea>`;
  } else if (o.type === 'select') {
    input = `<select name="${name}" ${req}>${(o.opts || []).map((op) => {
      const [v, l] = Array.isArray(op) ? op : [op, op];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;
  } else {
    const extra = o.type === 'number' ? `step="${o.step || 'any'}" min="${o.min ?? 0}"` : '';
    input = `<input type="${o.type || 'text'}" name="${name}" value="${esc(value)}" ${ph} ${req} ${list} ${extra} />`;
  }
  return `<label class="${cls}"><span>${esc(label)}</span>${input}${o.hint ? `<small>${o.hint}</small>` : ''}</label>`;
}

function patientSelect(pid) {
  const opts = [...db.patients].sort((a, b) => a.name.localeCompare(b.name)).map((p) => [p.id, `${p.name} — ${p.code}${p.phone ? ' — ' + p.phone : ''}`]);
  return fld('Patient *', 'patientId', pid || '', { type: 'select', opts: [['', '— Select patient —'], ...opts], required: true, span: 2 });
}

/* dynamic rows (medicines, test rows, bill items, services) */
const ROWDEFS = {
  meds: [
    { k: 'name', label: 'Medicine', ph: 'Tab. Paracetamol 650 mg', list: 'dl-meds', flex: 3 },
    { k: 'freq', label: 'Frequency', ph: '1-0-1', list: 'dl-freq', flex: 1.2 },
    { k: 'when', label: 'When', type: 'select', opts: WHEN, flex: 1.5 },
    { k: 'days', label: 'Days', ph: '5', flex: 0.8 },
  ],
  tests: [
    { k: 'name', label: 'Test', ph: 'Hemoglobin', list: 'dl-tests', flex: 2.4 },
    { k: 'value', label: 'Result', ph: '12.5', flex: 1.2 },
    { k: 'unit', label: 'Unit', ph: 'g/dL', flex: 1 },
    { k: 'range', label: 'Normal range', ph: '12 – 16', flex: 1.4 },
    { k: 'flag', label: 'Flag', type: 'select', opts: ['Normal', 'High', 'Low', 'Abnormal'], flex: 1.3 },
  ],
  items: [
    { k: 'desc', label: 'Description', ph: 'Doctor Consultation Fee', list: 'dl-services', flex: 3 },
    { k: 'qty', label: 'Qty', type: 'number', ph: '1', flex: 0.7 },
    { k: 'rate', label: 'Rate (₹)', type: 'number', ph: '300', flex: 1.1 },
  ],
  services: [
    { k: 'cat', label: 'Category', type: 'select', opts: Object.keys(BILL_TYPES), flex: 1.4 },
    { k: 'name', label: 'Service name', ph: 'X-Ray Chest PA', flex: 3 },
    { k: 'price', label: 'Price (₹)', type: 'number', ph: '400', flex: 1 },
  ],
};
function rowHTML(name, r = {}) {
  return `<div class="row-item">${ROWDEFS[name].map((f) => {
    const v = r[f.k] ?? '';
    let input;
    if (f.type === 'select') input = `<select data-k="${f.k}">${f.opts.map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else input = `<input data-k="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" placeholder="${esc(f.ph || '')}" ${f.list ? `list="${f.list}"` : ''} ${f.type === 'number' ? 'step="any" min="0"' : ''} />`;
    return `<div class="cell" style="flex:${f.flex || 1}"><em>${esc(f.label)}</em>${input}</div>`;
  }).join('')}<button type="button" class="icon-btn del-row" data-act="delrow" title="Remove">✕</button></div>`;
}
function rowsHTML(name, rows, addLabel = '+ Add row') {
  const list = rows && rows.length ? rows : [{}];
  return `<div class="rows" data-rows="${name}">
    <div class="rows-head">${ROWDEFS[name].map((f) => `<span style="flex:${f.flex || 1}">${esc(f.label)}</span>`).join('')}<span class="rh-x"></span></div>
    <div class="rows-body">${list.map((r) => rowHTML(name, r)).join('')}</div>
    <button type="button" class="btn btn-ghost btn-sm" data-act="addrow" data-name="${name}">${addLabel}</button>
  </div>`;
}
function readRows(form, name) {
  return $$(`[data-rows="${name}"] .row-item`, form)
    .map((row) => Object.fromEntries($$('[data-k]', row).map((i) => [i.dataset.k, i.value.trim()])))
    .filter((r) => ROWDEFS[name].some((f) => f.type !== 'select' && r[f.k]));
}

function renderDatalists() {
  const meds = new Set(COMMON_MEDS);
  db.prescriptions.forEach((rx) => (rx.meds || []).forEach((m) => m.name && meds.add(m.name)));
  const tests = new Set(COMMON_TESTS);
  db.results.forEach((r) => (r.tests || []).forEach((t) => t.name && tests.add(t.name)));
  const opt = (arr) => [...arr].map((v) => `<option value="${esc(v)}"></option>`).join('');
  $('#datalists').innerHTML = `
    <datalist id="dl-meds">${opt(meds)}</datalist>
    <datalist id="dl-freq">${opt(FREQS)}</datalist>
    <datalist id="dl-tests">${opt(tests)}</datalist>
    <datalist id="dl-services">${opt(db.settings.services.map((s) => s.name))}</datalist>`;
}

/* ---------- modal ---------- */
let modalSubmit = null;
function openModal({ title, color, body, onSubmit, submitLabel = 'Save', wide = false, onMount }) {
  $('#modal-title').innerHTML = title;
  $('#modal-head').style.background = color || STEP.patients.grad;
  $('#modal-body').innerHTML = body;
  $('#modal-submit').textContent = submitLabel;
  $('#modal-submit').style.background = color || '';
  $('#modal-box').classList.toggle('wide', wide);
  modalSubmit = onSubmit;
  $('#modal').classList.remove('hidden');
  document.body.classList.add('no-scroll');
  if (onMount) onMount($('#modal-form'));
  const first = $('#modal-body input:not([type=hidden]), #modal-body select, #modal-body textarea');
  if (first && window.innerWidth > 700) setTimeout(() => first.focus(), 50);
}
function closeModal() {
  $('#modal').classList.add('hidden');
  document.body.classList.remove('no-scroll');
  modalSubmit = null;
}
$('#modal-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!modalSubmit) return;
  const ok = modalSubmit(e.target);
  if (ok !== false) closeModal();
});

/* =========================================================
   FORMS for each step
   ========================================================= */
function openForm(type, id, pid) {
  if (type !== 'patients' && !db.patients.length) {
    toast('Please add a patient first');
    return openForm('patients');
  }
  renderDatalists();
  const s = STEP[type];
  const rec = id ? db[type].find((r) => r.id === id) : null;
  const r = rec || {};
  pid = r.patientId || pid || currentPatientId();
  const titleTxt = `${s.icon} ${rec ? 'Edit' : 'New'} ${s.singular} <small>Step ${s.n} of 6</small>`;
  const base = { title: titleTxt, color: s.grad, wide: ['prescriptions', 'results', 'bills', 'diagnostics'].includes(type) };
  const today = todayISO();

  if (type === 'patients') {
    openModal({
      ...base,
      body: `<div class="grid">
        ${fld('Full name *', 'name', r.name, { required: true, span: 2, ph: 'e.g. Mohammed Arif' })}
        ${fld('Age (years)', 'age', r.age, { type: 'number', ph: '35' })}
        ${fld('Gender', 'gender', r.gender || 'Male', { type: 'select', opts: ['Male', 'Female', 'Other'] })}
        ${fld('Mobile number', 'phone', r.phone, { type: 'tel', ph: '98765 43210' })}
        ${fld('Blood group', 'blood', r.blood || '', { type: 'select', opts: ['', 'A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] })}
        ${fld('Address', 'address', r.address, { type: 'textarea', span: 2, ph: 'House, area, city' })}
        ${fld('Allergies', 'allergies', r.allergies, { span: 2, ph: 'e.g. Penicillin, Sulfa drugs (leave blank if none)' })}
        ${fld('Medical history / chronic conditions', 'history', r.history, { type: 'textarea', span: 2, ph: 'e.g. Diabetes since 2019, Hypertension, Asthma…' })}
        ${fld('Notes', 'notes', r.notes, { type: 'textarea', span: 2 })}
      </div>`,
      onSubmit: (f) => {
        const d = Object.fromEntries(new FormData(f));
        if (rec) Object.assign(rec, d, { updatedAt: Date.now() });
        else {
          db.counters.patient += 1;
          const p = { id: uid(), code: 'AM-' + String(db.counters.patient).padStart(4, '0'), ...d, date: today, createdAt: Date.now() };
          db.patients.push(p);
          save();
          location.hash = '#/patient/' + p.id;
          toast(`${p.name} registered (${p.code})`, { label: 'Next: Diagnostics →', fn: () => openForm('diagnostics', null, p.id) });
          return;
        }
        save(); render(); toast('Patient details updated');
      },
    });
    return;
  }

  let body = '';
  let onMount;
  if (type === 'diagnostics') {
    const v = r.vitals || {};
    const advised = new Set(r.advised || []);
    const testChoices = db.settings.services.filter((x) => ['X-Ray', 'Diagnostic'].includes(x.cat)).map((x) => x.name);
    (r.advised || []).forEach((a) => !testChoices.includes(a) && testChoices.push(a));
    body = `<div class="grid">
      ${patientSelect(pid)}
      ${fld('Date', 'date', r.date || today, { type: 'date', required: true })}
      ${fld('Complaint duration', 'duration', r.duration, { ph: 'e.g. 3 days' })}
      ${fld('Chief complaints / symptoms', 'complaints', r.complaints, { type: 'textarea', span: 4, ph: 'Fever with chills, body ache, headache…', required: true })}
      <div class="span-4 sub-title">Vitals</div>
      ${fld('BP (mmHg)', 'bp', v.bp, { ph: '120/80' })}
      ${fld('Pulse (/min)', 'pulse', v.pulse, { ph: '78' })}
      ${fld('Temp (°F)', 'temp', v.temp, { ph: '98.6' })}
      ${fld('SpO₂ (%)', 'spo2', v.spo2, { ph: '98' })}
      ${fld('Weight (kg)', 'weight', v.weight, { ph: '65' })}
      ${fld('RBS (mg/dL)', 'rbs', v.rbs, { ph: '110' })}
      ${fld('Resp. rate (/min)', 'rr', v.rr, { ph: '16' })}
      ${fld('Height (cm)', 'height', v.height, { ph: '170' })}
      ${fld('Examination findings', 'exam', r.exam, { type: 'textarea', span: 4, ph: 'General exam, CVS, RS, P/A, CNS…' })}
      ${fld('Provisional diagnosis', 'diagnosis', r.diagnosis, { span: 4, ph: 'e.g. Acute febrile illness – ? Viral fever' })}
      <div class="span-4 sub-title">Investigations advised <small>(tap to select)</small></div>
      <div class="span-4 chips-pick">${testChoices.map((t) => `<label class="chip-pick"><input type="checkbox" name="advised" value="${esc(t)}" ${advised.has(t) ? 'checked' : ''}/><span>${esc(t)}</span></label>`).join('')}</div>
      ${fld('Other investigations', 'advisedOther', r.advisedOther, { span: 4, ph: 'e.g. USG Abdomen, Dengue NS1' })}
    </div>`;
  }

  if (type === 'results') {
    body = `<div class="grid">
      ${patientSelect(pid)}
      ${fld('Report date', 'date', r.date || today, { type: 'date', required: true })}
      ${fld('Report type', 'kind', r.kind || 'Blood Test', { type: 'select', opts: ['Blood Test', 'Urine Test', 'X-Ray', 'ECG', 'Ultrasound', 'Other'] })}
      ${fld('Report title', 'title', r.title, { span: 2, ph: 'e.g. CBC + Blood Sugar', required: true })}
      ${fld('Lab / Centre', 'lab', r.lab, { span: 2, ph: 'In-clinic / lab name' })}
      <div class="span-4 sub-title">Test values</div>
      <div class="span-4">${rowsHTML('tests', r.tests, '+ Add test')}</div>
      ${fld('Impression / doctor\'s remarks', 'remarks', r.remarks, { type: 'textarea', span: 4, ph: 'e.g. Hb low – iron deficiency anaemia. X-ray: no active lesion.' })}
    </div>`;
  }

  if (type === 'prescriptions') {
    let diag = r.diagnosis;
    if (!rec && pid) { const last = forPatient('diagnostics', pid)[0]; if (last) diag = last.diagnosis; }
    const fd = db.settings.followupDays || 7;
    body = `<div class="grid">
      ${patientSelect(pid)}
      ${fld('Date', 'date', r.date || today, { type: 'date', required: true })}
      ${fld('Diagnosis', 'diagnosis', diag, { span: 1, ph: 'Viral fever' })}
      <div class="span-4 sub-title">℞ Medicines</div>
      <div class="span-4">${rowsHTML('meds', r.meds, '+ Add medicine')}</div>
      ${fld('Advice / instructions', 'advice', r.advice, { type: 'textarea', span: 4, ph: 'Plenty of oral fluids, rest, light diet. Avoid oily food.' })}
      ${fld('Next visit (creates a follow-up)', 'nextVisit', r.nextVisit ?? (rec ? '' : addDays(today, fd)), { type: 'date', span: 2 })}
      <div class="span-2 quick-days"><span>Quick set:</span>${[3, 5, 7, 15, 30].map((d) => `<button type="button" class="btn btn-ghost btn-sm" data-act="quickdays" data-days="${d}">${d} days</button>`).join('')}<button type="button" class="btn btn-ghost btn-sm" data-act="quickdays" data-days="0">None</button></div>
    </div>`;
  }

  if (type === 'followups') {
    body = `<div class="grid">
      ${patientSelect(pid)}
      ${fld('Follow-up date', 'date', r.date || addDays(today, db.settings.followupDays || 7), { type: 'date', required: true })}
      ${fld('Status', 'status', r.status || 'Pending', { type: 'select', opts: ['Pending', 'Done', 'Missed'] })}
      ${fld('Reason', 'reason', r.reason, { span: 4, ph: 'Review with reports / BP check / dressing…', required: true })}
      ${fld('Notes', 'notes', r.notes, { type: 'textarea', span: 4 })}
    </div>`;
  }

  if (type === 'bills') {
    const btype = r.type || 'Consultation';
    let items = r.items;
    if (!rec) {
      const fee = db.settings.services.find((x) => x.cat === 'Consultation');
      items = fee ? [{ desc: fee.name, qty: 1, rate: fee.price }] : [{}];
    }
    body = `<div class="grid">
      ${patientSelect(pid)}
      ${fld('Bill date', 'date', r.date || today, { type: 'date', required: true })}
      ${fld('Bill type', 'type', btype, { type: 'select', opts: Object.keys(BILL_TYPES).map((k) => [k, `${BILL_TYPES[k].icon} ${k} Bill`]) })}
      <div class="span-4 sub-title">Quick add service <small>(prices editable in Settings)</small></div>
      <div class="span-4 svc-pick" id="svc-pick"></div>
      <div class="span-4">${rowsHTML('items', items, '+ Add item')}</div>
      ${fld('Discount (₹)', 'discount', r.discount || 0, { type: 'number' })}
      ${fld('Payment status', 'status', r.status || 'Paid', { type: 'select', opts: ['Paid', 'Pending'] })}
      ${fld('Payment mode', 'mode', r.mode || 'Cash', { type: 'select', opts: ['Cash', 'UPI', 'Card', 'Other'] })}
      <div class="bill-total-box"><span>Total</span><strong id="bill-total">₹0</strong></div>
      ${fld('Notes', 'notes', r.notes, { span: 4 })}
    </div>`;
    onMount = (form) => {
      const typeSel = $('[name=type]', form);
      const drawSvc = () => {
        const t = typeSel.value;
        const list = db.settings.services.filter((x) => x.cat === t);
        const other = db.settings.services.filter((x) => x.cat !== t);
        $('#svc-pick').innerHTML = [...list, ...other].map((x) => `<button type="button" class="svc ${x.cat === t ? 'on' : ''}" style="--c:${BILL_TYPES[x.cat]?.color || '#64748b'}" data-act="addsvc" data-name="${esc(x.name)}" data-price="${x.price}">${esc(x.name)} <b>${money(x.price)}</b></button>`).join('');
      };
      typeSel.addEventListener('change', drawSvc);
      drawSvc();
      form.addEventListener('input', updateBillTotal);
      updateBillTotal();
    };
  }

  openModal({
    ...base,
    body,
    onMount: (form) => {
      if (onMount) onMount(form);
    },
    onSubmit: (f) => saveRecord(type, rec, f),
  });
}

function updateBillTotal() {
  const f = $('#modal-form');
  const items = readRows(f, 'items');
  const sum = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const disc = Number($('[name=discount]', f)?.value) || 0;
  const el = $('#bill-total');
  if (el) el.textContent = money(Math.max(0, sum - disc));
}

function saveRecord(type, rec, f) {
  const fd = new FormData(f);
  const d = Object.fromEntries(fd);
  if (!d.patientId) { toast('Please select a patient'); return false; }
  let out = { patientId: d.patientId, date: d.date };

  if (type === 'diagnostics') {
    out = { ...out, complaints: d.complaints, duration: d.duration, exam: d.exam, diagnosis: d.diagnosis, advisedOther: d.advisedOther,
      advised: fd.getAll('advised'),
      vitals: { bp: d.bp, pulse: d.pulse, temp: d.temp, spo2: d.spo2, weight: d.weight, rbs: d.rbs, rr: d.rr, height: d.height } };
  }
  if (type === 'results') {
    out = { ...out, kind: d.kind, title: d.title, lab: d.lab, remarks: d.remarks, tests: readRows(f, 'tests') };
  }
  if (type === 'prescriptions') {
    const meds = readRows(f, 'meds');
    if (!meds.length) { toast('Add at least one medicine'); return false; }
    out = { ...out, diagnosis: d.diagnosis, advice: d.advice, nextVisit: d.nextVisit, meds };
  }
  if (type === 'followups') {
    out = { ...out, reason: d.reason, status: d.status, notes: d.notes };
    if (d.status === 'Done' && (!rec || rec.status !== 'Done')) out.doneOn = todayISO();
  }
  if (type === 'bills') {
    const items = readRows(f, 'items').map((i) => ({ ...i, qty: Number(i.qty) || 1, rate: Number(i.rate) || 0 }));
    if (!items.length) { toast('Add at least one bill item'); return false; }
    out = { ...out, type: d.type, items, discount: Number(d.discount) || 0, status: d.status, mode: d.mode, notes: d.notes };
  }

  let saved;
  if (rec) { Object.assign(rec, out, { updatedAt: Date.now() }); saved = rec; }
  else {
    saved = { id: uid(), ...out, createdAt: Date.now() };
    if (type === 'bills') {
      db.counters.bill += 1;
      saved.billNo = `AM/${new Date().getFullYear()}/${String(db.counters.bill).padStart(4, '0')}`;
    }
    db[type].push(saved);
  }

  // prescription "next visit" ⇒ linked follow-up
  if (type === 'prescriptions') {
    let fu = db.followups.find((x) => x.rxId === saved.id);
    if (saved.nextVisit) {
      const reason = `Review${saved.diagnosis ? ' – ' + saved.diagnosis : ''}`;
      if (fu) Object.assign(fu, { date: saved.nextVisit, patientId: saved.patientId });
      else db.followups.push({ id: uid(), rxId: saved.id, patientId: saved.patientId, date: saved.nextVisit, reason, status: 'Pending', createdAt: Date.now() });
    } else if (fu && fu.status === 'Pending') {
      db.followups = db.followups.filter((x) => x !== fu);
    }
  }

  save();
  render();
  const s = STEP[type];
  const next = STEPS[s.n]; // following step (n is 1-based)
  const pid = saved.patientId;
  const actions = [];
  if (type === 'prescriptions') actions.push({ label: '🖨 Print Rx', fn: () => printDoc('prescriptions', saved.id) }, { label: 'Next: Bill →', fn: () => openForm('bills', null, pid) });
  else if (type === 'bills') actions.push({ label: '🖨 Print Bill', fn: () => printDoc('bills', saved.id) });
  else if (next) actions.push({ label: `Next: ${next.short} →`, fn: () => openForm(next.key, null, pid) });
  toast(`${s.singular} ${rec ? 'updated' : 'saved'} ✓`, actions);
}

function deleteRecord(type, id) {
  const s = STEP[type];
  if (type === 'patients') {
    const p = P(id);
    if (!p || !confirm(`Delete ${p.name} (${p.code}) and ALL their records (diagnostics, results, prescriptions, follow-ups, bills)?\n\nThis cannot be undone.`)) return;
    ['diagnostics', 'results', 'prescriptions', 'followups', 'bills'].forEach((t) => { db[t] = db[t].filter((r) => r.patientId !== id); });
    db.patients = db.patients.filter((r) => r.id !== id);
    save();
    location.hash = '#/patients';
    toast('Patient deleted');
    return;
  }
  if (!confirm(`Delete this ${s.singular.toLowerCase()}?`)) return;
  db[type] = db[type].filter((r) => r.id !== id);
  if (type === 'prescriptions') db.followups = db.followups.filter((f) => !(f.rxId === id && f.status === 'Pending'));
  save(); render(); toast('Deleted');
}

/* =========================================================
   CARD renderers (one per step)
   ========================================================= */
function actionsHTML(type, r, extra = '') {
  return `<div class="card-actions">${extra}
    <button class="icon-btn" data-act="edit" data-type="${type}" data-id="${r.id}" title="Edit">✏️</button>
    <button class="icon-btn" data-act="del" data-type="${type}" data-id="${r.id}" title="Delete">🗑️</button></div>`;
}
function patientChip(pid, show) {
  if (!show) return '';
  const p = P(pid);
  return p ? `<a class="pchip" href="#/patient/${p.id}">👤 ${esc(p.name)} <small>${esc(p.code)}</small></a>` : '';
}
function vitalsHTML(v = {}) {
  const map = [['BP', v.bp, ''], ['Pulse', v.pulse, '/min'], ['Temp', v.temp, '°F'], ['SpO₂', v.spo2, '%'], ['Wt', v.weight, 'kg'], ['RBS', v.rbs, 'mg/dL'], ['RR', v.rr, '/min'], ['Ht', v.height, 'cm']];
  const items = map.filter((m) => m[1]);
  return items.length ? `<div class="vitals">${items.map(([k, val, u]) => `<span><b>${k}</b> ${esc(val)}${u}</span>`).join('')}</div>` : '';
}

const CARD = {
  diagnostics: (r, showP) => `
    <div class="rcard" style="--c:${STEP.diagnostics.color}">
      <div class="rcard-top"><span class="date-badge">📆 ${fmtDate(r.date)}</span>${patientChip(r.patientId, showP)}${actionsHTML('diagnostics', r)}</div>
      ${r.diagnosis ? `<h4>${esc(r.diagnosis)}</h4>` : ''}
      <p><b>Complaints:</b> ${esc(r.complaints)}${r.duration ? ` <em>(${esc(r.duration)})</em>` : ''}</p>
      ${vitalsHTML(r.vitals)}
      ${r.exam ? `<p><b>Examination:</b> ${nl2br(r.exam)}</p>` : ''}
      ${(r.advised || []).length || r.advisedOther ? `<div class="tags">🔬 ${[...(r.advised || []), ...(r.advisedOther ? [r.advisedOther] : [])].map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`,
  results: (r, showP) => `
    <div class="rcard" style="--c:${STEP.results.color}">
      <div class="rcard-top"><span class="date-badge">📆 ${fmtDate(r.date)}</span><span class="tag">${esc(r.kind)}</span>${patientChip(r.patientId, showP)}
      ${actionsHTML('results', r, `<button class="icon-btn" data-act="print" data-type="results" data-id="${r.id}" title="Print">🖨️</button>`)}</div>
      <h4>${esc(r.title)}${r.lab ? ` <small>· ${esc(r.lab)}</small>` : ''}</h4>
      ${(r.tests || []).length ? `<table class="mini"><tr><th>Test</th><th>Result</th><th>Range</th><th></th></tr>${r.tests.map((t) => `<tr><td>${esc(t.name)}</td><td><b>${esc(t.value)}</b> ${esc(t.unit)}</td><td>${esc(t.range)}</td><td><span class="flag flag-${esc((t.flag || 'Normal').toLowerCase())}">${esc(t.flag || 'Normal')}</span></td></tr>`).join('')}</table>` : ''}
      ${r.remarks ? `<p><b>Impression:</b> ${nl2br(r.remarks)}</p>` : ''}
    </div>`,
  prescriptions: (r, showP) => `
    <div class="rcard" style="--c:${STEP.prescriptions.color}">
      <div class="rcard-top"><span class="date-badge">📆 ${fmtDate(r.date)}</span>${patientChip(r.patientId, showP)}
      ${actionsHTML('prescriptions', r, `<button class="icon-btn" data-act="print" data-type="prescriptions" data-id="${r.id}" title="Print">🖨️</button>`)}</div>
      ${r.diagnosis ? `<h4>${esc(r.diagnosis)}</h4>` : ''}
      <ol class="meds">${(r.meds || []).map((m) => `<li><b>${esc(m.name)}</b> <span>${esc(m.freq)}</span> <span>${esc(m.when)}</span> ${m.days ? `<span>${esc(m.days)} days</span>` : ''}</li>`).join('')}</ol>
      ${r.advice ? `<p><b>Advice:</b> ${nl2br(r.advice)}</p>` : ''}
      ${r.nextVisit ? `<p class="next">📅 Next visit: <b>${fmtDate(r.nextVisit)}</b></p>` : ''}
    </div>`,
  followups: (r, showP) => {
    const t = todayISO();
    const p = P(r.patientId);
    let st = r.status;
    if (st === 'Pending' && r.date < t) st = 'Overdue';
    if (st === 'Pending' && r.date === t) st = 'Today';
    const wa = p && p.phone ? `<a class="icon-btn" target="_blank" rel="noopener" title="Send WhatsApp reminder" href="https://wa.me/${phoneDigits(p.phone)}?text=${encodeURIComponent(reminderText(r, p))}">💬</a>` : '';
    const call = p && p.phone ? `<a class="icon-btn" title="Call" href="tel:${esc(p.phone)}">📞</a>` : '';
    const done = r.status === 'Pending' ? `<button class="btn btn-sm btn-done" data-act="fu-done" data-id="${r.id}">✓ Done</button>` : '';
    return `
    <div class="rcard fu fu-${st.toLowerCase()}" style="--c:${STEP.followups.color}">
      <div class="rcard-top"><span class="date-badge">📆 ${fmtDate(r.date)}</span><span class="status st-${st.toLowerCase()}">${st}</span>${patientChip(r.patientId, showP)}
      ${actionsHTML('followups', r, done + wa + call)}</div>
      <h4>${esc(r.reason)}</h4>
      ${r.notes ? `<p>${nl2br(r.notes)}</p>` : ''}
    </div>`;
  },
  bills: (r, showP) => {
    const bt = BILL_TYPES[r.type] || BILL_TYPES.Other;
    return `
    <div class="rcard" style="--c:${bt.color}">
      <div class="rcard-top"><span class="date-badge">📆 ${fmtDate(r.date)}</span><span class="tag" style="background:${bt.color};color:#fff">${bt.icon} ${esc(r.type)}</span>
      <span class="status st-${r.status === 'Paid' ? 'done' : 'overdue'}">${esc(r.status)}${r.status === 'Paid' ? ' · ' + esc(r.mode) : ''}</span>${patientChip(r.patientId, showP)}
      ${actionsHTML('bills', r, `${r.status !== 'Paid' ? `<button class="btn btn-sm btn-done" data-act="bill-paid" data-id="${r.id}">Mark paid</button>` : ''}<button class="icon-btn" data-act="print" data-type="bills" data-id="${r.id}" title="Print">🖨️</button>`)}</div>
      <div class="bill-row"><div><small>${esc(r.billNo)}</small><div class="bill-items">${(r.items || []).map((i) => esc(i.desc)).join(', ')}</div></div><div class="bill-amt">${money(billTotal(r))}</div></div>
    </div>`;
  },
};

function reminderText(f, p) {
  const s = db.settings;
  return `Hello ${p.name}, this is a reminder from ${s.clinicName} (${s.doctorName}). Your follow-up visit is due on ${fmtDate(f.date)}${f.reason ? ' for: ' + f.reason : ''}. ${s.timings ? 'Clinic timings: ' + s.timings + '.' : ''} Thank you!`;
}

/* =========================================================
   PAGES
   ========================================================= */
function currentPatientId() {
  const m = location.hash.match(/^#\/patient\/([^/]+)/);
  return m ? m[1] : null;
}

function renderNav() {
  const page = (location.hash.slice(2).split('/')[0]) || 'dashboard';
  const counts = { patients: db.patients.length, followups: db.followups.filter((f) => f.status === 'Pending' && f.date <= todayISO()).length };
  $('#nav').innerHTML = `
    <a href="#/dashboard" class="nav-link ${page === 'dashboard' ? 'active' : ''}" style="--c:#f59e0b"><span class="nav-ico">🏠</span><span>Dashboard</span></a>
    <div class="nav-label">Patient journey</div>
    ${STEPS.map((s) => `<a href="#/${s.key}" class="nav-link ${page === s.key || (page === 'patient' && s.key === 'patients') ? 'active' : ''}" style="--c:${s.color}">
      <span class="nav-num" style="background:${s.color}">${STEP[s.key].n}</span><span class="nav-ico">${s.icon}</span><span>${s.label}</span>
      ${s.key === 'followups' && counts.followups ? `<b class="nav-badge">${counts.followups}</b>` : ''}</a>`).join('')}`;
  $$('.sidebar-foot .nav-link').forEach((a) => a.classList.toggle('active', page === 'settings'));
  $('#brand-name').textContent = db.settings.clinicName;
  $('#brand-sub').textContent = `${db.settings.doctorName}${db.settings.qualification ? ', ' + db.settings.qualification : ''}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
}

function pageDashboard() {
  const t = todayISO();
  const month = t.slice(0, 7);
  const paid = db.bills.filter((b) => b.status === 'Paid');
  const todayCollection = paid.filter((b) => b.date === t).reduce((s, b) => s + billTotal(b), 0);
  const monthCollection = paid.filter((b) => b.date.startsWith(month)).reduce((s, b) => s + billTotal(b), 0);
  const dues = db.bills.filter((b) => b.status !== 'Paid').reduce((s, b) => s + billTotal(b), 0);
  const seenToday = new Set(['diagnostics', 'results', 'prescriptions', 'bills'].flatMap((k) => db[k].filter((r) => r.date === t).map((r) => r.patientId)));
  db.patients.filter((p) => p.date === t).forEach((p) => seenToday.add(p.id));
  const fuToday = db.followups.filter((f) => f.status === 'Pending' && f.date === t);
  const fuOver = db.followups.filter((f) => f.status === 'Pending' && f.date < t).sort((a, b) => a.date.localeCompare(b.date));
  const fuUpcoming = db.followups.filter((f) => f.status === 'Pending' && f.date > t && f.date <= addDays(t, 7)).sort((a, b) => a.date.localeCompare(b.date));

  const byType = Object.keys(BILL_TYPES).map((k) => ({ k, v: paid.filter((b) => b.type === k && b.date.startsWith(month)).reduce((s, b) => s + billTotal(b), 0) }));
  const maxV = Math.max(1, ...byType.map((x) => x.v));

  // last 7 days collection
  const days = [...Array(7)].map((_, i) => addDays(t, i - 6));
  const dayVals = days.map((d) => paid.filter((b) => b.date === d).reduce((s, b) => s + billTotal(b), 0));
  const maxD = Math.max(1, ...dayVals);

  const recent = [...db.patients].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt)).slice(0, 6);

  const stat = (icon, label, val, grad, href) => `<a class="stat" href="${href}" style="background:${grad}"><span class="stat-ico">${icon}</span><div><div class="stat-val">${val}</div><div class="stat-lbl">${label}</div></div></a>`;

  return `
  <div class="hero">
    <div>
      <div class="hero-date">${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <h1>${greeting()}, ${esc(db.settings.doctorName)} 👋</h1>
      <p>Welcome to <b>${esc(db.settings.clinicName)}</b>. Here's your clinic at a glance.</p>
    </div>
    <div class="hero-actions">
      <button class="btn btn-white" data-act="add" data-type="patients">＋ New Patient</button>
      <button class="btn btn-white-o" data-act="add" data-type="bills">🧾 Quick Bill</button>
    </div>
  </div>

  <h2 class="sec-title">Patient journey <small>follow these steps for every visit</small></h2>
  <div class="journey">
    ${STEPS.map((s) => `<a class="jstep" href="#/${s.key}" style="--c:${s.color};background:${s.grad}">
      <span class="jnum">${STEP[s.key].n}</span><span class="jico">${s.icon}</span><span class="jlbl">${s.label}</span><span class="jcount">${db[s.key].length} records</span>
      <button class="jadd" data-act="add" data-type="${s.key}" title="Add ${s.singular}">＋</button></a>`).join('<span class="jarrow">➜</span>')}
  </div>

  <div class="stats">
    ${stat('👥', 'Total patients', db.patients.length, 'linear-gradient(135deg,#8b5cf6,#6366f1)', '#/patients')}
    ${stat('🩺', 'Patients seen today', seenToday.size, 'linear-gradient(135deg,#3b82f6,#06b6d4)', '#/diagnostics')}
    ${stat('💰', "Today's collection", money(todayCollection), 'linear-gradient(135deg,#22c55e,#14b8a6)', '#/bills')}
    ${stat('📈', 'This month', money(monthCollection), 'linear-gradient(135deg,#f59e0b,#ef4444)', '#/bills')}
    ${stat('⏳', 'Pending dues', money(dues), 'linear-gradient(135deg,#f43f5e,#be185d)', '#/bills?status=Pending')}
    ${stat('📅', 'Follow-ups today', fuToday.length + (fuOver.length ? ` <small>+${fuOver.length} overdue</small>` : ''), 'linear-gradient(135deg,#fb923c,#ea580c)', '#/followups')}
  </div>

  <div class="dash-grid">
    <div class="panel">
      <div class="panel-head" style="--c:${STEP.followups.color}"><h3>📅 Follow-ups to handle</h3><a href="#/followups">View all →</a></div>
      ${fuOver.length + fuToday.length + fuUpcoming.length === 0 ? empty('🎉', 'No follow-ups due. All caught up!') : ''}
      ${fuOver.length ? `<div class="mini-title red">Overdue (${fuOver.length})</div>${fuOver.slice(0, 5).map((f) => CARD.followups(f, true)).join('')}` : ''}
      ${fuToday.length ? `<div class="mini-title orange">Today (${fuToday.length})</div>${fuToday.map((f) => CARD.followups(f, true)).join('')}` : ''}
      ${fuUpcoming.length ? `<div class="mini-title blue">Next 7 days (${fuUpcoming.length})</div>${fuUpcoming.slice(0, 5).map((f) => CARD.followups(f, true)).join('')}` : ''}
    </div>
    <div class="panel-col">
      <div class="panel">
        <div class="panel-head" style="--c:${STEP.bills.color}"><h3>💰 Collection – last 7 days</h3><a href="#/bills">Bills →</a></div>
        <div class="vbars">${days.map((d, i) => `<div class="vbar"><div class="vbar-val">${dayVals[i] ? money(dayVals[i]) : ''}</div><div class="vbar-fill" style="height:${Math.max(3, (dayVals[i] / maxD) * 100)}%;background:${['#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#f59e0b', '#ef4444'][i]}"></div><div class="vbar-lbl">${d === t ? 'Today' : new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}</div></div>`).join('')}</div>
      </div>
      <div class="panel">
        <div class="panel-head" style="--c:#0284c7"><h3>📊 This month by bill type</h3></div>
        ${byType.map((x) => `<div class="hbar"><span class="hbar-lbl">${BILL_TYPES[x.k].icon} ${x.k}</span><div class="hbar-track"><div class="hbar-fill" style="width:${(x.v / maxV) * 100}%;background:${BILL_TYPES[x.k].color}"></div></div><b>${money(x.v)}</b></div>`).join('')}
      </div>
      <div class="panel">
        <div class="panel-head" style="--c:${STEP.patients.color}"><h3>👥 Recent patients</h3><a href="#/patients">All →</a></div>
        ${recent.length ? recent.map((p) => patientRow(p)).join('') : empty('👤', 'No patients yet. Click “New Patient” to start.')}
      </div>
    </div>
  </div>`;
}

function empty(icon, text) {
  return `<div class="empty"><div class="empty-ico">${icon}</div><p>${text}</p></div>`;
}

const AVATAR_COLORS = ['#8b5cf6', '#3b82f6', '#14b8a6', '#ec4899', '#f97316', '#22c55e', '#eab308', '#ef4444', '#06b6d4'];
function avatar(p, size = '') {
  const c = AVATAR_COLORS[(p.name || 'A').charCodeAt(0) % AVATAR_COLORS.length];
  const ini = (p.name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return `<span class="avatar ${size}" style="background:${c}">${esc(ini)}</span>`;
}
function lastVisit(pid) {
  const dates = ['diagnostics', 'prescriptions', 'bills', 'results'].flatMap((k) => db[k].filter((r) => r.patientId === pid).map((r) => r.date));
  return dates.sort().pop();
}
function patientRow(p) {
  const lv = lastVisit(p.id);
  return `<a class="prow" href="#/patient/${p.id}">${avatar(p)}<div class="prow-main"><b>${esc(p.name)}</b><small>${esc(p.code)} · ${esc(p.age || '?')}y ${esc((p.gender || '')[0] || '')}${p.phone ? ' · ' + esc(p.phone) : ''}</small></div><small class="prow-date">${lv ? 'Last visit ' + fmtDate(lv) : 'New'}</small></a>`;
}

function getQuery() {
  const q = location.hash.split('?')[1] || '';
  return Object.fromEntries(new URLSearchParams(q));
}

function pageHead(type, sub) {
  const s = STEP[type];
  return `<div class="page-head" style="background:${s.grad}">
    <div><div class="ph-step">Step ${s.n} of 6</div><h1>${s.icon} ${s.label}</h1><p>${sub}</p></div>
    <button class="btn btn-white" data-act="add" data-type="${type}">＋ Add ${s.singular}</button>
  </div>`;
}

function pagePatients() {
  const q = (getQuery().q || '').toLowerCase();
  let list = [...db.patients].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
  if (q) list = list.filter((p) => [p.name, p.phone, p.code, p.address].join(' ').toLowerCase().includes(q));
  return `${pageHead('patients', 'Register new patients and open their complete record.')}
  <div class="toolbar"><input class="tsearch" id="page-search" type="search" placeholder="🔍 Filter patients…" value="${esc(q)}" data-filter="patients" /><span class="count">${list.length} patient${list.length === 1 ? '' : 's'}</span></div>
  <div class="pgrid">${list.length ? list.map((p) => {
    const c = { d: forPatient('diagnostics', p.id).length, rx: forPatient('prescriptions', p.id).length, b: forPatient('bills', p.id).length };
    const lv = lastVisit(p.id);
    return `<a class="pcard" href="#/patient/${p.id}">
      <div class="pcard-top">${avatar(p, 'lg')}<div><b>${esc(p.name)}</b><small>${esc(p.code)}</small></div></div>
      <div class="pcard-info"><span>🎂 ${esc(p.age || '—')} yrs</span><span>⚧ ${esc(p.gender || '—')}</span>${p.blood ? `<span>🩸 ${esc(p.blood)}</span>` : ''}${p.phone ? `<span>📞 ${esc(p.phone)}</span>` : ''}</div>
      ${p.allergies ? `<div class="allergy">⚠️ Allergy: ${esc(p.allergies)}</div>` : ''}
      <div class="pcard-foot"><span style="--c:${STEP.diagnostics.color}">🩺 ${c.d}</span><span style="--c:${STEP.prescriptions.color}">💊 ${c.rx}</span><span style="--c:${STEP.bills.color}">🧾 ${c.b}</span><small>${lv ? 'Last: ' + fmtDate(lv) : 'Registered ' + fmtDate(p.date)}</small></div>
    </a>`;
  }).join('') : empty('👤', q ? 'No patient matches your search.' : 'No patients yet. Click “Add Patient” to register your first patient.')}</div>`;
}

function pageList(type) {
  const s = STEP[type];
  const qs = getQuery();
  const q = (qs.q || '').toLowerCase();
  const t = todayISO();
  let list = [...db[type]].sort(byDateDesc);
  if (q) list = list.filter((r) => (JSON.stringify(r) + ' ' + patientLabel(P(r.patientId))).toLowerCase().includes(q));
  let filters = '';
  let extraHead = '';

  if (type === 'bills') {
    const ft = qs.type || '';
    const fs = qs.status || '';
    if (ft) list = list.filter((b) => b.type === ft);
    if (fs) list = list.filter((b) => b.status === fs);
    const total = list.reduce((sum, b) => sum + billTotal(b), 0);
    filters = `<div class="filter-chips">${['', ...Object.keys(BILL_TYPES)].map((k) => `<button class="fchip ${ft === k ? 'on' : ''}" style="--c:${k ? BILL_TYPES[k].color : '#334155'}" data-act="filter" data-key="type" data-val="${k}">${k ? BILL_TYPES[k].icon + ' ' + k : 'All types'}</button>`).join('')}
      <span class="sep"></span>${['', 'Paid', 'Pending'].map((k) => `<button class="fchip ${fs === k ? 'on' : ''}" style="--c:${k === 'Pending' ? '#e11d48' : k === 'Paid' ? '#16a34a' : '#334155'}" data-act="filter" data-key="status" data-val="${k}">${k || 'Any status'}</button>`).join('')}</div>`;
    extraHead = `<div class="sum-strip">Showing <b>${list.length}</b> bills · Total <b>${money(total)}</b></div>`;
  }
  if (type === 'followups') {
    const fs = qs.status || 'Due';
    const groups = {
      Due: (f) => f.status === 'Pending' && f.date <= t,
      Upcoming: (f) => f.status === 'Pending' && f.date > t,
      Done: (f) => f.status === 'Done',
      Missed: (f) => f.status === 'Missed',
      All: () => true,
    };
    list = list.filter(groups[fs] || groups.All);
    if (fs === 'Due' || fs === 'Upcoming') list.sort((a, b) => a.date.localeCompare(b.date));
    filters = `<div class="filter-chips">${Object.keys(groups).map((k) => `<button class="fchip ${fs === k ? 'on' : ''}" style="--c:${STEP.followups.color}" data-act="filter" data-key="status" data-val="${k}">${{ Due: '🔥 Due / overdue', Upcoming: '⏭ Upcoming', Done: '✅ Done', Missed: '❌ Missed', All: 'All' }[k]} (${db.followups.filter(groups[k]).length})</button>`).join('')}</div>`;
  }
  const subs = {
    diagnostics: 'Record complaints, vitals, examination and the investigations you advise.',
    results: 'Enter lab, X-ray & ECG results. Abnormal values are highlighted.',
    prescriptions: 'Write prescriptions and print them on your letterhead.',
    followups: 'Never miss a review – send WhatsApp reminders with one tap.',
    bills: 'Consultation, X-Ray, Diagnostic & procedure bills with printable receipts.',
  };
  return `${pageHead(type, subs[type])}
  <div class="toolbar"><input class="tsearch" type="search" placeholder="🔍 Search ${s.short.toLowerCase()} or patient…" value="${esc(q)}" data-filter="${type}" />${filters}</div>
  ${extraHead}
  <div class="cards">${list.length ? list.map((r) => CARD[type](r, true)).join('') : empty(s.icon, `No ${s.short.toLowerCase()} here yet.`)}</div>`;
}

let patientTab = 'timeline';
function pagePatient(id) {
  const p = P(id);
  if (!p) return empty('🤷', 'Patient not found. <a href="#/patients">Back to patients</a>');
  const tab = getQuery().tab || patientTab;
  patientTab = tab;
  const counts = Object.fromEntries(STEPS.map((s) => [s.key, s.key === 'patients' ? 1 : forPatient(s.key, id).length]));
  const dues = forPatient('bills', id).filter((b) => b.status !== 'Paid').reduce((s, b) => s + billTotal(b), 0);
  const totalPaid = forPatient('bills', id).filter((b) => b.status === 'Paid').reduce((s, b) => s + billTotal(b), 0);
  const nextFu = forPatient('followups', id).filter((f) => f.status === 'Pending').sort((a, b) => a.date.localeCompare(b.date))[0];

  let content = '';
  if (tab === 'timeline') {
    const all = ['diagnostics', 'results', 'prescriptions', 'followups', 'bills'].flatMap((k) => forPatient(k, id).map((r) => ({ k, r })));
    all.sort((a, b) => byDateDesc(a.r, b.r));
    const groups = {};
    all.forEach((x) => { (groups[x.r.date] = groups[x.r.date] || []).push(x); });
    content = all.length
      ? Object.keys(groups).sort().reverse().map((d) => `<div class="tl-day"><div class="tl-date">${fmtDate(d)}</div><div class="tl-items">${groups[d].sort((a, b) => STEP[a.k].n - STEP[b.k].n).map((x) => `<div class="tl-item"><span class="tl-dot" style="background:${STEP[x.k].color}">${STEP[x.k].icon}</span>${CARD[x.k](x.r, false)}</div>`).join('')}</div></div>`).join('')
      : empty('🩺', 'No visits recorded yet. Start with <b>Step 2 – Diagnostics</b>.');
  } else if (tab === 'patients') {
    content = `<div class="details">
      ${[['Patient ID', p.code], ['Name', p.name], ['Age', p.age ? p.age + ' years' : ''], ['Gender', p.gender], ['Mobile', p.phone], ['Blood group', p.blood], ['Address', p.address], ['Allergies', p.allergies], ['Medical history', p.history], ['Notes', p.notes], ['Registered on', fmtDate(p.date)]]
        .map(([k, v]) => `<div class="drow"><span>${k}</span><b>${v ? nl2br(v) : '—'}</b></div>`).join('')}
      <div class="details-actions"><button class="btn btn-primary" data-act="edit" data-type="patients" data-id="${p.id}">✏️ Edit details</button>
      <button class="btn btn-light" data-act="print-summary" data-id="${p.id}">🖨 Print case summary</button>
      <button class="btn btn-danger" data-act="del" data-type="patients" data-id="${p.id}">🗑 Delete patient</button></div>
    </div>`;
  } else {
    const list = forPatient(tab, id);
    content = `<div class="tab-head"><button class="btn" style="background:${STEP[tab].grad};color:#fff" data-act="add" data-type="${tab}" data-pid="${id}">＋ Add ${STEP[tab].singular}</button></div>
      <div class="cards">${list.length ? list.map((r) => CARD[tab](r, false)).join('') : empty(STEP[tab].icon, `No ${STEP[tab].short.toLowerCase()} for ${esc(p.name)} yet.`)}</div>`;
  }

  return `
  <a href="#/patients" class="back">← All patients</a>
  <div class="phero">
    ${avatar(p, 'xl')}
    <div class="phero-main">
      <h1>${esc(p.name)} <span class="code">${esc(p.code)}</span></h1>
      <div class="phero-info"><span>🎂 ${esc(p.age || '—')} yrs</span><span>⚧ ${esc(p.gender || '—')}</span>${p.blood ? `<span>🩸 ${esc(p.blood)}</span>` : ''}${p.phone ? `<span>📞 ${esc(p.phone)}</span>` : ''}</div>
      ${p.allergies ? `<div class="allergy">⚠️ Allergy: ${esc(p.allergies)}</div>` : ''}
      ${p.history ? `<div class="hist">🩹 ${esc(p.history)}</div>` : ''}
    </div>
    <div class="phero-side">
      ${p.phone ? `<a class="btn btn-white btn-sm" href="tel:${esc(p.phone)}">📞 Call</a><a class="btn btn-white btn-sm" target="_blank" rel="noopener" href="https://wa.me/${phoneDigits(p.phone)}">💬 WhatsApp</a>` : ''}
      <div class="mini-stat">Paid: <b>${money(totalPaid)}</b></div>
      ${dues ? `<div class="mini-stat due">Due: <b>${money(dues)}</b></div>` : ''}
      ${nextFu ? `<div class="mini-stat">Next follow-up: <b>${fmtDate(nextFu.date)}</b></div>` : ''}
    </div>
  </div>

  <div class="stepper">
    <a class="st ${tab === 'timeline' ? 'on' : ''}" href="#/patient/${id}?tab=timeline" style="--c:#334155"><span class="st-n">★</span><span class="st-l">Full timeline</span></a>
    ${STEPS.map((s) => `<a class="st ${tab === s.key ? 'on' : ''} ${counts[s.key] ? 'has' : ''}" href="#/patient/${id}?tab=${s.key}" style="--c:${s.color}">
      <span class="st-n">${STEP[s.key].n}</span><span class="st-l">${s.icon} ${s.short === 'Patients' ? 'Details' : s.short}</span>${s.key !== 'patients' ? `<span class="st-c">${counts[s.key]}</span>` : ''}</a>`).join('')}
  </div>
  <div class="new-visit">
    <span>New visit? Go step by step →</span>
    ${STEPS.slice(1).map((s) => `<button class="btn btn-sm" style="background:${s.grad};color:#fff" data-act="add" data-type="${s.key}" data-pid="${id}">${STEP[s.key].n}. ${s.icon} ${s.short}</button>`).join('')}
  </div>
  <div class="tab-content">${content}</div>`;
}

function pageSettings() {
  const s = db.settings;
  const last = localStorage.getItem(DB_KEY + '_lastbackup');
  const size = (new Blob([JSON.stringify(db)]).size / 1024).toFixed(1);
  return `<div class="page-head" style="background:linear-gradient(135deg,#475569,#1e293b)"><div><h1>⚙️ Settings &amp; Backup</h1><p>Clinic letterhead details, service price list and data backup.</p></div></div>
  <div class="settings">
    <form class="panel" id="settings-form">
      <div class="panel-head" style="--c:#7c3aed"><h3>🏥 Clinic & letterhead</h3></div>
      <div class="grid">
        ${fld('Clinic name', 'clinicName', s.clinicName, { span: 2 })}
        ${fld('Doctor name', 'doctorName', s.doctorName)}
        ${fld('Qualification', 'qualification', s.qualification)}
        ${fld('Registration no.', 'regNo', s.regNo, { ph: 'Medical council reg. no.' })}
        ${fld('Clinic phone', 'phone', s.phone)}
        ${fld('Email', 'email', s.email, { span: 2 })}
        ${fld('Address', 'address', s.address, { type: 'textarea', span: 4 })}
        ${fld('Clinic timings', 'timings', s.timings, { span: 3 })}
        ${fld('Default follow-up (days)', 'followupDays', s.followupDays, { type: 'number' })}
      </div>
      <div class="panel-head" style="--c:#16a34a;margin-top:18px"><h3>💲 Services & price list</h3><small>Used for quick-add in bills</small></div>
      ${rowsHTML('services', s.services, '+ Add service')}
      <div class="details-actions"><button type="submit" class="btn btn-primary">💾 Save settings</button></div>
    </form>
    <div class="panel">
      <div class="panel-head" style="--c:#0284c7"><h3>🛟 Backup & restore</h3></div>
      <p class="note">All data is saved <b>only in this browser on this device</b> (${size} KB used). Download a backup regularly (e.g. weekly) and keep it in Google Drive / email, so nothing is lost if the browser data is cleared or you change phone/computer.</p>
      <p class="note">Last backup: <b>${last ? new Date(last).toLocaleString('en-IN') : 'never'}</b></p>
      <div class="details-actions">
        <button class="btn btn-primary" data-act="backup">⬇️ Download backup</button>
        <label class="btn btn-light">⬆️ Restore from backup<input type="file" id="restore-file" accept=".json,application/json" hidden /></label>
        <button class="btn btn-light" data-act="export-csv">📄 Export bills (CSV)</button>
        <button class="btn btn-danger" data-act="reset">⚠️ Erase all data</button>
      </div>
    </div>
  </div>`;
}

/* =========================================================
   PRINTING (prescription / bill / result / case summary)
   ========================================================= */
function letterhead(color) {
  const s = db.settings;
  return `<div class="lh" style="--c:${color}">
    <div class="lh-left"><div class="lh-logo">AM</div><div><div class="lh-clinic">${esc(s.clinicName)}</div><div class="lh-doc">${esc(s.doctorName)}${s.qualification ? ', ' + esc(s.qualification) : ''}</div>${s.regNo ? `<div class="lh-small">Reg. No: ${esc(s.regNo)}</div>` : ''}</div></div>
    <div class="lh-right">${s.address ? `<div>${nl2br(s.address)}</div>` : ''}${s.phone ? `<div>📞 ${esc(s.phone)}</div>` : ''}${s.email ? `<div>✉️ ${esc(s.email)}</div>` : ''}${s.timings ? `<div class="lh-small">${esc(s.timings)}</div>` : ''}</div>
  </div>`;
}
function patientStrip(p, date, extra = '') {
  return `<div class="pstrip"><div><span>Patient</span><b>${esc(p.name)}</b></div><div><span>Age / Sex</span><b>${esc(p.age || '—')} / ${esc(p.gender || '—')}</b></div><div><span>Patient ID</span><b>${esc(p.code)}</b></div><div><span>Date</span><b>${fmtDate(date)}</b></div>${extra}</div>`;
}
function signature() {
  const s = db.settings;
  return `<div class="sign"><div class="sign-line"></div><b>${esc(s.doctorName)}</b><small>${esc(s.qualification)}${s.regNo ? ' · Reg. ' + esc(s.regNo) : ''}</small></div>`;
}

function printDoc(type, id) {
  const r = db[type].find((x) => x.id === id);
  if (!r) return;
  const p = P(r.patientId) || { name: 'Unknown', code: '' };
  let html = '';
  if (type === 'prescriptions') {
    const dx = db.diagnostics.find((d) => d.patientId === r.patientId && d.date === r.date);
    html = `${letterhead(STEP.prescriptions.color)}${patientStrip(p, r.date)}
      ${p.allergies ? `<div class="pr-allergy">⚠️ Allergies: ${esc(p.allergies)}</div>` : ''}
      ${dx ? `<div class="pr-block"><b>Complaints:</b> ${esc(dx.complaints)}</div>${vitalsHTML(dx.vitals)}` : ''}
      ${r.diagnosis ? `<div class="pr-block"><b>Diagnosis:</b> ${esc(r.diagnosis)}</div>` : ''}
      <div class="rx-symbol">℞</div>
      <table class="ptable"><thead><tr><th>#</th><th>Medicine</th><th>Frequency</th><th>When</th><th>Duration</th></tr></thead>
      <tbody>${r.meds.map((m, i) => `<tr><td>${i + 1}</td><td><b>${esc(m.name)}</b></td><td>${esc(m.freq)}</td><td>${esc(m.when)}</td><td>${m.days ? esc(m.days) + ' days' : ''}</td></tr>`).join('')}</tbody></table>
      ${dx && ((dx.advised || []).length || dx.advisedOther) ? `<div class="pr-block"><b>Investigations advised:</b> ${esc([...(dx.advised || []), ...(dx.advisedOther ? [dx.advisedOther] : [])].join(', '))}</div>` : ''}
      ${r.advice ? `<div class="pr-block"><b>Advice:</b><br>${nl2br(r.advice)}</div>` : ''}
      ${r.nextVisit ? `<div class="pr-next">📅 Next visit: <b>${fmtDate(r.nextVisit)}</b></div>` : ''}
      ${signature()}`;
  }
  if (type === 'bills') {
    const bt = BILL_TYPES[r.type] || BILL_TYPES.Other;
    const sub = (r.items || []).reduce((s, i) => s + i.qty * i.rate, 0);
    html = `${letterhead(bt.color)}
      <div class="bill-title" style="background:${bt.color}">${esc(r.type).toUpperCase()} BILL / RECEIPT</div>
      ${patientStrip(p, r.date, `<div><span>Bill No.</span><b>${esc(r.billNo)}</b></div>`)}
      <table class="ptable"><thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
      <tbody>${r.items.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.desc)}</td><td class="r">${i.qty}</td><td class="r">${money(i.rate)}</td><td class="r">${money(i.qty * i.rate)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4" class="r">Sub-total</td><td class="r">${money(sub)}</td></tr>
      ${r.discount ? `<tr><td colspan="4" class="r">Discount</td><td class="r">− ${money(r.discount)}</td></tr>` : ''}
      <tr class="grand"><td colspan="4" class="r">TOTAL</td><td class="r">${money(billTotal(r))}</td></tr></tfoot></table>
      <div class="words">Amount in words: <b>${inWords(billTotal(r))}</b></div>
      <div class="paystat ${r.status === 'Paid' ? 'paid' : 'due'}">${r.status === 'Paid' ? `✔ PAID by ${esc(r.mode)}` : '⏳ PAYMENT PENDING'}</div>
      ${r.notes ? `<div class="pr-block">Note: ${esc(r.notes)}</div>` : ''}
      ${signature()}
      <div class="thanks">Thank you! Get well soon 🌼</div>`;
  }
  if (type === 'results') {
    html = `${letterhead(STEP.results.color)}
      <div class="bill-title" style="background:${STEP.results.color}">${esc(r.kind).toUpperCase()} REPORT – ${esc(r.title)}</div>
      ${patientStrip(p, r.date, r.lab ? `<div><span>Lab</span><b>${esc(r.lab)}</b></div>` : '')}
      ${(r.tests || []).length ? `<table class="ptable"><thead><tr><th>Test</th><th>Result</th><th>Unit</th><th>Normal range</th><th>Flag</th></tr></thead>
      <tbody>${r.tests.map((t) => `<tr class="${t.flag && t.flag !== 'Normal' ? 'abn' : ''}"><td>${esc(t.name)}</td><td><b>${esc(t.value)}</b></td><td>${esc(t.unit)}</td><td>${esc(t.range)}</td><td>${esc(t.flag)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${r.remarks ? `<div class="pr-block"><b>Impression:</b><br>${nl2br(r.remarks)}</div>` : ''}
      ${signature()}`;
  }
  doPrint(html);
}

function printSummary(pid) {
  const p = P(pid);
  const sec = (k, f) => { const l = forPatient(k, pid); return l.length ? `<h3 class="ps-h" style="color:${STEP[k].color}">${STEP[k].icon} ${STEP[k].label}</h3>${l.map(f).join('')}` : ''; };
  const html = `${letterhead(STEP.patients.color)}
    <div class="bill-title" style="background:${STEP.patients.color}">PATIENT CASE SUMMARY</div>
    ${patientStrip(p, todayISO(), `<div><span>Mobile</span><b>${esc(p.phone || '—')}</b></div>`)}
    ${p.allergies ? `<div class="pr-allergy">⚠️ Allergies: ${esc(p.allergies)}</div>` : ''}
    ${p.history ? `<div class="pr-block"><b>History:</b> ${esc(p.history)}</div>` : ''}
    ${sec('diagnostics', (d) => `<div class="ps-item"><b>${fmtDate(d.date)}</b> – ${esc(d.complaints)}${d.diagnosis ? ` → <i>${esc(d.diagnosis)}</i>` : ''}${vitalsHTML(d.vitals)}</div>`)}
    ${sec('results', (r) => `<div class="ps-item"><b>${fmtDate(r.date)}</b> – ${esc(r.title)}: ${(r.tests || []).map((t) => `${esc(t.name)} ${esc(t.value)}${esc(t.unit)}${t.flag && t.flag !== 'Normal' ? ` (${esc(t.flag)})` : ''}`).join(', ')} ${r.remarks ? '– ' + esc(r.remarks) : ''}</div>`)}
    ${sec('prescriptions', (r) => `<div class="ps-item"><b>${fmtDate(r.date)}</b> – ${esc(r.diagnosis || '')}: ${(r.meds || []).map((m) => `${esc(m.name)} ${esc(m.freq)} × ${esc(m.days || '?')}d`).join('; ')}</div>`)}
    ${signature()}`;
  doPrint(html);
}

function doPrint(html) {
  $('#print-area').innerHTML = `<div class="paper">${html}</div>`;
  document.body.classList.add('printing');
  setTimeout(() => {
    window.print();
    setTimeout(() => document.body.classList.remove('printing'), 300);
  }, 100);
}
window.addEventListener('afterprint', () => document.body.classList.remove('printing'));

/* =========================================================
   BACKUP
   ========================================================= */
function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function backup() {
  download(`AM-Associates-backup-${todayISO()}.json`, JSON.stringify(db, null, 2), 'application/json');
  localStorage.setItem(DB_KEY + '_lastbackup', new Date().toISOString());
  render();
  toast('Backup downloaded ✓');
}
function exportCSV() {
  const rows = [['Bill No', 'Date', 'Patient', 'Patient ID', 'Type', 'Items', 'Discount', 'Total', 'Status', 'Mode']];
  [...db.bills].sort(byDateDesc).forEach((b) => {
    const p = P(b.patientId) || {};
    rows.push([b.billNo, b.date, p.name, p.code, b.type, (b.items || []).map((i) => `${i.desc} x${i.qty} @${i.rate}`).join(' | '), b.discount || 0, billTotal(b), b.status, b.mode]);
  });
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  download(`AM-Associates-bills-${todayISO()}.csv`, '﻿' + csv, 'text/csv');
}
function restore(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (!d || !Array.isArray(d.patients)) throw new Error('Not a valid AM Associates backup file');
      if (!confirm(`Restore backup with ${d.patients.length} patients?\nThis will REPLACE the current data on this device.`)) return;
      localStorage.setItem(DB_KEY, JSON.stringify(d));
      db = load();
      save();
      render();
      toast('Backup restored ✓');
    } catch (e) {
      alert('Could not restore: ' + e.message);
    }
  };
  fr.readAsText(file);
}

/* =========================================================
   EVENTS
   ========================================================= */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, type, id } = el.dataset;
  if (el.tagName === 'BUTTON' || act !== 'add') e.preventDefault();
  if (el.closest('a') && el.tagName === 'BUTTON') e.stopPropagation();
  switch (act) {
    case 'add': e.preventDefault(); openForm(type, null, el.dataset.pid || currentPatientId()); break;
    case 'edit': openForm(type, id); break;
    case 'del': deleteRecord(type, id); break;
    case 'print': printDoc(type, id); break;
    case 'print-summary': printSummary(id); break;
    case 'close-modal': closeModal(); break;
    case 'addrow': {
      const body = $(`[data-rows="${el.dataset.name}"] .rows-body`, el.closest('form'));
      body.insertAdjacentHTML('beforeend', rowHTML(el.dataset.name));
      $('.row-item:last-child input', body)?.focus();
      break;
    }
    case 'delrow': {
      const body = el.closest('.rows-body');
      el.closest('.row-item').remove();
      if (!body.children.length) body.insertAdjacentHTML('beforeend', rowHTML(body.parentElement.dataset.rows));
      updateBillTotal();
      break;
    }
    case 'addsvc': {
      const body = $('[data-rows="items"] .rows-body');
      const emptyRow = $$('.row-item', body).find((r) => !$('[data-k=desc]', r).value.trim());
      const row = emptyRow || (body.insertAdjacentHTML('beforeend', rowHTML('items')), body.lastElementChild);
      $('[data-k=desc]', row).value = el.dataset.name;
      $('[data-k=qty]', row).value = 1;
      $('[data-k=rate]', row).value = el.dataset.price;
      updateBillTotal();
      break;
    }
    case 'quickdays': {
      const n = Number(el.dataset.days);
      const dateVal = $('#modal-form [name=date]').value || todayISO();
      $('#modal-form [name=nextVisit]').value = n ? addDays(dateVal, n) : '';
      break;
    }
    case 'fu-done': {
      const f = db.followups.find((x) => x.id === id);
      if (f) { f.status = 'Done'; f.doneOn = todayISO(); save(); render(); toast('Follow-up marked done ✓', { label: 'Start visit →', fn: () => openForm('diagnostics', null, f.patientId) }); }
      break;
    }
    case 'bill-paid': {
      const b = db.bills.find((x) => x.id === id);
      if (b) { b.status = 'Paid'; save(); render(); toast('Bill marked as paid ✓'); }
      break;
    }
    case 'filter': {
      const [path, qstr] = location.hash.split('?');
      const qs = new URLSearchParams(qstr || '');
      if (el.dataset.val) qs.set(el.dataset.key, el.dataset.val); else qs.delete(el.dataset.key);
      location.hash = path + (qs.toString() ? '?' + qs : '');
      break;
    }
    case 'backup': backup(); break;
    case 'export-csv': exportCSV(); break;
    case 'reset':
      if (confirm('Erase ALL clinic data on this device? Download a backup first!') && prompt('Type ERASE to confirm') === 'ERASE') {
        db = emptyDB(); save(); render(); toast('All data erased');
      }
      break;
    default: break;
  }
});

// close modal on backdrop / Esc
$('#modal').addEventListener('mousedown', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#modal').classList.contains('hidden')) closeModal(); });

// per-page search (debounced, keeps focus)
let searchTimer;
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches('.tsearch')) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    const [path, qstr] = location.hash.split('?');
    const qs = new URLSearchParams(qstr || '');
    if (el.value) qs.set('q', el.value); else qs.delete('q');
    history.replaceState(null, '', path + (qs.toString() ? '?' + qs : ''));
    render();
    const again = $('.tsearch');
    if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
  }, 200);
});

// global search
$('#global-search').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = $('#global-q').value.trim();
  const matches = db.patients.filter((p) => [p.name, p.phone, p.code].join(' ').toLowerCase().includes(q.toLowerCase()));
  if (matches.length === 1) location.hash = '#/patient/' + matches[0].id;
  else location.hash = '#/patients' + (q ? '?q=' + encodeURIComponent(q) : '');
  $('#global-q').value = '';
  $('#global-q').blur();
});

// settings save + restore
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'settings-form') return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(e.target));
  const services = readRows(e.target, 'services').map((x) => ({ ...x, price: Number(x.price) || 0 }));
  db.settings = { ...db.settings, ...d, followupDays: Number(d.followupDays) || 7, services };
  save(); render(); toast('Settings saved ✓');
});
document.addEventListener('change', (e) => { if (e.target.id === 'restore-file' && e.target.files[0]) restore(e.target.files[0]); });

// mobile menu
const toggleMenu = (open) => { $('#sidebar').classList.toggle('open', open); $('#backdrop').classList.toggle('show', open); };
$('#menu-btn').addEventListener('click', () => toggleMenu(true));
$('#backdrop').addEventListener('click', () => toggleMenu(false));

// keep tabs in sync if the clinic is open in two tabs
window.addEventListener('storage', (e) => { if (e.key === DB_KEY) { db = load(); render(); } });

/* =========================================================
   ROUTER
   ========================================================= */
function render() {
  const [path] = location.hash.slice(2).split('?');
  const [page, id] = path.split('/');
  let html;
  switch (page || 'dashboard') {
    case 'dashboard': html = pageDashboard(); break;
    case 'patients': html = pagePatients(); break;
    case 'patient': html = pagePatient(id); break;
    case 'settings': html = pageSettings(); break;
    default: html = STEP[page] ? pageList(page) : pageDashboard();
  }
  $('#view').innerHTML = html;
  renderNav();
}
let lastPath = '';
window.addEventListener('hashchange', () => {
  const path = location.hash.split('?')[0];
  if (path !== lastPath) { window.scrollTo(0, 0); lastPath = path; }
  toggleMenu(false);
  render();
});
if (!location.hash) history.replaceState(null, '', '#/dashboard');
lastPath = location.hash.split('?')[0];
render();
