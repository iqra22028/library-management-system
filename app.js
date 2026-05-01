'use strict';

/* ── API BASE ───────────────────────────────────────────────────── */
const API = 'http://localhost:3000/api';

/* ── STATE ──────────────────────────────────────────────────────── */
const State = {
  books: [],
  members: [],
  transactions: [],
  currentPage:  'dashboard',
  loggedIn:     false,
  currentUser:  null,
  modalCallback: null,
};

/* ── UTILS ──────────────────────────────────────────────────────── */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const fmt = d => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';
const today = () => new Date().toISOString().split('T')[0];
const addDays = (d, n) => { const dt = new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().split('T')[0]; };
const isOverdue = tx => !tx.return_date && tx.due_date < today();
const calcFine = tx => {
  const end = tx.return_date || today();
  if (end > tx.due_date) return Math.floor((new Date(end)-new Date(tx.due_date))/(86400000))*5;
  return 0;
};

/* ── API CALLS ──────────────────────────────────────────────────── */
async function apiFetch(path, method = 'GET', body = null) {
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API + path, opts);
    return await res.json();
  } catch(e) {
    toast('Server error! Is the backend running?', 'error');
    return null;
  }
}

/* ── LOAD ALL DATA ──────────────────────────────────────────────── */
async function loadAll() {
  const [books, members, transactions] = await Promise.all([
    apiFetch('/books'),
    apiFetch('/members'),
    apiFetch('/transactions'),
  ]);
  State.books        = books        || [];
  State.members      = members      || [];
  State.transactions = transactions || [];
}

/* ── SIDEBAR USER UPDATE ────────────────────────────────────────── */
function updateSidebarUser(user) {
  $('#userDisplayName').textContent = user.name;
  $('#userDisplayRole').textContent = user.role === 'admin' ? 'Administrator' : 'Member';
  const initials = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2);
  $('#userAvatar').textContent = initials;
}

/* ── RIPPLE ─────────────────────────────────────────────────────── */
function addRipple(btn) {
  btn.addEventListener('click', function(e) {
    const rect = this.getBoundingClientRect();
    const r = document.createElement('span');
    const d = Math.max(rect.width, rect.height);
    r.className = 'ripple';
    r.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX-rect.left-d/2}px;top:${e.clientY-rect.top-d/2}px`;
    this.appendChild(r);
    setTimeout(() => r.remove(), 600);
  });
}

/* ── TOAST ──────────────────────────────────────────────────────── */
function toast(msg, type = 'success', duration = 3500) {
  const icons = { success:'✓', error:'✕', warning:'⚠', info:'ℹ' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'✓'}</span><span class="toast-msg">${msg}</span><button class="toast-close">×</button>`;
  $('#toastContainer').appendChild(t);
  t.querySelector('.toast-close').onclick = () => dismissToast(t);
  setTimeout(() => dismissToast(t), duration);
}
function dismissToast(t) {
  t.classList.add('hiding');
  setTimeout(() => t.remove(), 320);
}

/* ── MODAL ──────────────────────────────────────────────────────── */
function showModal(title, body, onConfirm, danger = true) {
  $('#modalTitle').textContent = title;
  $('#modalBody').textContent  = body;
  $('#modalConfirm').className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`;
  State.modalCallback = onConfirm;
  $('#modalOverlay').classList.add('active');
}
function closeModal() {
  $('#modalOverlay').classList.remove('active');
  State.modalCallback = null;
}
$('#modalClose').onclick   = closeModal;
$('#modalCancel').onclick  = closeModal;
$('#modalConfirm').onclick = () => { if(State.modalCallback) State.modalCallback(); closeModal(); };
$('#modalOverlay').addEventListener('click', e => { if(e.target === $('#modalOverlay')) closeModal(); });

/* ── NAVIGATE ───────────────────────────────────────────────────── */
async function navigate(page) {
  if (!page) return;
  State.currentPage = page;
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = $(`#page-${page}`);
  if (pg) pg.classList.add('active');
  const nav = $(`.nav-item[data-page="${page}"]`);
  if (nav) nav.classList.add('active');
  const labels = { dashboard:'Dashboard', books:'Book Catalog', members:'Members', issue:'Issue Book', transactions:'Transactions', addbook:'Add Book', addmember:'Add Member' };
  $('#breadcrumbCurrent').textContent = labels[page] || page;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await loadAll();
  if (page === 'dashboard')    renderDashboard();
  if (page === 'books')        renderBooks();
  if (page === 'members')      renderMembers();
  if (page === 'transactions') renderTransactions();
  if (page === 'issue')        renderIssueDropdowns();
  $('#sidebar').classList.remove('mobile-open');
}
$$('.nav-item').forEach(item => item.addEventListener('click', () => navigate(item.dataset.page)));
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-page]');
  if (btn && !btn.classList.contains('nav-item')) navigate(btn.dataset.page);
});

