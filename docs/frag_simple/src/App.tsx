import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import workerUrl from '@thatopen/fragments/worker?url';
import { 
  FileUp, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Box, 
  Database,
  FileJson,
  Terminal
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

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="mb-12 border-b border-[#141414] pb-6">
          <div className="flex items-center gap-3 mb-2">
            <Box className="w-8 h-8" />
            <h1 className="text-3xl font-bold tracking-tight uppercase">IFC to FRAG</h1>
          </div>
          <p className="font-serif italic text-sm opacity-60">
            High-performance BIM conversion utility for web visualization.
          </p>
        </header>

        {/* Main Interface */}
        <main className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <section className="space-y-6">
            <div className="border border-[#141414] p-8 bg-white/50 relative overflow-hidden group">
              <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 border border-dashed border-[#141414] flex items-center justify-center group-hover:bg-[#141414] group-hover:text-[#E4E3E0] transition-colors duration-300">
                  <FileUp className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-lg font-bold uppercase">Upload IFC</h2>
                  <p className="text-xs opacity-50 font-mono">Drag & drop or click to select</p>
                </div>
                <input 
                  type="file" 
                  accept=".ifc" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={state.status === 'loading' || state.status === 'converting'}
                />
              </div>
              {/* Decorative grid lines */}
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5">
                <div className="w-full h-full grid grid-cols-4 grid-rows-4">
                  {[...Array(16)].map((_, i) => (
                    <div key={i} className="border border-[#141414]" />
                  ))}
                </div>
              </div>
            </div>

            {/* Status Panel */}
            <div className="border border-[#141414] p-6 bg-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono uppercase opacity-50 tracking-widest">System Status</span>
                <Terminal className="w-3 h-3 opacity-30" />
              </div>
              
              <div className="flex items-start gap-3">
                {state.status === 'loading' || state.status === 'converting' ? (
                  <Loader2 className="w-5 h-5 animate-spin mt-0.5" />
                ) : state.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
                ) : state.status === 'error' ? (
                  <AlertCircle className="w-5 h-5 text-rose-600 mt-0.5" />
                ) : (
                  <div className="w-5 h-5 border border-[#141414] mt-0.5" />
                )}
                
                <div className="space-y-1">
                  <p className="text-sm font-medium">{state.message}</p>
                  {state.fileName && (
                    <p className="text-[10px] font-mono opacity-50">FILE: {state.fileName}.ifc</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Output Section */}
          <section className="space-y-6">
            <div className="border border-[#141414] p-6 bg-[#141414] text-[#E4E3E0] h-full flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <span className="text-[10px] font-mono uppercase tracking-widest">Output Assets</span>
                <Database className="w-4 h-4" />
              </div>

              <AnimatePresence mode="wait">
                {state.status === 'success' ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 flex-grow"
                  >
                    {/* Frag Download Manual de Respaldo */}
                    <button 
                      onClick={() => downloadFile(state.fragBlob!, '.frag')}
                      className="w-full border border-[#E4E3E0] p-4 flex items-center justify-between hover:bg-[#E4E3E0] hover:text-[#141414] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Box className="w-5 h-5" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">Geometry Data</p>
                          <p className="text-[10px] opacity-60 font-mono">.FRAG (Optimized Mesh)</p>
                        </div>
                      </div>
                      <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    </button>

                    {/* JSON Download Manual de Respaldo */}
                    <button 
                      onClick={() => downloadFile(state.jsonBlob!, '.json')}
                      className="w-full border border-[#E4E3E0] p-4 flex items-center justify-between hover:bg-[#E4E3E0] hover:text-[#141414] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <FileJson className="w-5 h-5" />
                        <div className="text-left">
                          <p className="text-xs font-bold uppercase">Properties Data</p>
                          <p className="text-[10px] opacity-60 font-mono">.JSON (BIM Metadata)</p>
                        </div>
                      </div>
                      <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
                    </button>

                    <div className="mt-8 pt-6 border-t border-[#E4E3E0]/20">
                      <p className="text-[10px] font-mono opacity-40 leading-relaxed">
                        Assets are ready for integration. Use the .frag file for 3D rendering and the .json file for property management in your BIM viewer.
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex-grow flex flex-col items-center justify-center text-center opacity-20 py-12">
                    <Database className="w-12 h-12 mb-4" />
                    <p className="text-xs font-mono uppercase">Waiting for input...</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </main>

        {/* Footer Info */}
        <footer className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 text-[10px] font-mono opacity-40 border-t border-[#141414] pt-8">
          <div>
            <p className="font-bold uppercase mb-2">Technology</p>
            <p>Powered by That Open Engine & Web-IFC. Optimized for high-performance web-based BIM visualization.</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-2">Format Details</p>
            <p>.FRAG is a binary format that stores geometry as fragments, allowing for massive model loading with minimal memory footprint.</p>
          </div>
          <div>
            <p className="font-bold uppercase mb-2">Data Extraction</p>
            <p>Properties are extracted directly from the IFC schema and mapped to a JSON structure compatible with standard BIM viewers.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}