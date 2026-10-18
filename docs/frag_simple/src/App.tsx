import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import workerUrl from '@thatopen/fragments/worker?url';
import { 
  FileUp, 
  AlertCircle, 
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface ConversionState {
  status: 'idle' | 'loading' | 'converting' | 'success' | 'error';
  message: string;
  fragBlob?: Blob;
  jsonBlob?: Blob;
  fileName?: string;
}

const getWorkerUrl = () => {
  try {
    return new URL(workerUrl, window.location.href).href;
  } catch {
    return workerUrl || "https://unpkg.com/@thatopen/fragments@3.3.6/dist/Worker/worker.mjs";
  }
};

export default function App() {
  const [state, setState] = useState<ConversionState>({
    status: 'idle',
    message: 'Ready to convert your IFC file.'
  });

  const componentsRef = useRef<OBC.Components | null>(null);
  const fragmentsRef = useRef<OBC.FragmentsManager | null>(null);
  const loaderRef = useRef<OBC.IfcLoader | null>(null);

  useEffect(() => {
    // Initialize That Open Components
    const components = new OBC.Components();
    componentsRef.current = components;

    const fragments = components.get(OBC.FragmentsManager);
    fragmentsRef.current = fragments;

    try {
      fragments.init(getWorkerUrl());
    } catch (e) {
      console.warn("Error initializing fragments worker:", e);
    }

    const loader = components.get(OBC.IfcLoader);
    loaderRef.current = loader;

    // Prevent autoSetWasm from overwriting wasm path with incompatible unpkg semver (>=0.0.74 -> 0.0.78)
    loader.settings.autoSetWasm = false;
    loader.settings.wasm = {
      path: "https://unpkg.com/web-ifc@0.0.77/",
      absolute: true
    };

    // Clean up
    return () => {
      try {
        components.dispose();
      } catch {}
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setState({
        status: 'error',
        message: 'Please select a valid .ifc file.'
      });
      return;
    }

    const baseName = file.name.replace(/\.ifc$/i, '');

    setState({
      status: 'loading',
      message: 'Reading file...',
      fileName: baseName
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) return;

          setState(prev => ({ ...prev, status: 'converting', message: 'Converting IFC to Fragments...' }));

          const components = componentsRef.current!;
          const fragments = fragmentsRef.current!;
          const loader = loaderRef.current!;

          // Ensure fragments manager is initialized
          if (!fragments.initialized) {
            fragments.init(getWorkerUrl());
          }

          // Determine wasm path (prefer local wasm, fallback to unpkg 0.0.77)
          loader.settings.autoSetWasm = false;
          let wasmPath = "https://unpkg.com/web-ifc@0.0.77/";
          try {
            const localBase = new URL('./', window.location.href).href;
            const testRes = await fetch(new URL('web-ifc.wasm', localBase).href, { method: 'HEAD' });
            if (testRes.ok) {
              wasmPath = localBase;
            }
          } catch {}

          loader.settings.wasm = {
            path: wasmPath,
            absolute: true
          };

          // Initialize webIfc with forceSingleThread=true to prevent crossOriginIsolated MT worker crashes
          try {
            loader.webIfc.SetWasmPath(loader.settings.wasm.path, loader.settings.wasm.absolute);
            await loader.webIfc.Init(undefined, true);
          } catch (initErr) {
            console.warn("Manual webIfc init warning:", initErr);
          }

          // 1. Load IFC and convert to fragments
          const model = await loader.load(new Uint8Array(buffer), true, file.name);
          
          // 2. Export Fragments to .frag
          let fragBuffer: ArrayBuffer | Uint8Array;
          if (typeof (model as any).getBuffer === 'function') {
            fragBuffer = await (model as any).getBuffer();
          } else if (typeof (fragments as any).export === 'function') {
            fragBuffer = (fragments as any).export(model);
          } else {
            throw new Error("No fragment export method found on model or manager.");
          }
          const fragBlob = new Blob([fragBuffer], { type: 'application/octet-stream' });

          // 3. Extract Properties to JSON
          setState(prev => ({ ...prev, message: 'Extracting properties...' }));
          
          let properties: any = (model as any).properties;
          if (!properties && typeof (model as any).getLocalIds === 'function' && typeof (model as any).getItemsData === 'function') {
            try {
              const localIds = await (model as any).getLocalIds();
              properties = await (model as any).getItemsData(localIds);
            } catch (err) {
              console.warn("Could not retrieve items data:", err);
            }
          }
          if (!properties && typeof (model as any).getAllProperties === 'function') {
            try { properties = await (model as any).getAllProperties(); } catch {}
          } else if (!properties && typeof (model as any).getLocalProperties === 'function') {
            try { properties = await (model as any).getLocalProperties(); } catch {}
          }
          if (!properties) {
            properties = {};
          }

          const jsonBlob = new Blob([JSON.stringify(properties, null, 2)], { type: 'application/json' });

          // 4. Conversión binaria de alta velocidad para transmisión nativa a C#
          const fragBytes = new Uint8Array(fragBuffer);
          let binaryStr = '';
          const chunkSize = 8192;
          for (let i = 0; i < fragBytes.length; i += chunkSize) {
            binaryStr += String.fromCharCode.apply(null, Array.from(fragBytes.subarray(i, i + chunkSize)));
          }
          const fragBase64 = btoa(binaryStr);
          const jsonBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(properties, null, 2))));

          // 5. Enviar directamente a C# por el canal nativo de WebView2
          if ((window as any).chrome && (window as any).chrome.webview) {
            (window as any).chrome.webview.postMessage({
              tipo: "CONVERSION_COMPLETA",
              nombreBase: baseName,
              fragBase64: fragBase64,
              jsonBase64: jsonBase64
            });
          }

          setState(prev => ({
            ...prev,
            status: 'success',
            message: 'Conversion complete!',
            fragBlob,
            jsonBlob
          }));

          // Clean up the model from memory to avoid leaks
          try {
            if (typeof (model as any).dispose === 'function') {
              await (model as any).dispose();
            } else if (typeof (fragments as any).disposeGroup === 'function') {
              (fragments as any).disposeGroup(model);
            }
          } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr);
          }
        } catch (error) {
          console.error("Conversion error:", error);
          setState({
            status: 'error',
            message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      };

      reader.onerror = () => {
        setState({
          status: 'error',
          message: 'Error reading file.'
        });
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error(error);
      setState({
        status: 'error',
        message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const downloadFile = (blob: Blob, ext: string) => {
    if (!state.fileName) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.fileName}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleIniciarDescarga = () => {
    if (state.fragBlob) downloadFile(state.fragBlob, '.frag');
    setTimeout(() => {
      if (state.jsonBlob) downloadFile(state.jsonBlob, '.json');
    }, 250);
  };

  return (
    <div className="min-h-screen bg-white text-[#141414] font-sans p-4 md:p-8 flex flex-col justify-center items-center">
      <div className="w-full max-w-2xl flex flex-col items-center">
        {/* Header con Logo de Nora BIM centrado y grande */}
        <header className="mb-8 md:mb-12 flex justify-center items-center">
          <img 
            src="https://i.postimg.cc/SsS0K3Yn/LOGO-NORA-NEGRO.png" 
            alt="Nora BIM" 
            className="h-20 sm:h-24 md:h-28 w-auto object-contain"
          />
        </header>

        {/* Main Interface: Un solo cuadro grande en la mitad */}
        <main className="w-full">
          <div className="w-full min-h-[360px] md:min-h-[400px] bg-[#141414] text-[#E4E3E0] border border-[#141414] p-8 flex flex-col items-center justify-center relative shadow-2xl">
            <AnimatePresence mode="wait">
              {state.status === 'success' ? (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full flex flex-col items-center justify-center"
                >
                  <button 
                    onClick={handleIniciarDescarga}
                    className="w-full max-w-sm border-2 border-white bg-transparent hover:bg-white hover:text-[#141414] text-white py-4 px-8 flex items-center justify-center font-bold tracking-widest text-base uppercase transition-all duration-300 shadow-xl cursor-pointer"
                  >
                    <span>INICIAR CARGA</span>
                  </button>
                </motion.div>
              ) : state.status === 'loading' || state.status === 'converting' ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-center py-8"
                >
                  <Loader2 className="w-10 h-10 animate-spin mb-4 text-white" />
                  <p className="text-sm font-mono uppercase tracking-wider text-white/80">{state.message}</p>
                </motion.div>
              ) : state.status === 'error' ? (
                <motion.div
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center text-center py-8 text-rose-400"
                >
                  <AlertCircle className="w-10 h-10 mb-4" />
                  <p className="text-sm font-mono max-w-md mb-6">{state.message}</p>
                  <button 
                    onClick={() => setState({ status: 'idle', message: 'Ready to convert your IFC file.' })}
                    className="border border-rose-400/60 hover:bg-rose-400 hover:text-[#141414] text-rose-400 px-6 py-2 text-xs font-mono uppercase transition-colors cursor-pointer"
                  >
                    Intentar de nuevo
                  </button>
                </motion.div>
              ) : (
                /* Estado idle: La hojita sola y en el centro */
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full min-h-[300px] flex items-center justify-center cursor-pointer group relative"
                >
                  <input 
                    type="file" 
                    accept=".ifc" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                    title="Seleccionar archivo IFC"
                  />
                  <FileUp className="w-10 h-10 text-white/40 group-hover:text-white group-hover:scale-110 transition-all duration-300 pointer-events-none" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}