'use client';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Play, Plus, Star, Trash2, Upload } from 'lucide-react';
import { WinningFilePreview } from './winning-file-preview';
import { parseWinningFile } from '../../../lib/domain/tracker-editing.js';
import type { Creative } from '../types';
import styles from '../../command-center.module.css';

type File = { id: string; name: string; mimeType?: string };
export function TrackerWinners({ creative, busy, save, share }: { creative: Creative; busy: boolean;
  save: (creative: Creative, file: File, remove?: boolean) => Promise<unknown>; share: (creative: Creative, fileId: string) => Promise<unknown> }) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const folderId = (() => { try { const url = new URL(creative.driveLink); return url.hostname === 'drive.google.com' ? url.pathname.match(/\/folders\/([\w-]+)/)?.[1] : ''; } catch { return ''; } })();
  async function browse() {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    try {
      const result = await fetch(`/api/drive/list?folder=${encodeURIComponent(folderId || '')}`, { signal: controller.signal });
      const data = await result.json();
      if (!result.ok) throw new Error(data.error || 'Drive folder is unavailable.');
      setFiles((data.files || []).filter((file: File) => /^[\w-]+$/.test(file.id) && /^(image|video)\//.test(file.mimeType || '')));
      if (data.folders_truncated) setError('Folder scan reached its limit. Some files may not be shown.');
    } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Drive request failed.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <div>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); setError(''); try { void save(creative, parseWinningFile(url, name)); } catch (cause) { setError((cause as Error).message); } }}>
      <fieldset disabled={busy} className={styles.trackerForm}><div className={styles.trackerFormGrid}>
        <label>Winning file URL<input type="url" required value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label>File name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      </div><button type="submit"><Plus size={16} />Save winning file</button></fieldset>
    </form>
    <ul className={styles.trackerFileList}>{creative.winningArtifacts.map((file: File) => <li key={file.id}>
      <span>{file.name}</span><div className={styles.trackerButtons}>
        <button type="button" title="Preview winning file" aria-label={`Preview ${file.name}`} onClick={() => setPreview(file.id)}><Play size={16} /></button>
        <a href={`https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view`} target="_blank" rel="noreferrer" title="Open in Drive" aria-label={`Open ${file.name} in Drive`}><ExternalLink size={16} /></a>
        {creative.clickupTaskId ? <button type="button" disabled={busy} title="Post winning file to ClickUp" aria-label={`Post ${file.name} to ClickUp`} onClick={() => void share(creative, file.id)}><Upload size={16} /></button> : null}
        <button type="button" disabled={busy} title="Remove winning file" aria-label={`Remove ${file.name}`} onClick={() => void save(creative, file, true)}><Trash2 size={16} /></button>
      </div></li>)}</ul>
    {preview ? <WinningFilePreview fileId={preview} close={() => setPreview('')} /> : null}
    {folderId ? <button type="button" disabled={loading} onClick={() => void browse()}>{loading ? 'Loading files...' : 'Browse Drive folder'}</button> : null}
    <ul className={styles.trackerFileList}>{files.map((file) => <li key={file.id}><span>{file.name}</span><button type="button" disabled={busy} title="Mark as winning file" aria-label={`Mark ${file.name} as winner`} onClick={() => void save(creative,file)}><Star size={16} /></button></li>)}</ul>
  </div>;
}
