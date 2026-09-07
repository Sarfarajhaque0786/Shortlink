let chartInstance = null;

async function loadUrls() {
  const token = getToken();
  if (!token) {
    window.location.href = '/';
    return;
  }
  const res = await fetch(API + '/urls', { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  const tbody = document.getElementById('url-table-body');
  tbody.innerHTML = '';

  if (!data.success || data.urls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No links yet — create one from the home page.</td></tr>';
    return;
  }

  data.urls.forEach((u) => {
    const isExpired = u.expiresAt && new Date(u.expiresAt) < new Date();
    const statusClass = (u.isActive && !isExpired) ? 'active' : 'expired';
    const statusText = (u.isActive && !isExpired) ? 'Active' : 'Expired';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><a href="#" onclick="loadStats('${u.shortCode}'); return false;">${u.shortUrl}</a></td>
      <td title="${u.originalUrl}">${u.originalUrl.slice(0, 40)}${u.originalUrl.length > 40 ? '…' : ''}</td>
      <td>${u.clickCount}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td><button class="link-btn" onclick="deleteUrl('${u.shortCode}')">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}

async function deleteUrl(shortCode) {
  const token = getToken();
  await fetch(API + `/urls/${shortCode}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  loadUrls();
}

async function loadStats(shortCode) {
  const token = getToken();
  const res = await fetch(API + `/urls/${shortCode}/stats`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.success) return;

  document.getElementById('stats-card').style.display = 'block';
  document.getElementById('stats-title').textContent = `${data.shortUrl} — ${data.clickCount} total clicks`;

  const labels = data.clicksOverTime.map((d) => d._id);
  const counts = data.clicksOverTime.map((d) => d.count);

  const ctx = document.getElementById('clicks-chart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: 'Clicks per day', data: counts, borderColor: '#4f46e5', tension: 0.3 }]
    },
    options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
  });
}

loadUrls();
