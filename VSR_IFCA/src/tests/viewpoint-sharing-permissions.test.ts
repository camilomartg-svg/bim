import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';

// Mock storage
const storageStore: Record<string, string> = {};
let currentSessionUser: string | null = null;
const mockLocalStorage = {
    getItem: (key: string) => storageStore[key] || null,
    setItem: (key: string, val: string) => { storageStore[key] = val; },
    removeItem: (key: string) => { delete storageStore[key]; },
    clear: () => { for (const k in storageStore) delete storageStore[k]; }
};
const mockSessionStorage = {
    getItem: (key: string) => currentSessionUser,
    setItem: (key: string, val: string) => { currentSessionUser = val; },
    removeItem: (key: string) => { currentSessionUser = null; },
    clear: () => { currentSessionUser = null; }
};
(global as any).window = {
    localStorage: mockLocalStorage,
    sessionStorage: mockSessionStorage,
    alert: () => {},
    setInterval: (cb: any, ms: any) => setInterval(cb, ms),
    clearInterval: (id: any) => clearInterval(id),
    setTimeout: (cb: any, ms: any) => setTimeout(cb, ms),
    clearTimeout: (id: any) => clearTimeout(id),
    addEventListener: () => {},
    removeEventListener: () => {}
};
(global as any).document = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: { style: { cursor: '' } }
};
(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockSessionStorage;
(global as any).alert = () => {};

import { ViewpointsManager, ViewpointStateProvider, ViewpointData } from '../viewpoints-manager';
import { getUserEffectivePermissions } from '../securityUtils';

describe('Viewpoint Sharing ISO 19650 & Dimensions', () => {
    let mockComponents: any;
    let mockWorld: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockLocalStorage.clear();
        mockSessionStorage.clear();

        mockSessionStorage.setItem('userAccount', JSON.stringify({
            email: 'author@nora.com',
            username: 'author@nora.com'
        }));

        mockComponents = {
            get: vi.fn((cls) => {
                return {
                    world: null,
                    clear: vi.fn(),
                    highlightByID: vi.fn(),
                    selection: { select: {} },
                    list: new Set(),
                    lines: new Set()
                };
            })
        };

        mockWorld = {
            camera: {
                controls: {
                    getTarget: (v: any) => v.set(0, 0, 0),
                    setLookAt: vi.fn()
                },
                three: {
                    getWorldPosition: (v: any) => v.set(0, 0, 0),
                    position: new THREE.Vector3(0, 0, 0)
                },
                projection: {
                    current: 'Perspective'
                }
            }
        };
    });

    it('filters out users who do not have permission to view EN_PROGRESO status', async () => {
        const mockActiveProject = {
            fileVisibilityConfig: {},
            iso19650: {
                projectAdmins: ['author@nora.com'],
                deliveryTeams: [
                    { name: 'ARQUITECTURA', members: ['architect@nora.com'], leadEmail: 'architect@nora.com' }
                ],
                receiverTeams: [
                    { name: 'CLIENTE', members: ['client@nora.com'], leadEmail: 'client@nora.com' }
                ]
            },
            members: ['author@nora.com', 'architect@nora.com', 'client@nora.com']
        };

        const mockCompany = {
            members: [
                { email: 'author@nora.com', name: 'Author', role: 'ADMINISTRADOR' },
                { email: 'architect@nora.com', name: 'Architect', role: 'MEMBER' },
                { email: 'client@nora.com', name: 'Client', role: 'GUEST' }
            ]
        };

        // Client is in receiverTeams: by default canViewProgreso: false, canViewPublicado: true
        const clientPerms = getUserEffectivePermissions(
            { email: 'client@nora.com' },
            mockActiveProject,
            mockCompany,
            'company1'
        );
        expect(clientPerms.canViewProgreso).toBe(false);
        expect(clientPerms.canViewPublicado).toBe(true);

        // Architect is in deliveryTeams (task team): canViewProgreso: true
        const archPerms = getUserEffectivePermissions(
            { email: 'architect@nora.com' },
            mockActiveProject,
            mockCompany,
            'company1'
        );
        expect(archPerms.canViewProgreso).toBe(true);

        const provider: ViewpointStateProvider = {
            getMeasurements: () => [],
            restoreMeasurements: vi.fn(),
            getHiddenItems: () => ({}),
            restoreHiddenItems: vi.fn(),
            getClippingPlanes: () => [],
            restoreClippingPlanes: vi.fn(),
            getLoadedModels: () => [],
            restoreLoadedModels: vi.fn(),
            getCurrentStatus: () => 'EN_PROGRESO',
            getProjectUsers: () => [
                { id: 'architect@nora.com', name: 'Architect (architect@nora.com)', email: 'architect@nora.com' },
                { id: 'client@nora.com', name: 'Client (client@nora.com)', email: 'client@nora.com' }
            ],
            canUserAccessStatus: (userIdOrEmail: string, status: string) => {
                const email = userIdOrEmail.toLowerCase();
                if (email === 'client@nora.com' && status === 'EN_PROGRESO') {
                    return false;
                }
                return true;
            }
        };

        const manager = new ViewpointsManager(mockComponents, mockWorld, provider, 'test-project');
        
        // Save an EN_PROGRESO viewpoint
        await manager.saveViewpoint('Viga En Progreso');
        const viewpoints = (manager as any)._savedViewpoints as ViewpointData[];
        expect(viewpoints.length).toBe(1);
        expect(viewpoints[0].status).toBe('EN_PROGRESO');

        // Test permission check
        const canArchAccess = await provider.canUserAccessStatus!('architect@nora.com', viewpoints[0].status!);
        const canClientAccess = await provider.canUserAccessStatus!('client@nora.com', viewpoints[0].status!);

        expect(canArchAccess).toBe(true);
        expect(canClientAccess).toBe(false);
    });

    it('correctly serializes and restores linear dimension cotas (LengthMeasurement)', () => {
        const dummyLine = {
            start: { x: 1, y: 2, z: 3 },
            end: { x: 4, y: 5, z: 6 },
            units: 'm',
            rounding: 2
        };

        const measurerMock: any = {
            list: new Set([dummyLine])
        };

        const provider: ViewpointStateProvider = {
            getMeasurements: () => {
                const list: any[] = [];
                for (const line of measurerMock.list) {
                    list.push({
                        type: 'length_obf',
                        start: { x: line.start.x, y: line.start.y, z: line.start.z },
                        end: { x: line.end.x, y: line.end.y, z: line.end.z },
                        units: line.units,
                        rounding: line.rounding
                    });
                }
                return list;
            },
            restoreMeasurements: (data: any[]) => {
                measurerMock.list.clear();
                data.forEach(m => {
                    if (m.type === 'length_obf') {
                        measurerMock.list.add(m);
                    }
                });
            },
            getHiddenItems: () => ({}),
            restoreHiddenItems: vi.fn(),
            getClippingPlanes: () => [],
            restoreClippingPlanes: vi.fn(),
            getLoadedModels: () => [],
            restoreLoadedModels: vi.fn()
        };

        const saved = provider.getMeasurements();
        expect(saved.length).toBe(1);
        expect(saved[0].type).toBe('length_obf');
        expect(saved[0].start).toEqual({ x: 1, y: 2, z: 3 });
        expect(saved[0].end).toEqual({ x: 4, y: 5, z: 6 });

        measurerMock.list.clear();
        expect(measurerMock.list.size).toBe(0);

        provider.restoreMeasurements(saved);
        expect(measurerMock.list.size).toBe(1);
    });
});
