import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, X, Zap, Eye } from 'lucide-react';

export interface MassGenerationConfig {
  mode: 'single' | 'multi';
  single: {
    startNum: number;
    amount: number;
    floorName: string;
    floorNumber: number;
  };
  multi: {
    floorPrefix: string;
    startFloor: number;
    endFloor: number;
    startNum: number;
    spacesPerFloor: number;
  };
}

interface Props {
  isOpen: boolean;
  towerName: string;
  onClose: () => void;
  onGenerate: (config: MassGenerationConfig) => void;
}

export const MassGenerationModal: React.FC<Props> = ({ isOpen, towerName, onClose, onGenerate }) => {
  const [mode, setMode] = useState<'single' | 'multi'>('single');
  
  // Single mode state
  const [sStartNum, setSStartNum] = useState('1');
  const [sAmount, setSAmount] = useState('10');
  const [sFloorName, setSFloorName] = useState('PISO 1');
  
  // Multi mode state
  const [mFloorPrefix, setMFloorPrefix] = useState('PISO');
  const [mStartFloor, setMStartFloor] = useState('1');
  const [mEndFloor, setMEndFloor] = useState('10');
  const [mStartNum, setMStartNum] = useState('1');
  const [mSpacesPerFloor, setMSpacesPerFloor] = useState('10');

  if (!isOpen) return null;

  const handleGenerate = () => {
    onGenerate({
      mode,
      single: {
        startNum: parseInt(sStartNum) || 1,
        amount: parseInt(sAmount) || 1,
        floorName: sFloorName,
        floorNumber: parseInt(sFloorName.replace(/[^0-9]/g, '')) || 1
      },
      multi: {
        floorPrefix: mFloorPrefix,
        startFloor: parseInt(mStartFloor) || 1,
        endFloor: parseInt(mEndFloor) || 1,
        startNum: parseInt(mStartNum) || 1,
        spacesPerFloor: parseInt(mSpacesPerFloor) || 1,
      }
    });
  };

  const previewSingle = `${(parseInt(sFloorName.replace(/[^0-9]/g, '')) || 1)}${parseInt(sStartNum) < 10 ? '0' + parseInt(sStartNum) : parseInt(sStartNum)}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-[#111625] rounded-[24px] shadow-2xl w-full max-w-md overflow-hidden border border-white/5"
      >
        <div className="p-6 border-b border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <Copy className="text-white" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-black text-xl tracking-tight uppercase">Generación Masiva</h3>
            <p className="text-indigo-400 text-xs font-bold tracking-widest uppercase">Unidad: {towerName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex bg-[#0b0e17] rounded-xl p-1">
            <button
              onClick={() => setMode('single')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'single' ? 'bg-[#1e253c] text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Nivel Único
            </button>
            <button
              onClick={() => setMode('multi')}
              className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${mode === 'multi' ? 'bg-[#1e253c] text-white shadow-lg' : 'text-white/40 hover:text-white/60'}`}
            >
              Modo Torre (Varios Pisos)
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === 'single' ? (
              <motion.div key="single" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Inicio Num (Relativo)</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 font-black">#</div>
                      <input type="number" value={sStartNum} onChange={e => setSStartNum(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Cantidad de Espacios</label>
                    <input type="number" value={sAmount} onChange={e => setSAmount(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Nivel Destino</label>
                    <select value={sFloorName} onChange={e => setSFloorName(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500 appearance-none">
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={`PISO ${n}`}>PISO {n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="bg-[#1e253c] border border-white/5 rounded-xl p-4 mt-2">
                  <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <Eye size={12} /> Vista previa primer item:
                  </div>
                  <div className="text-white font-black">{previewSingle}</div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="multi" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Prefijo Nivel</label>
                    <input type="text" value={mFloorPrefix} onChange={e => setMFloorPrefix(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Inicio Piso</label>
                    <input type="number" value={mStartFloor} onChange={e => setMStartFloor(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                  <div className="col-span-1">
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Fin Piso</label>
                    <input type="number" value={mEndFloor} onChange={e => setMEndFloor(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">

                  <div>
                    <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Inicio Num (Relativo)</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 font-black">#</div>
                      <input type="number" value={mStartNum} onChange={e => setMStartNum(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 pl-10 pr-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase tracking-widest mb-2">Espacios por Nivel</label>
                  <input type="number" value={mSpacesPerFloor} onChange={e => setMSpacesPerFloor(e.target.value)} className="w-full bg-[#0b0e17] border border-white/5 rounded-xl h-12 px-4 text-sm font-bold text-white focus:outline-none focus:border-indigo-500" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-4 pt-4 mt-4 border-t border-white/5">
            <button onClick={onClose} className="flex-1 h-12 bg-[#1e253c] text-white/70 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[#252d47] transition-colors">
              Cancelar
            </button>
            <button onClick={handleGenerate} className="flex-[2] h-12 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-indigo-500 transition-colors shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center gap-2">
              <Zap size={16} /> Generar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
