const translations = {
  en: {
    title: 'TicketUpdater Access',
    loginTitle: 'Log in',
    signupTitle: 'Create account',
    inviteTitle: 'Accept invitation',
    dashboardTitle: 'Welcome',
    email: 'Email',
    password: 'Password',
    name: 'Name',
    login: 'Login',
    signup: 'Sign up',
    accept: 'Accept invite',
    invitePlaceholder: 'Invitation token',
    logout: 'Logout',
    noAccount: 'Need an account?',
    haveAccount: 'Already have an account?',
    inviteText: 'Join with your invitation token to finish setup.',
    dashboardCopy: 'You are authenticated. This page is protected with a client-side guard.',
    invitesAvailable: 'Available invite tokens (demo only):',
    fetchError: 'Something went wrong.',
    invalidInvite: 'Invite not found.',
    accepting: 'Accepting invite...',
    loading: 'Loading...'
  },
  de: {
    title: 'TicketUpdater Zugang',
    loginTitle: 'Anmelden',
    signupTitle: 'Konto erstellen',
    inviteTitle: 'Einladung annehmen',
    dashboardTitle: 'Willkommen',
    email: 'E-Mail',
    password: 'Passwort',
    name: 'Name',
    login: 'Anmelden',
    signup: 'Registrieren',
    accept: 'Einladung annehmen',
    invitePlaceholder: 'Einladungs-Token',
    logout: 'Abmelden',
    noAccount: 'Noch kein Konto?',
    haveAccount: 'Bereits ein Konto?',
    inviteText: 'Beitreten mit deinem Einladungs-Token.',
    dashboardCopy: 'Du bist angemeldet. Diese Seite ist clientseitig geschützt.',
    invitesAvailable: 'Verfügbare Einladungen (Demo):',
    fetchError: 'Etwas ist schiefgelaufen.',
    invalidInvite: 'Einladung nicht gefunden.',
    accepting: 'Einladung wird angenommen...',
    loading: 'Lädt...'
  }
};

let currentUser = null;
let currentLang = localStorage.getItem('lang') || 'en';
const app = document.getElementById('app');
const title = document.getElementById('title');
const langSelect = document.getElementById('lang-select');
const logoutBtn = document.getElementById('logout-btn');
const inviteInfo = document.getElementById('invite-info');

langSelect.value = currentLang;
langSelect.addEventListener('change', () => {
  currentLang = langSelect.value;
  localStorage.setItem('lang', currentLang);
  render();
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  currentUser = null;
  renderRoute('#/login');
});

function t(key) {
  return translations[currentLang][key];
}

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || t('fetchError'));
  }
  return res.json();
}

function getHashRoute() {
  const hash = window.location.hash || '#/login';
  const [route, queryString] = hash.split('?');
  const params = new URLSearchParams(queryString || '');
  return { route, params };
}

function renderRoute(targetHash) {
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
    return;
  }
  render();
}

async function checkAuth() {
  try {
    const data = await fetchJSON('/api/auth/me');
    currentUser = data.user;
  } catch (e) {
    currentUser = null;
  }
}

function guardedRoute(route) {
  if (!currentUser && route !== '#/login' && route !== '#/signup' && !route.startsWith('#/invite')) {
    renderRoute('#/login');
    return true;
  }
  return false;
}

function renderForm({ titleText, submitLabel, onSubmit, extra, fields }) {
  const form = document.createElement('form');
  form.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = titleText;
  form.appendChild(h2);

  const message = document.createElement('div');
  form.appendChild(message);

  fields.forEach(({ label, name, type = 'text', value = '' }) => {
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.name = name;
    input.value = value;
    l.appendChild(input);
    form.appendChild(l);
  });

  const submit = document.createElement('button');
  submit.textContent = submitLabel;
  form.appendChild(submit);

  if (extra) {
    const extraDiv = document.createElement('div');
    extraDiv.className = 'actions';
    extraDiv.appendChild(extra);
    form.appendChild(extraDiv);
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    message.innerHTML = '';
    const data = Object.fromEntries(new FormData(form));
    submit.disabled = true;
    try {
      await onSubmit(data, message);
    } catch (err) {
      const alert = document.createElement('div');
      alert.className = 'alert error';
      alert.textContent = err.message || t('fetchError');
      message.appendChild(alert);
    } finally {
      submit.disabled = false;
    }
  });

  return form;
}

