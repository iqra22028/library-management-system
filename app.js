const API = 'http://localhost:3000/api';
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimer = null;

/* ── STATE ─────────────────────────────────────────────────────── */
let currentUser       = null;
let allBooks          = [];
let allMembers        = [];
let allTx             = [];
let activeCatFilter   = '';
let currentBookFilter = '';
let currentAvailFilter= '';
let memberSearchFilter= '';
let darkMode          = false;

/* ── PAGINATION STATE ───────────────────────────────────────────── */
const PAGE_SIZE = 10;
let booksPage   = 1;
let membersPage = 1;

/* ── INIT ───────────────────────────────────────────────────────── */
globalThis.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('libraryos_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    bootApp();
  }
  document.getElementById('currentDate').textContent = fmtDate(new Date());
  document.getElementById('memberDate').textContent  = fmtDate(new Date());

  // Dark mode restore
  if (localStorage.getItem('libraryos_dark') === 'true') {
    darkMode = true;
    document.body.classList.add('dark-mode');
  }

  wireLoginUI();
  wireNav();
  wireSidebar();
  wireAdminForms();
  wireDarkMode();
  startLoginParticles();
});

/* ================================================================
   SESSION TIMEOUT
   ================================================================ */
function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    showToast('Session expired. Please login again.', 'warning');
    setTimeout(doLogout, 1500);
  }, SESSION_TIMEOUT);
}

document.addEventListener('mousemove', () => { if (currentUser) resetSessionTimer(); });
document.addEventListener('keydown',   () => { if (currentUser) resetSessionTimer(); });

/* ================================================================
   LOGIN BACKGROUND PARTICLES
   ================================================================ */
function startLoginParticles() {
  const canvas = document.getElementById('loginCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  const COLORS = ['rgba(240,192,64,', 'rgba(45,106,159,', 'rgba(30,107,62,', 'rgba(26,58,92,'];
  const NUM    = 38;

  const dots = Array.from({ length: NUM }, () => ({
    x:    Math.random() * W,
    y:    Math.random() * H,
    r:    Math.random() * 3.5 + 1.2,
    dx:   (Math.random() - 0.5) * 0.45,
    dy:   (Math.random() - 0.5) * 0.45,
    col:  COLORS[Math.floor(Math.random() * COLORS.length)],
    a:    Math.random() * 0.45 + 0.12,
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Draw connecting lines
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x;
        const dy = dots[i].y - dots[j].y;
        // FIX [javascript:S7769]: Use Math.hypot() instead of Math.sqrt(dx*dx + dy*dy)
        const dist = Math.hypot(dx, dy);
        if (dist < 140) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(26,58,92,${0.07 * (1 - dist / 140)})`;
          ctx.lineWidth = 1;
          ctx.moveTo(dots[i].x, dots[i].y);
          ctx.lineTo(dots[j].x, dots[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw dots
    dots.forEach(d => {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = d.col + d.a + ')';
      ctx.fill();

      d.x += d.dx;
      d.y += d.dy;
      if (d.x < 0 || d.x > W) d.dx *= -1;
      if (d.y < 0 || d.y > H) d.dy *= -1;
    });

    requestAnimationFrame(draw);
  }
  draw();
}

/* ================================================================
   DARK MODE
   ================================================================ */
function wireDarkMode() {
  const btn = document.getElementById('darkModeToggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('libraryos_dark', darkMode);
    btn.title = darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    btn.innerHTML = darkMode
      ? `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>`
      : `<svg viewBox="0 0 24 24" style="width:20px;height:20px;fill:currentColor"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-9.95h-2V3.5h2V.55zm7.45 3.91l-1.41-1.41-1.79 1.79 1.41 1.41 1.79-1.79zm-3.21 13.7l1.79 1.8 1.41-1.41-1.8-1.79-1.4 1.4zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 16.95h2V19.5h-2v2.95zm-7.45-3.91l1.41 1.41 1.79-1.8-1.41-1.41-1.79 1.8z"/></svg>`;
  });
}

/* ================================================================
   LOGIN / AUTH
   ================================================================ */
function wireLoginUI() {
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('logoutBtn').addEventListener('click', doLogout);

  // Hide Sign Up tab — only admin can create accounts
  const tabSignUp  = document.getElementById('tabSignUp');
  const formSignUp = document.getElementById('formSignUp');
  if (tabSignUp)  tabSignUp.style.display  = 'none';
  if (formSignUp) formSignUp.style.display = 'none';
}

async function doLogin() {
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const role     = document.getElementById('loginRole').value;

  if (!username || !password) { showToast('Enter username and password', 'error'); return; }

  try {
    const res  = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ username, password, role })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Login failed', 'error'); return; }

    currentUser = data;
    sessionStorage.setItem('libraryos_user', JSON.stringify(data));
    resetSessionTimer();
    bootApp();
  } catch(e) {
    showToast('Cannot connect to server. Is it running?', 'error');
    console.error('Login error:', e);
  }
}

function doLogout() {
  currentUser = null;
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionStorage.removeItem('libraryos_user');
  allBooks = []; allMembers = []; allTx = [];
  booksPage = 1; membersPage = 1;
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

function bootApp() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('userDisplayName').textContent = currentUser.name;
  document.getElementById('userDisplayRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Member';
  const initials = currentUser.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;

  if (currentUser.role === 'admin') {
    document.getElementById('adminNav').style.display = '';
    document.getElementById('memberNav').style.display = 'none';
    document.getElementById('adminSearchBar').style.display = '';
    loadAdminData();
    navigateTo('dashboard');
  } else {
    document.getElementById('adminNav').style.display = 'none';
    document.getElementById('memberNav').style.display = '';
    document.getElementById('adminSearchBar').style.display = 'none';
    document.getElementById('memberWelcome').textContent = `Welcome, ${currentUser.name.split(' ')[0]}!`;
    loadMemberData();
    navigateTo('member-dashboard');
  }
}

/* ================================================================
   NAVIGATION
   ================================================================ */
function wireNav() {
  document.addEventListener('click', e => {
    const navItem = e.target.closest('[data-page]');
    if (navItem) {
      e.preventDefault();
      navigateTo(navItem.dataset.page);
    }
  });
}

function _guardMemberAccess(page) {
  const memberPages = ['member-dashboard','my-books','my-fines','my-history'];
  return memberPages.includes(page);
}

function _updateNavUI(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');
  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');
  const labels = {
    'dashboard':'Dashboard','books':'Books','members':'Members',
    'issue':'Issue Book','transactions':'Transactions','reports':'Student Reports',
    'addbook':'Add Book','addmember':'Add Member',
    'member-dashboard':'My Dashboard','my-books':'My Books',
    'my-fines':'My Fines','my-history':'My History'
  };
  document.getElementById('breadcrumbCurrent').textContent = labels[page] || page;
}

function _refreshAdminPage(page) {
  if (page === 'dashboard')    renderAdminDashboard();
  if (page === 'books')        { booksPage = 1; renderBooks(); }
  if (page === 'members')      { membersPage = 1; renderMembers(); }
  if (page === 'transactions') renderTransactions();
  if (page === 'issue')        populateIssueDropdowns();
  if (page === 'reports')      renderReports();
}

function _refreshMemberPage(page) {
  if (page === 'member-dashboard') renderMemberDashboard();
  if (page === 'my-books')         renderMyBooks();
  if (page === 'my-fines')         renderMyFines();
  if (page === 'my-history')       renderMyHistory();
}

function navigateTo(page) {
  if (currentUser?.role === 'member') {
    if (!_guardMemberAccess(page)) return;
  }
  _updateNavUI(page);
  if (currentUser?.role === 'admin') {
    _refreshAdminPage(page);
  } else {
    _refreshMemberPage(page);
  }
}

/* ================================================================
   SIDEBAR TOGGLE
   ================================================================ */
function wireSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
    document.getElementById('mainContent').classList.toggle('sidebar-collapsed');
  });
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('mobile-open');
  });
}

