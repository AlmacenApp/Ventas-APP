import React, { useMemo, useState } from 'react';
import { ViewType, User } from '../types';

interface TopNavbarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  orderCount: number;
  currentUser: User;
  onOpenLogin: () => void;
  onLogout: () => void;
  onUpdateUserWhatsapp?: (userId: string, whatsapp: string) => void;
  isCloudConnected?: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentView,
  onSelectView,
  orderCount,
  currentUser,
  onOpenLogin,
  onLogout,
  onUpdateUserWhatsapp,
  isCloudConnected = true,
}) => {
  const isAdmin = currentUser.role === 'admin';
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [whatsappInput, setWhatsappInput] = useState('');

  const todayFormatted = useMemo(() => {
    return new Intl.DateTimeFormat('es-DO', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date());
  }, []);

  const roleText =
    currentUser.role === 'admin'
      ? 'Administrador'
      : currentUser.zone || 'Vendedor';

  const handleSaveWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUserWhatsapp) {
      onUpdateUserWhatsapp(currentUser.id, whatsappInput.trim());
    }
    setIsWhatsappModalOpen(false);
  };

  return (
    <header className="app-top-header">
      {/* Primary Top Bar */}
      <div className="top-navbar-main">
        {/* Brand */}
        <div className="brand-group">
          <a
            className="brand-link"
            href="#ventas"
            onClick={(e) => {
              e.preventDefault();
              onSelectView('ventas');
            }}
            aria-label="VI Venta &amp; Inventario APP inicio"
          >
            <span className="brand-mark">VI</span>
            <div className="brand-text">
              <strong>Venta &amp; Inventario</strong>
              <small>APP COMERCIAL</small>
            </div>
          </a>
          <div
            className="cloud-sync-pill"
            title={
              isCloudConnected
                ? 'Conectado a Firestore en la nube. Cambios sincronizados globalmente en tiempo real.'
                : 'Conectando con Firestore en la nube...'
            }
          >
            <span className={`sync-indicator-dot ${isCloudConnected ? 'live' : 'syncing'}`} />
            <span className="sync-indicator-label">{isCloudConnected ? 'En la nube' : 'Conectando...'}</span>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <nav className="top-nav-tabs desktop-only" aria-label="Navegación principal">
          <button
            type="button"
            className={`top-nav-tab ${currentView === 'ventas' ? 'active' : ''}`}
            onClick={() => onSelectView('ventas')}
          >
            <span className="tab-icon">＋</span>
            <span>Nueva venta</span>
          </button>

          <button
            type="button"
            className={`top-nav-tab ${currentView === 'inventario' ? 'active' : ''}`}
            onClick={() => onSelectView('inventario')}
          >
            <span className="tab-icon">▦</span>
            <span>Inventario</span>
          </button>

          <button
            type="button"
            className={`top-nav-tab ${currentView === 'clientes' ? 'active' : ''}`}
            onClick={() => onSelectView('clientes')}
          >
            <span className="tab-icon">♙</span>
            <span>Clientes</span>
          </button>

          <button
            type="button"
            className={`top-nav-tab ${currentView === 'ordenes' ? 'active' : ''}`}
            onClick={() => onSelectView('ordenes')}
          >
            <span className="tab-icon">↗</span>
            <span>Órdenes</span>
            {orderCount > 0 && <span className="tab-badge">{orderCount}</span>}
          </button>

          {isAdmin && (
            <button
              type="button"
              className={`top-nav-tab ${currentView === 'usuarios' ? 'active' : ''}`}
              onClick={() => onSelectView('usuarios')}
            >
              <span className="tab-icon">♧</span>
              <span>Usuarios</span>
            </button>
          )}
        </nav>

        {/* Right Controls: Today Date, User Profile & Logout */}
        <div className="top-navbar-right">
          <div className="today-date desktop-only">{todayFormatted}</div>

          {/* Linked WhatsApp for zone user / seller */}
          <button
            type="button"
            className="account-pill-button"
            onClick={() => {
              setWhatsappInput(currentUser.whatsapp || '');
              setIsWhatsappModalOpen(true);
            }}
            style={{
              background: currentUser.whatsapp ? '#f0fdf4' : '#ffffff',
              borderColor: currentUser.whatsapp ? '#86efac' : '#d7ded9',
              color: currentUser.whatsapp ? '#166534' : '#45564b',
              padding: '0 10px',
              height: '36px',
              gap: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              cursor: 'pointer',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 600,
            }}
            title={
              currentUser.whatsapp
                ? `WhatsApp enlazado: ${currentUser.whatsapp}. Clic para editar.`
                : 'Enlazar número de WhatsApp para compartir órdenes'
            }
          >
            <span style={{ fontSize: '15px' }}>💬</span>
            <span className="desktop-only">
              {currentUser.whatsapp ? `WhatsApp: ${currentUser.whatsapp}` : 'Enlazar WhatsApp'}
            </span>
          </button>

          <button
            type="button"
            className="account-pill-button"
            onClick={onOpenLogin}
            title="Cambiar usuario o ver sesión"
          >
            <span className="account-avatar">👤</span>
            <span className="account-text">
              <b>{currentUser.username}</b>
              <small>{roleText}</small>
            </span>
          </button>

          <button
            type="button"
            className="logout-button"
            onClick={onLogout}
            title="Cerrar sesión actual"
          >
            <span>⎋</span>
            <span className="logout-text">Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Navigation Tabs (Directly at the TOP, tightly coupled segmented control) */}
      <nav
        className={`top-nav-tabs mobile-only mobile-segmented-tabs ${isAdmin ? 'has-admin' : 'seller-tabs'}`}
        aria-label="Navegación móvil superior"
      >
        <button
          type="button"
          className={`top-nav-tab ${currentView === 'ventas' ? 'active' : ''}`}
          onClick={() => onSelectView('ventas')}
          title="Nueva venta"
        >
          <span className="tab-icon">＋</span>
          <span className="tab-label">Ventas</span>
        </button>

        <button
          type="button"
          className={`top-nav-tab ${currentView === 'inventario' ? 'active' : ''}`}
          onClick={() => onSelectView('inventario')}
          title="Inventario de productos"
        >
          <span className="tab-icon">▦</span>
          <span className="tab-label">Stock</span>
        </button>

        <button
          type="button"
          className={`top-nav-tab ${currentView === 'clientes' ? 'active' : ''}`}
          onClick={() => onSelectView('clientes')}
          title="Directorio de clientes"
        >
          <span className="tab-icon">♙</span>
          <span className="tab-label">Clientes</span>
        </button>

        <button
          type="button"
          className={`top-nav-tab ${currentView === 'ordenes' ? 'active' : ''}`}
          onClick={() => onSelectView('ordenes')}
          title="Historial de órdenes"
        >
          <span className="tab-icon">↗</span>
          <span className="tab-label">Órdenes</span>
          {orderCount > 0 && <span className="tab-badge">{orderCount}</span>}
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`top-nav-tab ${currentView === 'usuarios' ? 'active' : ''}`}
            onClick={() => onSelectView('usuarios')}
            title="Gestión de usuarios"
          >
            <span className="tab-icon">♧</span>
            <span className="tab-label">Usuarios</span>
          </button>
        )}
      </nav>

      {/* Modal: Enlazar / Editar Mi WhatsApp */}
      {isWhatsappModalOpen && (
        <div className="modal-overlay" onClick={() => setIsWhatsappModalOpen(false)}>
          <div
            className="product-dialog"
            style={{ width: 'min(440px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSaveWhatsapp}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow" style={{ color: '#166534' }}>MI WHATSAPP DE VENDEDOR</div>
                  <h2>Enlazar mi WhatsApp</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsWhatsappModalOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '14px',
                  fontSize: '11.5px',
                  color: '#166534',
                }}
              >
                Usuario: <b>{currentUser.username}</b>{' '}
                <span style={{ color: '#15803d' }}>
                  ({currentUser.role === 'admin' ? 'Administrador' : `Zona: ${currentUser.zone}`})
                </span>
              </div>

              <label className="field-label" htmlFor="user-whatsapp-input">
                Número de teléfono móvil o celular
              </label>
              <input
                id="user-whatsapp-input"
                className="text-input"
                type="tel"
                placeholder="Ej. 809-555-0100 o 8295551234"
                value={whatsappInput}
                onChange={(e) => setWhatsappInput(e.target.value)}
                autoFocus
              />
              <small style={{ color: '#6b7280', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                Al crear órdenes de venta, tendrás un botón directo para auto-enviarte la orden a este WhatsApp con un solo toque.
              </small>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  className="primary-button"
                  type="submit"
                  style={{ flex: 1, background: '#25D366', color: '#ffffff', fontWeight: 700 }}
                >
                  Guardar y Enlazar <span>✓</span>
                </button>
                {currentUser.whatsapp && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (onUpdateUserWhatsapp) {
                        onUpdateUserWhatsapp(currentUser.id, '');
                      }
                      setIsWhatsappModalOpen(false);
                    }}
                    style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                  >
                    Desenlazar
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
