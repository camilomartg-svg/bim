import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { Issue } from '../types';
import { 
  FileText, 
  Download, 
  PieChart, 
  BarChart3, 
  Database, 
  Filter, 
  ChevronDown, 
  Check, 
  Leaf, 
  Award, 
  Recycle, 
  AlertTriangle, 
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart as RePieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function ReportGenerator() {
  const [metricTab, setMetricTab] = useState<'OBRA' | 'AMBIENTAL'>('OBRA');
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [selectedFields, setSelectedFields] = useState<string[]>(['code', 'title', 'status', 'degreeOfAction', 'specialty', 'creatorName']);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qIssues = query(collection(db, 'issues'));
        const snapshotIssues = await getDocs(qIssues);
        setIssues(snapshotIssues.docs.map(doc => ({ id: doc.id, ...doc.data() } as Issue)));

        const qReports = query(collection(db, 'reports'));
        const snapshotReports = await getDocs(qReports);
        setReports(snapshotReports.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
      } catch (err) {
        console.error("Error fetching metrics data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // General Issue Stats
  const statsByStatus = issues.reduce((acc: any, issue) => {
    acc[issue.status] = (acc[issue.status] || 0) + 1;
    return acc;
  }, {});

  const chartData = [
    { name: 'Abiertas', value: statsByStatus.open || statsByStatus.ACTIVO || 0, color: '#3B82F6' },
    { name: 'En Progreso', value: statsByStatus.in_progress || statsByStatus.RESPONDIDA || 0, color: '#F59E0B' },
    { name: 'Resueltas', value: statsByStatus.resolved || statsByStatus.RESUELTA || 0, color: '#10B981' },
    { name: 'Cerradas', value: statsByStatus.closed || statsByStatus.ANULADA || 0, color: '#64748B' },
  ];

  // COMPUTE ENVIRONMENTAL COMPLIANCE METRICS
  const getEnvironmentalMetrics = () => {
    const inspections = reports.filter(r => r.reportType === 'ENVIRONMENTAL' && r.subtype === 'INSPECCION');
    const aprovechamientos = reports.filter(r => r.reportType === 'ENVIRONMENTAL' && r.subtype === 'APROVECHAMIENTO');

    // 11 Categories
    const categoriesList = [
      "1. INSTALACIONES LOCATIVAS",
      "2. ALMACENAMIENTO DE SUSTANCIAS QUÍMICAS",
      "3. CASINO",
      "4. MAQUINARIA Y EQUIPO",
      "5. RECURSO FAUNA Y FLORA",
      "6. RECURSO HÍDRICO",
      "7. RECURSO AIRE",
      "8. RECURSO SUELO",
      "9. RECURSO ENERGÍA",
      "10. MANEJO DE RCD",
      "11. ORDEN Y ASEO"
    ];

    const categoryStats: Record<string, { sum: number; count: number }> = {};
    categoriesList.forEach(cat => {
      categoryStats[cat] = { sum: 0, count: 0 };
    });

    let totalGlobalInspectionsScore = 0;
    let totalInspectionsCount = 0;

    inspections.forEach(ins => {
      if (ins.sections) {
        let insSum = 0;
        let insCount = 0;

        ins.sections.forEach((sec: any) => {
          // Normalize and match category title to lists
          const matchedKey = categoriesList.find(c => sec.title?.toUpperCase().includes(c.toUpperCase()) || c.toUpperCase().includes(sec.title?.toUpperCase()));
          if (matchedKey) {
            const pct = Number(sec.compliancePercentage) || 0;
            categoryStats[matchedKey].sum += pct;
            categoryStats[matchedKey].count += 1;
            
            insSum += pct;
            insCount += 1;
          }
        });

        if (insCount > 0) {
          totalGlobalInspectionsScore += (insSum / insCount);
          totalInspectionsCount += 1;
        }
      }
    });

    const categoriesChartDetails = categoriesList.map((cat, idx) => {
      const stats = categoryStats[cat];
      const avg = stats.count > 0 ? Math.round(stats.sum / stats.count) : 0;
      return {
        id: idx + 1,
        shortName: cat.slice(3).trim(),
        name: cat,
        Cumplimiento: avg,
        color: avg >= 85 ? '#10B981' : avg >= 60 ? '#F59E0B' : '#EF4444'
      };
    });

    const averageCompliancePercentage = totalInspectionsCount > 0 ? Math.round(totalGlobalInspectionsScore / totalInspectionsCount) : 0;

    // Waste utilization metrics
    let totalAprovechadoKg = 0;
    let totalGeneradoKg = 0;

    const convertToKg = (q: number, u: 'KG' | 'TON' | 'M3', m: string): number => {
      if (u === 'KG') return q;
      if (u === 'TON') return q * 1000;
      const densities: Record<string, number> = {
        PETREOS: 1400,
        MADERA: 500,
        PLASTICO: 120,
        CHATARRA: 750,
        CARTON: 150,
        PVC: 200,
        RESPEL: 800,
        ORDINARIOS: 300
      };
      return q * (densities[m] || 500);
    };

    aprovechamientos.forEach(apr => {
      if (apr.logs) {
        apr.logs.forEach((log: any) => {
          const kg = convertToKg(log.quantity, log.unit, log.material);
          totalGeneradoKg += kg;
          if (log.status === 'APROVECHADO' || log.status === 'RECICLADO') {
            totalAprovechadoKg += kg;
          }
        });
      }
    });

    const recyclingRate = totalGeneradoKg > 0 ? Math.round((totalAprovechadoKg / totalGeneradoKg) * 100) : 0;

    return {
      averageCompliancePercentage,
      totalInspectionsCount,
      categoriesChartDetails,
      totalAprovechadoTon: Number(((totalAprovechadoKg) / 1000).toFixed(2)),
      totalGeneradoTon: Number(((totalGeneradoKg) / 1000).toFixed(2)),
      recyclingRate
    };
  };

  const envMetrics = getEnvironmentalMetrics();

  const handleExport = () => {
    if (exportFormat === 'json') {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(issues, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `BIM_Reports_${new Date().toISOString()}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
    } else {
      const headers = selectedFields.join(',');
      const rows = issues.map(issue => selectedFields.map(f => {
        const val = (issue as any)[f];
        return typeof val === 'object' ? JSON.stringify(val).replace(/,/g, ';') : val;
      }).join(',')).join('\n');
      const csvContent = "data:text/csv;charset=utf-8," + headers + '\n' + rows;
      const encodedUri = encodeURI(csvContent);
      window.open(encodedUri);
    }
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#020617] transition-colors">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="flex-1 p-6 lg:p-8 bg-slate-50 dark:bg-[#020617] overflow-auto transition-colors h-screen custom-scrollbar font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* HEADER & DUAL TAB SELECTOR */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-3xl lg:text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight uppercase flex items-center gap-2">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
              Rendimiento y Métricas
            </h1>
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-[0.3em]">
              Tablero Analítico Inteligente Trevoly CDE
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Met Tab Toggle */}
            <div className="flex p-1 bg-white dark:bg-[#0f1424] border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
              <button 
                onClick={() => setMetricTab('OBRA')}
                className={cn(
                  "px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all", 
                  metricTab === 'OBRA' 
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/15" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
              >
                Incidencias de Obra
              </button>
              <button 
                onClick={() => setMetricTab('AMBIENTAL')}
                className={cn(
                  "px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5", 
                  metricTab === 'AMBIENTAL' 
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/15" 
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                )}
              >
                <Leaf className="w-3.5 h-3.5" />
                Sostenibilidad
              </button>
            </div>

            {metricTab === 'OBRA' && (
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={handleExport}
                  className="bg-slate-900 dark:bg-blue-600 text-white px-6 py-2.5 border border-slate-800 dark:border-blue-500 rounded-xl font-black text-[9.5px] uppercase tracking-widest shadow-lg shadow-blue-600/10 hover:bg-blue-500 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar
                </button>
              </div>
            )}
          </div>
        </header>

        {/* METRIC TAB 1: GENERAL INCIDENCIAS */}
        {metricTab === 'OBRA' && (
          <div className="space-y-8 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Chart 1 */}
              <div className="bg-white dark:bg-[#050508] p-8 rounded-[40px] border border-slate-100 dark:border-slate-900 shadow-xl shadow-slate-200/50 dark:shadow-none lg:col-span-2 transition-colors">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-8 flex items-center gap-2 uppercase tracking-[0.3em]">
                   <BarChart3 className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                   Trazabilidad de Resoluciones
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -35, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94A3B8" 
                        fontSize={9} 
                        tickLine={false} 
                        axisLine={false}
                        tick={{ fontWeight: 600, style: { textTransform: 'uppercase', letterSpacing: '0.1em' } }}
                      />
                      <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '12px', fontSize: '11px' }}
                        cursor={{ fill: '#F8FAFC' }}
                        itemStyle={{ color: '#0F172A' }}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="bg-blue-600 dark:bg-blue-900/90 text-white p-8 rounded-[40px] flex flex-col justify-between shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12 group-hover:rotate-0 transition-all duration-700">
                   <Database className="w-48 h-48" />
                </div>
                <div className="relative z-10">
                  <p className="text-white/60 text-[9px] font-black uppercase tracking-[0.3em] mb-4">Total Acumulado</p>
                  <h2 className="text-7xl font-bold tracking-tighter leading-none font-mono">{issues.length}</h2>
                  <div className="mt-2 text-xs font-black uppercase tracking-wider text-white/50">Incidencias de Obra</div>
                </div>
                <div className="relative z-10 pt-10 mt-10 border-t border-white/20 space-y-5">
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                    <span className="text-white/60">Críticas (Inmediatas)</span>
                    <span className="bg-red-500 px-2.5 py-1 rounded-lg text-white font-mono">{issues.filter(i => i.degreeOfAction === 'critica' || i.degreeOfAction === 'inmediata').length}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                    <span className="text-white/60">Especialidades Activas</span>
                    <span className="bg-emerald-500 px-2.5 py-1 rounded-lg text-white font-mono">
                      {new Set(issues.map(i => i.specialty)).size}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* DESIGN CUSTOMIZATION */}
            <div className="bg-white dark:bg-[#050508] p-8 rounded-[40px] border border-slate-100 dark:border-slate-900 shadow-sm transition-colors">
               <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-6 flex items-center gap-2 uppercase tracking-[0.3em]">
                  <Filter className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  Diseño de Reporte de Obra Personalizado
               </h3>
               <div className="flex flex-wrap gap-2.5">
                  {['code', 'title', 'type', 'status', 'degreeOfAction', 'specialty', 'assignedPosition', 'creatorName', 'createdAt'].map((field) => (
                    <button
                      key={field}
                      onClick={() => setSelectedFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all border",
                        selectedFields.includes(field) 
                          ? "bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/15" 
                          : "bg-slate-50 dark:bg-black/40 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-900 hover:text-slate-900 dark:hover:text-slate-300"
                      )}
                    >
                      {selectedFields.includes(field) && <Check className="w-3 h-3" />}
                      {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
                    </button>
                  ))}
               </div>
            </div>
          </div>
        )}

        {/* METRIC TAB 2: METRICAS AMBIENTALES */}
        {metricTab === 'AMBIENTAL' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* KPI STATS ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[32px] flex items-center justify-between shadow-sm">
                <div className="space-y-1.5">
                  <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">CUMPLIMIENTO MEDIO GLOBAL</p>
                  <h3 className="text-4xl font-black font-mono text-emerald-500">
                    {envMetrics.averageCompliancePercentage}%
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Auditorías de Inspección</p>
                </div>
                <div className="w-14 h-14 bg-emerald-500/5 rounded-2xl border border-emerald-500/15 flex items-center justify-center">
                  <Award className="w-7 h-7 text-emerald-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[32px] flex items-center justify-between shadow-sm">
                <div className="space-y-1.5">
                  <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">CO-PRODUCTOS RE-APROVECHADOS</p>
                  <h3 className="text-4xl font-black font-mono text-slate-800 dark:text-white">
                    {envMetrics.totalAprovechadoTon} <span className="text-xs font-bold text-slate-400">Ton</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">
                    Reciclaje Acumulado
                  </p>
                </div>
                <div className="w-14 h-14 bg-emerald-500/5 rounded-2xl border border-emerald-500/15 flex items-center justify-center">
                  <Recycle className="w-7 h-7 text-emerald-500" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#050508] border border-slate-200/60 dark:border-slate-900 p-6 rounded-[32px] flex items-center justify-between shadow-sm">
                <div className="space-y-1.5">
                  <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">ECO-INDICADOR GENERACIÓN</p>
                  <h3 className="text-4xl font-black font-mono text-slate-800 dark:text-white">
                    {envMetrics.totalGeneradoTon} <span className="text-xs font-bold text-slate-400">Ton</span>
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase">Masa Total de Residuos</p>
                </div>
                <div className="w-14 h-14 bg-slate-500/5 rounded-2xl border border-slate-500/15 flex items-center justify-center">
                  <Layers className="w-7 h-7 text-slate-450" />
                </div>
              </div>

            </div>

            {/* DYNAMIC COMPLIANCE CHART ACROSS ALL 11 CATEGORIES */}
            <div className="bg-white dark:bg-[#050508] p-8 border border-slate-200/70 dark:border-slate-900 rounded-[36px] shadow-sm">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 flex items-center gap-2">
                <Leaf className="w-4.5 h-4.5 text-emerald-500" />
                Cumplimiento Sostenible por Categoría Inspectoría (%)
              </h3>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={envMetrics.categoriesChartDetails} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis 
                      dataKey="shortName" 
                      fontSize={8} 
                      stroke="#94A3B8" 
                      tickLine={false} 
                      axisLine={false}
                      tick={{ fontWeight: 800, style: { textTransform: 'uppercase', letterSpacing: '0.05em' } }}
                    />
                    <YAxis stroke="#94A3B8" fontSize={9} min={0} max={100} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#070C19', color: '#FFFFFF', borderRadius: '12px', fontSize: '11px', border: 'none' }}
                      cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                    />
                    <Bar dataKey="Cumplimiento" radius={[4, 4, 0, 0]}>
                      {envMetrics.categoriesChartDetails.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GRID OF THE 11 CATEGORIES DETAILS - EXACT MATCHING PICTURE PROGRESS LOGICS */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] pl-1">
                Auditoría Desagregada de Categorías
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {envMetrics.categoriesChartDetails.map((cat) => (
                  <div 
                    key={cat.id}
                    className="bg-white dark:bg-[#050508] border border-slate-200/80 dark:border-slate-900 rounded-[28px] p-5 flex flex-col justify-between h-40 transition-all hover:border-emerald-500/20"
                  >
                    <div>
                      <span className="text-[8px] font-mono font-black text-slate-400">N°- {cat.id}</span>
                      <h4 className="text-[10.5px] font-black text-slate-800 dark:text-white uppercase tracking-wider leading-relaxed mt-1">
                        {cat.name.slice(3)}
                      </h4>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-900/60">
                      <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">CUMPLIMIENTO</span>
                      <span className={cn(
                        "text-sm font-mono font-black",
                        cat.Cumplimiento >= 85 ? "text-emerald-500" :
                        cat.Cumplimiento >= 60 ? "text-amber-500" : "text-red-500"
                      )}>
                        {cat.Cumplimiento}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