/* ================================================================
   DATA LOADING
   ================================================================ */
async function loadAdminData() {
  try {
    const [bRes, mRes, tRes] = await Promise.all([
      fetch(`${API}/books`),
      fetch(`${API}/members`),
      fetch(`${API}/transactions`)
    ]);
    allBooks   = await bRes.json();
    allMembers = await mRes.json();
    allTx      = await tRes.json();
    renderAdminDashboard();
    updateNotifBadge();
  } catch(e) {
    showToast('Failed to load data from server', 'error');
    console.error('Load admin data error:', e);
  }
}

async function loadMemberData() {
  try {
    const [bRes, tRes] = await Promise.all([
      fetch(`${API}/books`),
      fetch(`${API}/transactions/member/${currentUser.id}`)
    ]);
    allBooks = await bRes.json();
    allTx    = await tRes.json();
    renderMemberDashboard();
  } catch(e) {
    showToast('Failed to load data', 'error');
    console.error('Load member data error:', e);
  }
}

async function refreshAll() {
  if (currentUser?.role === 'admin') {
    await loadAdminData();
  } else {
    await loadMemberData();
  }
}

/* ================================================================
   ADMIN DASHBOARD
   ================================================================ */
function renderAdminDashboard() {
  const totalBooks    = allBooks.reduce((s,b) => s + (b.total||0), 0);
  const totalAvail    = allBooks.reduce((s,b) => s + (b.available||0), 0);
  const activeMembers = allMembers.filter(m => m.active !== false && m.role === 'member').length;
  const issuedTx      = allTx.filter(t => t.status === 'issued');
  const now           = new Date();
  const overdueTx     = issuedTx.filter(t => new Date(t.due_date) < now);
  const unpaidFines   = allTx.filter(t => t.fine > 0 && !t.fine_paid).reduce((s,t)=>s+(+t.fine),0);

  animateCount('stat-books',   totalBooks);
  animateCount('stat-members', activeMembers);
  animateCount('stat-issued',  issuedTx.length);
  animateCount('stat-overdue', overdueTx.length);
  document.getElementById('stat-fines').textContent = `PKR ${unpaidFines.toLocaleString()} fines`;

  updateNotifBadge();
  renderRecentTransactions();
  updateDonut(totalAvail, issuedTx.length - overdueTx.length, overdueTx.length, totalBooks);
  renderReturnReminders();
}

/* ── RETURN REMINDERS ────────────────────────────────────────────── */
function renderReturnReminders() {
  const container = document.getElementById('returnReminders');
  if (!container) return;
  const now = new Date();
  const soon = allTx.filter(t => {
    if (t.status !== 'issued') return false;
    const due  = new Date(t.due_date);
    const diff = Math.ceil((due - now) / (1000*60*60*24));
    return diff <= 3;
  });
  if (!soon.length) { container.style.display = 'none'; return; }
  container.style.display = '';
  container.innerHTML = `
    <div class="card" style="border-left:4px solid var(--orange);margin-bottom:20px">
      <div class="card-header" style="background:rgba(240,160,48,0.08)">
        <h3 style="color:var(--orange)">⚠️ Due Soon / Overdue — ${soon.length} book(s)</h3>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Member</th><th>Book</th><th>Due Date</th><th>Status</th></tr></thead>
          <tbody>
            ${soon.map(t => {
              const member = allMembers.find(m=>m.id===t.member_id)||{};
              const book   = allBooks.find(b=>b.id===t.book_id)||{};
              const due    = new Date(t.due_date);
              const diff   = Math.ceil((due-now)/(1000*60*60*24));
              // FIX [javascript:S3358]: Extract nested ternary into independent statements
              let label;
              if (diff < 0) {
                label = `<span class="badge badge-red">Overdue ${Math.abs(diff)}d</span>`;
              } else if (diff === 0) {
                label = `<span class="badge badge-orange">Due Today</span>`;
              } else {
                label = `<span class="badge badge-orange">Due in ${diff}d</span>`;
              }
              return `<tr>
                <td>${esc(member.name||'Unknown')}</td>
                <td>${esc(book.title||'Unknown')}</td>
                <td>${fmtDate(t.due_date)}</td>
                <td>${label}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}