/* ── MOBILE SIDEBAR ─────────────────────────────────────────────── */
$('#mobileMenuBtn').onclick = () => $('#sidebar').classList.toggle('mobile-open');
$('#sidebarToggle').onclick = () => $('#sidebar').classList.toggle('mobile-open');

/* ── DATE ───────────────────────────────────────────────────────── */
function updateDate() {
  $('#currentDate').textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}
updateDate();

/* ── ANIMATED COUNTER ───────────────────────────────────────────── */
function animateCount(el, target) {
  const start = parseInt(el.textContent) || 0;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / 600, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * ease);
    if (progress < 1) requestAnimationFrame(step);
    else { el.textContent = target; el.classList.add('counting'); setTimeout(() => el.classList.remove('counting'), 300); }
  }
  requestAnimationFrame(step);
}

/* ── DONUT CHART ────────────────────────────────────────────────── */
function updateDonut() {
  const totalCopies = State.books.reduce((s, b) => s + b.total, 0);
  const available   = State.books.reduce((s, b) => s + b.available, 0);
  const issued      = State.transactions.filter(t => !t.return_date).length;
  const overdue     = State.transactions.filter(t => isOverdue(t)).length;
  const circumf     = 2 * Math.PI * 70;
  if (totalCopies === 0) return;
  const aLen = (available / totalCopies) * circumf;
  const iLen = (issued    / totalCopies) * circumf;
  const oLen = (overdue   / totalCopies) * circumf;
  const segA = $('.seg-available'), segI = $('.seg-issued'), segO = $('.seg-overdue');
  segA.style.strokeDasharray  = `${aLen} ${circumf - aLen}`;
  segA.style.strokeDashoffset = `${circumf / 4}`;
  const iOffset = circumf / 4 - aLen;
  segI.style.strokeDasharray  = `${iLen} ${circumf - iLen}`;
  segI.style.strokeDashoffset = `${iOffset}`;
  const oOffset = iOffset - iLen;
  segO.style.strokeDasharray  = `${oLen} ${circumf - oLen}`;
  segO.style.strokeDashoffset = `${oOffset}`;
  $('#donutCenterNum').textContent = totalCopies;
}

/* ── DASHBOARD ──────────────────────────────────────────────────── */
function renderDashboard() {
  const totalBooks   = State.books.reduce((s, b) => s + b.total, 0);
  const totalMembers = State.members.filter(m => m.active).length;
  const issued       = State.transactions.filter(t => !t.return_date).length;
  const overdueList  = State.transactions.filter(t => isOverdue(t));
  const totalFines   = overdueList.reduce((s, t) => s + calcFine(t), 0);
  animateCount($('#stat-books'),   totalBooks);
  animateCount($('#stat-members'), totalMembers);
  animateCount($('#stat-issued'),  issued);
  animateCount($('#stat-overdue'), overdueList.length);
  $('#stat-fines').textContent = `PKR ${totalFines} fines`;
  const badge = $('#notifBadge');
  badge.textContent = overdueList.length;
  badge.classList.toggle('zero', overdueList.length === 0);
  const tbody  = $('#recentTxTable');
  const recent = [...State.transactions].slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No transactions yet</td></tr>';
  } else {
    tbody.innerHTML = recent.map(tx => {
      const m  = State.members.find(m => m.id === tx.member_id);
      const b  = State.books.find(b => b.id === tx.book_id);
      const od = isOverdue(tx);
      const status = tx.return_date ? '<span class="badge badge-green">Returned</span>' : od ? '<span class="badge badge-red">Overdue</span>' : '<span class="badge badge-orange">Issued</span>';
      return `<tr><td><strong>${m?.name||'—'}</strong></td><td>${b?.title||'—'}</td><td>${fmt(tx.issue_date)}</td><td style="color:${od?'var(--red)':'inherit'}">${fmt(tx.due_date)}</td><td>${status}</td></tr>`;
    }).join('');
  }
  setTimeout(updateDonut, 200);
}

