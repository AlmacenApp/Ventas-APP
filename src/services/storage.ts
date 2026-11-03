import { AppState, Product, User, Client } from '../types';
import { sortProductsNatural, sortClientsNatural } from '../utils/sorting';

export const STORE_KEY = 'venta-clara-data-v1';

export const DEFAULT_ADMIN: User = {
  id: 'admin',
  username: 'admin',
  pin: '1234',
  role: 'admin',
  zone: '',
};

export const SEED_PRODUCTS: Product[] = [
  { id: 'p1', code: 'ART-001', name: 'Café de origen', description: 'Café de origen tostado medio 1 lb', unit: 'Funda', category: 'Funda', price: 295.0, taxRate: 0, stock: 24, cost: 180 },
  { id: 'p2', code: 'ART-002', name: 'Taza artesanal', description: 'Taza artesanal de cerámica 12 oz', unit: 'Unidad', category: 'Unidad', price: 350.0, taxRate: 18, stock: 12, cost: 190 },
  { id: 'p3', code: 'ART-003', name: 'Bolsa de algodón', description: 'Bolsa de algodón reutilizable premium', unit: 'Unidad', category: 'Unidad', price: 180.0, taxRate: 18, stock: 31, cost: 95 },
  { id: 'p4', code: 'ART-004', name: 'Cuaderno botánico', description: 'Cuaderno botánico pasta dura hojas punteadas', unit: 'Unidad', category: 'Unidad', price: 420.0, taxRate: 18, stock: 8, cost: 230 },
  { id: 'p5', code: 'ART-005', name: 'Vela de cedro', description: 'Vela aromática de cera de soja con cedro', unit: 'Unidad', category: 'Unidad', price: 580.0, taxRate: 18, stock: 16, cost: 310 },
  { id: 'p6', code: 'ART-006', name: 'Té de jazmín', description: 'Té de jazmín hojas sueltas 100g', unit: 'Caja', category: 'Caja', price: 240.0, taxRate: 0, stock: 19, cost: 130 },
  { id: 'p7', code: 'ART-007', name: 'Lámina ilustrada', description: 'Lámina ilustrada botánica A4', unit: 'Unidad', category: 'Unidad', price: 390.0, taxRate: 18, stock: 5, cost: 160 },
  { id: 'p8', code: 'ART-008', name: 'Estuche de lino', description: 'Estuche multiuso de lino natural', unit: 'Unidad', category: 'Unidad', price: 310.0, taxRate: 18, stock: 0, cost: 150 },
  { id: 'p9', code: 'ART-009', name: 'Jabón de avena', description: 'Jabón artesanal exfoliante de avena y miel', unit: 'Unidad', category: 'Unidad', price: 160.0, taxRate: 18, stock: 27, cost: 75 },
];

export const INITIAL_CLIENTS = [
  {
    id: 'c1',
    code: 'CLI-001',
    company: 'Distribuidora del Caribe SRL',
    zone: 'Zona:01',
    address: 'Av. Winston Churchill #45, Piantini, Santo Domingo',
    phone: '809-555-0142',
  },
  {
    id: 'c2',
    code: 'CLI-002',
    company: 'Comercial Quisqueyana SAS',
    zone: 'Zona:02',
    address: 'Calle El Sol #120, Santiago de los Caballeros',
    phone: '809-582-9900',
  },
  {
    id: 'c3',
    code: 'CLI-003',
    company: 'Gourmet Market RD',
    zone: 'Zona:01',
    address: 'Av. Roberto Pastoriza #210, Naco, Santo Domingo',
    phone: '809-567-3321',
  },
];

