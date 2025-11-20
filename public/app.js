const langStrings = {
  en: {
    title: 'Credential Manager',
    credentialsHeading: 'Credentials',
    credentialsHelp: 'Create, update, and delete stored credentials. Data is saved to the backend API.',
    credNameLabel: 'Name',
    credNameHelp: 'Friendly label to identify this login (e.g. AStA Ticket).',
    credUsernameLabel: 'Username',
    credUsernameHelp: 'Account username, matriculation number, or email.',
    credPasswordLabel: 'Password',
    credPasswordHelp: 'Stored securely by the backend. Minimum 6 characters.',
    credNotesLabel: 'Notes',
    credNotesHelp: 'Optional hint for where these credentials are used.',
    saveCredential: 'Save credential',
    resetCredential: 'Reset form',
    tableName: 'Name',
    tableUser: 'Username',
    tableCreated: 'Created',
    tableActions: 'Actions',
    profilesHeading: 'Device Profiles',
    profilesHelp:
      'Use presets or store custom user agents, viewport sizes, and proxies for automation.',
    profileLabelLabel: 'Label',
    profileLabelHelp: 'A short name for this profile.',
    profileUserAgentLabel: 'User Agent',
    profileUserAgentHelp: 'Full user agent string that will be applied to requests.',
    viewportWidthLabel: 'Viewport width',
    viewportHeightLabel: 'Viewport height',
    viewportHelp: 'Numbers represent the browser viewport used during automation.',
    proxyLabel: 'Proxy (optional)',
    proxyHelp: 'HTTP or HTTPS proxy URL for this profile.',
    saveProfile: 'Save profile',
    resetProfile: 'Reset form',
    presetHeading: 'Presets',
    customHeading: 'Custom profiles',
    newButton: 'New',
    edit: 'Edit',
    delete: 'Delete',
    readOnly: 'Read-only preset'
  },
  de: {
    title: 'Zugangsdaten Manager',
    credentialsHeading: 'Zugangsdaten',
    credentialsHelp: 'Anlegen, bearbeiten und löschen von gespeicherten Zugangsdaten. Speicherung erfolgt über die API.',
    credNameLabel: 'Name',
    credNameHelp: 'Kurze Bezeichnung für diesen Login (z. B. AStA Ticket).',
    credUsernameLabel: 'Benutzername',
    credUsernameHelp: 'Benutzername, Matrikelnummer oder E-Mail.',
    credPasswordLabel: 'Passwort',
    credPasswordHelp: 'Wird über das Backend gespeichert. Mindestens 6 Zeichen.',
    credNotesLabel: 'Notizen',
    credNotesHelp: 'Optionaler Hinweis wofür diese Zugangsdaten genutzt werden.',
    saveCredential: 'Zugangsdaten speichern',
    resetCredential: 'Formular zurücksetzen',
    tableName: 'Name',
    tableUser: 'Benutzername',
    tableCreated: 'Erstellt',
    tableActions: 'Aktionen',
    profilesHeading: 'Geräteprofile',
    profilesHelp:
      'Vordefinierte Profile nutzen oder eigene User-Agents, Viewports und Proxys hinterlegen.',
    profileLabelLabel: 'Bezeichnung',
    profileLabelHelp: 'Kurzer Name für dieses Profil.',
    profileUserAgentLabel: 'User-Agent',
    profileUserAgentHelp: 'Vollständiger User-Agent-String für die automatisierten Aufrufe.',
    viewportWidthLabel: 'Viewport Breite',
    viewportHeightLabel: 'Viewport Höhe',
    viewportHelp: 'Numerische Werte des Browser-Viewports während der Automatisierung.',
    proxyLabel: 'Proxy (optional)',
    proxyHelp: 'HTTP- oder HTTPS-Proxy-URL für dieses Profil.',
    saveProfile: 'Profil speichern',
    resetProfile: 'Formular zurücksetzen',
    presetHeading: 'Voreinstellungen',
    customHeading: 'Eigene Profile',
    newButton: 'Neu',
    edit: 'Bearbeiten',
    delete: 'Löschen',
    readOnly: 'Schreibgeschützte Vorlage'
  }
};