function renderRecentTransactions() {
  const tbody  = document.getElementById('recentTxTable');
  const recent = allTx.slice(0, 8);
  if (!recent.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No transactions yet</td></tr>';
    return;
  }
  tbody.innerHTML = recent.map(t => {
    const member = allMembers.find(m=>m.id===t.member_id) || {};
    const book   = allBooks.find(b=>b.id===t.book_id) || {};
    const now    = new Date();
    const due    = new Date(t.due_date);
    // FIX [javascript:S3358]: Extract nested ternary into independent statements
    let badge;
    if (t.status === 'returned') {
      badge = '<span class="badge badge-green">Returned</span>';
    } else if (due < now) {
      badge = '<span class="badge badge-red">Overdue</span>';
    } else {
      badge = '<span class="badge badge-orange">Issued</span>';
    }
    return `<tr>
      <td>${member.name||'Unknown'}</td>
      <td>${book.title||'Unknown'}</td>
      <td>${fmtDate(t.issue_date)}</td>
      <td>${fmtDate(t.due_date)}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
}

function updateDonut(available, issued, overdue, total) {
  const circ      = 2 * Math.PI * 70;
  const safeTotal = total || 1;
  const aLen = (available / safeTotal) * circ;
  const iLen = (issued    / safeTotal) * circ;
  const oLen = (overdue   / safeTotal) * circ;

  const aSeg = document.querySelector('.seg-available');
  const iSeg = document.querySelector('.seg-issued');
  const oSeg = document.querySelector('.seg-overdue');

  aSeg.setAttribute('stroke-dasharray', `${aLen} ${circ - aLen}`);
  aSeg.setAttribute('stroke-dashoffset', '110');
  iSeg.setAttribute('stroke-dasharray', `${iLen} ${circ - iLen}`);
  iSeg.setAttribute('stroke-dashoffset', 110 - aLen);
  oSeg.setAttribute('stroke-dasharray', `${oLen} ${circ - oLen}`);
  oSeg.setAttribute('stroke-dashoffset', 110 - aLen - iLen);
  document.getElementById('donutCenterNum').textContent = total;
}

function updateNotifBadge() {
  const now     = new Date();
  const overdue = allTx.filter(t => t.status === 'issued' && new Date(t.due_date) < now).length;
  const badge   = document.getElementById('notifBadge');
  badge.textContent = overdue;
  badge.classList.toggle('zero', overdue === 0);
}

/* ================================================================
   BOOKS PAGE  (with pagination)
   ================================================================ */
function getFilteredBooks() {
  const search = (document.getElementById('bookSearch')?.value || currentBookFilter).toLowerCase();
  const avail  = document.getElementById('availFilter')?.value || currentAvailFilter;
  return allBooks.filter(b => {
    const matchCat    = !activeCatFilter || b.genre === activeCatFilter;
    const matchSearch = !search || (b.title+b.author+(b.isbn||'')+(b.genre||'')).toLowerCase().includes(search);
    const matchAvail  = !avail
      || (avail === 'available'   && b.available > 0)
      || (avail === 'unavailable' && b.available <= 0);
    return matchCat && matchSearch && matchAvail;
  });
}

function renderBooks() {
  const filtered = getFilteredBooks();
  const total    = filtered.length;
  const totalPg  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (booksPage > totalPg) booksPage = totalPg;
  const slice    = filtered.slice((booksPage-1)*PAGE_SIZE, booksPage*PAGE_SIZE);

  const tbody = document.getElementById('booksTableBody');
  if (!slice.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No books found</td></tr>';
  } else {
    tbody.innerHTML = slice.map((b,i) => `
      <tr>
        <td>${(booksPage-1)*PAGE_SIZE + i + 1}</td>
        <td><strong>${esc(b.title)}</strong></td>
        <td>${esc(b.author)}</td>
        <td><code>${b.isbn||'—'}</code></td>
        <td>${b.genre ? `<span class="badge badge-blue">${esc(b.genre)}</span>` : '—'}</td>
        <td>${b.available > 0
          ? `<span class="badge badge-green">${b.available}</span>`
          : `<span class="badge badge-red">0</span>`}</td>
        <td>${b.total}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-ghost" onclick="editBook(${b.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBook(${b.id})">Delete</button>
        </td>
      </tr>`).join('');
  }
  renderPagination('booksPagination', booksPage, totalPg, (p) => { booksPage = p; renderBooks(); });
}

// Category tabs
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('categoryTabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCatFilter = tab.dataset.cat;
    booksPage = 1;
    renderBooks();
  });
  document.getElementById('bookSearch')?.addEventListener('input', e => {
    currentBookFilter = e.target.value;
    booksPage = 1;
    renderBooks();
  });
  document.getElementById('availFilter')?.addEventListener('change', e => {
    currentAvailFilter = e.target.value;
    booksPage = 1;
    renderBooks();
  });
});

function editBook(id) {
  const b = allBooks.find(x=>x.id===id);
  if (!b) return;
  openModal(
    'Edit Book',
    `<div class="form-grid-2" style="gap:12px">
      <div class="form-group"><label class="form-label">Title</label>
        <input class="form-control" id="eb-title" maxlength="200" value="${esc(b.title)}"/></div>
      <div class="form-group"><label class="form-label">Author</label>
        <input class="form-control" id="eb-author" maxlength="150" value="${esc(b.author)}"/></div>
      <div class="form-group"><label class="form-label">ISBN</label>
        <input class="form-control" id="eb-isbn" maxlength="20" value="${b.isbn||''}"/></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-control form-select" id="eb-genre">
          ${['Software Engineering','Computer Science','Databases','Mathematics','Networking','Fiction','Islamic Studies','Science','Other']
            .map(g=>`<option value="${g}" ${b.genre===g?'selected':''}>${g}</option>`).join('')}
        </select></div>
      <div class="form-group"><label class="form-label">Total</label>
        <input class="form-control" type="number" id="eb-total" value="${b.total}"/></div>
      <div class="form-group"><label class="form-label">Available</label>
        <input class="form-control" type="number" id="eb-available" value="${b.available}"/></div>
      <div class="form-group"><label class="form-label">Year</label>
        <input class="form-control" type="number" id="eb-year" value="${b.year||''}"/></div>
    </div>`,
    async () => {
      const isbnVal = document.getElementById('eb-isbn').value.trim();

      // Client-side ISBN validation
      if (isbnVal.length > 0) {
        // FIX [javascript:S7781]: Use replaceAll() instead of replace() with global regex
        const isbnClean = isbnVal.replaceAll('-', '');
        if (!/^\d+$/.test(isbnClean)) {
          showToast('ISBN must contain numbers only (dashes allowed).', 'error');
          return false; // prevent modal close
        }
        if (isbnClean.length !== 10 && isbnClean.length !== 13) {
          showToast('ISBN must be 10 or 13 digits long.', 'error');
          return false;
        }
      }

      const payload = {
        title:     document.getElementById('eb-title').value,
        author:    document.getElementById('eb-author').value,
        isbn:      isbnVal || null,
        genre:     document.getElementById('eb-genre').value,
        total:     +document.getElementById('eb-total').value,
        available: +document.getElementById('eb-available').value,
        year:      document.getElementById('eb-year').value || null
      };
      const res = await fetch(`${API}/books/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        allBooks = allBooks.map(x=>x.id===id?updated:x);
        renderBooks();
        showToast('Book updated!','success');
      } else {
        const data = await res.json();
        showToast(data.error||'Update failed','error');
      }
    }
  );
}

function deleteBook(id) {
  const b = allBooks.find(x=>x.id===id);
  openModal('Delete Book', `<p>Are you sure you want to delete <strong>${esc(b?.title)}</strong>? This cannot be undone.</p>`,
    async () => {
      const res  = await fetch(`${API}/books/${id}`, {method:'DELETE'});
      const data = await res.json();
      if (res.ok) {
        allBooks = allBooks.filter(x=>x.id!==id);
        renderBooks();
        renderAdminDashboard();
        showToast('Book deleted','success');
      } else { showToast(data.error||'Delete failed','error'); }
    }
  );
}

/* ================================================================
   MEMBERS PAGE  (with search + pagination)
   ================================================================ */
function getFilteredMembers() {
  const search = memberSearchFilter.toLowerCase();
  return allMembers.filter(m => {
    if (m.role !== 'member') return false;
    if (!search) return true;
    return (m.name+m.username+(m.email||'')+(m.phone||'')).toLowerCase().includes(search);
  });
}

function renderMembers() {
  const filtered = getFilteredMembers();
  const total    = filtered.length;
  const totalPg  = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (membersPage > totalPg) membersPage = totalPg;
  const slice    = filtered.slice((membersPage-1)*PAGE_SIZE, membersPage*PAGE_SIZE);

  const tbody = document.getElementById('membersTableBody');
  if (!slice.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No members found</td></tr>';
  } else {
    tbody.innerHTML = slice.map((m,i) => `
      <tr>
        <td>${(membersPage-1)*PAGE_SIZE + i + 1}</td>
        <td><strong>${esc(m.name)}</strong></td>
        <td><code>${esc(m.username)}</code></td>
        <td><code style="color:var(--blue);font-size:0.78rem">${esc(m.member_id||'—')}</code></td>
        <td>${m.email||'—'}</td>
        <td>${m.phone||'—'}</td>
        <td>${m.active !== false
          ? '<span class="badge badge-green">Active</span>'
          : '<span class="badge badge-red">Inactive</span>'}</td>
        <td class="actions-cell">
          <button class="btn btn-sm ${m.active!==false?'btn-warning':'btn-success'}"
            onclick="toggleMember(${m.id})">${m.active!==false?'Deactivate':'Activate'}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMember(${m.id})">Delete</button>
        </td>
      </tr>`).join('');
  }
  renderPagination('membersPagination', membersPage, totalPg, (p) => { membersPage = p; renderMembers(); });
}

// Wire member search
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('memberSearch')?.addEventListener('input', e => {
    memberSearchFilter = e.target.value;
    membersPage = 1;
    renderMembers();
  });
});

