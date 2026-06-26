import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Trash2, Plus, Edit2, Save } from 'lucide-react';

export interface Apartment {
  id: string;
  number: string;
  status: string;
}

export interface Tower {
  id: number;
  name: string;
  apartments: Apartment[];
}

interface Props {
  isOpen: boolean;
  tower: Tower | null;
  onClose: () => void;
  onSave: (updatedTower: Tower) => void;
}

export const TowerEditorModal: React.FC<Props> = ({ isOpen, tower, onClose, onSave }) => {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [newAptNumber, setNewAptNumber] = useState('');
  
  React.useEffect(() => {
    if (tower) {
      setApartments([...tower.apartments]);
    }
  }, [tower]);

  if (!isOpen || !tower) return null;

  const handleDelete = (id: string) => {
    setApartments(prev => prev.filter(a => a.id !== id));
  };

  const handleAdd = () => {
    if (!newAptNumber.trim()) return;
    
    const newApt: Apartment = {
      id: `t${tower.id}-custom-${Date.now()}`,
      number: newAptNumber.trim(),
      status: 'in_process'
    };
    
    setApartments([...apartments, newApt]);
    setNewAptNumber('');
  };

  const handleSave = () => {
    onSave({ ...tower, apartments });
  };

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
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 flex flex-col max-h-[85vh]"
      >
        <div className="p-6 border-b border-gray-100 flex items-center gap-4 bg-gray-50">
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
            <Edit2 className="text-blue-600" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-gray-900 font-black text-xl tracking-tight uppercase">Editar Unidades</h3>
            <p className="text-blue-600 text-xs font-bold tracking-widest uppercase">{tower.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex gap-2">
            <input
              type="text"
              value={newAptNumber}
              onChange={e => setNewAptNumber(e.target.value)}
              placeholder="Ej. APTO 101, LOCAL 1..."
              className="flex-1 h-11 px-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <button
              onClick={handleAdd}
              className="h-11 px-6 bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus size={16} /> Añadir
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Unidades Actuales ({apartments.length})</h4>
              {apartments.length > 0 && (
                <button
                  onClick={() => {
                    if(window.confirm('¿Estás seguro de que deseas eliminar todas las unidades de esta torre?')) {
                      setApartments([]);
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] font-bold text-red-500 uppercase tracking-wider hover:text-red-700 transition-colors"
                >
                  <Trash2 size={12} /> Eliminar Todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <AnimatePresence>
                {apartments.map(apt => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white group hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <span className="text-sm font-bold text-gray-700">{apt.number}</span>
                    <button
                      onClick={() => handleDelete(apt.id)}
                      className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1"
                      title="Eliminar unidad"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {apartments.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm font-medium">
                No hay unidades en esta torre.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-4">
          <button onClick={onClose} className="flex-1 h-12 bg-white border border-gray-300 text-gray-700 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} className="flex-[2] h-12 bg-green-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
            <Save size={16} /> Guardar Unidades
          </button>
        </div>
      </motion.div>
    </div>
  );
};