/* ── BOOKS ──────────────────────────────────────────────────────── */
function renderBooks(filter = '', genre = '', avail = '') {
  const tbody = $('#booksTableBody');
  let list = [...State.books];
  if (filter) list = list.filter(b => b.title.toLowerCase().includes(filter.toLowerCase()) || b.author.toLowerCase().includes(filter.toLowerCase()) || (b.isbn||'').includes(filter) || (b.genre||'').toLowerCase().includes(filter.toLowerCase()));
  if (genre)  list = list.filter(b => b.genre === genre);
  if (avail === 'available')   list = list.filter(b => b.available > 0);
  if (avail === 'unavailable') list = list.filter(b => b.available === 0);
  if (!list.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No books found</td></tr>'; return; }
  tbody.innerHTML = list.map((b, i) => {
    const availBadge = b.available > 0 ? `<span class="badge badge-green">${b.available}</span>` : `<span class="badge badge-red">0</span>`;
    return `<tr style="animation:pageFadeIn 0.3s ease ${i*0.04}s both">
      <td>${b.id}</td>
      <td><strong>${b.title}</strong><br><small style="color:var(--text-muted)">${b.year||''}</small></td>
      <td>${b.author}</td>
      <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;background:var(--bg);padding:2px 6px;border-radius:4px">${b.isbn||'—'}</code></td>
      <td>${b.genre||'—'}</td>
      <td>${availBadge} / ${b.total}</td>
      <td>${b.total}</td>
      <td><div class="actions-cell">
        <button class="btn btn-warning btn-sm" onclick="editBookPrompt(${b.id})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteBook(${b.id})">Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}
$('#bookSearch').addEventListener('input',   e => renderBooks(e.target.value, $('#genreFilter').value, $('#availFilter').value));
$('#genreFilter').addEventListener('change', e => renderBooks($('#bookSearch').value, e.target.value, $('#availFilter').value));
$('#availFilter').addEventListener('change', e => renderBooks($('#bookSearch').value, $('#genreFilter').value, e.target.value));

async function deleteBook(id) {
  const b = State.books.find(x => x.id === id);
  const active = State.transactions.filter(t => t.book_id === id && !t.return_date).length;
  if (active) { toast('Cannot delete — book has active issues!', 'error'); return; }
  showModal('Delete Book', `Are you sure you want to delete "${b.title}"?`, async () => {
    await apiFetch(`/books/${id}`, 'DELETE');
    toast(`"${b.title}" deleted`, 'success');
    await loadAll();
    renderBooks();
    renderDashboard();
  });
}

function editBookPrompt(id) {
  const b = State.books.find(x => x.id === id);
  $('#bookTitle').value  = b.title;
  $('#bookAuthor').value = b.author;
  $('#bookISBN').value   = b.isbn||'';
  $('#bookGenre').value  = b.genre||'';
  $('#bookCopies').value = b.total;
  $('#bookYear').value   = b.year||'';
  navigate('addbook');
  const btn = $('#addBookBtn');
  btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Update Book';
  btn.dataset.editId = id;
  toast('Editing: ' + b.title, 'info', 2000);
}

/* ── ADD / UPDATE BOOK ──────────────────────────────────────────── */
$('#addBookBtn').addEventListener('click', async () => {
  const title  = $('#bookTitle').value.trim();
  const author = $('#bookAuthor').value.trim();
  const isbn   = $('#bookISBN').value.trim();
  const genre  = $('#bookGenre').value.trim();
  const total  = parseInt($('#bookCopies').value) || 1;
  const year   = parseInt($('#bookYear').value)   || null;
  if (!title || !author) { toast('Title and Author are required!', 'error'); return; }
  const editId = parseInt($('#addBookBtn').dataset.editId);
  if (editId) {
    const b = State.books.find(x => x.id === editId);
    const diff = total - b.total;
    const available = Math.max(0, b.available + diff);
    const result = await apiFetch(`/books/${editId}`, 'PUT', { title, author, isbn, genre, total, available, year });
    if (result) toast(`"${title}" updated!`, 'success');
    delete $('#addBookBtn').dataset.editId;
    $('#addBookBtn').innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Add Book';
  } else {
    const result = await apiFetch('/books', 'POST', { title, author, isbn, genre, total, year });
    if (result && !result.error) toast(`"${title}" added to database!`, 'success');
    else toast(result?.error || 'Failed to add book', 'error');
  }
  resetBookForm();
  await navigate('books');
});

$('#resetBookBtn').addEventListener('click', () => {
  resetBookForm();
  delete $('#addBookBtn').dataset.editId;
  $('#addBookBtn').innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> Add Book';
});
function resetBookForm() {
  ['#bookTitle','#bookAuthor','#bookISBN','#bookGenre','#bookYear'].forEach(s => $(s).value = '');
  $('#bookCopies').value = 1;
}

/* ── MEMBERS ────────────────────────────────────────────────────── */
function renderMembers() {
  const tbody = $('#membersTableBody');
  if (!State.members.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No members registered yet</td></tr>'; return; }
  tbody.innerHTML = State.members.map((m, i) => `
    <tr style="animation:pageFadeIn 0.3s ease ${i*0.05}s both">
      <td>${m.id}</td>
      <td><div style="font-weight:600">${m.name}</div></td>
      <td><code style="font-family:'JetBrains Mono',monospace;font-size:0.8rem">${m.username}</code></td>
      <td>${m.email||'—'}</td><td>${m.phone||'—'}</td>
      <td>${m.active ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-gray">Inactive</span>'}</td>
      <td><div class="actions-cell">
        <button class="btn ${m.active?'btn-danger':'btn-success'} btn-sm" onclick="toggleMember(${m.id})">${m.active?'Deactivate':'Activate'}</button>
      </div></td>
    </tr>`).join('');
}

async function toggleMember(id) {
  const result = await apiFetch(`/members/${id}/toggle`, 'PUT');
  if (result) {
    toast(`${result.name} ${result.active?'activated':'deactivated'}`, result.active?'success':'warning');
    await loadAll();
    renderMembers();
  }
}

/* ── ADD MEMBER ─────────────────────────────────────────────────── */
$('#addMemberBtn').addEventListener('click', async () => {
  const name     = $('#memberName').value.trim();
  const username = $('#memberUsername').value.trim();
  const email    = $('#memberEmail').value.trim();
  const phone    = $('#memberPhone').value.trim();
  const password = $('#memberPassword').value.trim();
  if (!name || !username || !password) { toast('Name, username & password are required!', 'error'); return; }
  const result = await apiFetch('/members', 'POST', { name, username, email, phone, password, role: 'member' });
  if (result && !result.error) {
    toast(`${name} registered!`, 'success');
    resetMemberForm();
    await navigate('members');
  } else {
    toast(result?.error || 'Failed to register member', 'error');
  }
});
$('#resetMemberBtn').addEventListener('click', resetMemberForm);
function resetMemberForm() {
  ['#memberName','#memberUsername','#memberEmail','#memberPhone','#memberPassword'].forEach(s => $(s).value = '');
}

/* ── ISSUE BOOK ─────────────────────────────────────────────────── */
function renderIssueDropdowns() {
  const memberSel = $('#issueMember'), bookSel = $('#issueBook');
  memberSel.innerHTML = '<option value="">— Choose Member —</option>' + State.members.filter(m => m.active).map(m => `<option value="${m.id}">${m.name} (${m.username})</option>`).join('');
  bookSel.innerHTML   = '<option value="">— Choose Book —</option>'   + State.books.filter(b => b.available > 0).map(b => `<option value="${b.id}">${b.title} by ${b.author} (${b.available} left)</option>`).join('');
  function updateInfoBox() {
    if (memberSel.value && bookSel.value) {
      const now = today(), due = addDays(now, 14);
      $('#issueDate').textContent = fmt(now); $('#dueDate').textContent = fmt(due);
      $('#issueInfoBox').style.display = 'flex';
    } else { $('#issueInfoBox').style.display = 'none'; }
  }
  memberSel.onchange = updateInfoBox; bookSel.onchange = updateInfoBox;
}

$('#issueBtnSubmit').addEventListener('click', async () => {
  const member_id = parseInt($('#issueMember').value);
  const book_id   = parseInt($('#issueBook').value);
  if (!member_id || !book_id) { toast('Please select both member and book!', 'error'); return; }
  const member = State.members.find(m => m.id === member_id);
  const book   = State.books.find(b => b.id === book_id);
  const issue_date = today(), due_date = addDays(today(), 14);
  const result = await apiFetch('/transactions', 'POST', { member_id, book_id, issue_date, due_date });
  if (result && !result.error) {
    toast(`"${book.title}" issued to ${member.name}. Due: ${fmt(due_date)}`, 'success');
    await navigate('transactions');
  } else {
    toast(result?.error || 'Failed to issue book', 'error');
  }
});

/* ── TRANSACTIONS ───────────────────────────────────────────────── */
function renderTransactions() {
  const tbody = $('#txTableBody');
  if (!State.transactions.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No transactions yet</td></tr>'; return; }
  tbody.innerHTML = State.transactions.map((tx, i) => {
    const m = State.members.find(x => x.id === tx.member_id);
    const b = State.books.find(x => x.id === tx.book_id);
    const od = isOverdue(tx), fine = calcFine(tx);
    const statusBadge = tx.return_date ? '<span class="badge badge-green">Returned</span>' : od ? '<span class="badge badge-red">Overdue</span>' : '<span class="badge badge-orange">Issued</span>';
    const fineCell = fine > 0 ? `<span style="color:${tx.fine_paid?'var(--green)':'var(--red)'};font-weight:600">PKR ${fine}${tx.fine_paid?' ✓':''}</span>` : '—';
    const actions = [];
    if (!tx.return_date) actions.push(`<button class="btn btn-success btn-sm" onclick="returnBook(${tx.id})">Return</button>`);
    if (fine > 0 && !tx.fine_paid) actions.push(`<button class="btn btn-warning btn-sm" onclick="payFine(${tx.id})">Pay Fine</button>`);
    return `<tr style="animation:pageFadeIn 0.3s ease ${i*0.04}s both">
      <td>${tx.id}</td><td><strong>${m?.name||'—'}</strong></td><td>${b?.title||'—'}</td>
      <td>${fmt(tx.issue_date)}</td>
      <td style="color:${od?'var(--red)':'inherit'};font-weight:${od?'600':'400'}">${fmt(tx.due_date)}</td>
      <td>${fmt(tx.return_date)}</td><td>${fineCell}</td><td>${statusBadge}</td>
      <td><div class="actions-cell">${actions.join('')}</div></td>
    </tr>`;
  }).join('');
}

async function returnBook(id) {
  const tx = State.transactions.find(t => t.id === id);
  const fine = calcFine(tx);
  const result = await apiFetch(`/transactions/${id}/return`, 'PUT', { return_date: today(), fine });
  if (result) {
    toast(fine > 0 ? `Book returned. Fine: PKR ${fine}` : 'Book returned!', fine > 0 ? 'warning' : 'success');
    await loadAll();
    renderTransactions();
    renderDashboard();
  }
}

async function payFine(id) {
  const tx = State.transactions.find(t => t.id === id);
  const result = await apiFetch(`/transactions/${id}/payfine`, 'PUT');
  if (result) {
    toast(`Fine of PKR ${calcFine(tx)} paid!`, 'success');
    await loadAll();
    renderTransactions();
    renderDashboard();
  }
}

/* ── GLOBAL SEARCH ──────────────────────────────────────────────── */
const searchInput = $('#globalSearch'), searchResults = $('#searchResults');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) { searchResults.classList.remove('active'); return; }
  const bookResults   = State.books.filter(b => b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)).slice(0, 4);
  const memberResults = State.members.filter(m => m.name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)).slice(0, 3);
  let html = '';
  if (bookResults.length) {
    html += `<div class="search-result-item" style="color:var(--text-muted);font-size:0.72rem;font-weight:700;letter-spacing:1px;pointer-events:none">BOOKS</div>`;
    html += bookResults.map(b => `<div class="search-result-item" onclick="navigate('books');searchInput.value='';searchResults.classList.remove('active')"><strong>${b.title}</strong><br><span>${b.author} · ${b.available>0?'✓ Available':'✗ Unavailable'}</span></div>`).join('');
  }
  if (memberResults.length) {
    html += `<div class="search-result-item" style="color:var(--text-muted);font-size:0.72rem;font-weight:700;letter-spacing:1px;pointer-events:none">MEMBERS</div>`;
    html += memberResults.map(m => `<div class="search-result-item" onclick="navigate('members');searchInput.value='';searchResults.classList.remove('active')"><strong>${m.name}</strong><br><span>@${m.username} · ${m.active?'Active':'Inactive'}</span></div>`).join('');
  }
  if (!html) html = '<div class="search-result-item" style="color:var(--text-muted);text-align:center">No results found</div>';
  searchResults.innerHTML = html;
  searchResults.classList.add('active');
});
document.addEventListener('click', e => { if (!e.target.closest('.search-bar')) searchResults.classList.remove('active'); });

/* ── AUTH TABS ──────────────────────────────────────────────────── */
function switchTab(tab) {
  const isSignIn = tab === 'signin';
  $('#tabSignIn').classList.toggle('active', isSignIn);
  $('#tabSignUp').classList.toggle('active', !isSignIn);
  $('#formSignIn').style.display = isSignIn ? 'flex' : 'none';
  $('#formSignUp').style.display = isSignIn ? 'none' : 'flex';
}
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId), isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.querySelector('svg path').setAttribute('d', isHidden
    ? 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22'
    : 'M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z');
}

/* ── REGISTER ───────────────────────────────────────────────────── */
$('#registerBtn').addEventListener('click', async () => {
  const name = $('#regName').value.trim(), username = $('#regUsername').value.trim();
  const email = $('#regEmail').value.trim(), password = $('#regPassword').value.trim();
  if (!name || !username || !password) { toast('Name, username & password are required!', 'error'); return; }
  if (password.length < 6) { toast('Password must be at least 6 characters!', 'error'); return; }
  const result = await apiFetch('/members', 'POST', { name, username, email, password, role: 'member' });
  if (result && !result.error) {
    toast(`Account created! Welcome, ${name} 🎉`, 'success', 4000);
    switchTab('signin');
    $('#loginUsername').value = username;
    ['#regName','#regUsername','#regEmail','#regPassword'].forEach(s => $(s).value = '');
  } else {
    toast(result?.error || 'Username already taken!', 'error');
  }
});

/* ── LOGIN ──────────────────────────────────────────────────────── */
$('#loginBtn').addEventListener('click', async () => {
  const username = $('#loginUsername').value.trim();
  const password = $('#loginPassword').value.trim();
  const result = await apiFetch('/login', 'POST', { username, password });
  if (!result || result.error) { toast('Invalid username or password!', 'error'); return; }
  localStorage.setItem('lib_loggedIn', JSON.stringify(result));
  State.currentUser = result; State.loggedIn = true;
  $('#loginOverlay').classList.add('hidden');
  setTimeout(() => { $('#loginOverlay').style.display = 'none'; }, 500);
  updateSidebarUser(result);
  toast(`Welcome back, ${result.name}! 👋`, 'success', 4000);
  await navigate('dashboard');
});
$('#loginPassword').addEventListener('keydown', e => { if(e.key==='Enter') $('#loginBtn').click(); });
$('#loginUsername').addEventListener('keydown', e => { if(e.key==='Enter') $('#loginBtn').click(); });

/* ── LOGOUT ─────────────────────────────────────────────────────── */
$('#logoutBtn').addEventListener('click', () => {
  showModal('Sign Out', 'Are you sure you want to sign out?', () => {
    localStorage.removeItem('lib_loggedIn');
    $('#loginOverlay').style.display = 'flex';
    setTimeout(() => $('#loginOverlay').classList.remove('hidden'), 10);
    $('#loginPassword').value = '';
    State.loggedIn = false; State.currentUser = null;
    toast('Signed out.', 'info');
  }, false);
});

/* ── RIPPLE OBSERVER ────────────────────────────────────────────── */
$$('.btn').forEach(addRipple);
const observer = new MutationObserver(mutations => {
  mutations.forEach(m => m.addedNodes.forEach(node => {
    if (node.nodeType === 1) {
      if (node.classList?.contains('btn')) addRipple(node);
      $$('.btn', node).forEach(addRipple);
    }
  }));
});
observer.observe(document.body, { childList: true, subtree: true });

/* ── KEYBOARD SHORTCUTS ─────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (!State.loggedIn) return;
  if (e.key === 'Escape') closeModal();
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchInput.focus(); }
});

/* ── INIT ───────────────────────────────────────────────────────── */
(async function init() {
  const savedUser = localStorage.getItem('lib_loggedIn');
  if (savedUser) {
    const user = JSON.parse(savedUser);
    State.currentUser = user;
    State.loggedIn    = true;
    $('#loginOverlay').style.display = 'none';
    updateSidebarUser(user);
    await navigate('dashboard');
  } else {
    $('#loginOverlay').style.display = 'flex';
    $('#loginOverlay').classList.remove('hidden');
  }
})();