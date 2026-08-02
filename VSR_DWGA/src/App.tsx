import React, { useState, useCallback, Component, ErrorInfo } from 'react'
import { Calibration, Tool, SnapSettings } from './types'
import DwgRenderer from './components/DwgRenderer'

// Error Boundary Component
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DwgRenderer crashed:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-red-400 p-8 text-center">
          <i className="fa-solid fa-bug text-4xl mb-4"></i>
          <h2 className="text-xl font-bold mb-2">Algo salió mal en el visor</h2>
          <p className="text-sm bg-slate-950 p-4 rounded border border-red-900/50 font-mono mb-4 max-w-2xl break-all">
            {this.state.error?.message}
          </p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded text-white text-sm"
          >
            Intentar recargar
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface RepoFile {
  name: string
  filename?: string
  fileId?: string
  description?: string
  folder?: string
}

const DRIVE_MODELS_FOLDER_ID = '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H';
const DRIVE_MODELS_API_URL = 'https://script.google.com/macros/s/AKfycby9jzOK9vz9OR_QTCo2MOMGAD25QlXJK1nreMGcWsR2Y2i3RNABh8BkGvBHfdO267AVgQ/exec';

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

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [activeTool, setActiveTool] = useState<Tool>('hand')
  const [showGrid, setShowGrid] = useState(false)
  const [calibration, setCalibration] = useState<Calibration | null>(null)
  const [snapSettings, setSnapSettings] = useState<SnapSettings>({
    enableEndpoint: true,
    enableMidpoint: true,
    thresholdPx: 18
  })
  
  // Repository files state
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([])
  const [selectedRepoFile, setSelectedRepoFile] = useState<RepoFile | null>(null)
  const [isLoadingRepo, setIsLoadingRepo] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({})
  const [isDarkMode, setIsDarkMode] = useState(true)

  // Sidebar Resizing Logic
  const [sidebarWidth, setSidebarWidth] = useState(300)
  const isResizing = React.useRef(false)

  const startResizing = useCallback(() => {
    isResizing.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const stopResizing = useCallback(() => {
    isResizing.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      const newWidth = Math.min(Math.max(e.clientX, 300), window.innerWidth - 100)
      setSidebarWidth(newWidth)
    }
  }, [])

  React.useEffect(() => {
    window.addEventListener('mousemove', resize)
    window.addEventListener('mouseup', stopResizing)
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [resize, stopResizing])

  // Sync dark mode with HTML element
  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Load files on mount
  React.useEffect(() => {
    loadRepoFiles()
  }, [])



  const loadRepoFiles = async () => {
    setIsLoadingRepo(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const project = params.get('project') || ''
      const driveFolderName = params.get('driveFolderName') || ''
      const folderId = params.get('driveFolderId') || DRIVE_MODELS_FOLDER_ID
      
      if (project || driveFolderName || folderId) {
        const url = new URL(DRIVE_MODELS_API_URL)
        url.searchParams.set('action', 'list')
        url.searchParams.set('folderId', folderId)
        if (project) url.searchParams.set('project', project)
        if (driveFolderName) url.searchParams.set('driveFolderName', driveFolderName)
        
        const data = await jsonpRequest<{ dwgs?: RepoFile[] }>(url, 45000)
        const files = Array.isArray(data?.dwgs) ? data.dwgs : []
        
        const processedFiles = files.map(f => ({
          ...f,
          filename: f.filename || f.name
        }))
        setRepoFiles(processedFiles)
        return
      }

      const baseUrl = (import.meta as any).env?.BASE_URL || './'
      const res = await fetch(`${baseUrl}Drawing/list.json?t=${Date.now()}`)
      if (!res.ok) throw new Error('No se pudo cargar la lista de archivos')
      const data = await res.json()
      setRepoFiles(data)
    } catch (err) {
      console.error(err)
      setRepoFiles([])
    } finally {
      setIsLoadingRepo(false)
    }
  }

  const selectRepoFile = async (rf: RepoFile) => {
    try {
      setIsDownloading(true)
      setDownloadError(null)
      
      let blob: Blob;
      if (rf.fileId) {
        const bytes = await fetchDriveBytes(rf.fileId)
        blob = new Blob([bytes as any], { type: rf.name.toLowerCase().endsWith('.dwg') ? 'application/dwg' : 'application/dxf' })
      } else {
        const baseUrl = (import.meta as any).env?.BASE_URL || './'
        const filename = rf.filename || rf.name
        const encodedPath = filename.split('/').map(part => encodeURIComponent(part)).join('/')
        const url = `${baseUrl}Drawing/${encodedPath}`
        
        console.log('Downloading file from:', url)
        
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Error al descargar archivo (${res.status})`)
        blob = await res.blob()
      }
      
      if (blob.size === 0) throw new Error('El archivo está vacío')

      const simpleName = rf.name || rf.filename || 'dibujo.dxf'
      const newFile = new File([blob], simpleName, { type: simpleName.toLowerCase().endsWith('.dwg') ? 'application/dwg' : 'application/dxf' })
      
      setFile(newFile)
      setCalibration(null)
      setSelectedRepoFile(rf)
    } catch (err) {
      console.error(err)
      setDownloadError((err as Error).message || 'Error al cargar el archivo')
      setFile(null)
    } finally {
      setIsDownloading(false)
    }
  }

  const toggleFolder = (folder: string) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [folder]: !prev[folder]
    }))
  }

  const onCalibrationComplete = useCallback((c: Calibration) => {
    setCalibration(c)
    setActiveTool('measure')
  }, [])

  return (
    <div className={`flex h-screen w-full ${isDarkMode ? 'dark' : ''} bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden select-none`}>
      {/* Sidebar */}
      <div 
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
        className={`bg-white dark:bg-black border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden relative`}
      >
        {/* Resize Handle */}
        <div 
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-nora-500 z-50 transition-colors delay-100"
          onMouseDown={startResizing}
        />
        <div className="h-12 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <span className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Galería</span>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
            <i className="fa-solid fa-chevron-left"></i>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {isLoadingRepo && repoFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <i className="fa-solid fa-circle-notch fa-spin text-xl mb-2"></i>
              <span className="text-[10px]">Cargando...</span>
            </div>
          ) : repoFiles.length === 0 ? (
            <div className="text-center py-8 text-slate-500 px-2">
              <p className="text-xs">No hay archivos</p>
            </div>
          ) : (
            Object.entries(repoFiles.reduce((acc, f) => {
              const k = f.folder || 'General'
              if (!acc[k]) acc[k] = []
              acc[k].push(f)
              return acc
            }, {} as Record<string, RepoFile[]>)).map(([folder, files]) => (
              <div key={folder} className="mb-4">
                <button 
                  onClick={() => toggleFolder(folder)}
                  className="w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-2 flex items-center justify-between sticky top-0 bg-white dark:bg-black py-1 z-10 border-b border-slate-200 dark:border-slate-800/50 hover:text-slate-800 dark:hover:text-slate-300 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <i className={`fa-regular ${collapsedFolders[folder] ? 'fa-folder' : 'fa-folder-open'} text-slate-400 dark:text-slate-600`}></i>
                    {folder}
                  </div>
                  <i className={`fa-solid fa-chevron-down transition-transform text-[10px] ${collapsedFolders[folder] ? '-rotate-90' : 'rotate-0'}`}></i>
                </button>
                
                <div className={`space-y-1 overflow-hidden transition-all duration-300 ${collapsedFolders[folder] ? 'max-h-0 opacity-0' : 'max-h-[1000px] opacity-100'}`}>
                  {files.map((rf, i) => (
                    <button
                      key={i}
                      onClick={() => selectRepoFile(rf)}
                      className={`w-full text-left p-2.5 rounded-lg border transition group flex flex-col gap-1
                        ${selectedRepoFile?.filename === rf.filename 
                          ? 'bg-nora-50 dark:bg-nora-600/20 border-nora-200 dark:border-nora-500/50' 
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-nora-300 dark:hover:border-nora-500/50'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <i className={`fa-regular fa-file-lines text-xs ${selectedRepoFile?.filename === rf.filename ? 'text-nora-600 dark:text-nora-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-nora-500'}`}></i>
                        <span className={`text-xs font-bold truncate ${selectedRepoFile?.filename === rf.filename ? 'text-nora-700 dark:text-nora-100' : 'text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white'}`}>
                          {rf.name}
                        </span>
                      </div>
                      {rf.description && (
                        <span className="text-[10px] text-slate-500 line-clamp-1 ml-5">
                          {rf.description}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black flex justify-center items-center">
          {isDarkMode ? (
            <img src="https://i.postimg.cc/fJT9Jjyh/LOGO_BIM_BLANCO_ICO.png" alt="BIM" className="h-12 object-contain" />
          ) : (
            <img src="https://i.postimg.cc/Whbkh6zc/LOGO_BIM_NEGRO_ICO.png" alt="BIM" className="h-12 object-contain" />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="h-12 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition mr-2"
                title="Mostrar Galería"
              >
                <i className="fa-solid fa-bars"></i>
              </button>
            )}
            <div className="flex items-center gap-3">
              <button 
                onClick={() => window.history.back()}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
                title="Volver"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <a href="../home.html" title="Volver al Home" className="flex items-center">
                {isDarkMode ? (
                  <img 
                    src="https://i.postimg.cc/tR3YSryT/LOGO-NORA-NEGRO.png" 
                    alt="nora CDE" 
                    className="h-7 object-contain"
                  />
                ) : (
                  <img 
                    src="https://i.postimg.cc/vmKVZndP/nora-urbano2.png" 
                    alt="nora CDE" 
                    className="h-7 object-contain"
                  />
                )}
              </a>
            </div>
            {file && <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-2"></div>}
            {file && <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[160px]">{file.name}</span>}
          </div>

          <div className="flex items-center gap-1">
            <div className="flex bg-slate-100 dark:bg-black rounded p-0.5 border border-slate-200 dark:border-slate-700 mr-4">
              <button 
                onClick={() => setActiveTool('hand')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'hand' ? 'bg-white dark:bg-nora-600 shadow text-nora-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Mano (Pan)"
              >
                <i className="fa-solid fa-hand-pointer text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('measure')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'measure' ? 'bg-white dark:bg-nora-600 shadow text-nora-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Medir"
              >
                <i className="fa-solid fa-ruler text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('area')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'area' ? 'bg-white dark:bg-nora-600 shadow text-nora-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Área"
              >
                <i className="fa-solid fa-draw-polygon text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('dimension')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'dimension' ? 'bg-white dark:bg-nora-600 shadow text-nora-600 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Cotas"
              >
                <i className="fa-solid fa-ruler-combined text-xs"></i>
              </button>
              <button 
                onClick={() => setActiveTool('calibrate')}
                className={`w-8 h-8 flex items-center justify-center rounded transition ${activeTool === 'calibrate' ? 'bg-nora-100 dark:bg-nora-500/20 text-nora-600 dark:text-nora-400 shadow-inner' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                title="Calibrar Escala"
              >
                <i className="fa-solid fa-arrows-left-right-to-line text-xs"></i>
              </button>
            </div>

            <button onClick={() => setShowGrid(!showGrid)} className={`w-8 h-8 rounded transition ${showGrid ? 'text-nora-600 dark:text-nora-400 bg-nora-50 dark:bg-nora-500/10' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title="Grid"><i className="fa-solid fa-border-none text-xs"></i></button>
                        
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className={`w-8 h-8 rounded transition ${isDarkMode ? 'text-nora-400 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'}`} 
              title="Alternar Tema"
            >
              <i className={`fa-solid ${isDarkMode ? 'fa-sun' : 'fa-moon'} text-xs`}></i>
            </button>

            <div className="hidden md:flex items-center gap-2 ml-4 px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Snap:</span>
              <label className="flex items-center gap-1 text-[10px] text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={snapSettings.enableEndpoint} onChange={(e) => setSnapSettings(s => ({ ...s, enableEndpoint: e.target.checked }))} />
                <span>Endpoint</span>
              </label>
              <label className="flex items-center gap-1 text-[10px] text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={snapSettings.enableMidpoint} onChange={(e) => setSnapSettings(s => ({ ...s, enableMidpoint: e.target.checked }))} />
                <span>Midpoint</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Umbral</span>
                <input
                  type="range"
                  min={6}
                  max={32}
                  value={snapSettings.thresholdPx}
                  onChange={(e) => setSnapSettings(s => ({ ...s, thresholdPx: parseInt(e.target.value) }))}
                />
                <span className="text-[10px] text-slate-300 w-6 text-center">{snapSettings.thresholdPx}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Gallery button removed, upload moved to sidebar */}
          </div>
        </header>

        {/* Modal removed */}

        {isDownloading ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 m-8 rounded-3xl border border-slate-800">
            <div className="w-16 h-16 border-4 border-nora-500/30 border-t-nora-500 animate-spin rounded-full mb-6"></div>
            <span className="text-nora-500 font-mono text-sm tracking-widest uppercase animate-pulse">Descargando archivo...</span>
          </div>
        ) : downloadError ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border-2 border-red-900/50 m-8 rounded-3xl">
            <div className="text-center space-y-4 max-w-sm p-8">
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
              </div>
              <h3 className="text-xl font-bold text-red-400 uppercase tracking-tight">Error de Carga</h3>
              <p className="text-slate-400 text-sm">{downloadError}</p>
              <button 
                onClick={() => setDownloadError(null)}
                className="inline-block cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold transition-all border border-slate-700"
              >
                Volver
              </button>
            </div>
          </div>
        ) : !file ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 m-8 rounded-3xl">
            <div className="text-center space-y-4 max-w-sm p-8">
              <div className="w-20 h-20 bg-nora-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-nora-500/20">
                <i className="fa-regular fa-folder-open text-3xl text-nora-500 animate-pulse"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Seleccionar Plano</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Explore la galería lateral para seleccionar y visualizar un plano del sistema.</p>
              {!isSidebarOpen && (
                <button 
                  onClick={() => setIsSidebarOpen(true)}
                  className="inline-block cursor-pointer bg-nora-600 hover:bg-nora-500 text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 active:scale-95 shadow-lg shadow-nora-500/20"
                >
                  Abrir Galería
                </button>
              )}
            </div>
          </div>
        ) : (
          <ErrorBoundary>
            <DwgRenderer 
              file={file}
              tool={activeTool}
              showGrid={showGrid}
              calibration={calibration}
              onCalibrationComplete={onCalibrationComplete}
              snapSettings={snapSettings}
              isDarkMode={isDarkMode}
            />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}

export default App
