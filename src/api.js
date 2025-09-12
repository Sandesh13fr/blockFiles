export async function deleteFile(cid) {
  const res = await fetch(`${API_BASE}/files/${cid}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  return res.json();
}
const API_BASE = '/api';

export async function health() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function listFiles() {
  const res = await fetch(`${API_BASE}/files`);
  if (!res.ok) throw new Error('Failed to list files');
  return res.json();
}

export async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function downloadByCid(cid) {
  const res = await fetch(`${API_BASE}/files/${cid}`);
  if (!res.ok) throw new Error('Download failed');
  const blob = await res.blob();
  return blob;
}

export function ipfsGatewayUrl(cid) {
  return `https://ipfs.io/ipfs/${cid}`;
} 