async function toggleMember(id) {
  const res = await fetch(`${API}/members/${id}/toggle`, {method:'PUT'});
  if (res.ok) {
    const updated = await res.json();
    allMembers = allMembers.map(m => m.id===id ? updated : m);
    renderMembers();
    showToast('Member status updated','success');
  }
}

function deleteMember(id) {
  const m = allMembers.find(x=>x.id===id);
  openModal('Delete Member',
    `<p>Are you sure you want to permanently delete <strong>${esc(m?.name)}</strong>? This cannot be undone.</p>`,
    async () => {
      const res  = await fetch(`${API}/members/${id}`, {method:'DELETE'});
      const data = await res.json();
      if (res.ok) {
        allMembers = allMembers.filter(x=>x.id!==id);
        renderMembers();
        renderAdminDashboard();
        showToast('Member deleted','success');
      } else { showToast(data.error||'Delete failed','error'); }
    }
  );
}

/* ================================================================
   ISSUE BOOK  — lending period changed to 1 day
   ================================================================ */
function populateIssueDropdowns() {
  const memberSel = document.getElementById('issueMember');
  const bookSel   = document.getElementById('issueBook');

  const activeMembers = allMembers.filter(m => m.role==='member' && m.active!==false);
  memberSel.innerHTML = '<option value="">— Choose Member —</option>' +
    activeMembers.map(m=>`<option value="${m.id}">${esc(m.name)} (@${esc(m.username)})</option>`).join('');

  const availBooks = allBooks.filter(b => b.available > 0);
  bookSel.innerHTML = '<option value="">— Choose Book —</option>' +
    availBooks.map(b=>`<option value="${b.id}">${esc(b.title)} — ${esc(b.author)}</option>`).join('');

  const update = () => {
    if (memberSel.value && bookSel.value) {
      const now = new Date();
      const due = new Date(now); due.setDate(due.getDate()+1); // 1-day lending period
      document.getElementById('issueDate').textContent = fmtDate(now);
      document.getElementById('dueDate').textContent   = fmtDate(due);
      document.getElementById('issueInfoBox').style.display = '';
    } else {
      document.getElementById('issueInfoBox').style.display = 'none';
    }
  };
  memberSel.onchange = update;
  bookSel.onchange   = update;
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('issueBtnSubmit')?.addEventListener('click', async () => {
    const memberId = document.getElementById('issueMember').value;
    const bookId   = document.getElementById('issueBook').value;
    if (!memberId || !bookId) { showToast('Select both member and book','error'); return; }

    const now     = new Date();
    const due     = new Date(now); due.setDate(due.getDate()+1); // 1-day lending period
    const payload = {
      member_id:  +memberId, book_id: +bookId,
      issue_date: now.toISOString().split('T')[0],
      due_date:   due.toISOString().split('T')[0]
    };

    const res  = await fetch(`${API}/transactions`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error||'Issue failed','error'); return; }

    allTx.unshift(data);
    const book = allBooks.find(b=>b.id===+bookId);
    if (book) book.available--;

    showToast('Book issued successfully! Due tomorrow.','success');
    document.getElementById('issueMember').value = '';
    document.getElementById('issueBook').value   = '';
    document.getElementById('issueInfoBox').style.display = 'none';
    populateIssueDropdowns();
    renderAdminDashboard();
  });
});

