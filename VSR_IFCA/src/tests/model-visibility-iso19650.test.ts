import { describe, it, expect } from 'vitest';
import {
  normalizeTeamName,
  getTeamVisibilityRule,
  getUserEffectivePermissions,
  getStatusMatchesForFile,
  isUserAuthorizedForFile
} from '../securityUtils';

describe('Model Lifecycle & Team Visibility (ISO 19650)', () => {
  const dummyProject = {
    slug: 'proyecto-test',
    members: ['miembro@test.com'],
    iso19650: {
      projectAdmins: ['admin.proy@test.com'],
      deliveryTeams: [
        {
          name: 'ARQUITECTURA',
          leadEmail: 'lead.arq@test.com',
          members: ['lead.arq@test.com', 'arq1@test.com']
        },
        {
          name: 'ESTRUCTURA',
          leadEmail: 'lead.est@test.com',
          members: ['lead.est@test.com', 'est1@test.com']
        }
      ],
      receiverTeams: [
        {
          name: 'EQUIPO RECEPTOR / OBRA',
          leadEmail: 'director.obra@test.com',
          members: ['director.obra@test.com', 'inspector@test.com']
        }
      ]
    },
    fileVisibilityConfig: {
      'receiver:EQUIPO RECEPTOR / OBRA': {
        canViewProgreso: false,
        canViewCompartido: false,
        canViewPublicado: true
      }
    }
  };

  it('normalizes team names correctly removing accents and converting to upper case', () => {
    expect(normalizeTeamName('Equipo de Instalación')).toBe('EQUIPO DE INSTALACION');
    expect(normalizeTeamName('  Arquitectura ')).toBe('ARQUITECTURA');
  });

  it('resolves default ISO 19650 team visibility rules correctly', () => {
    const taskRule = getTeamVisibilityRule('task', 'ARQUITECTURA', dummyProject);
    expect(taskRule.canViewProgreso).toBe(true);
    expect(taskRule.canViewCompartido).toBe(true);
    expect(taskRule.canViewPublicado).toBe(true);

    const receiverRule = getTeamVisibilityRule('receiver', 'EQUIPO RECEPTOR / OBRA', dummyProject);
    expect(receiverRule.canViewProgreso).toBe(false);
    expect(receiverRule.canViewCompartido).toBe(false);
    expect(receiverRule.canViewPublicado).toBe(true);
  });

  it('calculates effective permissions for different roles', () => {
    // 1. Super Admin
    const superAdminUser = { email: 'imagina3ddesign@gmail.com' };
    const superPerms = getUserEffectivePermissions(superAdminUser, dummyProject, null, '');
    expect(superPerms.canViewProgreso).toBe(true);
    expect(superPerms.canViewCompartido).toBe(true);
    expect(superPerms.canViewPublicado).toBe(true);
    expect(superPerms.isAdmin).toBe(true);

    // 2. Project Admin
    const projAdminUser = { email: 'admin.proy@test.com' };
    const projPerms = getUserEffectivePermissions(projAdminUser, dummyProject, null, '');
    expect(projPerms.isAdmin).toBe(true);
    expect(projPerms.canViewProgreso).toBe(true);

    // 3. Task team member (Arquitectura)
    const taskUser = { email: 'arq1@test.com' };
    const taskPerms = getUserEffectivePermissions(taskUser, dummyProject, null, '');
    expect(taskPerms.isAdmin).toBe(false);
    expect(taskPerms.canViewProgreso).toBe(true);
    expect(taskPerms.canViewCompartido).toBe(true);
    expect(taskPerms.canViewPublicado).toBe(true);

    // 4. Receiver team member (Obra)
    const receiverUser = { email: 'inspector@test.com' };
    const recvPerms = getUserEffectivePermissions(receiverUser, dummyProject, null, '');
    expect(recvPerms.isAdmin).toBe(false);
    expect(recvPerms.canViewProgreso).toBe(false);
    expect(recvPerms.canViewCompartido).toBe(false);
    expect(recvPerms.canViewPublicado).toBe(true);
  });

  it('matches file lifecycle status correctly from status entries', () => {
    const entries = [
      {
        originalFileId: 'fid-123',
        filename: 'ARQUITECTURA.frag',
        status: 'EN_PROGRESO',
        changedAt: '2026-11-01T10:00:00Z',
        deliveryTeams: ['ARQUITECTURA']
      },
      {
        originalFileId: 'fid-123',
        filename: 'ARQUITECTURA.frag',
        status: 'COMPARTIDO',
        changedAt: '2026-11-05T12:00:00Z',
        deliveryTeams: ['ARQUITECTURA']
      },
      {
        originalFileId: 'fid-123',
        filename: 'ARQUITECTURA.frag',
        status: 'PUBLICADO',
        changedAt: '2026-11-08T15:00:00Z',
        deliveryTeams: ['ARQUITECTURA']
      }
    ];

    const matches = getStatusMatchesForFile('fid-123', 'ARQUITECTURA.frag', entries);
    expect(matches.EN_PROGRESO).not.toBeNull();
    expect(matches.COMPARTIDO).not.toBeNull();
    expect(matches.PUBLICADO).not.toBeNull();
    expect(matches.PUBLICADO.status).toBe('PUBLICADO');
  });

  it('authorizes receiver team members ONLY for PUBLICADO models', () => {
    const receiverUser = { email: 'inspector@test.com' };

    const modelProgreso = {
      name: 'ESTRUCTURAL.frag',
      fileId: 'fid-est',
      status: 'EN_PROGRESO',
      folder: 'Estructura',
      deliveryTeams: ['ESTRUCTURA']
    };

    const modelCompartido = {
      name: 'ESTRUCTURAL.frag',
      fileId: 'fid-est',
      status: 'COMPARTIDO',
      folder: 'Estructura',
      deliveryTeams: ['ESTRUCTURA']
    };

    const modelPublicado = {
      name: 'ESTRUCTURAL.frag',
      fileId: 'fid-est',
      status: 'PUBLICADO',
      folder: 'Estructura',
      deliveryTeams: ['ESTRUCTURA']
    };

    expect(isUserAuthorizedForFile(receiverUser, modelProgreso, dummyProject, null, '')).toBe(false);
    expect(isUserAuthorizedForFile(receiverUser, modelCompartido, dummyProject, null, '')).toBe(false);
    expect(isUserAuthorizedForFile(receiverUser, modelPublicado, dummyProject, null, '')).toBe(true);
  });
});
