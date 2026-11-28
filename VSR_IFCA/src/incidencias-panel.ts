/**
 * IncidenciasPanel - Panel lateral derecho de incidencias para visores 3D de nora
 * Replica la lógica de roles (AUTOR, RESPONSABLE, REVISOR), estados, prioridades
 * y sincronización con Google Drive / LocalStorage del módulo principal de Incidencias.
 */

export interface Attachment {
  id: string;
  name: string;
  type: string;
  url: string;
  category: "file" | "image" | "video" | "audio" | "bim_model" | "bim_view" | "plan_pdf" | "plan_dwg";
  driveFileId?: string;
  webViewLink?: string;
  isLocalPending?: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Issue {
  id: string;
  code: string;
  title: string;
  type: string;
  degreeOfAction?: "inmediata" | "urgente" | "pronta" | "posterior" | "menor" | "mayor" | "critica" | "no_aplica";
  impact?: string[];
  description: string;
  status: "ACTIVO" | "RESPONDIDA" | "RESUELTA" | "VENCIDA" | "RECHAZADA" | "ACUERDO" | "ANULADA" | "REVISION_RESPONSABLE";
  specialty?: string;
  assignedPosition?: string;
  assignedName?: string;
  assignedEmail?: string;
  assignedTeam?: string;
  reviewers?: string[];
  reviewerEmails?: string[];
  creatorId?: string;
  creatorName?: string;
  creatorPosition?: string;
  creatorTeam?: string;
  authorEmail?: string;
  createdAt: string;
  updatedAt?: string;
  dueDate?: string;
  agreementDate?: string;
  rejectionReason?: string;
  attachments?: Attachment[];
  comments?: Comment[];
  redirectedTo?: {
    name: string;
    position: string;
    email: string;
    team?: string;
    at: string;
  };
  executor?: {
    name: string;
    position: string;
    email: string;
    team?: string;
    at: string;
    approved?: boolean;
    approvedAt?: string;
  };
}

export type RoleFilter = 'responsible' | 'author' | 'reviewer' | 'all';

export interface IncidenciasPanelOptions {
  container: HTMLElement;
  companyId?: string;
  projectId?: string;
  driveFolderName?: string;
  currentUser?: any;
  onLocateElement?: (issue: Issue) => void;
  onRestoreViewpoint?: (viewpointData: any) => void;
}

const DRIVE_GATEWAY_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

export class IncidenciasPanel {
  private container: HTMLElement;
  private companyId: string;
  private projectId: string;
  private driveFolderName: string;
  private currentUser: any;
  private issues: Issue[] = [];
  private activeRole: RoleFilter = 'responsible';
  private searchTerm: string = '';
  private statusFilter: string = 'all';
  private isLoading: boolean = false;
  private isSyncing: boolean = false;
  private syncChannel: BroadcastChannel | null = null;
  private onLocateElement?: (issue: Issue) => void;
  private onRestoreViewpoint?: (viewpointData: any) => void;

  constructor(options: IncidenciasPanelOptions) {
    this.container = options.container;
    this.companyId = options.companyId || '';
    this.projectId = options.projectId || '';
    this.driveFolderName = options.driveFolderName || '';
    this.currentUser = options.currentUser || this.resolveCurrentUser();
    this.onLocateElement = options.onLocateElement;
    this.onRestoreViewpoint = options.onRestoreViewpoint;

    this.resolveUrlContext();
    this.initBroadcastSync();
    this.loadFromLocalStorage();
    this.render();
  }

  public updateContext(companyId?: string, projectId?: string, driveFolderName?: string, user?: any) {
    if (companyId) this.companyId = companyId;
    if (projectId) this.projectId = projectId;
    if (driveFolderName) this.driveFolderName = driveFolderName;
    if (user) this.currentUser = user;
    this.loadFromLocalStorage();
    this.render();
  }

  private resolveUrlContext() {
    try {
      const params = new URLSearchParams(window.location.search);
      if (!this.companyId) this.companyId = params.get('empresa') || params.get('companyId') || '';
      if (!this.projectId) this.projectId = params.get('project') || params.get('projectId') || '';
      if (!this.driveFolderName) this.driveFolderName = params.get('driveFolderName') || params.get('projectName') || '';
    } catch (_) {}
  }

