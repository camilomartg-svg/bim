import React, { useState, useEffect, useRef } from 'react';
import { User, Building2, ChevronDown, LogOut, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const UserHeaderBadge: React.FC = () => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const empParam = urlParams.get('empresa') || '';
  const projectParam = urlParams.get('project') || '';

  // User details
  const rawUserStr = typeof window !== 'undefined' ? (sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount')) : null;
  const rawUser = rawUserStr ? JSON.parse(rawUserStr) : null;

  const displayName = user?.name || rawUser?.name || 'Usuario';
  const displayEmail = user?.email || rawUser?.username || rawUser?.email || '';
  const userInitial = (displayName.trim()[0] || 'U').toUpperCase();

  // Load companies
  useEffect(() => {
    fetch('../empresas.json')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCompanies(data);
      })
      .catch(() => {});
  }, []);

  // Associated companies for user
  const cleanEmail = displayEmail.toLowerCase().trim();
  const userCompanies = companies.filter(c => {
    const inAdmins = Array.isArray(c.admins) && c.admins.some((a: string) => String(a).toLowerCase().trim() === cleanEmail);
    const inMembers = Array.isArray(c.members) && c.members.some((m: any) => String(m.email || m.username || '').toLowerCase().trim() === cleanEmail);
    return inAdmins || inMembers;
  });

  // Current represented company in this project
  const [currentRep, setCurrentRep] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Representación';
    const saved = localStorage.getItem(`project_rep_company_${projectParam}_${cleanEmail}`);
    if (saved) return saved;
    if (rawUser?.empresaRepresentada) return rawUser.empresaRepresentada;
    if (empParam) {
      const match = companies.find(c => c.id === empParam || (c.name && c.name.toLowerCase() === empParam.toLowerCase()));
      if (match) return match.name;
    }
    if (rawUser?.empresaUsuario || rawUser?.empresa) return rawUser.empresaUsuario || rawUser.empresa;
    return 'Representación';
  });

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectRep = (compName: string) => {
    setCurrentRep(compName);
    localStorage.setItem(`project_rep_company_${projectParam}_${cleanEmail}`, compName);
    setModalOpen(false);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('userAccount');
    localStorage.removeItem('userAccount');
    if (logout) logout().catch(() => {});
    window.location.href = '../home.html';
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* User Header Pill */}
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 bg-white/90 dark:bg-zinc-800/90 border border-slate-200/90 dark:border-zinc-700/80 rounded-full py-1 px-3 shadow-sm hover:shadow transition-all cursor-pointer select-none text-left"
      >
        <div className="w-6 h-6 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-black uppercase shadow-inner shrink-0">
          {userInitial}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs font-bold text-slate-800 dark:text-white leading-tight truncate max-w-[120px] sm:max-w-[170px]">
            {displayName}
          </span>
          <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate max-w-[120px] sm:max-w-[170px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span>{currentRep || 'Representación'}</span>
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500 ml-0.5 shrink-0" />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 z-[9999] text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-2 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Sesión Activa</p>
            <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">{displayName}</p>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{displayEmail}</p>
          </div>

          <div className="p-2.5 my-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">En este proyecto:</span>
              {userCompanies.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setDropdownOpen(false);
                    setModalOpen(true);
                  }}
                  className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Cambiar
                </button>
              )}
            </div>
            <p className="text-xs font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 truncate">
              <Building2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{currentRep || 'Sin definir'}</span>
            </p>
          </div>

          <div className="pt-1 flex flex-col gap-1">
            <a
              href={`../perfil.html${empParam ? `?empresa=${encodeURIComponent(empParam)}` : ''}${projectParam ? `&project=${encodeURIComponent(projectParam)}` : ''}`}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <User className="w-3.5 h-3.5 text-zinc-400" />
              <span>Mi Perfil de Usuario</span>
            </a>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left w-full"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      )}

      {/* Modal Cambio de Representación */}
      {modalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-5 animate-in zoom-in-95 duration-200 text-left">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">¿Qué Empresa Representas?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Selecciona con qué empresa interactúas en este proyecto:</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {userCompanies.map(comp => {
                const isSelected = comp.name.toLowerCase() === currentRep.toLowerCase();
                return (
                  <button
                    key={comp.id || comp.name}
                    type="button"
                    onClick={() => handleSelectRep(comp.name)}
                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200'
                        : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
                        {((comp.code || comp.name).substring(0, 2)).toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-left">{comp.name}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
