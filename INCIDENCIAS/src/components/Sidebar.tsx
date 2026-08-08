import React from 'react';
import { LayoutDashboard, FileText, Settings, Bell, LogOut, Package, ClipboardList, Layers, XCircle, ShieldCheck, Leaf } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  canViewSite?: boolean;
  canViewQuality?: boolean;
  canViewEnv?: boolean;
}

import { useAuth } from '../context/AuthContext';

export default function Sidebar({ 
  activeTab, 
  setActiveTab,
  canViewSite = true,
  canViewQuality = true,
  canViewEnv = true
}: SidebarProps) {
  const { logout, user } = useAuth();
  const isBimTeam = user?.team?.toUpperCase().includes('BIM') || 
                    user?.position?.toUpperCase().includes('BIM') ||
                    user?.email?.toLowerCase() === 'imagina3ddesign@gmail.com';

  const menuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ...(isBimTeam || user?.role === 'admin' ? [
      { id: 'issues', icon: ClipboardList, label: 'Incidencias' },
      { id: 'anuladas', icon: XCircle, label: 'Anuladas' },
    ] : []),
    ...(canViewSite ? [{ id: 'site-reports', icon: ClipboardList, label: 'Informes de Obra' }] : []),
    ...(canViewQuality ? [{ id: 'quality-reports', icon: ShieldCheck, label: 'Informes de Calidad' }] : []),
    ...(canViewEnv ? [{ id: 'environmental-reports', icon: Leaf, label: 'Informes Ambientales' }] : []),
    { id: 'models', icon: Layers, label: 'Modelos CDE' },
    { id: 'reports', icon: FileText, label: 'Métricas' },
    { id: 'notifications', icon: Bell, label: 'Notificaciones' },
    ...(user?.role === 'admin' ? [{ id: 'settings', icon: Settings, label: 'Configuración' }] : []),
  ];

  return (
    <div className="w-20 lg:w-[240px] bg-white dark:bg-[#050505] border-r border-slate-200 dark:border-[#1a1a1a] flex flex-col h-screen overflow-hidden transition-all duration-500 z-[60]">
      <div className="p-5 lg:p-6 flex flex-col items-center lg:items-start gap-5">
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="w-8 h-8 bg-slate-900 dark:bg-white border border-slate-900 dark:border-white rounded-lg flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-500 overflow-hidden p-1.5">
            <img 
              src="https://i.postimg.cc/yY0XpLzW/LOGO-BIM-BLANCO-ICO.png" 
              alt="BIM Logo" 
              className="w-full h-full object-contain dark:invert opacity-95"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="font-display font-black text-sm tracking-tight text-slate-900 dark:text-white leading-none">NORA</span>
            <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mt-1">Ecosystem CDE</span>
          </div>
        </div>

        <div className="w-full h-[0.5px] bg-slate-100 dark:bg-[#1a1a1a]" />
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto custom-scrollbar pt-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3.5 p-3 rounded-lg transition-all duration-300 group relative",
              activeTab === item.id 
                ? "bg-slate-900 dark:bg-[#111111] text-white shadow-xl shadow-slate-900/10 dark:shadow-none translate-x-1" 
                : "text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-[#111111]/50 hover:text-slate-900 dark:hover:text-slate-100"
            )}
          >
            <item.icon className={cn("w-4 h-4 flex-shrink-0 transition-transform duration-300 group-hover:scale-110", activeTab === item.id ? "text-white" : "text-slate-400 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-slate-300")} />
            <span className="font-bold hidden lg:block text-[9px] uppercase tracking-widest">{item.label}</span>
            {activeTab === item.id && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute right-[-14px] w-1 h-6 bg-slate-900 dark:bg-white rounded-l-full hidden lg:block"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </nav>

      <div className="p-5 space-y-5">


        <button 
          onClick={logout}
          className="w-full flex items-center gap-4 p-4 rounded-xl text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 transition-all group"
        >
          <LogOut className="w-4.5 h-4.5 group-hover:-translate-x-1 transition-transform" />
          <span className="hidden lg:block text-slate-400 dark:text-slate-500 group-hover:text-red-500">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
}
