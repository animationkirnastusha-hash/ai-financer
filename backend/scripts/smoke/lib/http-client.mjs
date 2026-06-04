export class SmokeHttpError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'SmokeHttpError';
    this.details = details;
  }
}

function normalizePath(path) {
  return path.startsWith('/') ? path : `/${path}`;
}

export async function requestJson(context, path, options = {}) {
  const method = options.method || 'GET';
  const expected = options.expected || [200];
  const headers = { ...(options.headers || {}) };

  let body;
  if (options.body !== undefined) {
    headers['content-type'] = headers['content-type'] || 'application/json';
    body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  if (options.auth !== false && context.token) {
    headers.authorization = `Bearer ${context.token}`;
  }

  const url = `${context.baseUrl}${normalizePath(path)}`;
  const response = await fetch(url, { method, headers, body });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!expected.includes(response.status)) {
    throw new SmokeHttpError(`${method} ${path} returned ${response.status}`, {
      method,
      url,
      status: response.status,
      payload,
    });
  }

  return { status: response.status, payload, text };
}

export function unwrapArray(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  return [];
}
