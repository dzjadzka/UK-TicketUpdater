const singleDownloadForm = document.getElementById('single-download-form');
const bulkDownloadForm = document.getElementById('bulk-download-form');
const downloadStatus = document.getElementById('download-status');
const historyBody = document.getElementById('history-body');
const historyStatus = document.getElementById('history-status');
const pageLabel = document.getElementById('page-label');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const lazyTrigger = document.getElementById('lazy-trigger');
const ticketForm = document.getElementById('ticket-lookup-form');
const ticketFiles = document.getElementById('ticket-files');
const ticketStatus = document.getElementById('ticket-status');
const cleanupForm = document.getElementById('cleanup-form');
const purgeButton = document.getElementById('purge-button');
const adminStatus = document.getElementById('admin-status');

let currentPage = 1;
let isLoadingHistory = false;

const fetchJSON = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }

  return response.json();
};

const setStatus = (node, message, isError = false) => {
  node.textContent = message || '';
  node.style.color = isError ? '#fecaca' : '#fef9c3';
};

const serializeForm = (form) => {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
};

singleDownloadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(downloadStatus, 'Starting download…');
  const payload = serializeForm(singleDownloadForm);
  payload.force = !!payload.force;

  try {
    await fetchJSON('/downloads', {
      method: 'POST',
      body: JSON.stringify({ ...payload, bulk: false }),
    });
    setStatus(downloadStatus, 'Download triggered successfully.');
  } catch (error) {
    setStatus(downloadStatus, error.message, true);
  }
});

bulkDownloadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(downloadStatus, 'Starting bulk download…');
  const payload = serializeForm(bulkDownloadForm);
  payload.force = !!payload.force;
  payload.userIds = payload.userIds
    ? payload.userIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  try {
    await fetchJSON('/downloads', {
      method: 'POST',
      body: JSON.stringify({ ...payload, bulk: true }),
    });
    setStatus(downloadStatus, 'Bulk download triggered.');
  } catch (error) {
    setStatus(downloadStatus, error.message, true);
  }
});

const renderHistoryRows = (items, reset = false) => {
  if (reset) historyBody.innerHTML = '';

  if (!items.length && reset) {
    historyBody.innerHTML = '<tr><td colspan="5">No history yet.</td></tr>';
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="badge">${item.status}</span></td>
      <td>${new Date(item.timestamp).toLocaleString()}</td>
      <td>${item.device || '—'}</td>
      <td>${item.message || '—'}</td>
      <td><a href="/tickets/${encodeURIComponent(item.userId)}" target="_blank">${item.userId}</a></td>
    `;
    fragment.appendChild(row);
  });
  historyBody.appendChild(fragment);
};

const loadHistory = async (page = 1, append = false) => {
  if (isLoadingHistory) return;
  isLoadingHistory = true;
  setStatus(historyStatus, 'Loading history…');

  try {
    const data = await fetchJSON(`/downloads/history?page=${page}`);
    renderHistoryRows(data.items || [], !append);
    currentPage = page;
    pageLabel.textContent = `Page ${currentPage}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = !data.hasMore;
    setStatus(historyStatus, data.items?.length ? '' : 'No more results.');
  } catch (error) {
    setStatus(historyStatus, error.message, true);
  } finally {
    isLoadingHistory = false;
  }
};

prevPageBtn?.addEventListener('click', () => {
  if (currentPage > 1) loadHistory(currentPage - 1);
});

nextPageBtn?.addEventListener('click', () => {
  loadHistory(currentPage + 1);
});

const lazyObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && !nextPageBtn.disabled) {
      loadHistory(currentPage + 1, true);
    }
  });
});

if (lazyTrigger) lazyObserver.observe(lazyTrigger);

const renderTicketFiles = (files = []) => {
  ticketFiles.innerHTML = '';

  if (!files.length) {
    ticketFiles.innerHTML = '<p>No files found.</p>';
    return;
  }

  files.forEach((file) => {
    const card = document.createElement('div');
    card.className = 'file-card';
    card.innerHTML = `
      <div class="badge">${file.type || 'ticket'}</div>
      <div><strong>${file.name}</strong></div>
      <div class="meta">Updated ${file.updatedAt ? new Date(file.updatedAt).toLocaleString() : '—'}</div>
      <div class="actions">
        <a href="${file.url}" target="_blank" rel="noopener">View</a>
        <a href="${file.url}" download>Download</a>
      </div>
    `;
    ticketFiles.appendChild(card);
  });
};

const loadTickets = async (userId) => {
  setStatus(ticketStatus, 'Loading tickets…');
  try {
    const files = await fetchJSON(`/tickets/${encodeURIComponent(userId)}`);
    renderTicketFiles(files);
    setStatus(ticketStatus, files.length ? '' : 'No tickets available.');
  } catch (error) {
    if (error.message.includes('404')) {
      renderTicketFiles([]);
      setStatus(ticketStatus, 'No files found for this user.', true);
    } else {
      setStatus(ticketStatus, error.message, true);
    }
  }
};

ticketForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const { userId } = serializeForm(ticketForm);
  loadTickets(userId);
});

cleanupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = serializeForm(cleanupForm);
  setStatus(adminStatus, 'Updating TTL…');
  try {
    await fetchJSON('/admin/housekeeping', {
      method: 'POST',
      body: JSON.stringify({ ttlHours: Number(payload.ttl) || null }),
    });
    setStatus(adminStatus, 'TTL updated.');
  } catch (error) {
    setStatus(adminStatus, error.message, true);
  }
});

purgeButton?.addEventListener('click', async () => {
  setStatus(adminStatus, 'Running cleanup…');
  purgeButton.disabled = true;
  try {
    await fetchJSON('/admin/cleanup', { method: 'POST' });
    setStatus(adminStatus, 'Cleanup completed.');
  } catch (error) {
    setStatus(adminStatus, error.message, true);
  } finally {
    purgeButton.disabled = false;
  }
});

// Initial load
loadHistory();
