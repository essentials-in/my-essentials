/* Essentials — shared behaviour: theme toggle, welcome splash, Raise-a-Query modal.
   Each page sets <body data-space="home|water|metals|copper|aluminium">.
   Any element with data-query opens the modal; its value preselects a service
   ("" = the current page's default service). */
(function(){
  'use strict';

  var CONFIG = {
    whatsapp: '918950998004',
    email: 'Myessentials.global@gmail.com',
    business: 'Essentials'
  };
  // Services in the query dropdown. isService marks the ones counted in the trust stat.
  var SERVICES = [
    { key:'water',     label:'Water Supply',              isService:true  },
    { key:'copper',    label:'Metals — Copper',           isService:false },
    { key:'aluminium', label:'Metals — Aluminium',        isService:false },
    { key:'metals',    label:'Metals — not sure / other', isService:true  },
    { key:'other',     label:'Something else',            isService:false }
  ];
  var SPACE_SERVICE = { home:'', water:'water', metals:'metals', copper:'copper', aluminium:'aluminium' };
  var SPACE_COLOR = { water:'#0B3B5C', metals:'#2B2F33', copper:'#5A2E12', aluminium:'#3D4852' };

  var root = document.documentElement;
  var body = document.body;
  var space = body.getAttribute('data-space') || 'home';

  /* ---------- Theme ---------- */
  var themeBtn = document.getElementById('themeBtn');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function setTheme(t){
    root.setAttribute('data-theme', t);
    var dark = t === 'dark';
    if(themeBtn){
      themeBtn.setAttribute('aria-checked', dark ? 'true' : 'false');
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    if(themeMeta) themeMeta.setAttribute('content', SPACE_COLOR[space] || (dark ? '#171b20' : '#faf6ef'));
    document.cookie = 'theme=' + t + ';path=/;max-age=31536000;SameSite=Lax';
  }
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  if(themeBtn) themeBtn.addEventListener('click', function(){
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ---------- Splash (home only) ---------- */
  var splash = document.getElementById('splash');
  if(splash){
    if(root.classList.contains('splash-seen')){ splash.remove(); }
    else {
      var done = false;
      var dismiss = function(){
        if(done) return; done = true;
        splash.classList.add('hide');
        setTimeout(function(){ splash.remove(); }, 400);
      };
      splash.addEventListener('click', dismiss);
      setTimeout(dismiss, 1500);
      document.cookie = 'splashSeen=1;path=/;max-age=604800;SameSite=Lax';
    }
  }

  /* ---------- Trust stat ---------- */
  var svcCount = document.getElementById('svcCount');
  if(svcCount) svcCount.textContent = String(SERVICES.filter(function(s){ return s.isService; }).length);

  /* ---------- Query modal (built once, shared by every page) ---------- */
  var overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.id = 'overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-describedby="modalDesc">' +
      '<h2 id="modalTitle" tabindex="-1">How can we help?</h2>' +
      '<p class="sub" id="modalDesc">Pick a service, then choose how you\'d like to reach us.</p>' +
      '<label class="q-select-label" for="qService">Service</label>' +
      '<select id="qService" class="q-select"></select>' +
      '<div class="oops" id="svcHint" hidden aria-live="polite">' +
        '<div class="oops-drop"><svg viewBox="0 0 60 74" width="46" height="56" aria-hidden="true">' +
          '<path d="M30 2C30 2 6 30 6 48a24 24 0 0 0 48 0C54 30 30 2 30 2Z" fill="#5bb3ad"/>' +
          '<ellipse cx="20" cy="44" rx="4.5" ry="7" fill="#fff" opacity=".55"/>' +
          '<circle cx="23" cy="48" r="3.4" fill="#243b3a"/><circle cx="37" cy="48" r="3.4" fill="#243b3a"/>' +
          '<circle cx="24.2" cy="46.9" r="1.1" fill="#fff"/><circle cx="38.2" cy="46.9" r="1.1" fill="#fff"/>' +
          '<path d="M25 57 q5 4 10 0" stroke="#243b3a" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
        '</svg></div>' +
        '<div class="oops-bubble">Please select a service first</div>' +
      '</div>' +
      '<div class="qref">Your reference number: <b id="qref">—</b></div>' +
      '<div class="opt-row">' +
        '<a class="opt2" id="waOpt" target="_blank" rel="noopener" aria-label="Contact us on WhatsApp">' +
          '<img src="/assets/icon-whatsapp.svg" alt="" width="28" height="28"><span class="opt2-txt">WhatsApp</span></a>' +
        '<button class="opt2" id="emOpt" type="button" aria-label="Contact us by email via Gmail">' +
          '<img src="/assets/icon-gmail.svg" alt="" width="28" height="28"><span class="opt2-txt">Gmail</span></button>' +
      '</div>' +
      '<div class="email-fallback" id="emailFallback" hidden>' +
        '<p class="ef-note">If your mail app didn\'t open, email us directly:</p>' +
        '<p class="ef-addr">' + CONFIG.email + '</p>' +
        '<p class="ef-ref">Subject reference: <b id="efRef">—</b></p>' +
        '<button class="ef-copy" type="button" id="efCopyBtn">Copy email address</button>' +
      '</div>' +
      '<button class="modal-close" type="button" id="modalClose">Cancel</button>' +
    '</div>';
  body.appendChild(overlay);

  var modal = overlay.querySelector('.modal');
  var qService = document.getElementById('qService');
  var waBtn = document.getElementById('waOpt');
  var emBtn = document.getElementById('emOpt');
  var optRow = overlay.querySelector('.opt-row');
  var hint = document.getElementById('svcHint');
  var fallback = document.getElementById('emailFallback');
  var copyBtn = document.getElementById('efCopyBtn');
  var EMAIL = { gmailWeb:'', mailto:'' };
  var currentRef = '';
  var lastFocused = null;

  (function buildOptions(){
    var ph = document.createElement('option');
    ph.value = ''; ph.textContent = 'Select your service…';
    qService.appendChild(ph);
    SERVICES.forEach(function(s){
      var o = document.createElement('option');
      o.value = s.key; o.textContent = s.label;
      qService.appendChild(o);
    });
  })();

  function makeRef(){
    var d = new Date();
    var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    return 'QRY-' + ymd + '-' + Math.floor(1000 + Math.random() * 9000);
  }
  function findService(key){
    for(var i = 0; i < SERVICES.length; i++) if(SERVICES[i].key === key) return SERVICES[i];
    return null;
  }

  function refreshLinks(){
    var svc = findService(qService.value);
    modal.setAttribute('data-accent', svc ? svc.key : '');
    fallback.hidden = true;
    if(!svc){
      optRow.classList.add('is-disabled');
      waBtn.removeAttribute('href');
      waBtn.setAttribute('aria-disabled', 'true');
      emBtn.disabled = true;
      hint.hidden = false;
      return;
    }
    optRow.classList.remove('is-disabled');
    waBtn.setAttribute('aria-disabled', 'false');
    emBtn.disabled = false;
    hint.hidden = true;

    var about = ' regarding ' + svc.label;
    var subject = 'New Query [' + currentRef + '] - ' + svc.label;
    var bodyText = 'Hello ' + CONFIG.business + ',\n\n' +
      'I\'d like to raise a query' + about + '.\n\n' +
      'Reference number: ' + currentRef + '\n\n' +
      'My message:\n\n\n---\nName:\nPhone:\n';
    var waMsg = 'Hi ' + CONFIG.business + ', I\'d like to raise a query' + about + '. My reference number is ' + currentRef + '.';
    waBtn.href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(waMsg);
    var su = encodeURIComponent(subject), bd = encodeURIComponent(bodyText);
    EMAIL.gmailWeb = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(CONFIG.email) + '&su=' + su + '&body=' + bd;
    EMAIL.mailto = 'mailto:' + CONFIG.email + '?subject=' + su + '&body=' + bd;
  }

  function nudge(){
    hint.hidden = false;
    hint.style.animation = 'none'; void hint.offsetWidth; hint.style.animation = '';
    qService.classList.remove('needs-pick'); void qService.offsetWidth;
    qService.classList.add('needs-pick');
    qService.focus();
    setTimeout(function(){ qService.classList.remove('needs-pick'); }, 1200);
  }

  function openModal(serviceKey){
    currentRef = makeRef();
    document.getElementById('qref').textContent = currentRef;
    document.getElementById('efRef').textContent = currentRef;
    copyBtn.textContent = 'Copy email address';
    qService.value = findService(serviceKey) ? serviceKey : '';
    refreshLinks();
    lastFocused = document.activeElement;
    overlay.hidden = false;
    // Focus the heading (not the select) so mobile doesn't auto-open the picker
    document.getElementById('modalTitle').focus();
  }
  function closeModal(){
    overlay.hidden = true;
    if(lastFocused && lastFocused.focus) lastFocused.focus();
  }

  qService.addEventListener('change', refreshLinks);
  waBtn.addEventListener('click', function(e){ if(!qService.value){ e.preventDefault(); nudge(); } });
  emBtn.addEventListener('click', function(){
    if(!qService.value){ nudge(); return; }
    var isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    try {
      if(isMobile) window.location.href = EMAIL.mailto;
      else window.open(EMAIL.gmailWeb, '_blank', 'noopener');
    } catch(err){ /* fallback below covers it */ }
    setTimeout(function(){ fallback.hidden = false; fallback.scrollIntoView({behavior:'smooth', block:'nearest'}); }, 400);
  });
  copyBtn.addEventListener('click', function(){
    var ok = function(){ copyBtn.textContent = 'Copied ✓'; setTimeout(function(){ copyBtn.textContent = 'Copy email address'; }, 2000); };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(CONFIG.email).then(ok).catch(function(){ legacyCopy(ok); });
    } else legacyCopy(ok);
  });
  function legacyCopy(ok){
    var t = document.createElement('textarea');
    t.value = CONFIG.email; t.style.position = 'fixed'; t.style.opacity = '0';
    body.appendChild(t); t.select();
    try { document.execCommand('copy'); ok(); } catch(err){}
    body.removeChild(t);
  }
  document.getElementById('modalClose').addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e){ if(e.target === overlay) closeModal(); });

  // Any [data-query] element opens the modal ("" = this page's own service)
  document.addEventListener('click', function(e){
    var trigger = e.target.closest ? e.target.closest('[data-query]') : null;
    if(!trigger) return;
    e.preventDefault();
    openModal(trigger.getAttribute('data-query') || SPACE_SERVICE[space] || '');
  });

  // Escape closes; Tab stays inside the open dialog (visible, enabled controls only)
  document.addEventListener('keydown', function(e){
    if(overlay.hidden) return;
    if(e.key === 'Escape'){ closeModal(); return; }
    if(e.key !== 'Tab') return;
    var f = Array.prototype.filter.call(
      overlay.querySelectorAll('a[href],button:not([disabled]),select'),
      function(el){ return el.offsetParent !== null; }
    );
    if(!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if(e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });
})();
