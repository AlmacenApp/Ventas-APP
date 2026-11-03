import React, { useState } from 'react';
import { User } from '../types';

interface LoginModalProps {
  users: User[];
  currentUserId: string;
  onLogin: (user: User) => void;
  onLogout?: () => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  users,
  currentUserId,
  onLogin,
  onLogout,
  onClose,
  showToast,
}) => {
  const [selectedUserId, setSelectedUserId] = useState(currentUserId || users[0]?.id || 'admin');
  const [pin, setPin] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((u) => u.id === selectedUserId);
    if (!user || user.pin !== pin.trim()) {
      showToast('Usuario o contraseña incorrectos.');
      return;
    }
    onLogin(user);
    showToast(`Sesión iniciada como ${user.username}.`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <form onSubmit={handleSubmit}>
          <div className="dialog-head">
            <div>
              <div className="eyebrow">SESIÓN DE USUARIO</div>
              <h2>Cambiar de usuario</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <label className="field-label" htmlFor="login-user-select">
            Usuario
          </label>
          <select
            id="login-user-select"
            className="text-input"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
          >
            <optgroup label="Administración Global">
              {users.filter((u) => u.role === 'admin').map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} · Administrador (Todas las zonas)
                </option>
              ))}
            </optgroup>
            <optgroup label="Vendedores por Zona">
              {users.filter((u) => u.role === 'seller').map((u) => (
                <option key={u.id} value={u.id}>
                  [{u.zone || 'Sin zona'}] {u.username} (Vendedor)
                </option>
              ))}
            </optgroup>
          </select>

          <label className="field-label" htmlFor="login-pin-input">
            Contraseña / PIN
          </label>
          <input
            id="login-pin-input"
            type="password"
            className="text-input"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Introduce tu PIN"
            required
            autoComplete="current-password"
            autoFocus
          />

          <div style={{ marginTop: '16px', fontSize: '11px', color: '#55685c', background: '#f2f6f3', padding: '8px 10px', borderRadius: '6px', border: '1px solid #dbe7df' }}>
            <span>💡 <b>Sugerencia:</b> Puede llevar un PIN numérico de 4 a 6 dígitos o una combinación alfanumérica fácil de recordar.</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
            <button className="primary-button" type="submit" style={{ flex: 1 }}>
              Iniciar sesión <span>→</span>
            </button>
            {onLogout && currentUserId && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                style={{ color: '#b65454', borderColor: '#f2dede' }}
              >
                Cerrar sesión
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