const validationStrings = {
  en: {
    credential: {
      name: 'Name must be at least 2 characters long.',
      username: 'Username must be at least 3 characters long.',
      password: 'Password must be at least 6 characters long.'
    },
    profile: {
      label: 'Label must be at least 3 characters long.',
      userAgent: 'User agent must be at least 10 characters long.',
      viewportWidth: 'Viewport width must be an integer of at least 320.',
      viewportHeight: 'Viewport height must be an integer of at least 480.',
      proxy: 'Proxy must be empty or a valid URL starting with http/https.'
    }
  },
  de: {
    credential: {
      name: 'Name muss mindestens 2 Zeichen lang sein.',
      username: 'Benutzername muss mindestens 3 Zeichen lang sein.',
      password: 'Passwort muss mindestens 6 Zeichen lang sein.'
    },
    profile: {
      label: 'Bezeichnung muss mindestens 3 Zeichen lang sein.',
      userAgent: 'User-Agent muss mindestens 10 Zeichen lang sein.',
      viewportWidth: 'Viewport-Breite muss eine Ganzzahl ab 320 sein.',
      viewportHeight: 'Viewport-Höhe muss eine Ganzzahl ab 480 sein.',
      proxy: 'Proxy muss leer sein oder mit http/https beginnen.'
    }
  }
};

const state = {
  language: 'en',
  selectedCredentialId: null,
  selectedProfileId: null
};

const elements = {
  title: document.getElementById('title'),
  credentialsHeading: document.getElementById('credentialsHeading'),
  credentialsHelp: document.getElementById('credentialsHelp'),
  credNameLabel: document.getElementById('credNameLabel'),
  credNameHelp: document.getElementById('credNameHelp'),
  credUsernameLabel: document.getElementById('credUsernameLabel'),
  credUsernameHelp: document.getElementById('credUsernameHelp'),
  credPasswordLabel: document.getElementById('credPasswordLabel'),
  credPasswordHelp: document.getElementById('credPasswordHelp'),
  credNotesLabel: document.getElementById('credNotesLabel'),
  credNotesHelp: document.getElementById('credNotesHelp'),
  saveCredential: document.getElementById('saveCredential'),
  resetCredential: document.getElementById('resetCredential'),
  credNameCol: document.getElementById('credNameCol'),
  credUsernameCol: document.getElementById('credUsernameCol'),
  credCreatedCol: document.getElementById('credCreatedCol'),
  credActionsCol: document.getElementById('credActionsCol'),
  profilesHeading: document.getElementById('profilesHeading'),
  profilesHelp: document.getElementById('profilesHelp'),
  profileLabelLabel: document.getElementById('profileLabelLabel'),
  profileLabelHelp: document.getElementById('profileLabelHelp'),
  profileUserAgentLabel: document.getElementById('profileUserAgentLabel'),
  profileUserAgentHelp: document.getElementById('profileUserAgentHelp'),
  viewportWidthLabel: document.getElementById('viewportWidthLabel'),
  viewportHeightLabel: document.getElementById('viewportHeightLabel'),
  viewportHelp: document.getElementById('viewportHelp'),
  proxyLabel: document.getElementById('proxyLabel'),
  proxyHelp: document.getElementById('proxyHelp'),
  saveProfile: document.getElementById('saveProfile'),
  resetProfile: document.getElementById('resetProfile'),
  presetHeading: document.getElementById('presetHeading'),
  customHeading: document.getElementById('customHeading'),
  newCredential: document.getElementById('newCredential'),
  newProfile: document.getElementById('newProfile')
};