/* ================================================================
   TRANSACTIONS PAGE
   ================================================================ */
function renderTransactions() {
  const tbody = document.getElementById('txTableBody');
  if (!allTx.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No transactions yet</td></tr>';
    return;
  }
  tbody.innerHTML = allTx.map((t,i) => {
    const member  = allMembers.find(m=>m.id===t.member_id)||{};
    const book    = allBooks.find(b=>b.id===t.book_id)||{};
    const now     = new Date();
    const due     = new Date(t.due_date);
    // FIX [javascript:S3358]: Extract nested ternary into independent statements
    let status;
    if (t.status==='returned') {
      status = '<span class="badge badge-green">Returned</span>';
    } else if (due < now) {
      status = '<span class="badge badge-red">Overdue</span>';
    } else {
      status = '<span class="badge badge-orange">Issued</span>';
    }

    // FIX [javascript:S3358]: Extract nested ternary into independent statements
    let fineBadge;
    if (t.fine > 0) {
      fineBadge = t.fine_paid
        ? `<span class="badge badge-green">PKR ${t.fine} ✓</span>`
        : `<span class="badge badge-red">PKR ${t.fine}</span>`;
    } else {
      fineBadge = '—';
    }

    let actions = '';
    if (t.status === 'issued') {
      actions = `<button class="btn btn-sm btn-success" onclick="returnBook(${t.id})">Return</button>`;
    } else if (t.fine > 0 && !t.fine_paid) {
      actions = `<button class="btn btn-sm btn-warning" onclick="payFine(${t.id})">Pay Fine</button>`;
    }

    return `<tr>
      <td>${i+1}</td>
      <td>${esc(member.name||'Unknown')}</td>
      <td>${esc(book.title||'Unknown')}</td>
      <td>${fmtDate(t.issue_date)}</td>
      <td>${fmtDate(t.due_date)}</td>
      <td>${t.return_date ? fmtDate(t.return_date) : '—'}</td>
      <td>${fineBadge}</td>
      <td>${status}</td>
      <td class="actions-cell">${actions}</td>
    </tr>`;
  }).join('');
}

async function returnBook(txId) {
  const tx  = allTx.find(t=>t.id===txId);
  if (!tx) return;
  const now = new Date();
  const due = new Date(tx.due_date);
  const overdueDays = Math.max(0, Math.floor((now-due)/(1000*60*60*24)));
  const fine = overdueDays * 10;

  openModal('Return Book',
    `<p>Returning book.</p>
     ${overdueDays > 0
       ? `<p style="color:var(--red);margin-top:8px">⚠️ Overdue by <strong>${overdueDays} days</strong>. Fine: <strong>PKR ${fine}</strong></p>`
       : '<p style="color:var(--green-light);margin-top:8px">✅ On time — no fine.</p>'}`,
    async () => {
      const res = await fetch(`${API}/transactions/${txId}/return`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ return_date: now.toISOString().split('T')[0], fine })
      });
      if (res.ok) {
        const updated = await res.json();
        allTx = allTx.map(t=>t.id===txId?updated:t);
        const book = allBooks.find(b=>b.id===tx.book_id);
        if (book) book.available++;
        renderTransactions();
        renderAdminDashboard();
        showToast(fine>0?`Book returned. Fine: PKR ${fine}`:'Book returned successfully!', fine>0?'warning':'success');
      } else { showToast('Return failed','error'); }
    }
  );
}

async function payFine(txId) {
  openModal('Pay Fine','<p>Mark this fine as paid?</p>', async () => {
    const res = await fetch(`${API}/transactions/${txId}/payfine`, {method:'PUT'});
    if (res.ok) {
      const updated = await res.json();
      allTx = allTx.map(t=>t.id===txId?updated:t);
      renderTransactions();
      showToast('Fine marked as paid','success');
    }
  });
}

/* ================================================================
   STUDENT REPORTS
   ================================================================ */
function renderReports() {
  const members = allMembers.filter(m => m.role==='member');
  const grid    = document.getElementById('reportsGrid');
  if (!members.length) { grid.innerHTML = '<div class="empty-state">No members found</div>'; return; }

  grid.innerHTML = members.map(m => {
    const mTx    = allTx.filter(t => t.member_id === m.id);
    const active = mTx.filter(t => t.status==='issued').length;
    const total  = mTx.length;
    const now    = new Date();
    const overdue= mTx.filter(t => t.status==='issued' && new Date(t.due_date)<now).length;
    const unpaid = mTx.filter(t => t.fine>0 && !t.fine_paid).reduce((s,t)=>s+(+t.fine),0);

    return `<div class="report-card">
      <div class="report-card-header">
        <div class="report-avatar">${m.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</div>
        <div>
          <div class="report-name">${esc(m.name)}</div>
          <div class="report-username">@${esc(m.username)}</div>
        </div>
        <span class="badge ${m.active!==false?'badge-green':'badge-gray'}" style="margin-left:auto">
          ${m.active!==false?'Active':'Inactive'}
        </span>
      </div>
      <div class="report-card-stats">
        <div class="rstat"><span>${total}</span><label>Total Issued</label></div>
        <div class="rstat"><span>${active}</span><label>Active</label></div>
        <div class="rstat" style="${overdue>0?'color:var(--red)':''}"><span>${overdue}</span><label>Overdue</label></div>
        <div class="rstat" style="${unpaid>0?'color:var(--red)':''}">
          <span>${unpaid>0?'PKR '+unpaid:'None'}</span><label>Unpaid Fine</label>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:12px"
        onclick="viewMemberReport(${m.id})">View Full Report</button>
    </div>`;
  }).join('');
}

