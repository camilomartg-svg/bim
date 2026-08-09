import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import IssueList from './components/IssueList';
import IssueDetail from './components/IssueDetail';
import CreateIssueModal from './components/CreateIssueModal';
import ReportGenerator from './components/ReportGenerator';
import SiteReportList from './components/SiteReportList';
import QualityReportList from './components/QualityReportList';
import EnvironmentalReportList from './components/EnvironmentalReportList';
import ConfigPanel from './components/ConfigPanel';
import { Issue } from './types';
import { LogIn, Box, Layers, Workflow, Package, Plus, Bell, Calendar, ChevronRight, Moon, Sun, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

import DashboardSummary from './components/DashboardSummary';
import DashboardChat from './components/DashboardChat';

import { db } from './services/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

// Component for displaying standard restricted access view to matching style
function RestrictedView({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#020617]">
       <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 shadow-2xl shadow-indigo-500/10 rounded-3xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-500">
          <AlertCircle className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Acceso Restringido</h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 max-w-sm">La sección {title} está restringida por configuración para su perfil de usuario. Por favor, contacte con el Administrador BIM.</p>
          <button 
            onClick={onBack}
            className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10"
          >
            Volver al Dashboard
          </button>
       </div>
    </div>
  );
}

function Dashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [summaryFilter, setSummaryFilter] = useState<'author' | 'responsible' | 'reviewer' | 'bim'>('author');
  const { user, googleAccessToken, connectGoogleDrive } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectConfig, setProjectConfig] = useState<any>(() => {
    try {
      const cached = localStorage.getItem('cached_project_config');
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  });

  const isBimTeam = user?.team?.toUpperCase().includes('BIM') || 
                    user?.position?.toUpperCase().includes('BIM') ||
                    user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'project'), (snap) => {
      if (snap.exists()) {
        setProjectConfig(snap.data());
      }
    });
    return () => unsub();
  }, []);

  const userTeam = (user?.team || "").toUpperCase().trim();
  const userPosition = user?.position || "";
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin' || Boolean((user as any)?.isSuperAdmin);

  const siteAllowed: string[] = projectConfig?.siteReportsAllowedTeams || projectConfig?.siteReportsAllowedProfiles || [];
  const qualityAllowed: string[] = projectConfig?.qualityReportsAllowedTeams || projectConfig?.qualityReportsAllowedProfiles || [];
  const envAllowed: string[] = projectConfig?.environmentalReportsAllowedTeams || projectConfig?.environmentalReportsAllowedProfiles || [];

  const canViewSite = isBimTeam || isAdmin || siteAllowed.length === 0 || siteAllowed.includes(userTeam) || siteAllowed.includes(userPosition);
  const canViewQuality = isBimTeam || isAdmin || qualityAllowed.length === 0 || qualityAllowed.includes(userTeam) || qualityAllowed.includes(userPosition);
  const canViewEnv = isBimTeam || isAdmin || envAllowed.length === 0 || envAllowed.includes(userTeam) || envAllowed.includes(userPosition);

  const handleOpenIssue = async (issueId: string) => {
    try {
      const issueDoc = await getDoc(doc(db, 'issues', issueId));
      if (issueDoc.exists()) {
        setSelectedIssue({ id: issueDoc.id, ...issueDoc.data() } as Issue);
        setActiveTab('issues');
      }
    } catch (err) {
      console.error("Error fetching issue for navigation:", err);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="flex-1 flex overflow-hidden bg-white dark:bg-[#020617] transition-colors duration-300">
            {/* Left Column: Chat/Activity (50%) */}
            <section className="w-1/2 relative z-10 flex flex-col bg-white dark:bg-[#020617] transition-colors duration-300">
               <DashboardChat selectedIssue={selectedIssue} />
               <div className="absolute top-0 right-0 w-px h-full bg-slate-200 dark:bg-slate-800/30" />
            </section>

            {/* Right Column: Execution/Management (50%) */}
            <section className="w-1/2 flex flex-col overflow-hidden">
               {/* Fixed Header within Right Column */}
               <div className="px-5 py-3.5 bg-white/50 dark:bg-black/50 backdrop-blur-xl border-b border-slate-100 dark:border-[#111111]">
                  <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full bg-[#FFC000] text-slate-900 px-5 py-2.5 rounded-lg font-black text-[8.5px] uppercase tracking-[0.15em] hover:bg-amber-400 transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 group"
                  >
                    <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                    Registrar Hallazgo en Obra
                  </button>
                  
                  <div className="flex gap-6 mt-4 border-b border-slate-200 dark:border-[#1a1a1a]">
                    {[
                      { id: 'author', label: 'Autor' },
                      { id: 'responsible', label: 'Responsable' },
                      { id: 'reviewer', label: 'Revisor' },
                      ...(isBimTeam ? [{ id: 'bim', label: 'PANEL BIM (ELIMINAR)' }] : [])
                    ].map((tab) => (
                      <button 
                        key={tab.id}
                        onClick={() => setSummaryFilter(tab.id as any)}
                        className={cn(
                          "pb-2 text-[8px] font-black uppercase tracking-[0.15em] transition-all relative px-0.5",
                          summaryFilter === tab.id ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-600 hover:text-slate-800 dark:hover:text-slate-300"
                        )}
                      >
                        {tab.label}
                        {summaryFilter === tab.id && (
                          <motion.div 
                            layoutId="summaryTab" 
                            className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-amber-500 rounded-full" 
                          />
                        )}
                      </button>
                    ))}
                  </div>
               </div>

               {/* Dynamic Content Area */}
               <div className="flex-1 overflow-hidden px-4 py-1 flex flex-col">
                  <DashboardSummary 
                    onSelectIssue={(issue) => setSelectedIssue(issue)} 
                    onOpenReport={(reportId) => {
                      setSelectedReportId(reportId);
                      setActiveTab('site-reports');
                      setSelectedIssue(null);
                    }}
                    selectedIssueId={selectedIssue?.id}
                    filterRole={summaryFilter}
                  />
               </div>
            </section>
          </div>
        );
      case 'issues':
      case 'anuladas':
        if (!isBimTeam && user?.role !== 'admin') {
          return (
            <div className="flex-1 flex items-center justify-center bg-white dark:bg-[#020617]">
               <div className="text-center p-8 bg-slate-50 dark:bg-slate-900 shadow-2xl shadow-indigo-500/10 rounded-3xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in duration-500">
                  <AlertCircle className="w-16 h-16 text-indigo-500 mx-auto mb-6" />
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">Acceso Restringido</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 max-w-sm">Esta sección es exclusiva para miembros del equipo BIM o administradores. Por favor, contacte con administración si necesita acceso.</p>
                  <button 
                    onClick={() => setActiveTab('dashboard')}
                    className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-900/10"
                  >
                    Volver al Dashboard
                  </button>
               </div>
            </div>
          );
        }
        return (
          <div className="flex-1 flex overflow-hidden bg-white dark:bg-[#020617] transition-colors duration-300">
            <IssueList 
              onSelectIssue={(issue) => setSelectedIssue(issue)} 
              view={activeTab === 'anuladas' ? 'anuladas' : 'active'}
              onOpenReport={(reportId) => {
                setSelectedReportId(reportId);
                setActiveTab('site-reports');
                setSelectedIssue(null);
              }}
            />
            <AnimatePresence mode="wait">
              {selectedIssue ? (
                <IssueDetail 
                  key={selectedIssue.id}
                  issue={selectedIssue} 
                  onClose={() => setSelectedIssue(null)} 
                  onOpenReport={(reportId) => {
                    setSelectedReportId(reportId);
                    setActiveTab('site-reports');
                    setSelectedIssue(null);
                  }}
                />
              ) : (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50 dark:bg-slate-900/20"
                >
                  <div className="w-16 h-16 rounded-[1.5rem] bg-slate-100 dark:bg-[#050505] shadow-lg flex items-center justify-center mb-6 border border-slate-200 dark:border-[#1a1a1a]">
                    <Box className="w-7 h-7 text-slate-300 dark:text-slate-800" />
                  </div>
                  <h3 className="text-sm font-display font-black text-slate-900 dark:text-white uppercase tracking-[0.15em] mb-2.5">Gestión Estratégica</h3>
                  <p className="max-w-xs text-[9px] text-slate-400 dark:text-slate-600 leading-relaxed font-semibold uppercase tracking-wider">
                    Explora el inventario técnico de incidencias. Selecciona un registro para auditar su trazabilidad y flujos coordinados.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      case 'reports':
        return <ReportGenerator />;
      case 'site-reports':
        if (!canViewSite) {
          return <RestrictedView title="Informes de Obra" onBack={() => setActiveTab('dashboard')} />;
        }
        return (
          <SiteReportList 
            initialSelectedReportId={selectedReportId} 
            onClearInitialSelection={() => setSelectedReportId(null)} 
            onOpenIssue={handleOpenIssue}
          />
        );
      case 'quality-reports':
        if (!canViewQuality) {
          return <RestrictedView title="Informes de Calidad" onBack={() => setActiveTab('dashboard')} />;
        }
        return <QualityReportList />;
      case 'environmental-reports':
        if (!canViewEnv) {
          return <RestrictedView title="Informes Ambientales" onBack={() => setActiveTab('dashboard')} />;
        }
        return <EnvironmentalReportList />;
      case 'settings':
        if (user?.role !== 'admin') {
          return <RestrictedView title="Configuración" onBack={() => setActiveTab('dashboard')} />;
        }
        return <ConfigPanel />;
      default:
        return (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
             <div className="text-center">
               <Layers className="w-20 h-20 text-slate-200 mx-auto mb-6" />
               <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.3em]">Módulo Vanguardista</h2>
               <p className="text-xs text-slate-400 mt-3 font-medium">Esta capacidad está siendo optimizada para Nora.</p>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-black text-slate-900 dark:text-white font-sans selection:bg-amber-500/30 selection:text-white transition-colors duration-200">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        canViewSite={canViewSite}
        canViewQuality={canViewQuality}
        canViewEnv={canViewEnv}
      />
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Superior Navigation / Breadcrumbs */}
        <header className="h-10 border-b border-slate-200 dark:border-[#1a1a1a] flex items-center justify-between px-6 bg-white/80 dark:bg-black/80 backdrop-blur-md z-50 shrink-0 transition-colors duration-200">
          <div className="flex items-center gap-2.5">
             <span className="text-[8px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.2em]">Portal BIM</span>
             <ChevronRight className="w-2 h-2 text-slate-300 dark:text-slate-700" />
             <span className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">Nora</span>
             {activeTab !== 'dashboard' && (
               <>
                 <ChevronRight className="w-2 h-2 text-slate-300 dark:text-slate-700" />
                 <span className="text-[8px] font-black text-amber-500 uppercase tracking-[0.2em]">{activeTab}</span>
               </>
             )}
          </div>

          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2.5 text-slate-500">
               <Calendar className="w-3 h-3" />
               <span className="text-[8px] font-black uppercase tracking-widest">{format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}</span>
             </div>
             <div className="h-4 w-px bg-slate-200 dark:bg-[#1a1a1a]" />
             <button 
               onClick={toggleTheme}
               className="p-1.5 rounded-lg border border-slate-200 dark:border-[#1a1a1a] hover:bg-slate-50 dark:hover:bg-[#111111] transition-all text-slate-400 dark:text-slate-700 hover:text-slate-900 dark:hover:text-white active:scale-95 group"
               title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
             >
               {theme === 'dark' ? (
                 <Sun className="w-3.5 h-3.5 group-hover:rotate-45 transition-transform duration-500" />
               ) : (
                 <Moon className="w-3.5 h-3.5 group-hover:-rotate-12 transition-transform duration-500" />
               )}
             </button>
             <div className="h-4 w-px bg-slate-200 dark:bg-[#1a1a1a]" />

             {/* Google Drive Status & Connection Button */}
             <button
               type="button"
               onClick={async () => {
                 if (googleAccessToken) {
                   alert("Su cuenta de Google Drive ya está vinculada correctamente.");
                 } else {
                   const confirmConnect = window.confirm(
                     "¿Desea conectar y vincular su cuenta de Google Drive ahora para asegurar que los informes ambientales y fotografías queden almacenados en la carpeta pública?"
                   );
                   if (confirmConnect) {
                     try {
                       await connectGoogleDrive();
                       alert("¡Google Drive se ha conectado correctamente!");
                     } catch (err: any) {
                       alert("No se pudo conectar a Google Drive: " + (err?.message || String(err)));
                     }
                   }
                 }
               }}
               className={cn(
                 "p-1 px-2.5 rounded-lg border text-[7.5px] font-black uppercase tracking-wider flex items-center gap-2 active:scale-95 transition-all outline-none",
                 googleAccessToken
                   ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                   : "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
               )}
               title={googleAccessToken ? "Google Drive Vinculado" : "Google Drive Desconectado"}
             >
               <span className={cn("w-1.5 h-1.5 rounded-full", googleAccessToken ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
               <span>Drive: {googleAccessToken ? "VINCULADO" : "CONECTAR"}</span>
             </button>

             <div className="h-4 w-px bg-slate-200 dark:bg-[#1a1a1a]" />
             <div className="flex items-center gap-2.5">
               <div className="text-right">
                 <p className="text-[8px] font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">{user?.name}</p>
                 <p className="text-[6.5px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mt-1">{user?.position || 'Usuario BIM'}</p>
               </div>
               <div className="w-7 h-7 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center p-1.5 shadow-sm">
                 <img 
                    src="https://i.postimg.cc/yY0XpLzW/LOGO-BIM-BLANCO-ICO.png" 
                    alt="BIM Logo" 
                    className="w-full h-full object-contain dark:filter dark:invert"
                    referrerPolicy="no-referrer"
                 />
               </div>
             </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col relative">
          {renderContent()}
        </div>
      </main>

      <AnimatePresence>
        {isCreateModalOpen && (
          <CreateIssueModal 
            onClose={() => setIsCreateModalOpen(false)} 
            onSuccess={(type) => {
              if (type === 'report') setActiveTab('site-reports');
              else if (type === 'issue') setActiveTab('issues');
              setIsCreateModalOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoginScreen() {
  const { signIn } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-8 relative overflow-hidden transition-colors duration-300">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-blue-500/5 rounded-full blur-[120px] translate-x-1/4 -translate-y-1/4" />
      <div className="absolute bottom-0 left-0 w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px] -translate-x-1/4 translate-y-1/4" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-[900px] w-full grid grid-cols-1 lg:grid-cols-2 bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden relative z-10 transition-colors duration-300"
      >
        {/* Left Side: Brand Visual */}
        <div className="bg-slate-900 dark:bg-[#020617] p-12 lg:p-16 flex flex-col justify-between text-white relative overflow-hidden border-r border-slate-200 dark:border-slate-800 transition-colors duration-300">
          <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
            <Package className="w-64 h-64 rotate-12" />
          </div>
          
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/5 backdrop-blur-xl rounded-xl flex items-center justify-center mb-8 border border-white/10">
              <img 
                src="https://i.postimg.cc/yY0XpLzW/LOGO-BIM-BLANCO-ICO.png" 
                alt="BIM Logo" 
                className="w-7 h-7 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <h2 className="text-4xl font-display font-black tracking-tightest leading-[1.1] mb-6 uppercase">
              Evoluciona tu <br/>
              <span className="text-amber-500">Coordinación BIM</span>
            </h2>
            <p className="text-slate-500 font-bold text-base max-w-[240px] leading-relaxed uppercase tracking-tighter">
              Gestión estratégica de hallazgos, trazabilidad técnica y control total.
            </p>
          </div>
          
          <div className="relative z-10 flex items-center gap-5 mt-16 opacity-30">
            <img 
              src="https://i.postimg.cc/DhDLzDMQ/LOGO-NORA-BLANCO.png" 
              alt="Nora Logo" 
              className="h-5 object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="h-3 w-px bg-white/20" />
            <span className="text-[8px] font-black uppercase tracking-[0.4em]">nora CDE</span>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="p-12 lg:p-20 flex flex-col justify-center bg-white dark:bg-slate-900 transition-colors duration-300">
          <div className="mb-10">
            <h1 className="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tightest uppercase mb-3 leading-none">NORA</h1>
            <div className="flex items-center gap-3">
              <div className="h-0.5 w-10 bg-amber-500 rounded-full" />
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em]">Common Data Environment</span>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Acceso al Ecosistema</h3>
              <p className="text-slate-500 text-xs font-medium leading-relaxed">
                Utiliza tus credenciales institucionales para acceder a la plataforma de gestión.
              </p>
            </div>

            <button 
              onClick={signIn}
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-[#020617] py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.25em] flex items-center justify-center gap-3 hover:bg-black dark:hover:bg-slate-100 transition-all shadow-xl shadow-black/5 dark:shadow-white/5 active:scale-[0.98] group"
            >
              <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-500 font-black" />
              Sincronizar con Google
            </button>

            <div className="pt-8 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-6 opacity-30 dark:opacity-10 transition-colors duration-300">
               <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
               <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
               <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-full" />
            </div>
          </div>
        </div>
      </motion.div>
      
      <div className="absolute bottom-10 text-[8px] font-black text-slate-800 uppercase tracking-[0.8em] z-10">
        PROYECTO_CONTROL_V4.2.0
      </div>
    </div>
  );
}

function Main() {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-[#020617] transition-colors duration-300">
       <div className="animate-pulse space-y-6 text-center">
         <div className="w-14 h-14 bg-slate-900 dark:bg-slate-900 rounded-2xl mx-auto border border-slate-200 dark:border-slate-800 flex items-center justify-center p-3">
            <img 
                src="https://i.postimg.cc/yY0XpLzW/LOGO-BIM-BLANCO-ICO.png" 
                alt="BIM Logo" 
                className="w-full h-full object-contain filter invert opacity-90"
                referrerPolicy="no-referrer"
            />
         </div>
         <div className="space-y-2">
            <p className="text-[8px] font-black uppercase tracking-[0.6em] text-slate-900 dark:text-white">NORA ECOSYSTEM</p>
            <p className="text-[7px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">Sincronizando Common Data Environment...</p>
         </div>
       </div>
    </div>
  );

  return user ? <Dashboard /> : <LoginScreen />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Main />
      </AuthProvider>
    </ThemeProvider>
  );
}
