import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly'
];
const PICKER_API_URL = 'https://apis.google.com/js/api.js';
const GIS_API_URL = 'https://accounts.google.com/gsi/client';
const PICKER_VIEW_MIME_TYPES = undefined; // allow all

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function DriveUploader({
  apiBase = import.meta.env.VITE_API_BASE || 'http://localhost:5000',
  onUploaded,
  onFilePicked, // New callback that receives file info + access token
  defaultType = 'other',
  allowLocalUpload = true,
  driveButtonLabel = 'Upload from Google Drive',
  buttonBg,
  buttonTextColor,
  skipBackendSave = false, // If true, skip saving to DriveUpload collection
}) {
  const clientId = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;
  const apiKey = import.meta.env.VITE_GOOGLE_PICKER_API_KEY;
  const [pickerReady, setPickerReady] = useState(false);
  const oauthTokenRef = useRef(null);
  const tokenClientRef = useRef(null);
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [accountHint, setAccountHint] = useState(() => {
    try {
      return localStorage.getItem('google_account_hint') || '';
    } catch {
      return '';
    }
  });

  const parseJwt = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return {};
    }
  };

  const headers = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : undefined,
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let waitTimer = null;

    async function init() {
      try {
        await Promise.all([loadScript(PICKER_API_URL), loadScript(GIS_API_URL)]);
        if (cancelled) return;

        // Robustly wait until window.gapi and GIS are actually attached
        const waitForApis = (attempt = 0) => {
          if (cancelled) return;
          const g = window.gapi;
          const googleObj = window.google;
          const hasGapi = g && typeof g.load === 'function';
          const hasGis = googleObj && googleObj.accounts && googleObj.accounts.oauth2 && typeof googleObj.accounts.oauth2.initTokenClient === 'function';

          if (hasGapi && hasGis) {
            g.load('client', async () => {
              try {
                await g.client.init({
                  apiKey: apiKey,
                  // auth handled by GIS; no clientId/scope here
                  discoveryDocs: [],
                });
                // Prepare GIS token client
                tokenClientRef.current = googleObj.accounts.oauth2.initTokenClient({
                  client_id: clientId,
                  scope: SCOPES.join(' '),
                  callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                      oauthTokenRef.current = tokenResponse.access_token;
                      try {
                        g.client.setToken({ access_token: tokenResponse.access_token });
                      } catch (_) {}
                    } else {
                      console.error('Failed to obtain access token from GIS.', tokenResponse);
                    }
                  },
                });

                // Initialize One Tap to capture a hint (email) silently
                try {
                  googleObj.accounts.id.initialize({
                    client_id: clientId,
                    auto_select: true,
                    callback: (cred) => {
                      const payload = parseJwt(cred.credential || '');
                      if (payload && payload.email) {
                        setAccountHint(payload.email);
                        try { localStorage.setItem('google_account_hint', payload.email); } catch {}
                      }
                    },
                  });
                  // Trigger silent prompt (will not show if not eligible)
                  googleObj.accounts.id.prompt(() => {});
                } catch (_) {}

                if (!cancelled) setPickerReady(true);
              } catch (e) {
                console.error('gapi init error', e);
              }
            });
            return;
          }
          if (attempt > 40) {
            console.error('gapi or GIS failed to load after waiting. Check API key restrictions or ad blockers.');
            return;
          }
          waitTimer = setTimeout(() => waitForApis(attempt + 1), 100);
        };
        waitForApis();
      } catch (e) {
        console.error('Failed to load gapi', e);
      }
    }
    init();
    return () => {
      cancelled = true;
      if (waitTimer) {
        clearTimeout(waitTimer);
      }
    };
  }, [apiKey, clientId]);

  const ensureAuth = useCallback(async () => {
    if (oauthTokenRef.current) return oauthTokenRef.current;
    if (!tokenClientRef.current) throw new Error('Token client not ready');
    // Try silent token first; fall back to consent prompt only if required
    const requestToken = (promptValue, hintValue) =>
      new Promise((resolve, reject) => {
        try {
          tokenClientRef.current.callback = (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              resolve(tokenResponse.access_token);
            } else if (tokenResponse && (tokenResponse.error || tokenResponse.error_description)) {
              reject(tokenResponse);
            } else {
              reject(new Error('Failed to obtain access token'));
            }
          };
          tokenClientRef.current.requestAccessToken({ prompt: promptValue, hint: hintValue });
        } catch (e) {
          reject(e);
        }
      });

    let token;
    try {
      // Silent (no account chooser if possible)
      token = await requestToken('', accountHint || undefined);
    } catch (silentErr) {
      // Only then ask for consent (shows account chooser)
      token = await requestToken('consent', accountHint || undefined);
    }
    oauthTokenRef.current = token;
    try {
      window.gapi?.client?.setToken?.({ access_token: token });
    } catch (_) {}
    return token;
  }, []);

  const openPicker = useCallback(async () => {
    try {
      setBusy(true);
      if (!pickerReady) return;
      const token = await ensureAuth();
      // Ensure token is stored in ref for callback access
      oauthTokenRef.current = token;
      await new Promise((resolve) => window.gapi.load('picker', resolve));

      // Views: show all Drive files (Recent) first, like Classroom
      const docsView = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS)
        .setIncludeFolders(false)
        .setSelectFolderEnabled(false)
        .setMode(window.google.picker.DocsViewMode.THUMBNAILS);

      // Provide an Upload tab as secondary
      const uploadView = new window.google.picker.DocsUploadView()
        .setIncludeFolders(false);

      // Store token in closure for callback
      const currentToken = token;
      
      const picker = new window.google.picker.PickerBuilder()
        // Single selection (omit MULTISELECT to mimic Classroom)
        .setAppId('') // optional
        .setOAuthToken(currentToken)
        .setDeveloperKey(apiKey)
        // Put Docs first so it opens on Recent by default
        .addView(docsView)
        .addView(uploadView)
        .setCallback(async (data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const doc = data.docs && data.docs[0];
            if (doc) {
              // Use token from closure, fallback to ref if needed
              const accessToken = currentToken || oauthTokenRef.current;
              
              console.log('File picked from Google Drive:', {
                id: doc.id,
                name: doc.name,
                hasAccessToken: !!accessToken,
                tokenLength: accessToken ? accessToken.length : 0
              });
              
              // If onFilePicked callback is provided, call it with file info and token
              if (onFilePicked) {
                onFilePicked({
                  id: doc.id,
                  name: doc.name,
                  mimeType: doc.mimeType,
                  webViewLink: doc.url,
                  iconLink: doc.iconUrl,
                  thumbnailLink: doc.thumbnailUrl,
                  size: doc.sizeBytes,
                  accessToken: accessToken,
                });
                // Don't save to backend if skipBackendSave is true
                if (skipBackendSave) {
                  return;
                }
              }
              
              // Default behavior: save to DriveUpload collection
              const payload = {
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                webViewLink: doc.url,
                iconLink: doc.iconUrl,
                thumbnailLink: doc.thumbnailUrl,
                size: doc.sizeBytes,
                type: defaultType,
              };
              const res = await fetch(`${apiBase}/api/google-drive/save-picker`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.message || 'Failed saving Picker file');
              onUploaded && onUploaded(json.file);
            }
          }
        })
        .build();
      picker.setVisible(true);
    } catch (e) {
      console.error('Picker error', e);
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }, [apiBase, apiKey, defaultType, ensureAuth, headers, onUploaded, onFilePicked, skipBackendSave, pickerReady]);

  const handleFileButtonClick = useCallback(() => {
    if (!allowLocalUpload) return;
    fileInputRef.current?.click();
  }, [allowLocalUpload]);

  const onLocalChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        setBusy(true);
        const form = new FormData();
        form.append('file', file);
        form.append('type', defaultType);
        const token = localStorage.getItem('token');
        const res = await fetch(`${apiBase}/api/google-drive/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Upload failed');
        onUploaded && onUploaded(json.file);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (e2) {
        console.error(e2);
        alert(e2.message);
      } finally {
        setBusy(false);
      }
    },
    [apiBase, defaultType, onUploaded]
  );

  const buttonDisabled = !clientId || !apiKey || busy;

  return (
    <div style={{ display: 'inline-block' }}>
      <button
        type="button"
        disabled={buttonDisabled}
        onClick={openPicker}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '6px',
          border: buttonBg ? '1px solid transparent' : '1px solid #d1d5db',
          backgroundColor: buttonBg || '#ffffff',
          color: buttonTextColor || '#111827',
          cursor: buttonDisabled ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
          minWidth: '140px',
        }}
      >
        {busy ? 'Please wait…' : driveButtonLabel}
      </button>

      {allowLocalUpload && (
        <input
          ref={fileInputRef}
          type="file"
          onChange={onLocalChange}
          disabled={busy}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}