function viewMemberReport(memberId) {
  const member = allMembers.find(m=>m.id===memberId);
  if (!member) return;
  const mTx    = allTx.filter(t=>t.member_id===memberId);
  const now    = new Date();
  const active = mTx.filter(t=>t.status==='issued').length;
  const total  = mTx.length;
  const overdue= mTx.filter(t=>t.status==='issued'&&new Date(t.due_date)<now).length;
  const unpaid = mTx.filter(t=>t.fine>0&&!t.fine_paid).reduce((s,t)=>s+(+t.fine),0);

  document.getElementById('reportStudentName').textContent = member.name;
  document.getElementById('reportStudentMeta').textContent = `@${member.username}${member.email?' · '+member.email:''}`;
  document.getElementById('reportStatsRow').innerHTML = `
    <div class="rstat-lg"><span>${total}</span><label>Total Borrowed</label></div>
    <div class="rstat-lg"><span>${active}</span><label>Currently Active</label></div>
    <div class="rstat-lg" style="${overdue>0?'color:var(--red)':''}"><span>${overdue}</span><label>Overdue</label></div>
    <div class="rstat-lg" style="${unpaid>0?'color:var(--red)':''}">
      <span>${unpaid>0?'PKR '+unpaid:'PKR 0'}</span><label>Unpaid Fines</label>
    </div>`;

  const tbody = document.getElementById('reportTxTable');
  if (!mTx.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No transactions</td></tr>';
  } else {
    tbody.innerHTML = mTx.map((t,i)=>{
      const book = allBooks.find(b=>b.id===t.book_id)||{};
      const due  = new Date(t.due_date);
      // FIX [javascript:S3358]: Extract nested ternary into independent statements
      let status;
      if (t.status==='returned') {
        status = '<span class="badge badge-green">Returned</span>';
      } else if (due<now) {
        status = '<span class="badge badge-red">Overdue</span>';
      } else {
        status = '<span class="badge badge-orange">Issued</span>';
      }
      return `<tr>
        <td>${i+1}</td>
        <td>${esc(book.title||'Unknown')}</td>
        <td>${fmtDate(t.issue_date)}</td>
        <td>${fmtDate(t.due_date)}</td>
        <td>${t.return_date?fmtDate(t.return_date):'—'}</td>
        <td>${t.fine>0?'PKR '+t.fine:'—'}</td>
        <td>${t.fine>0?(t.fine_paid?'<span class="badge badge-green">Paid</span>':'<span class="badge badge-red">Unpaid</span>'):'—'}</td>
        <td>${status}</td>
      </tr>`;
    }).join('');
  }
  document.getElementById('reportDetailOverlay').style.display = 'flex';
}

function closeReportDetail() {
  document.getElementById('reportDetailOverlay').style.display = 'none';
}

/* ================================================================
   CSV EXPORT
   ================================================================ */
function exportCSV(type) {
  let csv = '';
  let filename = '';

  if (type === 'books') {
    filename = 'books_export.csv';
    csv = 'ID,Title,Author,ISBN,Genre,Available,Total,Year\n';
    csv += allBooks.map(b =>
      `${b.id},"${b.title}","${b.author}","${b.isbn||''}","${b.genre||''}",${b.available},${b.total},"${b.year||''}"`
    ).join('\n');
  } else if (type === 'members') {
    filename = 'members_export.csv';
    csv = 'ID,MemberID,Name,Username,Email,Phone,Status\n';
    csv += allMembers.filter(m=>m.role==='member').map(m =>
      `${m.id},"${m.member_id||''}","${m.name}","${m.username}","${m.email||''}","${m.phone||''}","${m.active!==false?'Active':'Inactive'}"`
    ).join('\n');
  } else if (type === 'transactions') {
    filename = 'transactions_export.csv';
    csv = 'ID,Member,Book,Issue Date,Due Date,Return Date,Fine,Fine Paid,Status\n';
    csv += allTx.map(t => {
      const member = allMembers.find(m=>m.id===t.member_id)||{};
      const book   = allBooks.find(b=>b.id===t.book_id)||{};
      const now    = new Date();
      const due    = new Date(t.due_date);
      // FIX [javascript:S3358]: Extract nested ternary into independent statements
      let status;
      if (t.status==='returned') {
        status = 'Returned';
      } else if (due < now) {
        status = 'Overdue';
      } else {
        status = 'Issued';
      }
      return `${t.id},"${member.name||''}","${book.title||''}","${t.issue_date}","${t.due_date}","${t.return_date||''}",${t.fine||0},"${t.fine_paid?'Yes':'No'}","${status}"`;
    }).join('\n');
  }

  const blob = new Blob([csv], {type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`${filename} downloaded!`, 'success');
}

/* ================================================================
   ADMIN FORMS — with uniqueness validation
   ================================================================ */
function wireAdminForms() {
  document.getElementById('addBookBtn')?.addEventListener('click', async () => {
    const title  = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const isbn   = document.getElementById('bookISBN').value.trim();
    const genre  = document.getElementById('bookGenre').value;
    const total  = +document.getElementById('bookCopies').value;
    const year   = document.getElementById('bookYear').value;

    if (!title || !author) { showToast('Title and Author required','error'); return; }
    if (!genre)             { showToast('Please select a category','error'); return; }

    // Client-side ISBN validation
    if (isbn.length > 0) {
      // FIX [javascript:S7781]: Use replaceAll() instead of replace() with global regex
      const isbnClean = isbn.replaceAll('-', '');
      if (!/^\d+$/.test(isbnClean)) {
        showToast('ISBN must contain numbers only (dashes allowed).', 'error');
        return;
      }
      if (isbnClean.length !== 10 && isbnClean.length !== 13) {
        showToast('ISBN must be exactly 10 or 13 digits.', 'error');
        return;
      }
    }

    const res  = await fetch(`${API}/books`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, author, isbn: isbn||null, genre, total, year: year||null })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error||'Failed to add book','error'); return; }
    allBooks.push(data);
    showToast(`"${title}" added to catalog!`,'success');
    document.getElementById('resetBookBtn').click();
    navigateTo('books');
  });

  document.getElementById('resetBookBtn')?.addEventListener('click', () => {
    ['bookTitle','bookAuthor','bookISBN','bookYear'].forEach(id => {
      document.getElementById(id).value='';
    });
    document.getElementById('bookGenre').value='';
    document.getElementById('bookCopies').value='1';
  });

  document.getElementById('addMemberBtn')?.addEventListener('click', async () => {
    const name     = document.getElementById('memberName').value.trim();
    const username = document.getElementById('memberUsername').value.trim();
    const email    = document.getElementById('memberEmail').value.trim();
    const phone    = document.getElementById('memberPhone').value.trim();
    const password = document.getElementById('memberPassword').value;

    if (!name||!username||!password) { showToast('Name, username and password required','error'); return; }

    // ── Client-side uniqueness checks ──────────────────────────────

    // Username uniqueness
    const dupUsername = allMembers.find(m => m.username.toLowerCase() === username.toLowerCase());
    if (dupUsername) {
      showToast(`Username "@${username}" is already taken.`, 'error');
      document.getElementById('memberUsername').focus();
      return;
    }

    // Email uniqueness (if provided)
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showToast('Please enter a valid email address.', 'error');
        document.getElementById('memberEmail').focus();
        return;
      }
      const dupEmail = allMembers.find(m => m.email && m.email.toLowerCase() === email.toLowerCase());
      if (dupEmail) {
        showToast(`Email "${email}" is already registered.`, 'error');
        document.getElementById('memberEmail').focus();
        return;
      }
    }

    // Phone uniqueness (if provided)
    if (phone) {
      // FIX [javascript:S7781]: Use replaceAll() instead of replace() with global regex
      const phoneDigits = phone.replaceAll(/\D/g, '');
      const dupPhone = allMembers.find(m => m.phone && m.phone.replaceAll(/\D/g, '') === phoneDigits);
      if (dupPhone) {
        showToast(`Phone number "${phone}" is already registered.`, 'error');
        document.getElementById('memberPhone').focus();
        return;
      }
    }

    const res  = await fetch(`${API}/members`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, username, email, phone, password, role:'member' })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error||'Failed to add member','error'); return; }
    allMembers.push(data);
    showToast(`${name} registered! Member ID: ${data.member_id||data.id}`,'success');
    document.getElementById('resetMemberBtn').click();
    navigateTo('members');
  });

  document.getElementById('resetMemberBtn')?.addEventListener('click', () => {
    ['memberName','memberUsername','memberEmail','memberPhone','memberPassword']
      .forEach(id=>{ document.getElementById(id).value=''; });
  });
}

