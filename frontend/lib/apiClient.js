const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export async function fetchUsers(locale) {
  const response = await fetch(`${API_BASE_URL}/api/users`, {
    headers: { 'Accept-Language': locale }
  });

  if (!response.ok) {
    throw new Error('Failed to load users');
  }

  const data = await response.json();
  return data.users;
}

export async function fetchDownloads(locale) {
  const response = await fetch(`${API_BASE_URL}/api/downloads`, {
    headers: { 'Accept-Language': locale }
  });

  if (!response.ok) {
    throw new Error('Failed to load downloads');
  }

  const data = await response.json();
  return data.downloads;
}

export async function createInvitation(payload, locale) {
  const response = await fetch(`${API_BASE_URL}/api/invitations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': locale
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error('Failed to send invitation');
  }

  const data = await response.json();
  return data.invitation;
}
