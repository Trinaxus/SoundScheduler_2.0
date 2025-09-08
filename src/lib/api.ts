// Simple API helper for PHP backend
// Uses VITE_API_BASE or defaults to '/server/api'

export const API_BASE = import.meta.env.VITE_API_BASE || '/server/api';

async function parseResponse<T>(res: Response, method: string, path: string): Promise<T> {
  // No content
  if (res.status === 204) return undefined as unknown as T;

  const ct = res.headers.get('content-type') || '';
  const isJson = ct.includes('application/json');
  if (isJson) {
    try {
      return (await res.json()) as T;
    } catch (e) {
      const text = await res.text().catch(() => '');
      if (!res.ok) throw new Error(text || `${method} ${path} failed with ${res.status}`);
      throw new Error(`Invalid JSON response from ${path}`);
    }
  } else {
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(text || `${method} ${path} failed with ${res.status}`);
    // Successful non-JSON; return as any string
    return text as unknown as T;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });
  return parseResponse<T>(res, 'GET', path);
}

export async function apiPost<T>(path: string, body: any, headers: Record<string, string> = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
    body: isForm ? body : JSON.stringify(body),
  });
  return parseResponse<T>(res, 'POST', path);
}

export async function login(username: string, password: string) {
  return apiPost<{ ok: boolean }>(`/login.php`, { username, password });
}

export async function logout(): Promise<{ ok: boolean }> {
  try {
    const res = await apiPost<{ ok: boolean }>(`/logout.php`, {});
    if (res && typeof res.ok === 'boolean') return res;
  } catch (_) {
    // ignore and try GET
  }
  // Fallback: some hosts block POST; attempt GET
  try {
    const res = await apiGet<{ ok: boolean }>(`/logout.php`);
    if (res && typeof res.ok === 'boolean') return res;
  } catch (_) {}
  return { ok: false };
}

export async function me() {
  return apiGet<{ authenticated: boolean }>(`/me.php`);
}

// Manifest and CRUD helpers
export type Manifest = {
  version: number;
  sounds: Array<any>;
  schedules: Array<any>;
  categories?: Array<any>;
};

export async function getManifest(): Promise<Manifest> {
  return apiGet<Manifest>(`/manifest.php`);
}

export async function uploadSound(file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiPost<{ name: string; url: string; file_path: string; size: number; type: string }>(`/upload.php`, form);
}

export async function soundsInsert(body: any, version?: number) {
  const form = new FormData();
  Object.entries(body || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });
  return apiPost<{ version: number; sound: any }>(`/sounds.php?action=insert`, form);
}

export async function soundsUpdate(body: any, version?: number) {
  const form = new FormData();
  Object.entries(body || {}).forEach(([k, v]) => {
    if (v !== undefined) {
      form.append(k, v === null ? '' : String(v));
    }
  });
  return apiPost<{ version: number; sound: any }>(`/sounds.php?action=update`, form);
}

export async function soundsDelete(id: string, version?: number) {
  const form = new FormData();
  form.append('id', id);
  return apiPost<{ version: number; ok: true }>(`/sounds.php?action=delete`, form);
}

export async function soundsReorder(orders: Array<{ id: string; display_order: number }>, version?: number) {
  const form = new FormData();
  // Send as JSON string inside form to keep payload simple
  form.append('orders', JSON.stringify(orders));
  return apiPost<{ version: number; ok: true }>(`/sounds.php?action=reorder`, form);
}

export async function schedulesInsert(body: any, version?: number) {
  const form = new FormData();
  Object.entries(body || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });
  return apiPost<{ version: number; schedule: any }>(`/schedules.php?action=insert`, form);
}

export async function schedulesUpdate(body: any, version?: number) {
  const form = new FormData();
  Object.entries(body || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null) form.append(k, String(v));
  });
  return apiPost<{ version: number; schedule: any }>(`/schedules.php?action=update`, form);
}

export async function schedulesDelete(id: string, version?: number) {
  const form = new FormData();
  form.append('id', id);
  return apiPost<{ version: number; ok: true }>(`/schedules.php?action=delete`, form);
}

export async function soundsResync() {
  return apiPost<{ version: number; added: any[]; ok: boolean }>(`/resync.php`, {});
}

// Categories CRUD
export async function categoriesInsert(body: { name: string; display_order?: number; color?: string | null }, version?: number) {
  const form = new FormData();
  form.append('name', body.name);
  if (typeof body.display_order === 'number') form.append('display_order', String(body.display_order));
  if (body.color !== undefined) {
    const v = body.color === null ? '' : String(body.color);
    form.append('color', v);
    form.append('hex', v);
    // Also send RGB numeric components to bypass possible WAF filters
    if (v) {
      const m = v.replace('#','');
      if (m.length === 6) {
        const r = parseInt(m.slice(0,2), 16);
        const g = parseInt(m.slice(2,4), 16);
        const b = parseInt(m.slice(4,6), 16);
        form.append('r', String(r));
        form.append('g', String(g));
        form.append('b', String(b));
      }
    }
  }
  return apiPost<{ version: number; category: any }>(`/categories.php?action=insert`, form);
}

export async function categoriesUpdate(body: { id: string; name?: string; display_order?: number; color?: string | null }, version?: number) {
  const form = new FormData();
  form.append('id', body.id);
  if (typeof body.name === 'string') form.append('name', body.name);
  if (typeof body.display_order === 'number') form.append('display_order', String(body.display_order));
  if (body.color !== undefined) {
    const v = body.color === null ? '' : String(body.color);
    form.append('color', v);
    form.append('hex', v);
  }
  return apiPost<{ version: number; category: any }>(`/categories.php?action=update`, form);
}

export async function categoriesDelete(id: string, version?: number) {
  const form = new FormData();
  form.append('id', id);
  return apiPost<{ version: number; ok: true }>(`/categories.php?action=delete`, form);
}

export async function categoriesGet() {
  return apiGet<{ version: number; categories: Array<any> }>(`/categories.php`);
}

// --- Timeline Presets ---
export type TimelinePreset = {
  id: string;
  name: string;
  segments: Array<{ id: string; title: string; startTime: string; endTime: string }>;
};

export async function presetsList() {
  return apiGet<{ presets: TimelinePreset[] }>(`/presets.php?action=list`);
}

export async function presetsUpsert(preset: TimelinePreset) {
  const form = new FormData();
  form.append('id', preset.id);
  form.append('name', preset.name);
  form.append('segments', JSON.stringify(preset.segments));
  return apiPost<{ ok: true; preset: TimelinePreset }>(`/presets.php?action=upsert`, form);
}

export async function presetsDelete(id: string) {
  const form = new FormData();
  form.append('id', id);
  return apiPost<{ ok: true }>(`/presets.php?action=delete`, form);
}

// Timeline state (e.g., mutedSchedules)
export async function timelineGet() {
  return apiGet<{ mutedSchedules: string[]; mutedSegments: string[] }>(`/timeline.php?action=get`);
}

export async function timelineSave(mutedSchedules: string[], mutedSegments: string[]) {
  const form = new FormData();
  form.append('mutedSchedules', JSON.stringify(mutedSchedules));
  form.append('mutedSegments', JSON.stringify(mutedSegments));
  return apiPost<{ ok: true; mutedSchedules: string[]; mutedSegments: string[] }>(`/timeline.php?action=save`, form);
}