/* ================================================================
   MEMBER DASHBOARD & PAGES
   ================================================================ */
function renderMemberDashboard() {
  const now     = new Date();
  const active  = allTx.filter(t=>t.status==='issued');
  const dueSoon = active.filter(t=>{
    const d = new Date(t.due_date);
    return (d-now)/(1000*60*60*24) <= 3 && d >= now;
  });
  const unpaid    = allTx.filter(t=>t.fine>0&&!t.fine_paid).reduce((s,t)=>s+(+t.fine),0);
  const fineCount = allTx.filter(t=>t.fine>0&&!t.fine_paid).length;

  animateCount('mstat-active', active.length);
  animateCount('mstat-due',    dueSoon.length);
  document.getElementById('mstat-fines').textContent      = `PKR ${unpaid.toLocaleString()}`;
  document.getElementById('mstat-fines-note').textContent = fineCount > 0 ? `${fineCount} unpaid` : 'All clear';
  animateCount('mstat-total',  allTx.length);

  // Return reminders for member
  const memberReminders = document.getElementById('memberReturnReminders');
  if (memberReminders) {
    const overdueOrSoon = active.filter(t => {
      const due  = new Date(t.due_date);
      const diff = Math.ceil((due-now)/(1000*60*60*24));
      return diff <= 3;
    });
    if (overdueOrSoon.length) {
      memberReminders.style.display = '';
      memberReminders.innerHTML = `
        <div style="background:rgba(240,160,48,0.1);border:1px solid var(--orange);border-radius:var(--radius-sm);padding:14px 18px;margin-bottom:20px">
          <strong style="color:var(--orange)">⚠️ Reminder:</strong>
          ${overdueOrSoon.map(t=>{
            const book = allBooks.find(b=>b.id===t.book_id)||{};
            const due  = new Date(t.due_date);
            const diff = Math.ceil((due-now)/(1000*60*60*24));
            // FIX [javascript:S3358]: Extract nested ternary into independent statements
            let label;
            if (diff < 0) {
              label = `overdue by ${Math.abs(diff)} day(s)`;
            } else if (diff === 0) {
              label = 'due today';
            } else {
              label = `due in ${diff} day(s)`;
            }
            return `<div style="margin-top:6px;font-size:0.85rem">📚 <strong>${esc(book.title||'Unknown')}</strong> — ${label}</div>`;
          }).join('')}
        </div>`;
    } else {
      memberReminders.style.display = 'none';
    }
  }

  const tbody = document.getElementById('memberActiveBooksTable');
  if (!active.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No active books</td></tr>';
    return;
  }
  tbody.innerHTML = active.map(t => {
    const book = allBooks.find(b=>b.id===t.book_id)||{};
    const due  = new Date(t.due_date);
    const diff = Math.ceil((due-now)/(1000*60*60*24));
    // FIX [javascript:S3358]: Extract nested ternary into independent statements
    let daysLabel;
    if (diff < 0) {
      daysLabel = `<span style="color:var(--red)">Overdue ${Math.abs(diff)}d</span>`;
    } else if (diff === 0) {
      daysLabel = `<span style="color:var(--orange)">Due today</span>`;
    } else {
      daysLabel = `${diff} days`;
    }
    const status = diff < 0
      ? '<span class="badge badge-red">Overdue</span>'
      : '<span class="badge badge-orange">Issued</span>';
    return `<tr>
      <td><strong>${esc(book.title||'Unknown')}</strong></td>
      <td>${fmtDate(t.issue_date)}</td>
      <td>${fmtDate(t.due_date)}</td>
      <td>${daysLabel}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function renderMyBooks() {
  const active = allTx.filter(t=>t.status==='issued');
  const now    = new Date();
  const tbody  = document.getElementById('myBooksTableBody');
  if (!active.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No books currently issued</td></tr>';
    return;
  }
  tbody.innerHTML = active.map((t,i)=>{
    const book = allBooks.find(b=>b.id===t.book_id)||{};
    const due  = new Date(t.due_date);
    const diff = Math.ceil((due-now)/(1000*60*60*24));
    // FIX [javascript:S3358]: Extract nested ternary into independent statements
    let daysLabel;
    if (diff < 0) {
      daysLabel = `<span style="color:var(--red)">Overdue ${Math.abs(diff)}d</span>`;
    } else if (diff === 0) {
      daysLabel = '<span style="color:var(--orange)">Due today</span>';
    } else {
      daysLabel = `${diff} days`;
    }
    const status = diff<0?'<span class="badge badge-red">Overdue</span>':'<span class="badge badge-orange">Issued</span>';
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(book.title||'Unknown')}</strong></td>
      <td>${esc(book.author||'—')}</td>
      <td>${fmtDate(t.issue_date)}</td>
      <td>${fmtDate(t.due_date)}</td>
      <td>${daysLabel}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function renderMyFines() {
  const fines = allTx.filter(t=>t.fine>0);
  const tbody = document.getElementById('myFinesTableBody');
  if (!fines.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No fines on record</td></tr>';
    return;
  }
  tbody.innerHTML = fines.map((t,i)=>{
    const book   = allBooks.find(b=>b.id===t.book_id)||{};
    const status = t.fine_paid
      ? '<span class="badge badge-green">Paid</span>'
      : '<span class="badge badge-red">Unpaid</span>';
    return `<tr>
      <td>${i+1}</td>
      <td>${esc(book.title||'Unknown')}</td>
      <td>${t.return_date?fmtDate(t.return_date):'—'}</td>
      <td><strong>PKR ${t.fine}</strong></td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

function renderMyHistory() {
  const tbody = document.getElementById('myHistoryTableBody');
  if (!allTx.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No history yet</td></tr>';
    return;
  }
  const now = new Date();
  tbody.innerHTML = allTx.map((t,i)=>{
    const book = allBooks.find(b=>b.id===t.book_id)||{};
    const due  = new Date(t.due_date);
    // FIX [javascript:S3358]: Extract nested ternary into independent statements
    let status;
    if (t.status==='returned') {
      status = '<span class="badge badge-green">Returned</span>';
    } else if (due<now) {
      status = '<span class="badge badge-red">Overdue</span>';
    } else {
      status = '<span class="badge badge-orange">Issued</span>';
    }
    return `<tr>
      <td>${i+1}</td>
      <td><strong>${esc(book.title||'Unknown')}</strong></td>
      <td>${fmtDate(t.issue_date)}</td>
      <td>${fmtDate(t.due_date)}</td>
      <td>${t.return_date?fmtDate(t.return_date):'—'}</td>
      <td>${t.fine>0?'PKR '+t.fine:'—'}</td>
      <td>${status}</td>
    </tr>`;
  }).join('');
}

/* ================================================================
   PAGINATION HELPER
   ================================================================ */
function renderPagination(containerId, currentPage, totalPages, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let html = `<div class="pagination">`;
  html += `<button class="pg-btn" ${currentPage===1?'disabled':''} onclick="(${onPageChange})(${currentPage-1})">‹ Prev</button>`;
  for (let i = 1; i <= totalPages; i++) {
    html += `<button class="pg-btn ${i===currentPage?'pg-active':''}" onclick="(${onPageChange})(${i})">${i}</button>`;
  }
  html += `<button class="pg-btn" ${currentPage===totalPages?'disabled':''} onclick="(${onPageChange})(${currentPage+1})">Next ›</button>`;
  html += `</div>`;
  container.innerHTML = html;
}

/* ================================================================
   GLOBAL SEARCH (Admin only)
   ================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const input   = document.getElementById('globalSearch');
  const results = document.getElementById('searchResults');
  if (!input) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.remove('active'); return; }

    const bHits = allBooks.filter(b=>(b.title+b.author).toLowerCase().includes(q)).slice(0,4);
    const mHits = allMembers.filter(m=>m.role==='member'&&(m.name+m.username).toLowerCase().includes(q)).slice(0,3);

    if (!bHits.length && !mHits.length) { results.classList.remove('active'); return; }

    results.innerHTML = [
      ...bHits.map(b=>`<div class="search-result-item" onclick="navigateTo('books')">
        <strong>${esc(b.title)}</strong> <span>${esc(b.author)} · Book</span></div>`),
      ...mHits.map(m=>`<div class="search-result-item" onclick="navigateTo('members')">
        <strong>${esc(m.name)}</strong> <span>@${esc(m.username)} · Member</span></div>`)
    ].join('');
    results.classList.add('active');
  });

  document.addEventListener('click', e=>{
    if (!e.target.closest('.search-bar')) results.classList.remove('active');
  });
});

/* ================================================================
   MODAL
   ================================================================ */
let _modalCallback = null;

function openModal(title, body, onConfirm) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML    = body;
  _modalCallback = onConfirm;
  document.getElementById('modalOverlay').classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('modalConfirm').addEventListener('click', async () => {
    if (_modalCallback) await _modalCallback();
    closeModal();
  });
  document.getElementById('modalCancel').addEventListener('click', closeModal);
  document.getElementById('modalClose').addEventListener('click',  closeModal);
  document.getElementById('modalOverlay').addEventListener('click', e=>{
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
});

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  _modalCallback = null;
}

/* ================================================================
   TOAST
   ================================================================ */
function showToast(msg, type='info') {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(toast);
  setTimeout(()=>{ toast.classList.add('hiding'); setTimeout(()=>toast.remove(),300); }, 4000);
}

/* ================================================================
   AUTH HELPERS
   ================================================================ */
globalThis.switchTab = function(tab) {
  document.getElementById('formSignIn').style.display = tab==='signin' ? '' : 'none';
  document.getElementById('formSignUp').style.display = tab==='signup' ? '' : 'none';
  document.getElementById('tabSignIn').classList.toggle('active', tab==='signin');
  document.getElementById('tabSignUp').classList.toggle('active', tab==='signup');
};

globalThis.togglePw = function(inputId) {
  const inp = document.getElementById(inputId);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
};

/* ================================================================
   UTILS
   ================================================================ */
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  // FIX [javascript:S7773]: Use Number.isNaN instead of isNaN
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' });
}

function esc(str) {
  if (!str) return '';
  // FIX [javascript:S7781]: Use replaceAll() instead of replace() with global regex
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  // FIX [javascript:S7773]: Use Number.parseInt instead of parseInt
  const start = Number.parseInt(el.textContent, 10) || 0;
  if (start === target) return;
  const duration = 600, steps = 20;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    el.textContent = Math.round(start + (target - start) * step / steps);
    if (step >= steps) { el.textContent = target; clearInterval(interval); }
  }, duration / steps);
}