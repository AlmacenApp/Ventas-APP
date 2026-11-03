import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  getDoc,
  Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Product, Client, Order, User } from '../types';
import { sortProductsNatural, sortClientsNatural } from '../utils/sorting';

// Initialize Firebase App & Firestore with configured Database ID
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline o comprobando red...');
    }
  }
}
testConnection();

// Error Handling conform to skill specifications
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

// Collections
const PRODUCTS_COL = 'products';
const CLIENTS_COL = 'clients';
const ORDERS_COL = 'orders';
const USERS_COL = 'users';
const SETTINGS_COL = 'settings';

/**
 * Initialize Firestore data if cloud database is empty.
 * Migrates local products, clients, users, and orders if present.
 */
export async function initializeCloudDatabase(
  initialProducts: Product[],
  initialClients: Client[],
  initialUsers: User[],
  initialOrders: Order[],
  initialAdminPhone: string
) {
  try {
    const metaRef = doc(db, SETTINGS_COL, 'metadata');
    const metaSnap = await getDoc(metaRef);

    if (metaSnap.exists()) {
      return; // Already initialized in cloud
    }

    // Check if products exist
    const productsSnap = await getDocs(collection(db, PRODUCTS_COL));
    if (productsSnap.size > 0) {
      await setDoc(metaRef, { initializedAt: new Date().toISOString() });
      return;
    }

    // Seed data into Firestore in batched writes
    const batch = writeBatch(db);

    // Initial products
    for (const p of initialProducts) {
      const ref = doc(db, PRODUCTS_COL, p.id);
      batch.set(ref, p);
    }

    // Initial clients
    for (const c of initialClients) {
      const ref = doc(db, CLIENTS_COL, c.id);
      batch.set(ref, c);
    }

    // Initial users
    for (const u of initialUsers) {
      const ref = doc(db, USERS_COL, u.id);
      batch.set(ref, u);
    }

    // Initial orders
    for (const o of initialOrders) {
      const ref = doc(db, ORDERS_COL, o.id);
      batch.set(ref, o);
    }

    // Settings
    const settingsRef = doc(db, SETTINGS_COL, 'general');
    batch.set(settingsRef, {
      adminPhone: initialAdminPhone || '809-555-0100',
      updatedAt: new Date().toISOString(),
    });

    batch.set(metaRef, {
      initializedAt: new Date().toISOString(),
      version: '1.0',
    });

    await batch.commit();
    console.log('Base de datos en la nube inicializada y sincronizada con éxito.');
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'initializeCloudDatabase');
  }
}

/**
 * Set up real-time Firestore listeners for global synchronization.
 * Whenever an admin or user makes changes on any device, these callbacks are fired.
 */
export function subscribeToCloudData(callbacks: {
  onProducts: (products: Product[]) => void;
  onClients: (clients: Client[]) => void;
  onOrders: (orders: Order[]) => void;
  onUsers: (users: User[]) => void;
  onAdminPhone: (phone: string) => void;
  onConnectionChange: (connected: boolean) => void;
}): () => void {
  const unsubs: Unsubscribe[] = [];

  try {
    // 1. Products listener
    const unsubProducts = onSnapshot(
      collection(db, PRODUCTS_COL),
      (snapshot) => {
        callbacks.onConnectionChange(true);
        if (!snapshot.empty) {
          const list: Product[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Product);
          });
          callbacks.onProducts(sortProductsNatural(list));
        }
      },
      (err) => {
        callbacks.onConnectionChange(false);
        handleFirestoreError(err, OperationType.GET, PRODUCTS_COL);
      }
    );
    unsubs.push(unsubProducts);

    // 2. Clients listener
    const unsubClients = onSnapshot(
      collection(db, CLIENTS_COL),
      (snapshot) => {
        callbacks.onConnectionChange(true);
        if (!snapshot.empty) {
          const list: Client[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as Client);
          });
          callbacks.onClients(sortClientsNatural(list));
        }
      },
      (err) => {
        callbacks.onConnectionChange(false);
        handleFirestoreError(err, OperationType.GET, CLIENTS_COL);
      }
    );
    unsubs.push(unsubClients);

    // 3. Orders listener
    const unsubOrders = onSnapshot(
      collection(db, ORDERS_COL),
      (snapshot) => {
        callbacks.onConnectionChange(true);
        const list: Order[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Order);
        });
        // Sort descending by date or id
        list.sort((a, b) => b.id.localeCompare(a.id));
        callbacks.onOrders(list);
      },
      (err) => {
        callbacks.onConnectionChange(false);
        handleFirestoreError(err, OperationType.GET, ORDERS_COL);
      }
    );
    unsubs.push(unsubOrders);

    // 4. Users listener
    const unsubUsers = onSnapshot(
      collection(db, USERS_COL),
      (snapshot) => {
        callbacks.onConnectionChange(true);
        if (!snapshot.empty) {
          const list: User[] = [];
          snapshot.forEach((docSnap) => {
            list.push(docSnap.data() as User);
          });
          callbacks.onUsers(list);
        }
      },
      (err) => {
        callbacks.onConnectionChange(false);
        handleFirestoreError(err, OperationType.GET, USERS_COL);
      }
    );
    unsubs.push(unsubUsers);

    // 5. General Settings listener
    const unsubSettings = onSnapshot(
      doc(db, SETTINGS_COL, 'general'),
      (snap) => {
        callbacks.onConnectionChange(true);
        if (snap.exists()) {
          const data = snap.data();
          if (data && data.adminPhone) {
            callbacks.onAdminPhone(data.adminPhone);
          }
        }
      },
      (err) => {
        callbacks.onConnectionChange(false);
        handleFirestoreError(err, OperationType.GET, `${SETTINGS_COL}/general`);
      }
    );
    unsubs.push(unsubSettings);
  } catch (err) {
    callbacks.onConnectionChange(false);
    console.error('Error starting Firestore subscriptions:', err);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

// ================= PRODUCT CLOUD MUTATIONS =================
export async function syncSaveProduct(product: Product) {
  try {
    await setDoc(doc(db, PRODUCTS_COL, product.id), product);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${PRODUCTS_COL}/${product.id}`);
  }
}

export async function syncDeleteProduct(productId: string) {
  try {
    await deleteDoc(doc(db, PRODUCTS_COL, productId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${PRODUCTS_COL}/${productId}`);
  }
}

