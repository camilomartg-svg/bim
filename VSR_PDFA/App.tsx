
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import PdfRenderer from './components/PdfRenderer';
import Toolbar from './components/Toolbar';
import { Calibration, Tool } from './types';
import { loadSecurityContext, isUserAuthorizedForFile, cleanSpecialty } from './securityUtils';

interface DrawingItem {
  name: string;
  filename?: string;
  fileId?: string;
  folder: string;
}

const DRIVE_MODELS_FOLDER_ID = '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H';
const DRIVE_MODELS_API_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

const jsonpRequest = async <T,>(url: URL, timeoutMs = 30000): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const cb = `__jsonp_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    url.searchParams.set('callback', cb);
    const script = document.createElement('script');
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try {
        delete (window as any)[cb];
      } catch {
        (window as any)[cb] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera agotado (JSONP)'));
    }, timeoutMs);

    (window as any)[cb] = (data: T) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('No se pudo cargar el script JSONP'));
    };

    script.src = url.toString();
    document.head.appendChild(script);
  });
};

const base64ToBytes = (base64: string): Uint8Array => {
  const binString = atob(base64);
  return Uint8Array.from(binString, (m) => m.charCodeAt(0));
};

const concatBytes = (arrays: Uint8Array[], totalLength: number): Uint8Array => {
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.byteLength;
  }
  return result;
};

const fetchDriveBytes = async (id: string, onProgress?: (percent: number) => void): Promise<Uint8Array> => {
  let limit = 2 * 1024 * 1024;
  let offset = 0;
  let total: number | null = null;
  const parts: Uint8Array[] = [];

  for (;;) {
    const url = new URL(DRIVE_MODELS_API_URL);
    url.searchParams.set('action', 'chunk');
    url.searchParams.set('id', id);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));

    let payload: { data?: string; total?: number; nextOffset?: number; done?: boolean } | null = null;
    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        payload = await jsonpRequest<{ data?: string; total?: number; nextOffset?: number; done?: boolean }>(url, 45000);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        const msg = String((e as any)?.message ?? '');
        const isTimeout = msg.includes('Tiempo de espera agotado');
        if (isTimeout && limit > 256 * 1024) {
          limit = Math.max(256 * 1024, Math.floor(limit / 2));
        }
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
      }
    }
    if (!payload) throw (lastErr instanceof Error ? lastErr : new Error('No se pudo descargar el chunk de Drive.'));

    const chunk = payload.data ? base64ToBytes(payload.data) : new Uint8Array(0);
    parts.push(chunk);
    if (typeof payload.total === 'number' && Number.isFinite(payload.total)) total = payload.total;
    offset = typeof payload.nextOffset === 'number' && Number.isFinite(payload.nextOffset) ? payload.nextOffset : offset + chunk.byteLength;
    
    if (onProgress && total) {
      onProgress(Math.min(100, Math.round((offset / total) * 100)));
    }
    
    if (payload.done) break;
    if (chunk.byteLength === 0) break;
    if (total !== null && offset >= total) break;
  }

  const finalTotal = total ?? parts.reduce((a, b) => a + b.byteLength, 0);
  return concatBytes(parts, finalTotal);
};

const DRAWING_BASE_URL = 'https://raw.githubusercontent.com/camilomartg-svg/bim/main/VSR_PDF/public/Drawing';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.8);
  const [rotation, setRotation] = useState(0);
  const [documentText, setDocumentText] = useState("");
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  const [activeTool, setActiveTool] = useState<Tool>('hand');
  const [showGrid, setShowGrid] = useState(false);
  const [isBlueprint, setIsBlueprint] = useState(false);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [drawings, setDrawings] = useState<DrawingItem[]>([]);
  const [isLoadingDrawing, setIsLoadingDrawing] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [showSidebar, setShowSidebar] = useState(true);
  
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('vsr_pdfa_sidebar_width');
    return saved ? parseInt(saved, 10) : 256;
  });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = mouseMoveEvent.clientX;
      if (newWidth >= 180 && newWidth <= 500) {
        setSidebarWidth(newWidth);
        localStorage.setItem('vsr_pdfa_sidebar_width', String(newWidth));
      }
    }
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    } else {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setCurrentPage(1);
    setCalibration(null);
    setDocumentText("");
  };

  const onDocumentLoad = useCallback((pages: number, text: string) => {
    setTotalPages(pages);
    setDocumentText(text);
  }, []);

  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleZoom = (delta: number) => setScale(prev => Math.max(0.1, Math.min(10, prev + delta)));

  useEffect(() => {
    console.log(`%c NORA CDE BIM v2.4 - ${new Date().toLocaleTimeString()} `, "background: #333333; color: #0D0D0D; font-size: 20px; padding: 10px;");
  }, []);

  useEffect(() => {
    const loadDrawings = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const project = params.get('project') || '';
        const driveFolderName = params.get('driveFolderName') || '';
        const folderId = params.get('driveFolderId') || DRIVE_MODELS_FOLDER_ID;
        const companyId = params.get('empresa') || '';

        let secCtx: any = null;
        try {
          secCtx = await loadSecurityContext(project, companyId);
        } catch (se) {
          console.warn('Error loading security context:', se);
        }

        if (project || driveFolderName || folderId) {
          const url = new URL(DRIVE_MODELS_API_URL);
          url.searchParams.set('action', 'list');
          url.searchParams.set('folderId', folderId);
          if (project) url.searchParams.set('project', project);
          if (driveFolderName) url.searchParams.set('driveFolderName', driveFolderName);
          url.searchParams.set('t', String(Date.now()));

          const data = await jsonpRequest<{ pdfs?: DrawingItem[] }>(url, 45000);
          const files = Array.isArray(data?.pdfs) ? data.pdfs : [];
          
          const processedFiles = files.map(item => {
            const fname = item.name || item.filename || '';
            const fid = item.fileId || '';
            const match = secCtx?.statusMap?.[fid] || secCtx?.statusMap?.[fname.toLowerCase()] || null;
            return {
              ...item,
              filename: fname,
              status: match?.status || 'EN_PROGRESO',
              changedBy: (match?.changedBy && match.changedBy.trim()) || (item as any).ownerName || 'UNASSIGNED',
              changedByEmail: (match?.changedByEmail && match.changedByEmail.trim()) || (item as any).ownerEmail || 'unassigned@nora.cde'
            };
          });

          const authorizedFiles = processedFiles.filter(f => isUserAuthorizedForFile(
            secCtx?.currentUser,
            f,
            secCtx?.activeProject,
            secCtx?.currentCompany,
            companyId,
            'view'
          ));

          setDrawings(authorizedFiles);
          return;
        }

        const response = await fetch(`${DRAWING_BASE_URL}/list.json`);
        if (!response.ok) return;
        const data: DrawingItem[] = await response.json();
        
        const processedLocal = data.map(item => {
          const fname = item.name || item.filename || '';
          const fid = item.fileId || '';
          const match = secCtx?.statusMap?.[fid] || secCtx?.statusMap?.[fname.toLowerCase()] || null;
          return {
            ...item,
            filename: fname,
            status: match?.status || 'EN_PROGRESO',
            changedBy: (match?.changedBy && match.changedBy.trim()) || (item as any).ownerName || 'UNASSIGNED',
            changedByEmail: (match?.changedByEmail && match.changedByEmail.trim()) || (item as any).ownerEmail || 'unassigned@nora.cde'
          };
        });

        const authorizedLocal = processedLocal.filter(f => isUserAuthorizedForFile(
          secCtx?.currentUser,
          f,
          secCtx?.activeProject,
          secCtx?.currentCompany,
          companyId,
          'view'
        ));

        setDrawings(authorizedLocal);
      } catch (err) {
        console.error('loadDrawings error:', err);
      }
    };
    loadDrawings();
  }, []);

  const handleSelectDrawing = async (drawing: DrawingItem) => {
    setIsLoadingDrawing(true);
    try {
      let blob: Blob;
      if (drawing.fileId) {
        const bytes = await fetchDriveBytes(drawing.fileId);
        blob = new Blob([bytes as any], { type: 'application/pdf' });
      } else {
        const filename = drawing.filename || drawing.name;
        const relativePath = filename.includes('/')
          ? filename
          : (drawing.folder ? `${drawing.folder}/${filename}` : filename);
        const encodedPath = relativePath
          .split('/')
          .map(segment => encodeURIComponent(segment))
          .join('/');
        const pdfPath = `${DRAWING_BASE_URL}/${encodedPath}`;
        const response = await fetch(pdfPath);
        if (!response.ok) return;
        blob = await response.blob();
      }
      const simpleName = drawing.name.toLowerCase().endsWith('.pdf') ? drawing.name : `${drawing.name}.pdf`;
      const fileFromServer = new File([blob], simpleName, { type: 'application/pdf' });
      handleFileSelect(fileFromServer);
    } catch {
    } finally {
      setIsLoadingDrawing(false);
    }
  };

  const groupedDrawings = useMemo(() => {
    const groups: Record<string, DrawingItem[]> = {};
    drawings.forEach(d => {
      const specialty = cleanSpecialty(d.folder, d.name || d.filename);
      if (!groups[specialty]) groups[specialty] = [];
      groups[specialty].push(d);
    });
    const sortedFolders = Object.keys(groups).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) {
        return na - nb;
      }
      return a.localeCompare(b);
    });
    return sortedFolders.map(folder => ({
      folder,
      items: groups[folder].sort((a, b) => a.name.localeCompare(b))
    }));
  }, [drawings]);

  useEffect(() => {
    if (drawings.length && Object.keys(expandedFolders).length === 0) {
      const init: Record<string, boolean> = {};
      drawings.forEach(d => {
        const specialty = cleanSpecialty(d.folder, d.name || d.filename);
        init[specialty] = false;
      });
      setExpandedFolders(init);
    }
  }, [drawings, expandedFolders]);

  useEffect(() => {
    if (drawings.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const autoLoadFileId = params.get('fileId');
      const autoLoadFilename = params.get('file');

      if ((autoLoadFileId || autoLoadFilename) && !(window as any)._autoLoadedDrawing) {
        (window as any)._autoLoadedDrawing = true;
        const matchingItem = drawings.find((d) =>
          (autoLoadFileId && d.fileId === autoLoadFileId) ||
          (autoLoadFilename && (d.name === autoLoadFilename || d.filename === autoLoadFilename))
        );

        if (matchingItem) {
          handleSelectDrawing(matchingItem);
          const specialty = cleanSpecialty(matchingItem.folder, matchingItem.name || matchingItem.filename);
          setExpandedFolders(prev => ({ ...prev, [specialty]: true }));
        }
      }
    }
  }, [drawings]);

  const toggleFolder = (folder: string) => {
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    groupedDrawings.forEach(g => { next[g.folder] = true; });
    setExpandedFolders(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    groupedDrawings.forEach(g => { next[g.folder] = false; });
    setExpandedFolders(next);
  };

  return (
    <div className={`flex h-screen w-full overflow-hidden select-none ${theme === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <Toolbar
          file={file}
          activeTool={activeTool}
          scale={scale}
          showGrid={showGrid}
          isBlueprint={isBlueprint}
          onToolChange={setActiveTool}
          onZoom={handleZoom}
          onRotate={handleRotate}
          onShowGridToggle={() => setShowGrid(!showGrid)}
          onBlueprintToggle={() => setIsBlueprint(!isBlueprint)}
          theme={theme}
          onThemeToggle={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          sidebarVisible={showSidebar}
          onSidebarToggle={() => setShowSidebar(v => !v)}
        />

        {file && (
          <div
            className={`absolute bottom-6 right-6 px-4 py-2 rounded-xl flex items-center gap-6 z-40 shadow-2xl border ${
              theme === 'dark'
                ? 'bg-[#000000]/90 border-[#605E62]'
                : 'bg-[#FFFFFF] border-[#C5C0C8]'
            }`}
          >
            <div
              className={`flex items-center gap-3 pr-4 border-r ${
                theme === 'dark' ? 'border-[#605E62]' : 'border-[#C5C0C8]'
              }`}
            >
              <button
                onClick={() => currentPage > 1 && setCurrentPage(p => p - 1)}
                disabled={currentPage <= 1}
                className={`w-8 h-8 flex items-center justify-center rounded disabled:opacity-20 transition ${
                  theme === 'dark'
                    ? 'hover:bg-[#605E62] text-[#C5C0C8]'
                    : 'hover:bg-[#F3F3F3] text-[#605E62]'
                }`}
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
              <span
                className={`text-[10px] font-bold min-w-[80px] text-center uppercase tracking-widest ${
                  theme === 'dark' ? 'text-[#C5C0C8]' : 'text-[#605E62]'
                }`}
              >
                PLANO {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => currentPage < totalPages && setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages}
                className={`w-8 h-8 flex items-center justify-center rounded disabled:opacity-20 transition ${
                  theme === 'dark'
                    ? 'hover:bg-[#605E62] text-[#C5C0C8]'
                    : 'hover:bg-[#F3F3F3] text-[#605E62]'
                }`}
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            </div>
            {calibration ? (
              <div className="flex items-center gap-2 text-[#333333] text-[10px] font-black animate-pulse">
                <i className="fa-solid fa-check-circle"></i> ESCALA CALIBRADA
              </div>
            ) : (
              <div
                className={`text-[9px] font-bold uppercase ${
                  theme === 'dark' ? 'text-[#827E84]' : 'text-[#605E62]'
                }`}
              >
                Escala no definida
              </div>
            )}
          </div>
        )}

        <main className={`flex-1 relative overflow-hidden flex ${isResizing ? 'cursor-col-resize select-none' : ''}`}>
          {showSidebar && (
          <aside 
            style={{ width: `${sidebarWidth}px` }}
            className="sidebar-panel border-r border-[var(--border-color)] flex-shrink-0 flex flex-col pb-16 transition-colors duration-200 relative"
          >
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <h2 className="text-[11px] font-black tracking-[0.18em] uppercase text-[var(--text-black)]">
                Planos BIM
              </h2>
              <p className="text-[10px] mt-1 text-[var(--text-med-gray)]">
                Selecciona un plano de la galería.
              </p>
            </div>
            <div className="px-4 py-2 border-b border-[var(--border-color)] flex items-center gap-2">
              <button 
                onClick={expandAll} 
                className="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-white)] text-[var(--text-dark-gray)] hover:bg-[var(--bg-light-gray)] hover:text-[var(--primary-color)] transition"
              >
                Expandir todo
              </button>
              <button 
                onClick={collapseAll} 
                className="text-[10px] px-2 py-1 rounded border border-[var(--border-color)] bg-[var(--bg-white)] text-[var(--text-dark-gray)] hover:bg-[var(--bg-light-gray)] hover:text-[var(--primary-color)] transition"
              >
                Contraer todo
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2 px-2 pb-16 space-y-1 bg-[var(--bg-light-gray)]">
              {groupedDrawings.map(group => (
                <div key={group.folder} className="mb-2">
                  <div className="px-1 py-1 text-[9px] font-bold uppercase tracking-[0.16em] flex items-center justify-between text-[var(--text-med-gray)]">
                    <span>{group.folder}</span>
                    <button 
                      onClick={() => toggleFolder(group.folder)} 
                      className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-dark-gray)] hover:bg-[var(--bg-light-gray)] hover:text-[var(--primary-color)] transition"
                    >
                      <i className={`fa-solid ${expandedFolders[group.folder] ? 'fa-chevron-down' : 'fa-chevron-right'} text-xs`}></i>
                    </button>
                  </div>
                  {expandedFolders[group.folder] && (
                    <div className="space-y-1 pl-1">
                      {group.items.map(drawing => {
                        const isActive = file && file.name.startsWith(drawing.name);
                        return (
                          <button
                            key={`${group.folder}-${drawing.filename}`}
                            onClick={() => handleSelectDrawing(drawing)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition border ${
                              isActive
                                ? 'bg-[var(--primary-color)] text-[var(--bg-white)] border-[var(--primary-color)] shadow-sm'
                                : 'bg-[var(--bg-white)] hover:bg-[var(--bg-light-gray)] text-[var(--text-dark-gray)] border-[var(--border-color)]'
                            }`}
                          >
                            <span className="block truncate">{drawing.name}</span>
                            <span className={`block text-[9px] mt-0.5 ${isActive ? 'text-[var(--bg-white)] opacity-80' : 'text-[var(--text-med-gray)]'}`}>
                              {cleanSpecialty(drawing.folder, drawing.name || drawing.filename)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {/* Drag Handle for Resizing */}
            <div
              onMouseDown={startResizing}
              className={`resizer ${isResizing ? 'resizing' : ''}`}
            />
          </aside>
          )}

          <div className="flex-1 relative flex flex-col viewer-panel transition-colors duration-200">
            <PdfRenderer 
              file={file} 
              currentPage={currentPage} 
              scale={scale} 
              rotation={rotation}
              tool={activeTool}
              showGrid={showGrid}
              isBlueprint={isBlueprint}
              calibration={calibration}
              onCalibrationComplete={setCalibration}
              onDocumentLoad={onDocumentLoad}
              onFileSelect={handleFileSelect}
              onToolChange={setActiveTool}
              onZoom={setScale}
            />

            {isLoadingDrawing && (
              <div className="absolute inset-0 bg-[#000000]/80 flex items-center justify-center z-40">
                <div className="px-4 py-3 rounded-xl bg-[#0D0D0D] border border-[#605E62]/60 shadow-2xl flex items-center gap-3">
                  <div className="w-6 h-6 border-2 border-[#333333]/20 border-t-[#333333] rounded-full animate-spin" />
                  <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-[#C5C0C8]">Cargando plano desde galería...</span>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