  private resolveCurrentUser(): any {
    try {
      const raw = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (_) {}
    return null;
  }

  private initBroadcastSync() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.syncChannel = new BroadcastChannel('nora_incidents_sync');
        this.syncChannel.onmessage = (event) => {
          if (event.data && (!event.data.companyId || event.data.companyId === this.companyId)) {
            if (Array.isArray(event.data.incidents)) {
              this.issues = event.data.incidents;
              this.render();
            }
          }
        };
      }

      window.addEventListener('nora_incidents_updated', (e: any) => {
        if (e.detail && Array.isArray(e.detail.incidents)) {
          this.issues = e.detail.incidents;
          this.render();
        } else {
          this.loadFromLocalStorage();
          this.render();
        }
      });
    } catch (err) {
      console.warn('[IncidenciasPanel] Sync channel init warning:', err);
    }
  }

  public loadFromLocalStorage() {
    if (!this.companyId || !this.projectId) {
      this.resolveUrlContext();
    }
    const key = `nora_incidents_${this.companyId}_${this.projectId}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.issues = parsed;
          return;
        }
      }
    } catch (_) {}

    // Fallback: search any nora_incidents_ key
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nora_incidents_')) {
          const raw = localStorage.getItem(k);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              this.issues = parsed;
              return;
            }
          }
        }
      }
    } catch (_) {}
  }

  public async syncWithDrive() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.render();

    try {
      const params = new URLSearchParams({
        action: 'listIncidents',
        companyId: this.companyId,
        projectId: this.projectId,
        driveFolderName: this.driveFolderName
      });

      const res = await fetch(`${DRIVE_GATEWAY_URL}?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.incidents)) {
          this.issues = data.incidents;
          const key = `nora_incidents_${this.companyId}_${this.projectId}`;
          try {
            localStorage.setItem(key, JSON.stringify(this.issues));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[IncidenciasPanel] Remote sync warning, using local cache:', err);
    } finally {
      this.isSyncing = false;
      this.render();
    }
  }

  private filterByRole(issue: Issue, role: RoleFilter): boolean {
    const user = this.currentUser;
    const userEmail = (user?.email || user?.username || '').toLowerCase().trim();
    const userName = (user?.name || '').toLowerCase().trim();
    const userPosUpper = (user?.position || '').trim().toUpperCase();

    if (role === 'all') return true;

    if (role === 'author') {
      const matchEmail = Boolean(userEmail && issue.authorEmail && issue.authorEmail.toLowerCase().trim() === userEmail);
      const matchId = Boolean(user?.id && issue.creatorId && issue.creatorId === user.id);
      const matchName = Boolean(userName && issue.creatorName && issue.creatorName.toLowerCase().trim() === userName);
      return matchEmail || matchId || matchName;
    }

    if (role === 'responsible') {
      const issuePosUpper = (issue.assignedPosition || '').trim().toUpperCase();
      const isDirDeObraUser = userPosUpper.includes('DIRECTOR DE OBRA');
      const isDirDeObraIssue = issuePosUpper.includes('DIRECTOR DE OBRA');

      const matchEmail = Boolean(userEmail && (
        (issue.assignedEmail && issue.assignedEmail.toLowerCase().trim() === userEmail) ||
        (issue.redirectedTo?.email && issue.redirectedTo.email.toLowerCase().trim() === userEmail) ||
        (issue.executor?.email && issue.executor.email.toLowerCase().trim() === userEmail)
      ));

      const matchPos = Boolean(userPosUpper && issuePosUpper === userPosUpper) || (isDirDeObraUser && isDirDeObraIssue);
      const matchName = Boolean(userName && issue.assignedName && issue.assignedName.toLowerCase().trim() === userName);

      return matchEmail || matchPos || matchName;
    }

    if (role === 'reviewer') {
      const matchReviewerEmail = Boolean(userEmail && issue.reviewerEmails && issue.reviewerEmails.some(e => e.toLowerCase().trim() === userEmail));
      const matchReviewerList = Boolean(Array.isArray(issue.reviewers) && issue.reviewers.some(r => {
        const rLower = (r || '').toLowerCase().trim();
        return (userEmail && rLower === userEmail) || (userPosUpper && r.toUpperCase() === userPosUpper);
      }));

      return matchReviewerEmail || matchReviewerList;
    }

    return true;
  }

  private getCounts(): Record<RoleFilter, number> {
    const counts: Record<RoleFilter, number> = {
      responsible: 0,
      author: 0,
      reviewer: 0,
      all: 0
    };

    for (const issue of this.issues) {
      if (issue.status === 'ANULADA') continue;
      counts.all++;
      if (this.filterByRole(issue, 'responsible')) counts.responsible++;
      if (this.filterByRole(issue, 'author')) counts.author++;
      if (this.filterByRole(issue, 'reviewer')) counts.reviewer++;
    }

    return counts;
  }

  private getFilteredIssues(): Issue[] {
    const q = this.searchTerm.toLowerCase().trim();
    return this.issues.filter(issue => {
      if (issue.status === 'ANULADA' && this.statusFilter !== 'ANULADA') return false;

      if (!this.filterByRole(issue, this.activeRole)) return false;

      if (this.statusFilter !== 'all') {
        if (this.statusFilter === 'ACTIVAS') {
          if (issue.status !== 'ACTIVO' && issue.status !== 'RESPONDIDA' && issue.status !== 'REVISION_RESPONSABLE') return false;
        } else if (issue.status !== this.statusFilter) {
          return false;
        }
      }

      if (q) {
        const codeMatch = issue.code?.toLowerCase().includes(q);
        const titleMatch = issue.title?.toLowerCase().includes(q);
        const descMatch = (issue.description || '').toLowerCase().includes(q);
        const specMatch = (issue.specialty || '').toLowerCase().includes(q);
        const posMatch = (issue.assignedPosition || '').toLowerCase().includes(q);
        const nameMatch = (issue.assignedName || '').toLowerCase().includes(q);
        if (!codeMatch && !titleMatch && !descMatch && !specMatch && !posMatch && !nameMatch) {
          return false;
        }
      }

      return true;
    });
  }

  private formatDate(isoString?: string): string {
    if (!isoString) return '--/--';
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    } catch (_) {
      return isoString;
    }
  }

  private formatDueDate(dueStr?: string): { text: string; colorClass: string; icon: string } {
    if (!dueStr) return { text: 'SIN VENCIMIENTO', colorClass: 'text-slate', icon: 'event' };
    try {
      const due = new Date(dueStr);
      if (isNaN(due.getTime())) return { text: dueStr, colorClass: 'text-slate', icon: 'event' };
      const now = new Date();
      const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const day = String(due.getDate()).padStart(2, '0');
      const month = String(due.getMonth() + 1).padStart(2, '0');
      const year = String(due.getFullYear()).slice(-2);

      if (diffDays < 0) {
        return { text: `VENCE ${day}/${month}/${year} (VENCIDA)`, colorClass: 'text-danger', icon: 'error' };
      } else if (diffDays <= 2) {
        return { text: `VENCE ${day}/${month}/${year} (${diffDays}d)`, colorClass: 'text-warning', icon: 'schedule' };
      } else {
        return { text: `VENCE ${day}/${month}/${year}`, colorClass: 'text-success', icon: 'check_circle' };
      }
    } catch (_) {
      return { text: dueStr, colorClass: 'text-slate', icon: 'event' };
    }
  }

  private getDegreeBadge(degree?: string): { label: string; dotColor: string; textColor: string } {
    const d = (degree || '').toLowerCase();
    switch (d) {
      case 'inmediata':
      case 'critica':
        return { label: 'INMEDIATA', dotColor: '#ef4444', textColor: '#dc2626' };
      case 'urgente':
      case 'mayor':
        return { label: 'URGENTE', dotColor: '#f59e0b', textColor: '#d97706' };
      case 'pronta':
        return { label: 'PRONTA', dotColor: '#3b82f6', textColor: '#2563eb' };
      case 'posterior':
      case 'menor':
        return { label: 'POSTERIOR', dotColor: '#10b981', textColor: '#059669' };
      default:
        return { label: (degree || 'NORMAL').toUpperCase(), dotColor: '#94a3b8', textColor: '#64748b' };
    }
  }

  private getStatusBadge(status?: string): { label: string; bg: string; text: string; border: string } {
    switch (status) {
      case 'ACTIVO':
        return { label: 'ACTIVO', bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' };
      case 'RESPONDIDA':
      case 'REVISION_RESPONSABLE':
        return { label: 'RESPONDIDA', bg: '#fef3c7', text: '#b45309', border: '#fde68a' };
      case 'RESUELTA':
        return { label: 'RESUELTA', bg: '#dcfce7', text: '#15803d', border: '#bbf7d0' };
      case 'VENCIDA':
        return { label: 'VENCIDA', bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' };
      case 'RECHAZADA':
        return { label: 'RECHAZADA', bg: '#f3e8ff', text: '#6b21a8', border: '#e9d5ff' };
      case 'ACUERDO':
        return { label: 'ACUERDO', bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' };
      case 'ANULADA':
        return { label: 'ANULADA', bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
      default:
        return { label: status || 'ACTIVO', bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
    }
  }

  public render() {
    if (!this.container) return;

    const counts = this.getCounts();
    const filtered = this.getFilteredIssues();

    this.container.innerHTML = `
      <div class="nora-inc-panel">
        <!-- Header -->
        <div class="nora-inc-header">
          <div class="nora-inc-title-row">
            <div class="nora-inc-title">
              <span class="material-symbols-outlined" style="color: #f59e0b; font-size: 20px;">assignment_late</span>
              <span>Incidencias</span>
            </div>
            <div class="nora-inc-actions">
              <button class="nora-inc-btn-icon ${this.isSyncing ? 'spinning' : ''}" id="btn-inc-sync" title="Sincronizar con Drive">
                <span class="material-symbols-outlined" style="font-size: 17px;">sync</span>
              </button>
              <a href="../INCIDENCIAS/?empresa=${encodeURIComponent(this.companyId)}&project=${encodeURIComponent(this.projectId)}&driveFolderName=${encodeURIComponent(this.driveFolderName)}&action=new" 
                 target="_blank" 
                 class="nora-inc-new-btn" 
                 title="Registrar nuevo hallazgo en Incidencias">
                <span class="material-symbols-outlined" style="font-size: 16px;">add</span>
                <span>Hallazgo</span>
              </a>
            </div>
          </div>

          <!-- Role Subtabs (AUTOR | RESPONSABLE | REVISOR | TODAS) -->
          <div class="nora-inc-role-tabs">
            <button class="nora-inc-role-tab ${this.activeRole === 'responsible' ? 'active' : ''}" data-role="responsible">
              <span>RESPONSABLE</span>
              <span class="nora-inc-tab-badge">${counts.responsible}</span>
            </button>
            <button class="nora-inc-role-tab ${this.activeRole === 'author' ? 'active' : ''}" data-role="author">
              <span>AUTOR</span>
              <span class="nora-inc-tab-badge">${counts.author}</span>
            </button>
            <button class="nora-inc-role-tab ${this.activeRole === 'reviewer' ? 'active' : ''}" data-role="reviewer">
              <span>REVISOR</span>
              <span class="nora-inc-tab-badge">${counts.reviewer}</span>
            </button>
            <button class="nora-inc-role-tab ${this.activeRole === 'all' ? 'active' : ''}" data-role="all" title="Ver todas las incidencias">
              <span>TODAS</span>
              <span class="nora-inc-tab-badge">${counts.all}</span>
            </button>
          </div>

          <!-- Search and Filter bar -->
          <div class="nora-inc-search-bar">
            <div class="nora-inc-input-wrapper">
              <span class="material-symbols-outlined" style="font-size: 17px; color: #94a3b8;">search</span>
              <input type="text" id="nora-inc-search" placeholder="Buscar código, título, especialidad..." value="${escapeHtml(this.searchTerm)}" />
              ${this.searchTerm ? `<button type="button" id="nora-inc-clear-search" class="nora-inc-clear-btn">✕</button>` : ''}
            </div>
            <select id="nora-inc-status-select" class="nora-inc-select">
              <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>Todos los estados</option>
              <option value="ACTIVAS" ${this.statusFilter === 'ACTIVAS' ? 'selected' : ''}>Solo Activas</option>
              <option value="ACTIVO" ${this.statusFilter === 'ACTIVO' ? 'selected' : ''}>Activo</option>
              <option value="RESPONDIDA" ${this.statusFilter === 'RESPONDIDA' ? 'selected' : ''}>Respondida</option>
              <option value="RESUELTA" ${this.statusFilter === 'RESUELTA' ? 'selected' : ''}>Resuelta</option>
              <option value="VENCIDA" ${this.statusFilter === 'VENCIDA' ? 'selected' : ''}>Vencida</option>
              <option value="RECHAZADA" ${this.statusFilter === 'RECHAZADA' ? 'selected' : ''}>Rechazada</option>
              <option value="ACUERDO" ${this.statusFilter === 'ACUERDO' ? 'selected' : ''}>Acuerdo</option>
            </select>
          </div>
        </div>

        <!-- Issue Cards List -->
        <div class="nora-inc-list" id="nora-inc-list-container">
          ${filtered.length === 0 ? this.renderEmptyState() : filtered.map(issue => this.renderIssueCard(issue)).join('')}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private renderEmptyState(): string {
    const roleNames: Record<RoleFilter, string> = {
      responsible: 'como Responsable',
      author: 'como Autor',
      reviewer: 'como Revisor',
      all: 'en este proyecto'
    };

    return `
      <div class="nora-inc-empty">
        <div class="nora-inc-empty-icon">
          <span class="material-symbols-outlined" style="font-size: 40px; color: #94a3b8;">assignment_turned_in</span>
        </div>
        <div class="nora-inc-empty-title">Sin incidencias ${roleNames[this.activeRole]}</div>
        <div class="nora-inc-empty-desc">
          ${this.searchTerm || this.statusFilter !== 'all' 
            ? 'No hay registros que coincidan con los filtros de búsqueda aplicados.' 
            : 'No tienes incidencias pendientes asociadas bajo este rol en este momento.'}
        </div>
        <button type="button" class="nora-inc-refresh-btn" id="btn-inc-empty-refresh">
          <span class="material-symbols-outlined" style="font-size: 16px;">refresh</span>
          <span>Actualizar datos</span>
        </button>
      </div>
    `;
  }

  private renderIssueCard(issue: Issue): string {
    const statusB = this.getStatusBadge(issue.status);
    const degreeB = this.getDegreeBadge(issue.degreeOfAction);
    const dueInfo = this.formatDueDate(issue.dueDate);
    const createdStr = this.formatDate(issue.createdAt);
    const attCount = issue.attachments?.length || 0;
    const cmtCount = issue.comments?.length || 0;

    // Specialty / process name
    const processOrSpec = issue.specialty || issue.assignedTeam || 'PROCESO AUDITADO';

    // Direct link to the incident
    const openUrl = `../INCIDENCIAS/?empresa=${encodeURIComponent(this.companyId)}&project=${encodeURIComponent(this.projectId)}&driveFolderName=${encodeURIComponent(this.driveFolderName)}&issueId=${encodeURIComponent(issue.id)}`;

    return `
      <div class="nora-inc-card" data-issue-id="${escapeHtml(issue.id)}">
        <!-- Top Tags Row -->
        <div class="nora-inc-card-tags">
          <div class="nora-inc-code-badge" title="Código de incidencia">${escapeHtml(issue.code || 'GEN')}</div>
          
          <div class="nora-inc-status-badge" style="background: ${statusB.bg}; color: ${statusB.text}; border-color: ${statusB.border};">
            ${escapeHtml(statusB.label)}
          </div>

          ${issue.type ? `
            <div class="nora-inc-type-badge" title="${escapeHtml(issue.type)}">
              ${escapeHtml(issue.type)}
            </div>
          ` : ''}

          <div class="nora-inc-degree-badge" style="color: ${degreeB.textColor};" title="Grado de acción: ${escapeHtml(degreeB.label)}">
            <span class="nora-inc-dot" style="background: ${degreeB.dotColor};"></span>
            <span>${escapeHtml(degreeB.label)}</span>
          </div>
        </div>

        <!-- Title -->
        <div class="nora-inc-card-title">${escapeHtml(issue.title || 'Incidencia sin título')}</div>

        <!-- Description Snippet -->
        ${issue.description ? `
          <div class="nora-inc-card-desc">${escapeHtml(issue.description)}</div>
        ` : ''}

        <!-- Meta Information -->
        <div class="nora-inc-card-meta">
          <div class="nora-inc-meta-item">
            <span class="material-symbols-outlined" style="font-size: 15px; color: #64748b;">person</span>
            <div class="nora-inc-meta-text">
              <span class="nora-inc-meta-label">${escapeHtml(issue.assignedName || issue.assignedPosition || 'Sin asignar')}</span>
              <span class="nora-inc-meta-sub">${escapeHtml(processOrSpec)}</span>
            </div>
          </div>

          <div class="nora-inc-meta-row-times">
            <div class="nora-inc-time-chip" title="Fecha de creación">
              <span class="material-symbols-outlined" style="font-size: 14px;">schedule</span>
              <span>${createdStr}</span>
            </div>
            
            <div class="nora-inc-time-chip ${dueInfo.colorClass}" title="${dueInfo.text}">
              <span class="material-symbols-outlined" style="font-size: 14px;">${dueInfo.icon}</span>
              <span>${dueInfo.text}</span>
            </div>
          </div>
        </div>

        <!-- Footer Actions & Evidence counts -->
        <div class="nora-inc-card-footer">
          <div class="nora-inc-evidence-counts">
            ${attCount > 0 ? `
              <span class="nora-inc-count-pill" title="${attCount} adjuntos (fotos/videos/archivos)">
                <span class="material-symbols-outlined" style="font-size: 13px;">attach_file</span>
                <span>${attCount}</span>
              </span>
            ` : ''}
            ${cmtCount > 0 ? `
              <span class="nora-inc-count-pill" title="${cmtCount} notas o mensajes en chat">
                <span class="material-symbols-outlined" style="font-size: 13px;">chat</span>
                <span>${cmtCount}</span>
              </span>
            ` : ''}
          </div>

          <div class="nora-inc-card-btns">
            <a href="${openUrl}" target="_blank" class="nora-inc-open-btn" title="Abrir y gestionar en módulo de Incidencias">
              <span>Abrir en Incidencias</span>
              <span class="material-symbols-outlined" style="font-size: 14px;">open_in_new</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  private bindEvents() {
    // Role tabs
    const roleTabs = this.container.querySelectorAll<HTMLButtonElement>('.nora-inc-role-tab');
    roleTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const role = tab.getAttribute('data-role') as RoleFilter;
        if (role && this.activeRole !== role) {
          this.activeRole = role;
          this.render();
        }
      });
    });

    // Search input
    const searchInput = this.container.querySelector<HTMLInputElement>('#nora-inc-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        const list = this.container.querySelector('#nora-inc-list-container');
        if (list) {
          const filtered = this.getFilteredIssues();
          list.innerHTML = filtered.length === 0 ? this.renderEmptyState() : filtered.map(i => this.renderIssueCard(i)).join('');
          this.bindCardEvents();
        }
      });
    }

    // Clear search
    const clearBtn = this.container.querySelector<HTMLButtonElement>('#nora-inc-clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.searchTerm = '';
        this.render();
      });
    }

    // Status filter select
    const statusSelect = this.container.querySelector<HTMLSelectElement>('#nora-inc-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = (e.target as HTMLSelectElement).value;
        this.render();
      });
    }

    // Sync button
    const syncBtn = this.container.querySelector<HTMLButtonElement>('#btn-inc-sync');
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.syncWithDrive();
      });
    }

    // Refresh button in empty state
    const emptyRefresh = this.container.querySelector<HTMLButtonElement>('#btn-inc-empty-refresh');
    if (emptyRefresh) {
      emptyRefresh.addEventListener('click', () => {
        this.syncWithDrive();
      });
    }

    this.bindCardEvents();
  }

  private bindCardEvents() {
    // Card clicks or action handlers
  }
}

function escapeHtml(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
