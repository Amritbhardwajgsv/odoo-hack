const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// A failed zod parse on the server comes back as a generic
// { message: 'Invalid input', issues: [...] } - "Invalid input" alone tells
// the user nothing actionable. The issues array carries the real reason
// (e.g. "Attendance date cannot be in the future"), so surface that first.
function messageFrom(body: { message?: string; issues?: { message?: string }[] }): string {
  const detail = body.issues?.[0]?.message;
  return detail || body.message || 'Request failed';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(messageFrom(body), response.status);
  }

  return body as T;
}

// PDFs are behind the same bearer auth as everything else, so a plain link
// would arrive without the token. Fetch it, then hand back an object URL the
// page can open or revoke.
async function blob(path: string): Promise<string> {
  const token = localStorage.getItem('token');
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(messageFrom(body), response.status);
  }
  return URL.createObjectURL(await response.blob());
}

// A plain <a href> can't carry the bearer token, and the browser has no API
// to "save this object URL as a file" other than faking a click on an
// anchor with the download attribute set.
async function download(path: string, filename: string): Promise<void> {
  const url = await blob(path);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  blob,
  download,
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: <T>(path: string, data: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(data) }),
};
