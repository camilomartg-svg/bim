import React, { useEffect, useState } from 'react';
import { addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Issue, IssueStatus, DEGREE_OF_ACTION } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Filter, MoreVertical, Paperclip, MessageSquare, Clock, AlertCircle, ClipboardList, Zap, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { subscribeToIssues } from '../services/firebaseService';

interface IssueListProps {
  onSelectIssue: (issue: Issue) => void;
  view?: 'active' | 'anuladas';
  onOpenReport?: (reportId: string) => void;
}

export default function IssueList({ onSelectIssue, view = 'active', onOpenReport }: IssueListProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<IssueStatus | 'all'>('all');
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToIssues((issuesData) => {
      setIssues(issuesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      issue.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (issue.code && issue.code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const isAnulada = issue.status === 'ANULADA';
    
    if (view === 'anuladas') {
      if (!isAnulada) return false;
      if (issue.creatorId !== user?.id && user?.role !== 'admin' && !user?.position?.toUpperCase().includes('BIM')) return false;
    } else {
      if (isAnulada) return false;
    }

    const matchesStatus = filterStatus === 'all' || issue.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: IssueStatus) => {
    switch (status) {
      case 'ACTIVO': return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
      case 'RESPONDIDA': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'RESUELTA': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'VENCIDA': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'RECHAZADA': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'ACUERDO': return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
      case 'ANULADA': return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      default: return 'bg-slate-50 text-slate-400 border-slate-200';
    }
  };

  return (
    <div className={cn(
      "w-72 lg:w-80 flex flex-col h-full bg-white dark:bg-black border-r border-slate-200 dark:border-[#111111] transition-all duration-300",
      view === 'anuladas' && "border-r-red-900/10"
    )}>
      {/* Header */}
      <div className="p-5 border-b border-slate-100 dark:border-[#111111]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">{view === 'anuladas' ? 'Archivo Histórico' : 'Banco de Incidencias'}</h2>
          <div className={cn(
            "text-[7.5px] px-2 py-1 rounded-lg border font-black uppercase tracking-[0.1em] leading-tight shadow-sm transition-all duration-300",
            view === 'anuladas' ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-slate-900 dark:bg-white text-white dark:text-black border-slate-900 dark:border-white shadow-xl dark:shadow-white/5"
          )}>
            {view === 'anuladas' ? 'ANULADAS' : 'EN VIVO'}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 dark:text-slate-700 group-focus-within:text-slate-900 dark:group-focus-within:text-white transition-colors" />
            <input
              type="text"
              placeholder="Hallazgo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1a1a1a] rounded-lg text-[10px] text-slate-900 dark:text-white font-semibold placeholder:text-slate-300 dark:placeholder:text-slate-800 outline-none focus:border-slate-400 dark:focus:border-slate-700 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            />
          </div>
          <div className="flex items-center gap-2.5 bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-[#1a1a1a] rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-[#111111] transition-all relative shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
            <Filter className="w-3 h-3 text-slate-400 dark:text-slate-700" />
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="bg-transparent border-none outline-none text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 dark:text-slate-600 cursor-pointer w-full"
            >
              <option value="all" className="bg-white text-slate-900">TODOS LOS ESTADOS</option>
              {['ACTIVO', 'ACUERDO', 'ANULADA', 'RECHAZADA', 'RESPONDIDA', 'RESUELTA', 'VENCIDA'].map(s => (
                <option key={s} value={s} className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white">{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* List content */}
      <div className="flex-1 overflow-auto custom-scrollbar px-4 pt-4">
        {loading ? (
          <div className="p-8 flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-900 dark:border-white transition-colors duration-200"></div>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="w-8 h-8 mx-auto mb-3 text-slate-200 dark:text-slate-900 transition-colors duration-200" />
            <p className="text-[8px] uppercase font-black tracking-[0.15em] text-slate-400 dark:text-slate-800">Sin correspondencias</p>
          </div>        ) : (
          <div className="space-y-2.5 pb-10">
            {filteredIssues.map((issue) => {
              const isEnvironmental = issue.specialty === 'AMBIENTAL' || 
                                      issue.type === 'Informe Ambiental' ||
                                      issue.type === 'No Conformidad Ambiental' ||
                                      (issue.type && issue.type.toLowerCase().includes('ambiental')) ||
                                      issue.reportType === 'ENVIRONMENTAL';
              return (
                <motion.div
                  key={issue.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => onSelectIssue(issue)}
                  className={cn(
                    "p-4 rounded-xl border transition-all cursor-pointer group hover:bg-slate-50 dark:hover:bg-[#0a0a0a] hover:scale-[1.005] bg-white dark:bg-[#050505] border-slate-200 dark:border-[#1a1a1a] hover:border-slate-300 dark:hover:border-slate-700 transition-colors duration-200 shadow-sm hover:shadow-md",
                    isEnvironmental && "border-emerald-500/30 bg-emerald-500/[0.02] dark:bg-emerald-950/[0.05] hover:border-emerald-500/50 shadow-emerald-500/[0.01]"
                  )}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "px-2 py-0.5 rounded-md transition-all",
                        isEnvironmental ? "bg-emerald-600 text-white" : "bg-slate-900 dark:bg-white"
                      )}>
                        <span className="text-[7.5px] font-black tracking-widest text-white dark:text-black font-mono uppercase">
                          {issue.code || `#${issue.id.slice(0, 4).toUpperCase()}`}
                        </span>
                      </div>
                  {issue.fromReport && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReport && issue.sourceReportId && onOpenReport(issue.sourceReportId);
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 shadow-xl border active:scale-95 group/report",
                          isEnvironmental
                            ? "bg-emerald-600 hover:bg-emerald-500 border-emerald-400/50 shadow-emerald-500/30"
                            : issue.reportType === 'QUALITY' 
                              ? "bg-red-600 hover:bg-red-500 shadow-red-500/30 border-red-400/50" 
                              : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/40 border-indigo-400/50"
                        )}
                        title={issue.reportType === 'QUALITY' ? "Ir al Informe de Calidad (BIM)" : isEnvironmental ? "Ir al Informe Ambiental" : "Ir al Informe"}
                      >
                        <FileText className="w-3 h-3 text-white" />
                        <span className="text-[7.5px] font-black tracking-widest text-white uppercase leading-none">
                          {isEnvironmental ? 'INF. AMBIENTAL' : issue.reportType === 'QUALITY' ? 'INF. CALIDAD (BIM)' : 'VIENE DE INFORME'}
                        </span>
                      </button>
                      {issue.creatorTeam && !isEnvironmental && (
                      <div className={cn(
                        "px-2.5 py-1 rounded-md border text-[7.5px] font-black uppercase tracking-widest shadow-xl",
                        issue.creatorTeam === 'ARQUITECTURA' ? "bg-amber-500/20 border-amber-500/40 text-amber-500" : 
                        issue.creatorTeam === 'COORDINACIÓN TÉCNICA' ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-500" :
                        "bg-slate-500/10 border-slate-500/20 text-slate-500 shadow-slate-500/5"
                      )}>
                        {issue.creatorTeam}
                      </div>
                      )}
                    </div>
                  )}
                    </div>
                    <div className={cn("text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border shadow-sm transition-all duration-300", 
                      issue.status === 'ACTIVO' ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-600" :
                      issue.status === 'RESPONDIDA' ? "border-amber-500/20 bg-amber-500/10 text-amber-600" :
                      issue.status === 'RESUELTA' ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600" :
                      issue.status === 'VENCIDA' ? "border-rose-500/20 bg-rose-500/10 text-rose-600" :
                      issue.status === 'RECHAZADA' ? "border-red-500/20 bg-red-500/10 text-red-600" :
                      issue.status === 'ACUERDO' ? "border-violet-500/20 bg-violet-500/10 text-violet-600" :
                      issue.status === 'ANULADA' ? "border-slate-500/20 bg-slate-500/10 text-slate-400" :
                      "border-slate-200 dark:border-[#1a1a1a] bg-slate-100 dark:bg-[#050505] text-slate-400"
                    )}>
                    {issue.status.replace('_', ' ')}
                  </div>
                </div>
                
                <h3 className="text-xs font-display font-black text-slate-900 dark:text-white leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors mb-4 uppercase tracking-tight">
                  {issue.title}
                </h3>
                
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#111111]">
                  <div className="flex items-center gap-2">
                     <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-[#111111] border border-slate-200 dark:border-[#1a1a1a] flex items-center justify-center text-[8px] font-black text-slate-500">
                       {issue.creatorName.charAt(0)}
                     </div>
                     <div className="flex flex-col">
                       <span className="text-[7.5px] font-black text-slate-600 dark:text-slate-500 uppercase tracking-widest leading-none">{issue.creatorName}</span>
                       <span className="text-[6.5px] font-bold text-slate-400 dark:text-slate-700 uppercase tracking-widest mt-1">CREADO: {format(new Date(issue.createdAt), 'dd/MM HH:mm')}</span>
                     </div>
                  </div>
                  <div className="flex -space-x-1">
                    {issue.reviewers?.slice(0, 3).map((rev, i) => (
                      <div key={i} className="w-4.5 h-4.5 rounded-md bg-slate-100 dark:bg-slate-800 border-[1.5px] border-white dark:border-black flex items-center justify-center text-[6.5px] font-black text-slate-400 dark:text-slate-600 shadow-sm" title={rev}>
                        {rev.charAt(0)}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )})}
          </div>
        )}
      </div>
    </div>
  );
}
