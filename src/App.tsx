/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AppState, ViewType, Product, Client, Order, User } from './types';
import {
  loadState,
  saveState,
  DEFAULT_ADMIN,
  setActiveSession,
  recordActivity,
  checkSessionExpired,
  getAdminPhone,
  setAdminPhone,
} from './services/storage';
import {
  initializeCloudDatabase,
  subscribeToCloudData,
  syncSaveProduct,
  syncDeleteProduct,
  syncBulkProducts,
  syncSaveClient,
  syncDeleteClient,
  syncBulkClients,
  syncCreateOrder,
  syncUpdateOrder,
  syncDeleteOrder,
  syncSaveUser,
  syncDeleteUser,
  syncUpdateUserPin,
} from './services/firebase';
import { TopNavbar } from './components/TopNavbar';
import { SalesView } from './components/SalesView';
import { InventoryView } from './components/InventoryView';
import { ClientsView } from './components/ClientsView';
import { OrdersView } from './components/OrdersView';
import { UsersView } from './components/UsersView';
import { LoginModal } from './components/LoginModal';
import { LoginGateScreen } from './components/LoginGateScreen';
import { Toast } from './components/Toast';
import { sortProductsNatural, sortClientsNatural } from './utils/sorting';

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [currentView, setCurrentView] = useState<ViewType>('ventas');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSessionExpiredNotice, setIsSessionExpiredNotice] = useState(false);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Initialize Cloud Database and listen in real-time
  useEffect(() => {
    const adminPhone = getAdminPhone();
    initializeCloudDatabase(
      state.products,
      state.clients,
      state.users,
      state.orders,
      adminPhone
    );

    const unsubscribe = subscribeToCloudData({
      onProducts: (products) => {
        setState((prev) => ({
          ...prev,
          products,
        }));
      },
      onClients: (clients) => {
        setState((prev) => ({
          ...prev,
          clients,
        }));
      },
      onOrders: (orders) => {
        setState((prev) => ({
          ...prev,
          orders,
        }));
      },
      onUsers: (users) => {
        setState((prev) => {
          const safeUsers = users.length > 0 ? users : [DEFAULT_ADMIN];
          if (!safeUsers.some((u) => u.role === 'admin')) {
            safeUsers.unshift(DEFAULT_ADMIN);
          }
          return {
            ...prev,
            users: safeUsers,
          };
        });
      },
      onAdminPhone: (phone) => {
        if (phone) {
          setAdminPhone(phone);
        }
      },
      onConnectionChange: (connected) => {
        setIsCloudConnected(connected);
      },
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Auto-save whenever state changes locally as cache
  useEffect(() => {
    saveState(state);
  }, [state]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    const timer = setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
    return () => clearTimeout(timer);
  }, []);

  // Track user activity and check inactivity timeout
  useEffect(() => {
    if (!state.currentUserId) return;

    recordActivity();

    let lastRecord = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastRecord > 5000) {
        lastRecord = now;
        recordActivity();
      }
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, handleUserActivity, { passive: true }));

    // Periodic check for inactivity timeout
    const interval = setInterval(() => {
      if (checkSessionExpired()) {
        setActiveSession('');
        setState((prev) => ({ ...prev, currentUserId: '' }));
        setIsSessionExpiredNotice(true);
        setCurrentView('ventas');
        showToast('Sesión bloqueada por inactividad. Inicia sesión para continuar.');
      }
    }, 8000);

    // Also check on tab visibility change or focus
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (checkSessionExpired()) {
          setActiveSession('');
          setState((prev) => ({ ...prev, currentUserId: '' }));
          setIsSessionExpiredNotice(true);
          setCurrentView('ventas');
          showToast('Sesión bloqueada por inactividad. Inicia sesión para continuar.');
        } else {
          handleUserActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
      clearInterval(interval);
    };
  }, [state.currentUserId, showToast]);

  // Current active user
  const currentUser: User | null = useMemo(() => {
    if (!state.currentUserId) return null;
    const found = state.users.find((u) => u.id === state.currentUserId);
    if (found) return found;
    return state.users.find((u) => u.role === 'admin') || DEFAULT_ADMIN;
  }, [state.users, state.currentUserId]);

  const isAdmin = currentUser?.role === 'admin';

  // Available zones derived from users, clients, orders
  const availableZones = useMemo(() => {
    const raw = [
      ...state.users.filter((u) => u.role === 'seller').map((u) => u.zone),
      ...state.clients.map((c) => c.zone),
      ...state.orders.map((o) => o.zone),
      'Zona:01',
      'Zona:02',
    ];
    return [...new Set(raw.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  }, [state.users, state.clients, state.orders]);

  // Order count visible to current user
  const visibleOrderCount = useMemo(() => {
    if (!currentUser) return 0;
    if (isAdmin) return state.orders.length;
    return state.orders.filter((o) => o.zone === currentUser.zone).length;
  }, [state.orders, isAdmin, currentUser]);

  // Guard against non-admin accessing usuarios
  const handleSelectView = (view: ViewType) => {
    if (view === 'usuarios' && !isAdmin) {
      showToast('Solo el administrador tiene acceso a la gestión de usuarios.');
      setCurrentView('ventas');
      return;
    }
    setCurrentView(view);
  };

  // Product actions - always kept sorted alphabetically by description / name
  const handleSaveProduct = (product: Product, isNew: boolean) => {
    setState((prev) => {
      const list = isNew
        ? [product, ...prev.products]
        : prev.products.map((p) => (p.id === product.id ? product : p));
      return {
        ...prev,
        products: sortProductsNatural(list),
      };
    });
    syncSaveProduct(product);
  };

  const handleDeleteProduct = (productId: string) => {
    setState((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
    syncDeleteProduct(productId);
  };

  const handleBulkAddProducts = (newProducts: Product[]) => {
    setState((prev) => {
      const existingCodes = new Set(newProducts.map((p) => p.code.toLowerCase()));
      const filteredPrev = prev.products.filter((p) => !existingCodes.has(p.code.toLowerCase()));
      const combined = [...newProducts, ...filteredPrev];
      const sorted = sortProductsNatural(combined);
      syncBulkProducts(sorted);
      return {
        ...prev,
        products: sorted,
      };
    });
  };

  const handleBulkUpdateProducts = (updatedProducts: Product[]) => {
    const map = new Map(updatedProducts.map((p) => [p.id, p]));
    setState((prev) => {
      const list = prev.products.map((p) => map.get(p.id) || p);
      const sorted = sortProductsNatural(list);
      syncBulkProducts(sorted);
      return {
        ...prev,
        products: sorted,
      };
    });
  };

  // Client actions - kept sorted naturally by code (A-Z and 1..N)
  const handleSaveClient = (client: Client, isNew: boolean) => {
    setState((prev) => {
      const list = isNew
        ? [client, ...prev.clients]
        : prev.clients.map((c) => (c.id === client.id ? client : c));
      return {
        ...prev,
        clients: sortClientsNatural(list),
      };
    });
    syncSaveClient(client);
  };

  const handleDeleteClient = (clientId: string) => {
    setState((prev) => ({
      ...prev,
      clients: prev.clients.filter((c) => c.id !== clientId),
    }));
    syncDeleteClient(clientId);
  };

  const handleBulkAddClients = (newClients: Client[]) => {
    setState((prev) => {
      const existingCodes = new Set(newClients.map((c) => c.code.toLowerCase()));
      const filteredPrev = prev.clients.filter((c) => !existingCodes.has(c.code.toLowerCase()));
      const combined = [...newClients, ...filteredPrev];
      const sorted = sortClientsNatural(combined);
      syncBulkClients(sorted);
      return {
        ...prev,
        clients: sorted,
      };
    });
  };

  // Order actions
  const handleCreateOrder = (newOrder: Order, updatedProducts: Product[]) => {
    setState((prev) => ({
      ...prev,
      orders: [newOrder, ...prev.orders],
      products: updatedProducts,
    }));
    syncCreateOrder(newOrder, updatedProducts);
  };

  const handleUpdateOrder = (updatedOrder: Order, updatedProducts: Product[]) => {
    setState((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
      products: updatedProducts,
    }));
    syncUpdateOrder(updatedOrder, updatedProducts);
  };

  const handleDeleteOrder = (orderId: string, restoreStock: boolean = true) => {
    let orderDocName = orderId;
    let itemsRestoredCount = 0;
    let finalProducts: Product[] = [];

    setState((prev) => {
      const orderToDelete = prev.orders.find((o) => o.id === orderId);
      if (!orderToDelete) return prev;

      orderDocName = orderToDelete.clientSnapshot?.code
        ? `${orderToDelete.clientSnapshot.code} (${orderToDelete.id})`
        : orderToDelete.id;

      let updatedProducts = prev.products;
      if (restoreStock) {
        const returnMap = new Map<string, number>();
        for (const item of orderToDelete.items) {
          const current = returnMap.get(item.productId) || 0;
          returnMap.set(item.productId, current + item.quantity);
          itemsRestoredCount += item.quantity;
        }

        updatedProducts = prev.products.map((p) => {
          const toAdd = returnMap.get(p.id) || 0;
          if (toAdd > 0) {
            return {
              ...p,
              stock: p.stock + toAdd,
            };
          }
          return p;
        });
      }

      finalProducts = updatedProducts;

      return {
        ...prev,
        orders: prev.orders.filter((o) => o.id !== orderId),
        products: updatedProducts,
      };
    });

    syncDeleteOrder(orderId, finalProducts);

    showToast(
      restoreStock && itemsRestoredCount > 0
        ? `Orden ${orderDocName} eliminada. Se reintegraron ${itemsRestoredCount} artículos al stock.`
        : `Orden ${orderDocName} eliminada del sistema.`
    );
  };

  // User actions
  const handleAddUser = (newUser: User) => {
    setState((prev) => ({
      ...prev,
      users: [...prev.users, newUser],
    }));
    syncSaveUser(newUser);
  };

  const handleDeleteUser = (userId: string) => {
    setState((prev) => ({
      ...prev,
      users: prev.users.filter((u) => u.id !== userId),
      currentUserId: prev.currentUserId === userId ? 'admin' : prev.currentUserId,
    }));
    syncDeleteUser(userId);
  };

  const handleUpdatePassword = (userId: string, newPin: string) => {
    const target = state.users.find((u) => u.id === userId);
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? { ...u, pin: newPin } : u)),
    }));
    if (target) {
      syncUpdateUserPin(userId, newPin, target);
    }
  };

  const handleUpdateUserWhatsapp = (userId: string, whatsapp: string) => {
    const clean = whatsapp.trim();
    const target = state.users.find((u) => u.id === userId);
    if (!target) return;
    const updatedUser: User = {
      ...target,
      whatsapp: clean,
    };
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === userId ? updatedUser : u)),
    }));
    syncSaveUser(updatedUser);
    showToast(
      clean
        ? `WhatsApp enlazado correctamente a "${updatedUser.username}": ${clean}`
        : `WhatsApp desenlazado de "${updatedUser.username}".`
    );
  };

  const handleLogin = (user: User) => {
    setActiveSession(user.id);
    setIsSessionExpiredNotice(false);
    setCurrentView('ventas');
    setState((prev) => ({
      ...prev,
      currentUserId: user.id,
    }));
    setIsLoginModalOpen(false);
  };

  const handleLogout = () => {
    setActiveSession('');
    setIsSessionExpiredNotice(false);
    setCurrentView('ventas');
    setState((prev) => ({
      ...prev,
      currentUserId: '',
    }));
    setIsLoginModalOpen(false);
    showToast('Sesión cerrada correctamente.');
  };

  const handleRestoreState = (restored: AppState) => {
    setState(restored);
    syncBulkProducts(restored.products);
    syncBulkClients(restored.clients);
    for (const u of restored.users) {
      syncSaveUser(u);
    }
    for (const o of restored.orders) {
      syncCreateOrder(o, restored.products);
    }
    showToast('Base de datos restaurada y sincronizada globalmente.');
  };

  // If user is logged out, show the login gate screen
  if (!currentUser || !state.currentUserId) {
    return (
      <>
        <LoginGateScreen
          users={state.users}
          onLogin={handleLogin}
          showToast={showToast}
          inactivityExpired={isSessionExpiredNotice}
        />
        <Toast message={toastMessage} />
      </>
    );
  }

  return (
    <div className="app-shell">
      {/* Top Navigation Bar - Navigation situated strictly at the top */}
      <TopNavbar
        currentView={currentView}
        onSelectView={handleSelectView}
        orderCount={visibleOrderCount}
        currentUser={currentUser}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        onUpdateUserWhatsapp={handleUpdateUserWhatsapp}
        isCloudConnected={isCloudConnected}
      />

      {/* Main Content Area */}
      <main className="main-content">

        {currentView === 'ventas' && (
          <SalesView
            products={state.products}
            clients={state.clients}
            orders={state.orders}
            currentUser={currentUser}
            onSaveOrder={handleCreateOrder}
            onNavigateToOrders={() => setCurrentView('ordenes')}
            onUpdateUserWhatsapp={handleUpdateUserWhatsapp}
            showToast={showToast}
          />
        )}

        {currentView === 'inventario' && (
          <InventoryView
            products={state.products}
            currentUser={currentUser}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onBulkAddProducts={handleBulkAddProducts}
            onBulkUpdateProducts={handleBulkUpdateProducts}
            showToast={showToast}
          />
        )}

        {currentView === 'clientes' && (
          <ClientsView
            clients={state.clients}
            orders={state.orders}
            currentUser={currentUser}
            availableZones={availableZones}
            onSaveClient={handleSaveClient}
            onDeleteClient={handleDeleteClient}
            onBulkAddClients={handleBulkAddClients}
            showToast={showToast}
          />
        )}

        {currentView === 'ordenes' && (
          <OrdersView
            orders={state.orders}
            products={state.products}
            clients={state.clients}
            currentUser={currentUser}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
            onUpdateUserWhatsapp={handleUpdateUserWhatsapp}
            showToast={showToast}
          />
        )}

        {currentView === 'usuarios' && isAdmin && (
          <UsersView
            users={state.users}
            currentUserId={state.currentUserId}
            availableZones={availableZones}
            clients={state.clients}
            onAddUser={handleAddUser}
            onDeleteUser={handleDeleteUser}
            onUpdatePassword={handleUpdatePassword}
            onUpdateUserWhatsapp={handleUpdateUserWhatsapp}
            appState={state}
            onRestoreState={handleRestoreState}
            showToast={showToast}
          />
        )}
      </main>

      {/* Login / Switch User Modal */}
      {isLoginModalOpen && (
        <LoginModal
          users={state.users}
          currentUserId={state.currentUserId}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onClose={() => setIsLoginModalOpen(false)}
          showToast={showToast}
        />
      )}

      {/* Floating Toast Notification */}
      <Toast message={toastMessage} />
    </div>
  );
}
