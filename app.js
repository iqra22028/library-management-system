/* ================================================================
   LibraryOS — app.js
   Full role-based frontend logic
   ================================================================ */

const API = 'http://localhost:3000/api';

/* ── STATE ─────────────────────────────────────────────────────── */
let currentUser  = null;   // logged-in user object
let allBooks     = [];
let allMembers   = [];
let allTx        = [];
let activeCatFilter = '';
let currentBookFilter = '';
let currentAvailFilter = '';

/* ── INIT ───────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('libraryos_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    bootApp();
  }
  // Show login
  document.getElementById('currentDate').textContent = fmtDate(new Date());
  document.getElementById('memberDate').textContent  = fmtDate(new Date());
  wireLoginUI();
  wireNav();
  wireSidebar();
  wireAdminForms();
});

/* ================================================================
   LOGIN / AUTH
   ================================================================ */
function wireLoginUI() {
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('registerBtn').addEventListener('click', doRegister);
  document.getElementById('logoutBtn').addEventListener('click', doLogout);
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
    bootApp();
  } catch(e) {
    showToast('Cannot connect to server. Is it running?', 'error');
  }
}

async function doRegister() {
  const name     = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUsername').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!name || !username || !password) { showToast('Fill required fields', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

  try {
    const res  = await fetch(`${API}/members`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, username, email, password, role: 'member' })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Registration failed', 'error'); return; }
    showToast('Account created! Please sign in.', 'success');
    switchTab('signin');
  } catch(e) {
    showToast('Cannot connect to server', 'error');
  }
}

function doLogout() {
  currentUser = null;
  sessionStorage.removeItem('libraryos_user');
  allBooks = []; allMembers = []; allTx = [];
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('loginUsername').value = '';
  document.getElementById('loginPassword').value = '';
}