export function loadState(): AppState {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.orders)) {
        const users: User[] = Array.isArray(parsed.users) ? parsed.users : [DEFAULT_ADMIN];
        if (!users.some((u) => u.role === 'admin')) {
          users.unshift(DEFAULT_ADMIN);
        }

        const loadedProducts: Product[] = sortProductsNatural(
          parsed.products.map((p: any, i: number): Product => ({
            id: p.id || `p-${Date.now()}-${i}`,
            code: p.code || 'ART-' + String(i + 1).padStart(3, '0'),
            description: p.description || p.name || '',
            name: p.description || p.name || '',
            unit: p.unit || 'Unidad',
            category: p.category || p.unit || 'Unidad',
            taxRate: Number(p.taxRate) || 0,
            price: Number(p.price) || 0,
            stock: Number.isInteger(Number(p.stock)) ? Number(p.stock) : 0,
            cost: Number.isFinite(Number(p.cost)) ? Number(p.cost) : 0,
          }))
        );

        const loadedClients: Client[] = sortClientsNatural(
          (Array.isArray(parsed.clients) && parsed.clients.length > 0 ? parsed.clients : INITIAL_CLIENTS)
            .map((c: any, i: number): Client => ({
              id: c.id || `c-${Date.now()}-${i}`,
              code: c.code || `CLI-${String(i + 1).padStart(3, '0')}`,
              company: c.company || '',
              zone: c.zone || 'Zona:01',
              address: c.address || '',
              phone: c.phone || '',
            }))
        );

        return {
          products: loadedProducts,
          orders: parsed.orders || [],
          clients: loadedClients,
          users,
          currentUserId: getActiveSessionUserId(),
        };
      }
    }
  } catch (e) {
    console.warn('No se pudo leer el almacenamiento local:', e);
  }

  const sortedSeedProducts = sortProductsNatural([...SEED_PRODUCTS]);

  const sortedSeedClients = sortClientsNatural([...INITIAL_CLIENTS]);

  return {
    products: sortedSeedProducts,
    orders: [],
    clients: sortedSeedClients,
    users: [DEFAULT_ADMIN],
    currentUserId: getActiveSessionUserId(),
  };
}

export const SESSION_USER_KEY = 'venta-clara-session-user';
export const LAST_ACTIVITY_KEY = 'venta-clara-last-activity';
export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos de inactividad

export function getActiveSessionUserId(): string {
  try {
    const sessionUserId = sessionStorage.getItem(SESSION_USER_KEY);
    if (!sessionUserId) return '';

    const lastActiveStr = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (!isNaN(lastActive) && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
        // Expirado por inactividad
        sessionStorage.removeItem(SESSION_USER_KEY);
        return '';
      }
    }
    return sessionUserId;
  } catch {
    return '';
  }
}

export function setActiveSession(userId: string): void {
  try {
    if (userId) {
      sessionStorage.setItem(SESSION_USER_KEY, userId);
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    } else {
      sessionStorage.removeItem(SESSION_USER_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
    }
  } catch (e) {
    console.warn('Error gestionando sesión:', e);
  }
}

export function recordActivity(): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  } catch {
    // Ignore error
  }
}

export function checkSessionExpired(): boolean {
  try {
    const sessionUserId = sessionStorage.getItem(SESSION_USER_KEY);
    if (!sessionUserId) return false;
    const lastActiveStr = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (!isNaN(lastActive) && Date.now() - lastActive > INACTIVITY_TIMEOUT_MS) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export function saveState(state: AppState): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error('Error al guardar estado:', e);
    return false;
  }
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat('es-DO', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function generateOrderId(orders: { id: string }[]): string {
  const d = new Date();
  const stamp = [
    String(d.getFullYear()).slice(-2),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('');
  const prefix = `VI-${stamp}-`;
  const legacyPrefix = `VC-${stamp}-`;
  const seq =
    orders.filter((o) => o.id.startsWith(prefix) || o.id.startsWith(legacyPrefix)).length + 1;
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

export const ADMIN_PHONE_KEY = 'vi_admin_whatsapp_phone';
export const DEFAULT_ADMIN_PHONE = '809-555-0100';

export function getAdminPhone(): string {
  try {
    const saved = localStorage.getItem(ADMIN_PHONE_KEY);
    if (saved && saved.trim()) return saved.trim();
  } catch {}
  return DEFAULT_ADMIN_PHONE;
}

export function setAdminPhone(phone: string): boolean {
  try {
    localStorage.setItem(ADMIN_PHONE_KEY, phone.trim());
    return true;
  } catch {
    return false;
  }
}
