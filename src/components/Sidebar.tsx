import React from 'react';
import { ViewType, User } from '../types';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  orderCount: number;
  currentUser: User;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  orderCount,
  currentUser,
  onLogout,
}) => {
  const isAdmin = currentUser.role === 'admin';

  return (
    <aside className="sidebar">
      <a
        className="brand"
        href="#ventas"
        onClick={(e) => {
          e.preventDefault();
          onSelectView('ventas');
        }}
        aria-label="VI Venta &amp; Inventario APP inicio"
      >
        <span className="brand-mark">VI</span>
        <span style={{ fontSize: '15px', lineHeight: '1.2', fontWeight: 800 }}>
          Venta &amp; <span className="brand-light">Inventario APP</span>
        </span>
      </a>

      <div className="workspace-label">GESTIÓN</div>

      <nav className="main-nav" aria-label="Navegación principal">
        <button
          type="button"
          className={`nav-item ${currentView === 'ventas' ? 'active' : ''}`}
          onClick={() => onSelectView('ventas')}
        >
          <span className="nav-icon">＋</span>
          <span>Nueva venta</span>
        </button>

        <button
          type="button"
          className={`nav-item ${currentView === 'inventario' ? 'active' : ''}`}
          onClick={() => onSelectView('inventario')}
        >
          <span className="nav-icon">▦</span>
          <span>Inventario</span>
        </button>

        <button
          type="button"
          className={`nav-item ${currentView === 'clientes' ? 'active' : ''}`}
          onClick={() => onSelectView('clientes')}
        >
          <span className="nav-icon">♙</span>
          <span>Clientes</span>
        </button>

        <button
          type="button"
          className={`nav-item ${currentView === 'ordenes' ? 'active' : ''}`}
          onClick={() => onSelectView('ordenes')}
        >
          <span className="nav-icon">↗</span>
          <span>Órdenes</span>
          {orderCount > 0 && <span className="nav-count">{orderCount}</span>}
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`nav-item ${currentView === 'usuarios' ? 'active' : ''}`}
            onClick={() => onSelectView('usuarios')}
          >
            <span className="nav-icon">♧</span>
            <span>Usuarios</span>
          </button>
        )}
      </nav>

      <div className="sidebar-bottom" style={{ flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
          <div className="status-dot"></div>
          <div>
            <strong>Todo al día</strong>
            <small>Datos guardados localmente</small>
          </div>
        </div>
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            style={{
              background: 'transparent',
              border: 'none',
              padding: '6px 0 0',
              color: '#b65454',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>⎋</span>
            <span>Cerrar sesión</span>
          </button>
        )}
      </div>
    </aside>
  );
};