function bootApp() {
  // Hide login
  document.getElementById('loginOverlay').classList.add('hidden');

  // Update sidebar user info
  document.getElementById('userDisplayName').textContent = currentUser.name;
  document.getElementById('userDisplayRole').textContent = currentUser.role === 'admin' ? 'Administrator' : 'Member';
  const initials = currentUser.name.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;

  // Show correct nav
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

function navigateTo(page) {
  // Guard member from admin pages
  if (currentUser && currentUser.role === 'member') {
    const memberPages = ['member-dashboard','my-books','my-fines','my-history'];
    if (!memberPages.includes(page)) return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  // Breadcrumb
  const labels = {
    'dashboard':'Dashboard','books':'Books','members':'Members',
    'issue':'Issue Book','transactions':'Transactions','reports':'Student Reports',
    'addbook':'Add Book','addmember':'Add Member',
    'member-dashboard':'My Dashboard','my-books':'My Books',
    'my-fines':'My Fines','my-history':'My History'
  };
  document.getElementById('breadcrumbCurrent').textContent = labels[page] || page;

  // Refresh data on page visit
  if (currentUser?.role === 'admin') {
    if (page === 'dashboard')     renderAdminDashboard();
    if (page === 'books')         renderBooks();
    if (page === 'members')       renderMembers();
    if (page === 'transactions')  renderTransactions();
    if (page === 'issue')         populateIssueDropdowns();
    if (page === 'reports')       renderReports();
  } else {
    if (page === 'member-dashboard') renderMemberDashboard();
    if (page === 'my-books')         renderMyBooks();
    if (page === 'my-fines')         renderMyFines();
    if (page === 'my-history')       renderMyHistory();
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
  const totalBooks   = allBooks.reduce((s,b) => s + (b.total||0), 0);
  const totalAvail   = allBooks.reduce((s,b) => s + (b.available||0), 0);
  const activeMembers= allMembers.filter(m => m.active !== false && m.role === 'member').length;
  const issuedTx     = allTx.filter(t => t.status === 'issued');
  const now          = new Date();
  const overdueTx    = issuedTx.filter(t => new Date(t.due_date) < now);
  const unpaidFines  = allTx.filter(t => t.fine > 0 && !t.fine_paid).reduce((s,t)=>s+(+t.fine),0);

  animateCount('stat-books',   totalBooks);
  animateCount('stat-members', activeMembers);
  animateCount('stat-issued',  issuedTx.length);
  animateCount('stat-overdue', overdueTx.length);
  document.getElementById('stat-fines').textContent = `PKR ${unpaidFines.toLocaleString()} fines`;

  updateNotifBadge();
  renderRecentTransactions();
  updateDonut(totalAvail, issuedTx.length - overdueTx.length, overdueTx.length, totalBooks);
}

function renderRecentTransactions() {
  const tbody = document.getElementById('recentTxTable');
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
    let badge    = '';
    if (t.status === 'returned') badge = '<span class="badge badge-green">Returned</span>';
    else if (due < now)          badge = '<span class="badge badge-red">Overdue</span>';
    else                         badge = '<span class="badge badge-orange">Issued</span>';
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
  const circ    = 2 * Math.PI * 70; // ~440
  const safeTotal = total || 1;
  const aFrac = available / safeTotal;
  const iFrac = issued    / safeTotal;
  const oFrac = overdue   / safeTotal;

  const aLen = aFrac * circ;
  const iLen = iFrac * circ;
  const oLen = oFrac * circ;

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
   BOOKS PAGE
   ================================================================ */
function renderBooks() {
  const search = (document.getElementById('bookSearch')?.value || currentBookFilter).toLowerCase();
  const avail  = document.getElementById('availFilter')?.value || currentAvailFilter;

  let filtered = allBooks.filter(b => {
    const matchCat   = !activeCatFilter || b.genre === activeCatFilter;
    const matchSearch= !search || (b.title+b.author+(b.isbn||'')+(b.genre||'')).toLowerCase().includes(search);
    const matchAvail = !avail
      || (avail === 'available'   && b.available > 0)
      || (avail === 'unavailable' && b.available <= 0);
    return matchCat && matchSearch && matchAvail;
  });

  const tbody = document.getElementById('booksTableBody');
  if (!filtered.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No books found</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map((b,i) => `
    <tr>
      <td>${i+1}</td>
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

// Category tabs
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('categoryTabs')?.addEventListener('click', e => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeCatFilter = tab.dataset.cat;
    renderBooks();
  });

  document.getElementById('bookSearch')?.addEventListener('input', e => {
    currentBookFilter = e.target.value;
    renderBooks();
  });
  document.getElementById('availFilter')?.addEventListener('change', e => {
    currentAvailFilter = e.target.value;
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
        <input class="form-control" id="eb-title" value="${esc(b.title)}"/></div>
      <div class="form-group"><label class="form-label">Author</label>
        <input class="form-control" id="eb-author" value="${esc(b.author)}"/></div>
      <div class="form-group"><label class="form-label">ISBN</label>
        <input class="form-control" id="eb-isbn" value="${b.isbn||''}"/></div>
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
      const payload = {
        title: document.getElementById('eb-title').value,
        author: document.getElementById('eb-author').value,
        isbn: document.getElementById('eb-isbn').value,
        genre: document.getElementById('eb-genre').value,
        total: +document.getElementById('eb-total').value,
        available: +document.getElementById('eb-available').value,
        year: document.getElementById('eb-year').value || null
      };
      const res = await fetch(`${API}/books/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        allBooks = allBooks.map(x=>x.id===id?updated:x);
        renderBooks();
        showToast('Book updated!','success');
      } else { showToast('Update failed','error'); }
    }
  );
}

function deleteBook(id) {
  const b = allBooks.find(x=>x.id===id);
  openModal('Delete Book', `<p>Are you sure you want to delete <strong>${esc(b?.title)}</strong>? This cannot be undone.</p>`,
    async () => {
      const res = await fetch(`${API}/books/${id}`, {method:'DELETE'});
      if (res.ok) {
        allBooks = allBooks.filter(x=>x.id!==id);
        renderBooks();
        renderAdminDashboard();
        showToast('Book deleted','success');
      } else { showToast('Delete failed','error'); }
    }
  );
}

/* ================================================================
   MEMBERS PAGE
   ================================================================ */
function renderMembers() {
  const members = allMembers.filter(m => m.role === 'member');
  const tbody   = document.getElementById('membersTableBody');
  if (!members.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No members registered yet</td></tr>';
    return;
  }
  tbody.innerHTML = members.map((m,i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong>${esc(m.name)}</strong></td>
      <td><code>${esc(m.username)}</code></td>
      <td>${m.email||'—'}</td>
      <td>${m.phone||'—'}</td>
      <td>${m.active !== false
        ? '<span class="badge badge-green">Active</span>'
        : '<span class="badge badge-red">Inactive</span>'}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-ghost" onclick="viewMemberReport(${m.id})">Report</button>
        <button class="btn btn-sm ${m.active!==false?'btn-warning':'btn-success'}"
          onclick="toggleMember(${m.id})">${m.active!==false?'Disable':'Enable'}</button>
      </td>
    </tr>`).join('');
}

async function toggleMember(id) {
  const res  = await fetch(`${API}/members/${id}/toggle`, {method:'PUT'});
  if (res.ok) {
    const updated = await res.json();
    allMembers = allMembers.map(m => m.id===id ? updated : m);
    renderMembers();
    showToast('Member status updated','success');
  }
}

/* ================================================================
   ISSUE BOOK
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

  // Show info box when both selected
  const update = () => {
    if (memberSel.value && bookSel.value) {
      const now = new Date();
      const due = new Date(now); due.setDate(due.getDate()+14);
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

    const now    = new Date();
    const due    = new Date(now); due.setDate(due.getDate()+14);
    const payload = {
      member_id: +memberId, book_id: +bookId,
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

    showToast(`Book issued successfully!`,'success');
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
    let status    = '';
    if (t.status==='returned') status = '<span class="badge badge-green">Returned</span>';
    else if (due < now)        status = '<span class="badge badge-red">Overdue</span>';
    else                       status = '<span class="badge badge-orange">Issued</span>';

    const fineBadge = t.fine > 0
      ? (t.fine_paid
          ? `<span class="badge badge-green">PKR ${t.fine} ✓</span>`
          : `<span class="badge badge-red">PKR ${t.fine}</span>`)
      : '—';

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
  const fine = overdueDays * 10; // PKR 10/day

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
  openModal('Pay Fine','<p>Mark this fine as paid?', async () => {
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

  if (!members.length) {
    grid.innerHTML = '<div class="empty-state">No members found</div>';
    return;
  }

  grid.innerHTML = members.map(m => {
    const mTx      = allTx.filter(t => t.member_id === m.id);
    const active   = mTx.filter(t => t.status==='issued').length;
    const total    = mTx.length;
    const now      = new Date();
    const overdue  = mTx.filter(t => t.status==='issued' && new Date(t.due_date)<now).length;
    const unpaid   = mTx.filter(t => t.fine>0 && !t.fine_paid).reduce((s,t)=>s+(+t.fine),0);

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
        onclick="viewMemberReport(${m.id})">
        View Full Report
      </button>
    </div>`;
  }).join('');
}

function viewMemberReport(memberId) {
  const member = allMembers.find(m=>m.id===memberId);
  if (!member) return;

  const mTx = allTx.filter(t=>t.member_id===memberId);
  const now  = new Date();
  const active  = mTx.filter(t=>t.status==='issued').length;
  const total   = mTx.length;
  const overdue = mTx.filter(t=>t.status==='issued'&&new Date(t.due_date)<now).length;
  const unpaid  = mTx.filter(t=>t.fine>0&&!t.fine_paid).reduce((s,t)=>s+(+t.fine),0);

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
      let status = '';
      if (t.status==='returned') status='<span class="badge badge-green">Returned</span>';
      else if (due<now)          status='<span class="badge badge-red">Overdue</span>';
      else                       status='<span class="badge badge-orange">Issued</span>';
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
   ADMIN FORMS
   ================================================================ */
function wireAdminForms() {
  // Add Book
  document.getElementById('addBookBtn')?.addEventListener('click', async () => {
    const title  = document.getElementById('bookTitle').value.trim();
    const author = document.getElementById('bookAuthor').value.trim();
    const isbn   = document.getElementById('bookISBN').value.trim();
    const genre  = document.getElementById('bookGenre').value;
    const total  = +document.getElementById('bookCopies').value;
    const year   = document.getElementById('bookYear').value;

    if (!title || !author) { showToast('Title and Author required','error'); return; }
    if (!genre)             { showToast('Please select a category','error'); return; }

    const res = await fetch(`${API}/books`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title, author, isbn, genre, total, year: year||null })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error||'Failed to add book','error'); return; }
    allBooks.push(data);
    showToast(`"${title}" added to catalog!`,'success');
    document.getElementById('resetBookBtn').click();
    navigateTo('books');
  });

  document.getElementById('resetBookBtn')?.addEventListener('click', () => {
    ['bookTitle','bookAuthor','bookISBN','bookYear'].forEach(id=>{
      document.getElementById(id).value='';
    });
    document.getElementById('bookGenre').value='';
    document.getElementById('bookCopies').value='1';
  });

  // Add Member
  document.getElementById('addMemberBtn')?.addEventListener('click', async () => {
    const name     = document.getElementById('memberName').value.trim();
    const username = document.getElementById('memberUsername').value.trim();
    const email    = document.getElementById('memberEmail').value.trim();
    const phone    = document.getElementById('memberPhone').value.trim();
    const password = document.getElementById('memberPassword').value;

    if (!name||!username||!password) { showToast('Name, username and password required','error'); return; }

    const res = await fetch(`${API}/members`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, username, email, phone, password, role:'member' })
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error||'Failed to add member','error'); return; }
    allMembers.push(data);
    showToast(`${name} registered!`,'success');
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
  const now    = new Date();
  const active = allTx.filter(t=>t.status==='issued');
  const dueSoon= active.filter(t=>{
    const d = new Date(t.due_date);
    return (d-now)/(1000*60*60*24) <= 3 && d >= now;
  });
  const unpaid = allTx.filter(t=>t.fine>0&&!t.fine_paid).reduce((s,t)=>s+(+t.fine),0);
  const fineCount = allTx.filter(t=>t.fine>0&&!t.fine_paid).length;

  animateCount('mstat-active', active.length);
  animateCount('mstat-due',    dueSoon.length);
  document.getElementById('mstat-fines').textContent = `PKR ${unpaid.toLocaleString()}`;
  document.getElementById('mstat-fines-note').textContent = fineCount > 0 ? `${fineCount} unpaid` : 'All clear';
  animateCount('mstat-total',  allTx.length);

  // Active books table
  const tbody = document.getElementById('memberActiveBooksTable');
  if (!active.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No active books</td></tr>';
    return;
  }
  tbody.innerHTML = active.map(t => {
    const book = allBooks.find(b=>b.id===t.book_id)||{};
    const due  = new Date(t.due_date);
    const diff = Math.ceil((due-now)/(1000*60*60*24));
    const daysLabel = diff < 0
      ? `<span style="color:var(--red)">Overdue ${Math.abs(diff)}d</span>`
      : diff === 0 ? `<span style="color:var(--orange)">Due today</span>`
      : `${diff} days`;
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
    const daysLabel = diff<0?`<span style="color:var(--red)">Overdue ${Math.abs(diff)}d</span>`:diff===0?'<span style="color:var(--orange)">Due today</span>':`${diff} days`;
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
    const book = allBooks.find(b=>b.id===t.book_id)||{};
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
    let status = '';
    if (t.status==='returned') status='<span class="badge badge-green">Returned</span>';
    else if (due<now)          status='<span class="badge badge-red">Overdue</span>';
    else                       status='<span class="badge badge-orange">Issued</span>';
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
   AUTH HELPERS (global, called from HTML)
   ================================================================ */
window.switchTab = function(tab) {
  document.getElementById('formSignIn').style.display = tab==='signin' ? '' : 'none';
  document.getElementById('formSignUp').style.display = tab==='signup' ? '' : 'none';
  document.getElementById('tabSignIn').classList.toggle('active', tab==='signin');
  document.getElementById('tabSignUp').classList.toggle('active', tab==='signup');
};

window.togglePw = function(inputId, btn) {
  const inp = document.getElementById(inputId);
  inp.type  = inp.type === 'password' ? 'text' : 'password';
};

/* ================================================================
   UTILS
   ================================================================ */
function fmtDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-PK', { day:'2-digit', month:'short', year:'numeric' });
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;
  const duration = 600, steps = 20;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    el.textContent = Math.round(start + (target - start) * step / steps);
    if (step >= steps) { el.textContent = target; clearInterval(interval); }
  }, duration / steps);
}