function translateUI() {
  const strings = langStrings[state.language];
  elements.title.textContent = strings.title;
  elements.credentialsHeading.textContent = strings.credentialsHeading;
  elements.credentialsHelp.textContent = strings.credentialsHelp;
  elements.credNameLabel.textContent = strings.credNameLabel;
  elements.credNameHelp.textContent = strings.credNameHelp;
  elements.credUsernameLabel.textContent = strings.credUsernameLabel;
  elements.credUsernameHelp.textContent = strings.credUsernameHelp;
  elements.credPasswordLabel.textContent = strings.credPasswordLabel;
  elements.credPasswordHelp.textContent = strings.credPasswordHelp;
  elements.credNotesLabel.textContent = strings.credNotesLabel;
  elements.credNotesHelp.textContent = strings.credNotesHelp;
  elements.saveCredential.textContent = strings.saveCredential;
  elements.resetCredential.textContent = strings.resetCredential;
  elements.newCredential.textContent = strings.newButton;
  elements.newProfile.textContent = strings.newButton;
  elements.credNameCol.textContent = strings.tableName;
  elements.credUsernameCol.textContent = strings.tableUser;
  elements.credCreatedCol.textContent = strings.tableCreated;
  elements.credActionsCol.textContent = strings.tableActions;
  elements.profilesHeading.textContent = strings.profilesHeading;
  elements.profilesHelp.textContent = strings.profilesHelp;
  elements.profileLabelLabel.textContent = strings.profileLabelLabel;
  elements.profileLabelHelp.textContent = strings.profileLabelHelp;
  elements.profileUserAgentLabel.textContent = strings.profileUserAgentLabel;
  elements.profileUserAgentHelp.textContent = strings.profileUserAgentHelp;
  elements.viewportWidthLabel.textContent = strings.viewportWidthLabel;
  elements.viewportHeightLabel.textContent = strings.viewportHeightLabel;
  elements.viewportHelp.textContent = strings.viewportHelp;
  elements.proxyLabel.textContent = strings.proxyLabel;
  elements.proxyHelp.textContent = strings.proxyHelp;
  elements.saveProfile.textContent = strings.saveProfile;
  elements.resetProfile.textContent = strings.resetProfile;
  elements.presetHeading.textContent = strings.presetHeading;
  elements.customHeading.textContent = strings.customHeading;

  document.querySelectorAll('[data-text="edit"]').forEach((el) => {
    el.textContent = strings.edit;
  });
  document.querySelectorAll('[data-text="delete"]').forEach((el) => {
    el.textContent = strings.delete;
  });
  document.querySelectorAll('[data-text="readonly"]').forEach((el) => {
    el.textContent = strings.readOnly;
  });
}

function clearErrors() {
  document.querySelectorAll('.error').forEach((el) => {
    el.textContent = '';
  });
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString(state.language === 'de' ? 'de-DE' : 'en-US');
}