export async function syncBulkProducts(products: Product[]) {
  try {
    const batch = writeBatch(db);
    for (const p of products) {
      batch.set(doc(db, PRODUCTS_COL, p.id), p);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, PRODUCTS_COL);
  }
}

// ================= CLIENT CLOUD MUTATIONS =================
export async function syncSaveClient(client: Client) {
  try {
    await setDoc(doc(db, CLIENTS_COL, client.id), client);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${CLIENTS_COL}/${client.id}`);
  }
}

export async function syncDeleteClient(clientId: string) {
  try {
    await deleteDoc(doc(db, CLIENTS_COL, clientId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${CLIENTS_COL}/${clientId}`);
  }
}

export async function syncBulkClients(clients: Client[]) {
  try {
    const batch = writeBatch(db);
    for (const c of clients) {
      batch.set(doc(db, CLIENTS_COL, c.id), c);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, CLIENTS_COL);
  }
}

// ================= ORDER CLOUD MUTATIONS =================
export async function syncCreateOrder(order: Order, updatedProducts: Product[]) {
  try {
    const batch = writeBatch(db);
    // 1. Add order
    batch.set(doc(db, ORDERS_COL, order.id), order);
    // 2. Update changed product stocks
    for (const p of updatedProducts) {
      batch.set(doc(db, PRODUCTS_COL, p.id), p);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${ORDERS_COL}/${order.id}`);
  }
}

export async function syncUpdateOrder(order: Order, updatedProducts: Product[]) {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, ORDERS_COL, order.id), order);
    for (const p of updatedProducts) {
      batch.set(doc(db, PRODUCTS_COL, p.id), p);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${ORDERS_COL}/${order.id}`);
  }
}

export async function syncDeleteOrder(orderId: string, updatedProducts: Product[]) {
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, ORDERS_COL, orderId));
    for (const p of updatedProducts) {
      batch.set(doc(db, PRODUCTS_COL, p.id), p);
    }
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${ORDERS_COL}/${orderId}`);
  }
}

// ================= USER CLOUD MUTATIONS =================
export async function syncSaveUser(user: User) {
  try {
    await setDoc(doc(db, USERS_COL, user.id), user);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${USERS_COL}/${user.id}`);
  }
}

export async function syncDeleteUser(userId: string) {
  try {
    await deleteDoc(doc(db, USERS_COL, userId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${USERS_COL}/${userId}`);
  }
}

export async function syncUpdateUserPin(userId: string, newPin: string, existingUser: User) {
  try {
    await setDoc(doc(db, USERS_COL, userId), {
      ...existingUser,
      pin: newPin,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COL}/${userId}`);
  }
}

export async function syncUpdateUserWhatsapp(userId: string, whatsapp: string, existingUser: User) {
  try {
    await setDoc(doc(db, USERS_COL, userId), {
      ...existingUser,
      whatsapp: whatsapp.trim(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${USERS_COL}/${userId}`);
  }
}

// ================= SETTINGS CLOUD MUTATIONS =================
export async function syncSaveAdminPhone(phone: string) {
  try {
    await setDoc(
      doc(db, SETTINGS_COL, 'general'),
      {
        adminPhone: phone.trim(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${SETTINGS_COL}/general`);
  }
}
