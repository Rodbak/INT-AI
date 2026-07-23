// POS data layer: online API + offline-first catalog cache and sale sync.
import { API_BASE_URL } from './api';
import { idb } from './idb';

export interface PosProduct { id: string; name: string; price: number; cost: number; stock: number; unit: string; barcode?: string | null; category?: string | null; sku?: string | null }
export interface PosCustomer { id: string; name: string; phone?: string | null }
export interface TaxRate { name: string; rate: number }
export interface PosSettings {
  taxEnabled: boolean; taxRates: TaxRate[] | null; taxInclusive: boolean;
  barcodeEnabled: boolean; printerEnabled: boolean; cashDrawer: boolean;
  receiptHeader?: string | null; receiptFooter?: string | null;
}
export interface PosCashier { id: string; name: string; active?: boolean }
export interface PosCatalog { shopName: string; products: PosProduct[]; customers: PosCustomer[]; settings: PosSettings; cashiers: PosCashier[]; currency: string }

export interface QueuedSale {
  clientId: string;
  items: { productId: string; qty: number; unitPrice: number }[];
  discount: number; tax: number; method: string; tendered: number;
  amount: number; customerId?: string | null; cashierId?: string | null; shiftId?: string | null;
  soldAt: string;
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export const isOnline = () => navigator.onLine;

// ── Catalog (offline-first) ──────────────────────────────────────────────────
export async function bootstrap(): Promise<PosCatalog> {
  if (navigator.onLine) {
    try {
      const data = await req<PosCatalog>('GET', '/pos/bootstrap');
      await idb.set('catalog', data);
      return data;
    } catch { /* fall back to cache below */ }
  }
  const cached = await idb.get<PosCatalog>('catalog');
  if (cached) return cached;
  throw new Error('No connection and nothing saved yet. Open the till once while online first.');
}

async function applyStockDelta(items: { productId: string; qty: number }[]) {
  const cat = await idb.get<PosCatalog>('catalog');
  if (!cat) return;
  const map = new Map(items.map((i) => [i.productId, i.qty]));
  cat.products = cat.products.map((p) => (map.has(p.id) ? { ...p, stock: p.stock - (map.get(p.id) || 0) } : p));
  await idb.set('catalog', cat);
}

// ── Selling (queue + sync) ───────────────────────────────────────────────────
export async function queueSale(sale: QueuedSale): Promise<void> {
  await idb.queuePut({ ...sale });
  await applyStockDelta(sale.items);
  void syncNow(); // fire and forget; safe if offline
}

let syncing = false;
export async function syncNow(): Promise<{ synced: number }> {
  if (syncing || !navigator.onLine) return { synced: 0 };
  syncing = true;
  try {
    const pending = await idb.queueAll<QueuedSale>();
    if (!pending.length) return { synced: 0 };
    const res = await req<{ saved: string[] }>('POST', '/pos/sync', { sales: pending });
    for (const cid of res.saved || []) await idb.queueDelete(cid);
    return { synced: (res.saved || []).length };
  } catch {
    return { synced: 0 };
  } finally {
    syncing = false;
  }
}

export const pendingCount = () => idb.queueCount();

/** Subscribe to connectivity + auto-sync when we come back online. */
export function watchConnectivity(cb: (online: boolean) => void): () => void {
  const on = () => { cb(true); void syncNow(); };
  const off = () => cb(false);
  window.addEventListener('online', on);
  window.addEventListener('offline', off);
  return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
}

// ── Cashiers, shifts, settings (online admin/session ops) ────────────────────
export const loginCashier = (cashierId: string, pin: string) => req<{ ok: boolean; cashier: PosCashier }>('POST', '/pos/cashiers/login', { cashierId, pin });
export const openShift = (cashierId: string, openingFloat: number) => req<{ shift: { id: string } }>('POST', '/pos/shifts/open', { cashierId, openingFloat });
export const currentShift = (cashierId: string) => req<{ shift: ShiftReport | null }>('GET', `/pos/shifts/current?cashierId=${cashierId}`);
export const shiftReport = (id: string) => req<{ report: ShiftReport }>('GET', `/pos/shifts/${id}/report`);
export const closeShift = (id: string, countedCash: number) => req<{ report: ShiftReport }>('POST', `/pos/shifts/${id}/close`, { countedCash });

export const listCashiers = () => req<{ cashiers: PosCashier[] }>('GET', '/pos/cashiers');
export const createCashier = (name: string, pin: string) => req<{ cashier: PosCashier }>('POST', '/pos/cashiers', { name, pin });
export const updateCashier = (id: string, body: { name?: string; pin?: string; active?: boolean }) => req<{ cashier: PosCashier }>('PATCH', `/pos/cashiers/${id}`, body);
export const deleteCashier = (id: string) => req<{ ok: boolean }>('DELETE', `/pos/cashiers/${id}`);
export const getSettings = () => req<{ settings: PosSettings }>('GET', '/pos/settings');
export const saveSettings = (body: Partial<PosSettings>) => req<{ settings: PosSettings }>('PATCH', '/pos/settings', body);

export interface ShiftReport {
  id: string; cashier: string; openedAt: string; closedAt: string | null; status: string;
  openingFloat: number; salesCount: number; salesTotal: number;
  byMethod: Record<string, number>; expectedCash: number; countedCash: number | null; variance: number | null;
}
