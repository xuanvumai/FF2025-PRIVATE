'use strict';

const $ = (id) => document.getElementById(id);
let token = sessionStorage.getItem('ff_admin_token') || '';

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function showLogin(message = '') {
  $('loginCard').hidden = false;
  $('dashboard').hidden = true;
  $('loginMessage').textContent = message;
}

async function loadDashboard() {
  try {
    const [overview, userData] = await Promise.all([
      api('/api/admin/overview'),
      api('/api/admin/users')
    ]);
    $('users').textContent = overview.users;
    $('rooms').textContent = overview.waitingRooms;
    $('matches').textContent = overview.matches;
    $('userRows').innerHTML = userData.users.map(user =>
      `<tr><td>${escapeHtml(user.id)}</td><td>${escapeHtml(user.username)}</td><td>${escapeHtml(user.email)}</td><td>${escapeHtml(user.role)}</td><td>${escapeHtml(user.level)}</td></tr>`
    ).join('');
    $('loginCard').hidden = true;
    $('dashboard').hidden = false;
    $('dashMessage').textContent = '';
  } catch (error) {
    token = '';
    sessionStorage.removeItem('ff_admin_token');
    showLogin(error.message);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('loginMessage').textContent = 'Đang đăng nhập...';
  try {
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: $('email').value, password: $('password').value })
    });
    if (result.user.role !== 'admin') throw new Error('Tài khoản này không có quyền admin.');
    token = result.token;
    sessionStorage.setItem('ff_admin_token', token);
    await loadDashboard();
  } catch (error) {
    showLogin(error.message);
  }
});

$('refresh').addEventListener('click', loadDashboard);
$('logout').addEventListener('click', () => {
  token = '';
  sessionStorage.removeItem('ff_admin_token');
  showLogin('Bạn đã đăng xuất.');
});

if (token) loadDashboard();