function renderLogin() {
  const extra = document.createElement('button');
  extra.type = 'button';
  extra.className = 'secondary';
  extra.textContent = t('noAccount');
  extra.onclick = () => renderRoute('#/signup');
  return renderForm({
    titleText: t('loginTitle'),
    submitLabel: t('login'),
    extra,
    fields: [
      { label: t('email'), name: 'email', type: 'email' },
      { label: t('password'), name: 'password', type: 'password' }
    ],
    onSubmit: async (data) => {
      await fetchJSON('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
      await checkAuth();
      renderRoute('#/dashboard');
    }
  });
}

function renderSignup() {
  const extra = document.createElement('button');
  extra.type = 'button';
  extra.className = 'secondary';
  extra.textContent = t('haveAccount');
  extra.onclick = () => renderRoute('#/login');
  return renderForm({
    titleText: t('signupTitle'),
    submitLabel: t('signup'),
    extra,
    fields: [
      { label: t('name'), name: 'name' },
      { label: t('email'), name: 'email', type: 'email' },
      { label: t('password'), name: 'password', type: 'password' }
    ],
    onSubmit: async (data) => {
      await fetchJSON('/api/auth/signup', { method: 'POST', body: JSON.stringify(data) });
      await checkAuth();
      renderRoute('#/dashboard');
    }
  });
}

function renderInvite(params) {
  const tokenFromParams = params.get('token') || '';
  const info = document.createElement('p');
  info.textContent = t('inviteText');
  const message = document.createElement('div');

  const form = renderForm({
    titleText: t('inviteTitle'),
    submitLabel: t('accept'),
    fields: [
      { label: t('invitePlaceholder'), name: 'token', value: tokenFromParams },
      { label: t('name'), name: 'name' },
      { label: t('password'), name: 'password', type: 'password' }
    ],
    onSubmit: async (data) => {
      message.innerHTML = `<div class="alert success">${t('accepting')}</div>`;
      await fetchJSON('/api/auth/accept-invite', { method: 'POST', body: JSON.stringify(data) });
      await checkAuth();
      renderRoute('#/dashboard');
    }
  });
  form.insertBefore(info, form.children[1]);
  form.insertBefore(message, form.children[2]);
  return form;
}

function renderDashboard() {
  const card = document.createElement('div');
  card.className = 'card';
  const h2 = document.createElement('h2');
  h2.textContent = `${t('dashboardTitle')}, ${currentUser?.name || ''}`;
  const p = document.createElement('p');
  p.textContent = t('dashboardCopy');
  card.appendChild(h2);
  card.appendChild(p);
  return card;
}

async function renderInvitesList() {
  try {
    const data = await fetchJSON('/api/invites');
    const container = document.createElement('div');
    container.className = 'card';
    const h2 = document.createElement('h2');
    h2.textContent = t('invitesAvailable');
    container.appendChild(h2);
    const list = document.createElement('div');
    list.className = 'invite-list';
    data.invites.forEach((invite) => {
      const row = document.createElement('div');
      row.innerHTML = `<strong>${invite.email}</strong> - <code>${invite.token}</code>`;
      list.appendChild(row);
    });
    container.appendChild(list);
    return container;
  } catch (e) {
    const err = document.createElement('div');
    err.className = 'alert error';
    err.textContent = t('invalidInvite');
    return err;
  }
}

async function render() {
  title.textContent = t('title');
  logoutBtn.textContent = t('logout');
  logoutBtn.hidden = !currentUser;

  const { route, params } = getHashRoute();
  if (guardedRoute(route)) return;

  app.innerHTML = '';
  if (!currentUser) {
    if (route === '#/signup') {
      app.appendChild(renderSignup());
    } else if (route.startsWith('#/invite')) {
      app.appendChild(renderInvite(params));
    } else {
      app.appendChild(renderLogin());
    }
  } else {
    app.appendChild(renderDashboard());
  }

  if (route.startsWith('#/invite')) {
    inviteInfo.textContent = '';
  } else {
    inviteInfo.textContent = '';
    renderInvitesList().then((el) => inviteInfo.replaceChildren(el));
  }
}

async function bootstrap() {
  title.textContent = t('loading');
  await checkAuth();
  render();
}

window.addEventListener('hashchange', render);
bootstrap();
