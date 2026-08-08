import React, { useState, useEffect } from 'react';
import { FileText, Calendar, User, ChevronRight, Eye, Download, Filter, Search, ShieldCheck, Building2, MapPin, Map as MapIcon, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { subscribeToReports, deleteReport } from '../services/firebaseService';
import { useAuth } from '../context/AuthContext';
import { SiteReport } from '../types';
import { format } from 'date-fns';
import { generateSiteReportPDF } from '../utils/pdfGenerator';

interface SiteReportListProps {
  initialSelectedReportId?: string | null;
  onClearInitialSelection?: () => void;
  onOpenIssue?: (issueId: string) => void;
}

export default function SiteReportList({ initialSelectedReportId, onClearInitialSelection, onOpenIssue }: SiteReportListProps) {
  const { user } = useAuth();
  const isBimTeam = user?.team?.toUpperCase().includes('BIM') || 
                    user?.position?.toUpperCase().includes('BIM') ||
                    user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';

  const [reports, setReports] = useState<SiteReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<SiteReport | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const handleDeleteReport = async () => {
    if (!selectedReport) return;
    try {
      await deleteReport(selectedReport.id);
      setSelectedReport(null);
      setIsConfirmingDelete(false);
      if (onClearInitialSelection) onClearInitialSelection();
    } catch (err) {
      console.error("Error al eliminar informe de obra:", err);
    }
  };

  const handleDownloadPDF = async () => {
    if (!selectedReport) return;
    try {
      await generateSiteReportPDF(selectedReport);
    } catch (e) {
      console.error("Error generating PDF:", e);
    }
  };

  useEffect(() => {
    const unsub = subscribeToReports((data) => {
      setReports(data);
      setLoading(false);
      
      // If we have an initial ID, select it
      if (initialSelectedReportId && !selectedReport) {
        const report = data.find(r => r.id === initialSelectedReportId);
        if (report) {
          setSelectedReport(report);
        }
      }
    });
    return () => unsub();
  }, [initialSelectedReportId]);

  const handleCloseModal = () => {
    setSelectedReport(null);
    setIsConfirmingDelete(false);
    if (onClearInitialSelection) onClearInitialSelection();
  };

  const filteredReports = reports.filter(r => 
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.creatorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-[#020617]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 dark:bg-[#020617] h-screen overflow-hidden flex flex-col font-sans">
      <header className="p-8 lg:p-12 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/50 dark:bg-[#020617]/50 backdrop-blur-xl shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="space-y-3">
            <h1 className="text-4xl lg:text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight uppercase">
              Informes de Obra
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-3">
              <span className="w-8 h-px bg-slate-800" />
              Gestión y Bitácora de Registro CDE
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-white transition-colors" />
                <input 
                  type="text"
                  placeholder="BUSCAR INFORME..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-12 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white outline-none focus:border-indigo-500/50 focus:bg-slate-50 dark:focus:bg-slate-900 transition-all w-full sm:w-64"
                />
             </div>
             <div className="px-6 py-3.5 bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{filteredReports.length} ITEMS ENCONTRADOS</span>
             </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-8 lg:p-12 custom-scrollbar">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredReports.map((report) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="group p-6 bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800 rounded-[2rem] hover:bg-slate-50 dark:hover:bg-slate-900/50 hover:border-slate-350 dark:hover:border-slate-700 transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[260px] active:scale-[0.98]"
              >
                <div className="absolute top-0 right-0 p-6 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                  <ShieldCheck className="w-32 h-32 text-white" />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 bg-slate-100 dark:bg-white border border-slate-200 dark:border-white rounded-md shadow-lg shadow-slate-200/5 dark:shadow-white/5">
                          <span className="text-[9px] font-black text-[#020617] uppercase tracking-widest font-mono">
                            {report.code || 'REP-000'}
                          </span>
                        </div>
                        <div className={cn(
                          "px-2.5 py-1 rounded-md border text-[8px] font-black uppercase tracking-[0.2em] shadow-xl",
                          report.creatorTeam === 'ARQUITECTURA' ? "bg-amber-500/20 border-amber-500/40 text-amber-500 shadow-amber-500/10" : 
                          report.creatorTeam === 'COORDINACIÓN TÉCNICA' ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-500 shadow-cyan-500/10" :
                          "bg-slate-500/10 border-slate-500/20 text-slate-500"
                        )}>
                          {report.creatorTeam || 'EQUIPO TÉCNICO'}
                        </div>
                      </div>
                    <div className="flex items-center gap-1.5 text-slate-600 group-hover:text-white transition-colors">
                      <Calendar className="w-3 h-3" />
                      <span className="text-[8px] font-black uppercase tracking-widest leading-none">
                        {format(new Date(report.createdAt), 'dd MMM, yyyy')}
                        <span className="block mt-1 text-slate-500 font-mono">{format(new Date(report.createdAt), 'HH:mm')}</span>
                      </span>
                    </div>
                  </div>

                  <h3 className="text-lg font-display font-black text-slate-800 dark:text-white uppercase tracking-tight leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors mb-3 line-clamp-2">
                    {report.title}
                  </h3>

                  <div className="flex flex-wrap gap-2 mb-6">
                     <span className="px-2 py-0.5 bg-slate-150 dark:bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-8000 dark:border-slate-800 rounded text-[7px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                       <FileText className="w-2.5 h-2.5" /> {report.blocks?.length || 0} BLOQUES TÉCNICOS
                     </span>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-200 dark:border-slate-800/50 flex items-center justify-between">
                   <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500">
                        <User className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[6px] font-black text-slate-600 uppercase tracking-widest">Responsable</span>
                        <span className="text-[8px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest">{report.creatorName}</span>
                      </div>
                   </div>
                   <div className="p-2 bg-slate-100 dark:bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-8000 dark:border-slate-800 rounded-lg group-hover:bg-slate-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-[#020617] transition-all">
                     <ChevronRight className="w-3 h-3" />
                   </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredReports.length === 0 && (
          <div className="max-w-xl mx-auto mt-20 p-12 bg-slate-100 dark:bg-slate-900/20 border border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] text-center">
            <FileText className="w-12 h-12 text-slate-800 mx-auto mb-6" />
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-[0.4em] leading-relaxed">
              No se han encontrado registros<br />en la bitácora técnica
            </h3>
          </div>
        )}
      </div>

      {/* Report View Modal */}
      <AnimatePresence>
        {selectedReport && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 lg:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseModal}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl h-full bg-slate-50 dark:bg-[#020617] rounded-[3rem] border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-5 lg:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-slate-50 dark:bg-white/80 dark:bg-[#020617]/80 backdrop-blur-xl z-20 shadow-2xl">
                <div className="space-y-1">
                  <div className="flex items-center gap-4">
                    <span className="px-3 py-1.5 bg-white text-[#020617] text-[11px] font-black rounded-xl font-mono shadow-2xl shadow-indigo-500/20">{selectedReport.code}</span>
                    <div className={cn(
                      "px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl",
                      selectedReport.creatorTeam === 'ARQUITECTURA' ? "bg-amber-500/20 border-amber-500/40 text-amber-500 shadow-amber-500/10" : 
                      selectedReport.creatorTeam === 'COORDINACIÓN TÉCNICA' ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-500 shadow-cyan-500/10" :
                      "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                    )}>
                      {selectedReport.creatorTeam ? `INFORME DE ${selectedReport.creatorTeam}` : 'INFORME TÉCNICO DE OBRA'}
                    </div>
                  </div>
                  <h2 className="text-2xl font-display font-black text-slate-800 dark:text-white uppercase tracking-tight">{selectedReport.title}</h2>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-3 bg-slate-900 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-white transition-all border border-slate-200 dark:border-slate-800 active:scale-95 shadow-xl"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8 lg:p-12 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-10">
                  <div className="grid grid-cols-2 gap-8 pb-10 border-b border-slate-200 dark:border-slate-800/50">
                     <div className="space-y-2">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">Emitido por</p>
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 text-lg font-black">
                             {selectedReport.creatorName.charAt(0)}
                           </div>
                           <div className="flex flex-col">
                             <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{selectedReport.creatorName}</p>
                             <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                               {selectedReport.creatorPosition} 
                               {selectedReport.creatorTeam ? ` | EQUIPO ${selectedReport.creatorTeam}` : ''}
                             </p>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-2 text-right flex flex-col items-end">
                        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">Cronología de Registro</p>
                        <div className="flex items-center gap-3">
                           <div className="text-right">
                              <p className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">{format(new Date(selectedReport.createdAt), 'dd MMMM, yyyy')}</p>
                              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">{format(new Date(selectedReport.createdAt), 'HH:mm:ss')}</p>
                           </div>
                           <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-600">
                             <Calendar className="w-5 h-5" />
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-10">
                    {selectedReport.blocks.map((block, idx) => (
                      <div key={block.id} className="space-y-6 group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-slate-200 dark:bg-white rounded-xl border border-slate-300 dark:border-white flex items-center justify-center text-[#020617] dark:text-[#020617] font-display font-black shadow-xl shadow-white/5">
                             {String(idx + 1).padStart(2, '0')}
                           </div>
                           <div className="h-px flex-1 bg-slate-800 group-hover:bg-indigo-500/30 transition-colors" />
                        </div>
                        
                        <div className="p-8 bg-white dark:bg-slate-900/20 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 group-hover:border-slate-350 dark:hover:border-slate-700 transition-all space-y-6 shadow-sm">
                           <p className="text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed font-semibold italic text-wrap break-words">
                             "{block.description}"
                           </p>

                           <div className="grid grid-cols-3 gap-8 pt-6 border-t border-slate-200 dark:border-slate-800/50">
                             <div className="space-y-2">
                               <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><Building2 className="w-3 h-3" /> Unidad</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {block.location.units.map(u => <span key={u} className="px-2 py-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-8000 dark:border-slate-800 text-[8px] font-black text-slate-800 dark:text-white rounded-lg uppercase shadow-sm">{u}</span>)}
                               </div>
                             </div>
                             <div className="space-y-2">
                               <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><MapPin className="w-3 h-3" /> Nivel</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {block.location.levels.map(l => <span key={l} className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-[8px] font-black text-indigo-400 rounded-lg uppercase shadow-sm">{l}</span>)}
                               </div>
                             </div>
                             <div className="space-y-2">
                               <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2"><MapIcon className="w-3 h-3" /> Espacio</p>
                               <div className="flex flex-wrap gap-1.5">
                                 {block.location.spaces.map(s => <span key={s} className="px-2 py-1 bg-blue-500/10 border border-blue-500/20 text-[8px] font-black text-blue-400 rounded-lg uppercase shadow-sm">{s}</span>)}
                               </div>
                             </div>
                           </div>

                           {block.attachments && block.attachments.length > 0 && (
                             <div className="pt-6 border-t border-slate-200 dark:border-slate-800/50 space-y-4">
                               <p className="text-[7px] font-black text-slate-600 uppercase tracking-widest mb-3">Evidencia Técnica Adjunta</p>
                               
                               {/* Image Previews */}
                               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                 {block.attachments.filter(a => a.type.startsWith('image/')).map(att => (
                                   <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="aspect-video rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-indigo-500 transition-all group/img relative shadow-xl">
                                      <img src={att.url} alt={att.name} referrerPolicy="no-referrer" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                                        <Eye className="w-5 h-5 text-white" />
                                      </div>
                                   </a>
                                 ))}
                               </div>

                               <div className="flex flex-wrap gap-3">
                                 {block.attachments.map(att => (
                                   <a key={att.id} href={att.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-8000 dark:border-slate-800 rounded-xl hover:border-slate-600 transition-all group/att">
                                      <FileText className="w-3.5 h-3.5 text-slate-600 group-hover/att:text-white" />
                                      <span className="text-[9px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tight">{att.name}</span>
                                   </a>
                                 ))}
                               </div>
                             </div>
                           )}

                           {block.issueId && (
                             <button 
                               onClick={() => onOpenIssue && onOpenIssue(block.issueId!)}
                               className="w-full mt-4 p-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl flex items-center justify-between shadow-xl shadow-emerald-500/10 border border-emerald-400/20 transition-all active:scale-[0.98] group/banner"
                             >
                               <div className="flex items-center gap-4">
                                 <div className="w-10 h-10 bg-slate-50 dark:bg-[#020617]/20 rounded-xl flex items-center justify-center text-white group-hover/banner:scale-110 transition-transform">
                                   <ShieldCheck className="w-5 h-5 shadow-inner" />
                                 </div>
                                 <div className="text-left">
                                   <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none">REGISTRO VINCULADO AL HALLAZGO</p>
                                   <p className="text-[8px] text-emerald-100 font-bold uppercase mt-1.5 opacity-80">ESTADO: ACTIVO / SINCRONIZADO</p>
                                 </div>
                               </div>
                               <ChevronRight className="w-4 h-4 text-white/50 group-hover/banner:translate-x-1 transition-transform" />
                             </button>
                           )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                     <div className="p-6 lg:p-8 border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 flex flex-wrap justify-end items-center gap-4">
                 {(isBimTeam || user?.role === 'admin') && (
                   <div className="flex items-center gap-2">
                     {isConfirmingDelete ? (
                       <>
                         <button 
                           onClick={() => setIsConfirmingDelete(false)}
                           className="px-4 py-3 bg-slate-300 dark:bg-slate-800 text-slate-800 dark:text-slate-300 hover:bg-slate-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95"
                         >
                           Cancelar
                         </button>
                         <button 
                           onClick={handleDeleteReport}
                           className="px-5 py-3 bg-red-700 hover:bg-red-800 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl shadow-red-600/30 active:scale-95 transition-all flex items-center gap-2 animate-pulse"
                         >
                           <Trash2 className="w-3.5 h-3.5" /> CONFIRMAR ELIMINAR
                         </button>
                       </>
                     ) : (
                       <button 
                         onClick={() => setIsConfirmingDelete(true)}
                         className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-xl shadow-red-600/20 active:scale-95 transition-all flex items-center gap-2"
                       >
                         <Trash2 className="w-3.5 h-3.5" /> Eliminar Informe (BIM)
                       </button>
                     )}
                   </div>
                 )}
                 <button 
                  onClick={handleCloseModal}
                  className="px-8 py-3 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors"
                 >
                   Cerrar Vista
                 </button>
                 <button 
                  onClick={handleDownloadPDF}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.2em] shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2"
                 >
                   <Download className="w-3.5 h-3.5" /> Descargar PDF (V.2)
                 </button>
              </div>          </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
