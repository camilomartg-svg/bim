import { ViewpointsManager } from '../viewpoints-manager';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Setup Mock Storage globally for Node
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

const mockWindow = {
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

const mockDocument = {
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    body: {
        style: {
            cursor: ''
        }
    }
};

(global as any).window = mockWindow;
(global as any).document = mockDocument;
(global as any).localStorage = mockLocalStorage;
(global as any).sessionStorage = mockSessionStorage;
(global as any).alert = () => {};

// Mock Dependencies
const mockComponents = {
    get: () => {
        return {
            world: {},
            highlightByID: () => {},
            clear: () => {},
            selection: {
                select: {}
            }
        };
    }
} as any;

const mockWorld = {
    camera: {
        three: {
            getWorldPosition: (v: any) => v.set(0, 0, 0)
        },
        controls: {
            getTarget: (v: any) => v.set(0, 0, 0),
            setLookAt: async () => {}
        }
    }
} as any;

describe('Viewpoint Auth & Privacy', () => {
    beforeEach(() => {
        // Clear stores before each test
        for (const k in storageStore) {
            delete storageStore[k];
        }
        currentSessionUser = null;
    });

    it('should save User A view to the correct partition', async () => {
        currentSessionUser = JSON.stringify({ username: 'userA@test.com', name: 'User A' });
        const managerA = new ViewpointsManager(mockComponents, mockWorld);
        (managerA as any).initializeUser();
        (managerA as any).loadFromStorage();

        await managerA.saveViewpoint('View A');

        const keyA = 'vsr-ifc-viewpoints-userA@test.com';
        expect(storageStore[keyA]).toBeDefined();
        const views = JSON.parse(storageStore[keyA]);
        expect(views.length).toBe(1);
        expect(views[0].title).toBe('View A');
    });

    it('should NOT allow User B to see User A views (Privacy Isolation)', async () => {
        // First save User A view
        storageStore['vsr-ifc-viewpoints-userA@test.com'] = JSON.stringify([
            { id: '1', title: 'View A', creator: 'userA@test.com', camera: { position: [0,0,0], target: [0,0,0] } }
        ]);

        currentSessionUser = JSON.stringify({ username: 'userB@test.com', name: 'User B' });
        const managerB = new ViewpointsManager(mockComponents, mockWorld);
        (managerB as any).initializeUser();
        (managerB as any).loadFromStorage();

        expect((managerB as any)._savedViewpoints.length).toBe(0);
    });

    it('should save User B view to the correct partition', async () => {
        currentSessionUser = JSON.stringify({ username: 'userB@test.com', name: 'User B' });
        const managerB = new ViewpointsManager(mockComponents, mockWorld);
        (managerB as any).initializeUser();
        (managerB as any).loadFromStorage();

        await managerB.saveViewpoint('View B');

        const keyB = 'vsr-ifc-viewpoints-userB@test.com';
        expect(storageStore[keyB]).toBeDefined();
        const views = JSON.parse(storageStore[keyB]);
        expect(views.length).toBe(1);
        expect(views[0].title).toBe('View B');
    });

    it('should block User B from accessing User A private view', async () => {
        const viewA = { id: 'viewA-123', title: 'View A', creator: 'userA@test.com', camera: { position: [0,0,0], target: [0,0,0] } };
        storageStore['vsr-ifc-viewpoints-userA@test.com'] = JSON.stringify([viewA]);

        currentSessionUser = JSON.stringify({ username: 'userB@test.com', name: 'User B' });
        const managerB = new ViewpointsManager(mockComponents, mockWorld);
        (managerB as any).initializeUser();
        (managerB as any).loadFromStorage();

        // Inject View A into Manager B
        (managerB as any)._savedViewpoints.push(viewA);

        const alertSpy = vi.spyOn(global, 'alert').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await managerB.restoreViewpoint(viewA.id);

        expect(errorSpy).toHaveBeenCalled();
        expect(errorSpy.mock.calls[0][0]).toContain('403');

        alertSpy.mockRestore();
        errorSpy.mockRestore();
    });
});
