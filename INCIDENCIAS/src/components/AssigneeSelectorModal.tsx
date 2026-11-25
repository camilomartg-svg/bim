import { createPortal } from 'react-dom';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  Search, 
  Users, 
  User as UserIcon, 
  Building2, 
  Check, 
  ShieldCheck, 
  Layers, 
  Briefcase,
  ChevronRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { TeamMember } from '../types';
import { useAuth } from '../context/AuthContext';
import { filterMembersByScope, IssueTypeScope, getBranchForTeamName, getActiveProjectData, getUserProjectStatus } from '../utils/userScope';

export interface AssigneeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  scope?: IssueTypeScope; // 'GLOBAL' | 'DELIVERY' | 'RECEIVER'
  mode?: 'single' | 'multiple';
  selectedValue?: string; // member email, position or id
  selectedValues?: string[]; // for multiple reviewers
  onSelect?: (member: TeamMember) => void;
  onSelectMultiple?: (members: TeamMember[]) => void;
  members: TeamMember[];
  position?: 'center' | 'right';
}

export default function AssigneeSelectorModal({
  isOpen,
  onClose,
  title = 'Seleccionar Responsable / Asignado',
  scope = 'GLOBAL',
  mode = 'single',
  selectedValue = '',
  selectedValues = [],
  onSelect,
  onSelectMultiple,
  members = [],
  position = 'center'
}: AssigneeSelectorModalProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'individual' | 'team' | 'company'>('individual');
  const [tempSelected, setTempSelected] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTempSelected(selectedValues || []);
    }
  }, [isOpen, selectedValues]);

  // 1. Filtrar miembros estrictamente según el alcance de la incidencia
  // - GLOBAL: todos los miembros
  // - DELIVERY: solo miembros de equipo de entrega
  // - RECEIVER: solo miembros de equipo de recepción
  const scopedMembers = useMemo(() => {
    const byScope = filterMembersByScope(members, scope);

    return byScope.filter((m) => {
      const mEmail = String(m.email || '').toLowerCase().trim();
      const mName = String(m.name || '').toLowerCase().trim();

      // Excluir terminantemente usuarios suspendidos o que ya no hacen parte del proyecto
      const status = getUserProjectStatus(mEmail || mName);
      if (status.isSuspendedFromCompany || status.isRemovedFromProject) return false;

      return true;
    });
  }, [members, scope, user?.email, user?.name]);

  // 2. Filtrado en tiempo real con teclado
  const filteredMembers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return scopedMembers;
    return scopedMembers.filter(m => {
      const name = (m.name || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const pos = (m.position || '').toLowerCase();
      const team = (m.team || '').toLowerCase();
      const comp = (m.company || '').toLowerCase();
      const cargo = (m.cargo || '').toLowerCase();
      return name.includes(q) || email.includes(q) || pos.includes(q) || team.includes(q) || comp.includes(q) || cargo.includes(q);
    });
  }, [scopedMembers, searchTerm]);

  // 3. Agrupación por Equipo de Entrega / Recepción
  const membersByTeam = useMemo(() => {
    const map: Record<string, TeamMember[]> = {};
    filteredMembers.forEach(m => {
      const teamName = m.team || 'SIN EQUIPO';
      if (!map[teamName]) map[teamName] = [];
      map[teamName].push(m);
    });
    return map;
  }, [filteredMembers]);

  // 4. Agrupación por Empresa
  const membersByCompany = useMemo(() => {
    const map: Record<string, TeamMember[]> = {};
    filteredMembers.forEach(m => {
      const compName = m.company || 'EMPRESA GENERAL';
      if (!map[compName]) map[compName] = [];
      map[compName].push(m);
    });
    return map;
  }, [filteredMembers]);

  if (!isOpen || !mounted) return null;

  const handleMemberClick = (member: TeamMember) => {
    if (mode === 'single') {
      if (onSelect) onSelect(member);
      onClose();
    } else {
      // Multiple mode toggle
      const identifier = member.position || member.name;
      const isAlready = tempSelected.includes(identifier);
      const next = isAlready ? tempSelected.filter(x => x !== identifier) : [...tempSelected, identifier];
      setTempSelected(next);
    }
  };

  const handleConfirmMultiple = () => {
    if (onSelectMultiple) {
      const matched = scopedMembers.filter(m => tempSelected.includes(m.position || m.name) || tempSelected.includes(m.name) || tempSelected.includes(m.email));
      onSelectMultiple(matched);
    }
    onClose();
  };

  const isMemberSelected = (member: TeamMember) => {
    if (mode === 'single') {
      const cleanVal = selectedValue.toLowerCase().trim();
      return (
        cleanVal && (
          (member.position || '').toLowerCase().trim() === cleanVal ||
          (member.name || '').toLowerCase().trim() === cleanVal ||
          (member.email || '').toLowerCase().trim() === cleanVal
        )
      );
    } else {
      const identifier = member.position || member.name;
      return tempSelected.includes(identifier) || tempSelected.includes(member.name);
    }
  };

  // Resolver líder del equipo
  const resolveTeamLeader = (teamName: string, teamMembersList: TeamMember[]): TeamMember => {
    if (!teamMembersList || teamMembersList.length === 0) return {} as TeamMember;
    const proj = getActiveProjectData();
    const iso = proj?.iso19650 || {};
    const cleanTeam = (teamName || '').toUpperCase().trim();

    let leadEmail = '';

    // 1. Delivery teams
    const dt = (iso.deliveryTeams || []).find((d: any) => (d.name || '').toUpperCase().trim() === cleanTeam);
    if (dt && dt.leadEmail) leadEmail = dt.leadEmail.toLowerCase().trim();

    // 2. Receiver teams
    if (!leadEmail) {
      const rt = (iso.receiverTeams || []).find((r: any) => (r.name || '').toUpperCase().trim() === cleanTeam);
      if (rt && rt.leadEmail) leadEmail = rt.leadEmail.toLowerCase().trim();
    }

    // 3. Task teams within delivery
    if (!leadEmail) {
      for (const d of (iso.deliveryTeams || [])) {
        const tt = (d.taskTeams || []).find((t: any) => (t.name || '').toUpperCase().trim() === cleanTeam);
        if (tt && tt.leadEmail) { leadEmail = tt.leadEmail.toLowerCase().trim(); break; }
      }
    }

    // 4. Task teams within receiver
    if (!leadEmail) {
      for (const r of (iso.receiverTeams || [])) {
        const tt = (r.taskTeams || []).find((t: any) => (t.name || '').toUpperCase().trim() === cleanTeam);
        if (tt && tt.leadEmail) { leadEmail = tt.leadEmail.toLowerCase().trim(); break; }
      }
    }

    // 5. Roles globales ISO
    if (!leadEmail && cleanTeam.includes('ENTREGA') && iso.liderEquipoEntrega) {
      leadEmail = String(iso.liderEquipoEntrega).toLowerCase().trim();
    }
    if (!leadEmail && (cleanTeam.includes('OBRA') || cleanTeam.includes('RECEPTOR')) && iso.directorDeObra) {
      leadEmail = String(iso.directorDeObra).toLowerCase().trim();
    }

    if (leadEmail) {
      const found = teamMembersList.find(m => (m.email || '').toLowerCase().trim() === leadEmail);
      if (found) return found;
    }

    // 6. Buscar en la lista por cargo / posición / rol
    const byCargo = teamMembersList.find(m => {
      const txt = ((m.cargo || '') + ' ' + (m.position || '') + ' ' + ((m as any).role || '')).toUpperCase();
      return txt.includes('LÍDER') || txt.includes('LIDER') || txt.includes('LEAD') || txt.includes('DIRECTOR') || txt.includes('COORDINADOR') || txt.includes('ADMIN');
    });
    if (byCargo) return byCargo;

    return teamMembersList[0];
  };

  // Resolver administrador de empresa
  const resolveCompanyAdmin = (companyName: string, companyMembersList: TeamMember[]): TeamMember => {
    if (!companyMembersList || companyMembersList.length === 0) return {} as TeamMember;
    const adminMember = companyMembersList.find(m => {
      const txt = ((m.cargo || '') + ' ' + (m.position || '') + ' ' + ((m as any).role || '')).toUpperCase();
      return txt.includes('ADMINISTRADOR_EMPRESA') || txt.includes('ADMINISTRADOR') || txt.includes('ADMIN') || txt.includes('SUPER') || txt.includes('GERENTE') || txt.includes('DIRECTOR');
    });
    if (adminMember) return adminMember;

    return companyMembersList[0];
  };

  const handleSelectEntireTeam = (teamName: string, teamMembersList: TeamMember[]) => {
    const leader = resolveTeamLeader(teamName, teamMembersList);
    if (!leader) return;

    if (mode === 'single') {
      if (onSelect) {
        onSelect({
          ...leader,
          position: `${leader.cargo || leader.position || 'Líder'} [${teamName}]`,
          team: teamName
        });
      }
      onClose();
    } else {
      // Multiple mode: toggle all members of that team
      const identifiers = teamMembersList.map(m => m.position || m.name);
      const allSelected = identifiers.every(id => tempSelected.includes(id));
      if (allSelected) {
        setTempSelected(tempSelected.filter(id => !identifiers.includes(id)));
      } else {
        setTempSelected(Array.from(new Set([...tempSelected, ...identifiers])));
      }
    }
  };

  const handleSelectEntireCompany = (companyName: string, companyMembersList: TeamMember[]) => {
    const admin = resolveCompanyAdmin(companyName, companyMembersList);
    if (!admin) return;

    if (mode === 'single') {
      if (onSelect) {
        onSelect({
          ...admin,
          position: `${admin.cargo || admin.position || 'Administrador'} [${companyName}]`,
          company: companyName
        });
      }
      onClose();
    } else {
      // Multiple mode: toggle all members of that company
      const identifiers = companyMembersList.map(m => m.position || m.name);
      const allSelected = identifiers.every(id => tempSelected.includes(id));
      if (allSelected) {
        setTempSelected(tempSelected.filter(id => !identifiers.includes(id)));
      } else {
        setTempSelected(Array.from(new Set([...tempSelected, ...identifiers])));
      }
    }
  };

  const isTeamSelected = (tName: string, tMembers: TeamMember[]) => {
    if (mode === 'single') {
      const leader = resolveTeamLeader(tName, tMembers);
      const cleanVal = selectedValue.toLowerCase().trim();
      return cleanVal && (
        cleanVal.includes(`[${tName.toLowerCase()}]`) ||
        (leader.position || '').toLowerCase().trim() === cleanVal ||
        (leader.name || '').toLowerCase().trim() === cleanVal
      );
    } else {
      const identifiers = tMembers.map(m => m.position || m.name);
      return identifiers.length > 0 && identifiers.every(id => tempSelected.includes(id));
    }
  };

  const isCompanySelected = (cName: string, cMembers: TeamMember[]) => {
    if (mode === 'single') {
      const admin = resolveCompanyAdmin(cName, cMembers);
      const cleanVal = selectedValue.toLowerCase().trim();
      return cleanVal && (
        cleanVal.includes(`[${cName.toLowerCase()}]`) ||
        (admin.position || '').toLowerCase().trim() === cleanVal ||
        (admin.name || '').toLowerCase().trim() === cleanVal
      );
    } else {
      const identifiers = cMembers.map(m => m.position || m.name);
      return identifiers.length > 0 && identifiers.every(id => tempSelected.includes(id));
    }
  };

  const scopeBadge = () => {
    if (scope === 'DELIVERY') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Layers className="w-3 h-3" /> Ámbito Entrega ({scopedMembers.length} Miembros)
        </span>
      );
    }
    if (scope === 'RECEIVER') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
          <Briefcase className="w-3 h-3" /> Ámbito Recepción / Obra ({scopedMembers.length} Miembros)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
        <Users className="w-3 h-3" /> Ámbito Global ({scopedMembers.length} Miembros)
      </span>
    );
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={cn("fixed z-[9999] p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200 flex items-center justify-center", position === "right" ? "inset-y-0 right-0 left-0 md:left-1/2 bg-slate-950/60 backdrop-blur-sm" : "inset-0 bg-slate-950/70 backdrop-blur-md")}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {title}
              </h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {scopeBadge()}
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                {mode === 'single' ? 'Selección individual de responsable' : 'Selección múltiple para comité de revisión'}
              </span>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar (Keyboard Search) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-3 shrink-0 bg-white dark:bg-slate-900">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar con el teclado por nombre, cargo, equipo o empresa..."
              className="w-full pl-11 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs sm:text-[13px] text-slate-900 dark:text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-inner"
            />
            {searchTerm && (
              <button 
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs: Individuo / Por Equipo / Por Empresa */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setFilterMode('individual')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                filterMode === 'individual'
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <UserIcon className="w-3 h-3" /> Individuos ({filteredMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('team')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                filterMode === 'team'
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Users className="w-3 h-3" /> Por Equipo ({Object.keys(membersByTeam).length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('company')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all",
                filterMode === 'company'
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              )}
            >
              <Building2 className="w-3 h-3" /> Por Empresa ({Object.keys(membersByCompany).length})
            </button>
          </div>
        </div>

        {/* Modal List Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">No se encontraron miembros</p>
              <p className="text-[10px] text-slate-400 mt-1">Verifique el término de búsqueda o el ámbito de la incidencia.</p>
            </div>
          ) : filterMode === 'individual' ? (
            /* VISTA 1: LISTADO DE INDIVIDUOS */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredMembers.map((member) => {
                const isSelected = isMemberSelected(member);
                const br = (member as any).branch || getBranchForTeamName(member.team);
                return (
                  <button
                    key={member.id || member.email}
                    type="button"
                    onClick={() => handleMemberClick(member)}
                    className={cn(
                      "flex items-center gap-3.5 p-3.5 rounded-2xl border text-left transition-all group relative overflow-hidden active:scale-95",
                      isSelected 
                        ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-1 ring-indigo-500"
                        : "bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
                    )}
                  >
                    {/* Avatar Initials with Branch Color */}
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-colors shadow-sm",
                      isSelected 
                        ? "bg-indigo-600 text-white" 
                        : br === 'DELIVERY' 
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" 
                          : br === 'RECEIVER'
                            ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    )}>
                      {(member.name || member.email || 'U').slice(0, 2).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 justify-between">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {member.name}
                        </p>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold truncate mt-0.5">
                        {member.cargo || member.position}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {member.team && (
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            br === 'DELIVERY' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" :
                            br === 'RECEIVER' ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20" :
                            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          )}>
                            {member.team}
                          </span>
                        )}
                        {member.company && (
                          <span className="text-[8px] font-bold text-slate-400 uppercase truncate max-w-[120px]">
                            {member.company}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : filterMode === 'team' ? (
            /* VISTA 2: AGRUPADO POR EQUIPO */
            <div className="space-y-4">
              {Object.entries(membersByTeam).map(([teamName, teamMembersList]) => {
                const br = getBranchForTeamName(teamName);
                return (
                  <div key={teamName} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2.5 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Users className={cn(
                          "w-4 h-4",
                          br === 'DELIVERY' ? "text-amber-500" : br === 'RECEIVER' ? "text-purple-500" : "text-blue-500"
                        )} />
                        <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                          {teamName}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {teamMembersList.length} {teamMembersList.length === 1 ? 'integrante' : 'integrantes'}
                        </span>

                        {/* Botón para escoger todo el equipo (Líder asignado como responsable) */}
                        <button
                          type="button"
                          onClick={() => handleSelectEntireTeam(teamName, teamMembersList)}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 group border ml-1",
                            isTeamSelected(teamName, teamMembersList)
                              ? "bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-500/30"
                              : "bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                          )}
                          title={`Asignar a todo el equipo ${teamName} (Líder: ${resolveTeamLeader(teamName, teamMembersList)?.name})`}
                        >
                          <ShieldCheck className={cn("w-3.5 h-3.5 transition-transform group-hover:scale-110", isTeamSelected(teamName, teamMembersList) ? "text-white" : "text-indigo-600 dark:text-indigo-400")} />
                          <span>Escoger Todo el Equipo</span>
                          <span className={cn("text-[8px] font-semibold opacity-85 hidden sm:inline", isTeamSelected(teamName, teamMembersList) ? "text-indigo-100" : "text-indigo-600 dark:text-indigo-400")}>
                            (Líder: {resolveTeamLeader(teamName, teamMembersList)?.name?.split(' ')[0]})
                          </span>
                          {isTeamSelected(teamName, teamMembersList) && <Check className="w-3.5 h-3.5 ml-0.5 stroke-[3]" />}
                        </button>
                      </div>
                      <span className={cn(
                        "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                        br === 'DELIVERY' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                        br === 'RECEIVER' ? "bg-purple-500/10 text-purple-500 border border-purple-500/20" :
                        "bg-slate-200 dark:bg-slate-800 text-slate-600"
                      )}>
                        {br === 'DELIVERY' ? 'Equipo de Entrega' : br === 'RECEIVER' ? 'Equipo Receptor / Obra' : 'Equipo General'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {teamMembersList.map(member => {
                        const isSelected = isMemberSelected(member);
                        return (
                          <button
                            key={member.id || member.email}
                            type="button"
                            onClick={() => handleMemberClick(member)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                              isSelected 
                                ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 hover:border-slate-300"
                            )}
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {(member.name || 'U').slice(0, 1)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">{member.name}</p>
                              <p className="text-[9px] text-slate-400 truncate">{member.cargo || member.position}</p>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* VISTA 3: AGRUPADO POR EMPRESA */
            <div className="space-y-4">
              {Object.entries(membersByCompany).map(([companyName, companyMembersList]) => (
                <div key={companyName} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2.5 flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-emerald-500" />
                      <h4 className="text-xs font-black uppercase text-slate-900 dark:text-white tracking-wider">
                        {companyName}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {companyMembersList.length} {companyMembersList.length === 1 ? 'miembro' : 'miembros'}
                      </span>

                      {/* Botón para escoger toda la empresa (Administrador de empresa como responsable) */}
                      <button
                        type="button"
                        onClick={() => handleSelectEntireCompany(companyName, companyMembersList)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 group border ml-1",
                          isCompanySelected(companyName, companyMembersList)
                            ? "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/30"
                            : "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                        )}
                        title={`Asignar a toda la empresa ${companyName} (Admin: ${resolveCompanyAdmin(companyName, companyMembersList)?.name})`}
                      >
                        <Building2 className={cn("w-3.5 h-3.5 transition-transform group-hover:scale-110", isCompanySelected(companyName, companyMembersList) ? "text-white" : "text-emerald-600 dark:text-emerald-400")} />
                        <span>Escoger Toda la Empresa</span>
                        <span className={cn("text-[8px] font-semibold opacity-85 hidden sm:inline", isCompanySelected(companyName, companyMembersList) ? "text-emerald-100" : "text-emerald-600 dark:text-emerald-400")}>
                          (Admin: {resolveCompanyAdmin(companyName, companyMembersList)?.name?.split(' ')[0]})
                        </span>
                        {isCompanySelected(companyName, companyMembersList) && <Check className="w-3.5 h-3.5 ml-0.5 stroke-[3]" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {companyMembersList.map(member => {
                      const isSelected = isMemberSelected(member);
                      return (
                        <button
                          key={member.id || member.email}
                          type="button"
                          onClick={() => handleMemberClick(member)}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                            isSelected 
                              ? "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-850 hover:border-slate-300"
                          )}
                        >
                          <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {(member.name || 'U').slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-slate-900 dark:text-white truncate">{member.name}</p>
                            <p className="text-[9px] text-slate-400 truncate">{member.cargo || member.position}</p>
                            {member.team && (
                              <span className="text-[7.5px] font-bold text-slate-400 uppercase">
                                [{member.team}]
                              </span>
                            )}
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer (For Multiple Selection confirmation) */}
        {mode === 'multiple' && (
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              <span className="font-black text-indigo-600 dark:text-indigo-400">{tempSelected.length}</span> {tempSelected.length === 1 ? 'revisor seleccionado' : 'revisores seleccionados'}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMultiple}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
              >
                Confirmar Selección
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}
