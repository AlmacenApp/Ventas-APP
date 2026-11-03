import React, { useMemo } from 'react';
import { ViewType, User } from '../types';

interface TopbarProps {
  currentView: ViewType;
  currentUser: User;
  onOpenLogin: () => void;
  onLogout: () => void;
}

const VIEW_NAMES: Record<ViewType, string> = {
  ventas: 'Nueva venta',
  inventario: 'Inventario',
  clientes: 'Clientes',
  ordenes: 'Órdenes',
  usuarios: 'Usuarios',
};

export const Topbar: React.FC<TopbarProps> = ({
  currentView,
  currentUser,
  onOpenLogin,
  onLogout,
}) => {
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

  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>Panel</span>
        <span className="crumb-sep">/</span>
        <strong>{VIEW_NAMES[currentView]}</strong>
      </div>

      <div className="topbar-right">
        <div className="today">{todayFormatted}</div>
        <button
          type="button"
          className="account-button"
          onClick={onOpenLogin}
          title="Cambiar usuario o ver sesión"
        >
          <span>👤</span>
          <span>{`${currentUser.username} · ${roleText}`}</span>
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={onLogout}
          title="Cerrar sesión actual"
          style={{
            height: '32px',
            minHeight: '32px',
            padding: '0 10px',
            fontSize: '11px',
            color: '#b65454',
            borderColor: '#f2dede',
            background: '#fff9f9',
          }}
        >
          <span>⎋</span>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
};