async function loadCredentials() {
  const res = await fetch('/api/credentials');
  const credentials = await res.json();
  const tbody = document.querySelector('#credentialsTable tbody');
  tbody.innerHTML = '';
  credentials.forEach((cred) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${cred.name}</td>
      <td>${cred.username}</td>
      <td>${formatDate(cred.createdAt)}</td>
      <td class="actions"></td>
    `;
    const actionsCell = tr.querySelector('.actions');
    actionsCell.innerHTML = '';

    const editBtn = document.createElement('button');
    editBtn.className = 'secondary';
    editBtn.dataset.text = 'edit';
    editBtn.textContent = langStrings[state.language].edit;
    editBtn.addEventListener('click', () => setCredentialForm(cred));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'secondary';
    deleteBtn.dataset.text = 'delete';
    deleteBtn.textContent = langStrings[state.language].delete;
    deleteBtn.addEventListener('click', () => deleteCredential(cred.id));

    actionsCell.append(editBtn, deleteBtn);
    tbody.appendChild(tr);
  });
}

function setCredentialForm(cred) {
  state.selectedCredentialId = cred?.id || null;
  document.getElementById('credName').value = cred?.name || '';
  document.getElementById('credUsername').value = cred?.username || '';
  document.getElementById('credPassword').value = cred?.password || '';
  document.getElementById('credNotes').value = cred?.notes || '';
}

function resetCredentialForm() {
  setCredentialForm(null);
  clearErrors();
}

async function saveCredential(event) {
  event.preventDefault();
  clearErrors();

  const payload = {
    name: document.getElementById('credName').value,
    username: document.getElementById('credUsername').value,
    password: document.getElementById('credPassword').value,
    notes: document.getElementById('credNotes').value
  };

  const method = state.selectedCredentialId ? 'PUT' : 'POST';
  const endpoint = state.selectedCredentialId
    ? `/api/credentials/${state.selectedCredentialId}`
    : '/api/credentials';

  const res = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const { errors, message } = await res.json();
    if (errors) {
      Object.entries(errors).forEach(([key, text]) => {
        const errorEl = document.getElementById(`cred${key.charAt(0).toUpperCase()}${key.slice(1)}Error`);
        const localized = validationStrings[state.language].credential[key] || text;
        if (errorEl) errorEl.textContent = localized;
      });
    } else {
      alert(message || 'Unable to save credential');
    }
    return;
  }

  await res.json();
  resetCredentialForm();
  loadCredentials();
}

async function deleteCredential(id) {
  if (!confirm('Delete this credential?')) return;
  await fetch(`/api/credentials/${id}`, { method: 'DELETE' });
  if (state.selectedCredentialId === id) {
    resetCredentialForm();
  }
  loadCredentials();
}

async function loadProfiles() {
  const res = await fetch('/api/device-profiles');
  const { presets, custom } = await res.json();
  renderProfiles(presets, document.getElementById('presetList'), true);
  renderProfiles(custom, document.getElementById('customList'), false);
}

function renderProfiles(profiles, targetList, readOnly) {
  const template = document.getElementById('profileCardTemplate');
  targetList.innerHTML = '';
  profiles.forEach((profile) => {
    const li = template.content.firstElementChild.cloneNode(true);
    li.querySelector('.card-title').textContent = profile.label;
    li.querySelector('.card-meta').textContent = profile.userAgent;
    li.querySelector(
      '.card-body'
    ).textContent = `Viewport ${profile.viewport.width} x ${profile.viewport.height}${profile.proxy ? ` • Proxy: ${profile.proxy}` : ''}`;

    const actions = li.querySelector('.card-actions');
    actions.innerHTML = '';
    if (readOnly) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.dataset.text = 'readonly';
      badge.textContent = langStrings[state.language].readOnly;
      actions.appendChild(badge);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className = 'secondary';
      editBtn.dataset.text = 'edit';
      editBtn.textContent = langStrings[state.language].edit;
      editBtn.addEventListener('click', () => setProfileForm(profile));

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'secondary';
      deleteBtn.dataset.text = 'delete';
      deleteBtn.textContent = langStrings[state.language].delete;
      deleteBtn.addEventListener('click', () => deleteProfile(profile.id));

      actions.append(editBtn, deleteBtn);
    }

    targetList.appendChild(li);
  });
}

function setProfileForm(profile) {
  state.selectedProfileId = profile?.id || null;
  document.getElementById('profileLabel').value = profile?.label || '';
  document.getElementById('profileUserAgent').value = profile?.userAgent || '';
  document.getElementById('viewportWidth').value = profile?.viewport?.width || '';
  document.getElementById('viewportHeight').value = profile?.viewport?.height || '';
  document.getElementById('proxy').value = profile?.proxy || '';
}

function resetProfileForm() {
  setProfileForm(null);
  clearErrors();
}

async function saveProfile(event) {
  event.preventDefault();
  clearErrors();

  const payload = {
    label: document.getElementById('profileLabel').value,
    userAgent: document.getElementById('profileUserAgent').value,
    viewport: {
      width: Number(document.getElementById('viewportWidth').value),
      height: Number(document.getElementById('viewportHeight').value)
    },
    proxy: document.getElementById('proxy').value
  };

  const method = state.selectedProfileId ? 'PUT' : 'POST';
  const endpoint = state.selectedProfileId
    ? `/api/device-profiles/${state.selectedProfileId}`
    : '/api/device-profiles';

  const res = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const { errors, message } = await res.json();
    if (errors) {
      const errorMap = {
        label: 'profileLabelError',
        userAgent: 'profileUserAgentError',
        viewportWidth: 'viewportWidthError',
        viewportHeight: 'viewportHeightError',
        proxy: 'proxyError'
      };
      Object.entries(errors).forEach(([key, text]) => {
        const elId = errorMap[key];
        const el = document.getElementById(elId);
        const localized = validationStrings[state.language].profile[key] || text;
        if (el) el.textContent = localized;
      });
    } else {
      alert(message || 'Unable to save profile');
    }
    return;
  }

  await res.json();
  resetProfileForm();
  loadProfiles();
}

async function deleteProfile(id) {
  if (!confirm('Delete this profile?')) return;
  await fetch(`/api/device-profiles/${id}`, { method: 'DELETE' });
  if (state.selectedProfileId === id) {
    resetProfileForm();
  }
  loadProfiles();
}

function bindEvents() {
  document.getElementById('credentialForm').addEventListener('submit', saveCredential);
  document.getElementById('profileForm').addEventListener('submit', saveProfile);
  document.getElementById('resetCredential').addEventListener('click', resetCredentialForm);
  document.getElementById('resetProfile').addEventListener('click', resetProfileForm);
  document.getElementById('newCredential').addEventListener('click', resetCredentialForm);
  document.getElementById('newProfile').addEventListener('click', resetProfileForm);
  document.getElementById('language').addEventListener('change', (event) => {
    state.language = event.target.value;
    translateUI();
  });
}

bindEvents();
translateUI();
loadCredentials();
loadProfiles();
