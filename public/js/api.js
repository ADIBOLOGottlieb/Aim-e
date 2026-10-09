export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Connexion au serveur impossible');
  }
  let data = null;
  try {
    data = await res.json();
  } catch { /* réponse vide */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) window.dispatchEvent(new Event('auth:lost'));
    throw new ApiError(res.status, (data && data.error) || `Erreur ${res.status}`);
  }
  return data;
}

export const get = (path) => api(path);
export const post = (path, body = {}) => api(path, { method: 'POST', body });
export const put = (path, body) => api(path, { method: 'PUT', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });
