const API = '/api';

function getToken() { return localStorage.getItem('shortlink_token'); }
function setToken(t) { localStorage.setItem('shortlink_token', t); }

let authMode = 'login';

function showAuth(mode) {
  authMode = mode;
  document.getElementById('auth-card'777).style.display = 'block';
  document.getElementById('auth-name').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('auth-submit').textContent = mode === 'register' ? 'Register' : 'Login';
}

async function submitAuth() {
  const name = document.getElementById('auth-name').value;
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.textContent = '';

  const endpoint = authMode === 'register' ? '/auth/register' : '/auth/login';
  const body = authMode === 'register' ? { name, email, password } : { email, password };

  try {
    const res = await fetch(API + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!data.success) {
      errorEl.textContent = data.error || 'Something went wrong';
      return;
    }
    setToken(data.token);
    document.getElementById('auth-card').style.display = 'none';
    document.getElementById('nav-links').innerHTML =
      `<span>Hi, ${data.user.name}</span> <a href="/dashboard.html">Dashboard</a> <a href="#" onclick="logout()">Logout</a>`;
  } catch (err) {
    errorEl.textContent = 'Network error';
  }
}

function logout() {
  localStorage.removeItem('shortlink_token');
  location.reload();
}

async function shorten() {
  const url = document.getElementById('long-url').value.trim();
  const customAlias = document.getElementById('custom-alias').value.trim();
  const errorEl = document.getElementById('shorten-error');
  const resultBox = document.getElementById('result-box');
  errorEl.textContent = '';
  resultBox.style.display = 'none';

  const token = getToken();
  if (!token) {
    errorEl.textContent = 'Please login or register first.';
    showAuth('login');
    return;
  }

  try {
    const res = await fetch(API + '/urls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, customAlias: customAlias || undefined })
    });
    const data = await res.json();
    if (!data.success) {
      errorEl.textContent = data.error || 'Could not shorten URL';
      return;
    }
    const link = document.getElementById('result-link');
    link.href = data.shortUrl;
    link.textContent = data.shortUrl;
    resultBox.style.display = 'block';
  } catch (err) {
    errorEl.textContent = 'Network error';
  }
}

function copyResult() {
  const link = document.getElementById('result-link').textContent;
  navigator.clipboard.writeText(link);
}

// If already logged in, reflect that in the nav bar on load.
(function initNav() {
  if (getToken()) {
    document.getElementById('nav-links').innerHTML =
      `<a href="/dashboard.html">Dashboard</a> <a href="#" onclick="logout()">Logout</a>`;
  }
})();
