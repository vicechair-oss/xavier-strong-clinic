/* Xavier Strong Baseball Clinic - registration front end
   ------------------------------------------------------
   EDIT THIS BLOCK. Nothing else needs changing to switch payment paths. */
const CONFIG = {
  // 'venmo-handoff' = parent pays in the Venmo app, staff reconciles by reference (no PayPal account needed)
  // 'paypal-venmo'  = Venmo button on the page, payment captured and recorded automatically
  paymentMode: 'venmo-handoff',

  // Exact Venmo username, no @. Business profiles use venmo.com/<name>;
  // personal profiles use venmo.com/u/<name>. If the link 404s, see venmoPath below.
  venmoHandle: 'allthings6',
  venmoPath: '',                       // set to 'u/' only if venmo.com/<name> does not resolve
  paypalClientId: '',                  // required only for 'paypal-venmo'
  fee: 20,
};
/* --------------------------------------------------------------------- */

const TOTAL_STEPS = 5;
let step = 1;
let reference = '';

const $ = (id) => document.getElementById(id);
const val = (id) => ($(id)?.value || '').trim();

function show(n) {
  document.querySelectorAll('.step').forEach((el) => el.classList.remove('active'));
  $('s' + n)?.classList.add('active');
  const capped = Math.min(n, TOTAL_STEPS);
  $('fill').style.width = (capped / TOTAL_STEPS * 100) + '%';
  document.querySelectorAll('.progress-steps span').forEach((s) => {
    s.classList.toggle('on', Number(s.dataset.s) <= capped);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------------------------------------ validation */

const REQUIRED = {
  1: ['gName', 'gEmail', 'gPhone'],
  2: ['pName', 'pDob', 'pShirt'],
  3: ['eName', 'ePhone'],
};

function validate(n) {
  let ok = true;
  (REQUIRED[n] || []).forEach((id) => {
    const el = $(id);
    const err = $('e-' + id);
    const empty = !el.value.trim();
    if (empty) ok = false;
    err?.classList.toggle('show', empty);
    el.classList.toggle('bad', empty);
  });
  if (n === 1) {
    const em = $('gEmail');
    if (em.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em.value.trim())) {
      $('e-gEmail').classList.add('show');
      em.classList.add('bad');
      ok = false;
    }
  }
  return ok;
}

function next(n) {
  if (!validate(n)) return;
  step = n + 1;
  if (step === 4) fillReview();
  show(step);
}
function back(n) { step = n - 1; show(step); }

function fillReview() {
  ['gName','gEmail','gPhone','pName','pDob','pGrade','pShirt','pPos','eName','ePhone']
    .forEach((id) => {
      const t = $('r-' + id);
      if (t) t.textContent = val(id) || '—';
    });
  $('r-hAllergy').textContent = val('hAllergy') || 'None listed';
}

/* -------------------------------------------------------------- register */

function showFormError(msg) {
  const box = $('formErr');
  box.textContent = msg;
  box.classList.add('show');
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function submitReg() {
  const consent = $('consent');
  const consentErr = $('e-consent');
  if (!consent.checked) { consentErr.classList.add('show'); return; }
  consentErr.classList.remove('show');
  $('formErr').classList.remove('show');

  const btn = document.querySelector('.btn-pay');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  const payload = {
    guardianName: val('gName'),
    guardianEmail: val('gEmail'),
    guardianPhone: val('gPhone'),
    playerName: val('pName'),
    dob: val('pDob'),
    grade: val('pGrade'),
    shirt: val('pShirt'),
    position: val('pPos'),
    emergencyName: val('eName'),
    emergencyPhone: val('ePhone'),
    allergies: val('hAllergy'),
    notes: val('hNotes'),
    consent: true,
    website: val('website'),           // honeypot
  };

  let data;
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = 'Complete Signup'; }
    return showFormError('We could not reach the server. Check your connection and try again.');
  }

  if (!data.ok) {
    if (btn) { btn.disabled = false; btn.textContent = 'Complete Signup'; }
    const first = data.errors ? Object.values(data.errors)[0] : data.error;
    return showFormError(first || 'Something went wrong. Please try again.');
  }

  reference = data.reference;
  $('payRef').textContent = reference;
  $('refCode').textContent = reference;
  step = 5;
  show(5);
  startPayment();
}

/* --------------------------------------------------------------- payment */

function startPayment() {
  if (CONFIG.paymentMode === 'paypal-venmo' && CONFIG.paypalClientId) {
    $('payPaypal').hidden = false;
    loadPayPal();
  } else {
    $('payVenmo').hidden = false;
    const note = encodeURIComponent(`Xavier Strong Clinic ${reference}`);
    $('venmoRef').textContent = reference;
    $('venmoHandle').textContent = '@' + CONFIG.venmoHandle;
    $('venmoLink').href =
      `https://venmo.com/${CONFIG.venmoPath}${CONFIG.venmoHandle}` +
      `?txn=pay&amount=${CONFIG.fee}&note=${note}`;
  }
}

function venmoDone() {
  $('doneNote').textContent =
    'Once we match your Venmo payment, a coach from All Things Foundation will follow up to confirm the spot.';
  step = 6;
  show(6);
}

function loadPayPal() {
  const s = document.createElement('script');
  s.src = 'https://www.paypal.com/sdk/js?client-id=' +
          encodeURIComponent(CONFIG.paypalClientId) +
          '&currency=USD&enable-funding=venmo&disable-funding=paylater';
  s.onerror = () => showFormError('Payment could not load. Please refresh and try again.');
  s.onload = renderPayPal;
  document.head.appendChild(s);
}

function renderPayPal() {
  if (!window.paypal) return;
  window.paypal.Buttons({
    style: { layout: 'vertical', color: 'blue', shape: 'rect', label: 'pay', height: 48 },
    createOrder: async () => {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || 'order failed');
      return d.id;
    },
    onApprove: async (data) => {
      const res = await fetch('/api/capture-order', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderID: data.orderID }),
      });
      const d = await res.json();
      if (!d.ok) return showFormError('Payment did not complete. Please try again.');
      $('doneNote').textContent =
        'Payment received. A coach from All Things Foundation will follow up before the clinic.';
      step = 6;
      show(6);
    },
    onError: () => showFormError('Payment could not be completed. Please try again.'),
  }).render('#ppButtons');
}

/* ----------------------------------------------------------------- wiring */

document.querySelectorAll('input,select,textarea').forEach((el) => {
  el.addEventListener('input', () => {
    el.classList.remove('bad');
    $('e-' + el.id)?.classList.remove('show');
  });
});

window.next = next;
window.back = back;
window.submitReg = submitReg;
window.venmoDone = venmoDone;
