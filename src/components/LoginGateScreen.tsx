import React, { useState } from 'react';
import { User } from '../types';

interface LoginGateScreenProps {
  users: User[];
  onLogin: (user: User) => void;
  showToast: (msg: string) => void;
  inactivityExpired?: boolean;
}

export const LoginGateScreen: React.FC<LoginGateScreenProps> = ({
  users,
  onLogin,
  showToast,
  inactivityExpired = false,
}) => {
  const [selectedUserId, setSelectedUserId] = useState<string>(users[0]?.id || 'admin');
  const [pin, setPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((u) => u.id === selectedUserId);
    if (!user || user.pin !== pin.trim()) {
      showToast('Usuario o contraseña incorrectos.');
      return;
    }
    onLogin(user);
    showToast(`Bienvenido/a, ${user.username}.`);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f6f7f5 0%, #eaf2ed 100%)',
        padding: '20px',
      }}
    >
      <div
        className="panel"
        style={{
          width: 'min(440px, 100%)',
          padding: '36px 32px',
          boxShadow: '0 20px 60px rgba(32, 48, 39, 0.12)',
          border: '1px solid #e1e7e2',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#225c44',
              color: '#fff',
              fontWeight: 800,
              fontSize: '20px',
              marginBottom: '14px',
              boxShadow: '0 6px 18px rgba(34, 92, 68, 0.25)',
              letterSpacing: '-0.5px',
            }}
          >
            VI
          </div>
          <h1
            style={{
              margin: '0 0 6px',
              fontSize: '22px',
              fontWeight: 700,
              fontFamily: 'var(--display)',
              color: '#202923',
            }}
          >
            Venta &amp; Inventario APP
          </h1>
          <p style={{ margin: 0, color: '#859088', fontSize: '12px' }}>
            Selecciona tu cuenta e ingresa tu PIN para acceder al sistema.
          </p>
        </div>

        {inactivityExpired && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              color: '#92400e',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '18px',
              fontSize: '12px',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>🔒</span>
            <span>
              <strong>Sesión bloqueada por inactividad:</strong> Has estado un tiempo prolongado sin usar la aplicación. Por seguridad, ingresa tu PIN para reanudar.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="field-label" htmlFor="gate-user-select" style={{ marginTop: 0 }}>
            Cuenta de usuario
          </label>
          <select
            id="gate-user-select"
            className="text-input"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            required
            style={{ height: '42px', fontSize: '13px' }}
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

          <label className="field-label" htmlFor="gate-pin-input">
            Contraseña / PIN de acceso
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="gate-pin-input"
              type={showPassword ? 'text' : 'password'}
              className="text-input"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Introduce tu PIN"
              required
              autoComplete="current-password"
              autoFocus
              style={{ height: '42px', fontSize: '13px', paddingRight: '60px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                fontSize: '11px',
                color: '#657168',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {showPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>

          <div
            style={{
              marginTop: '16px',
              marginBottom: '22px',
              fontSize: '11px',
              color: '#55685c',
              background: '#f2f6f3',
              padding: '10px 12px',
              borderRadius: '7px',
              border: '1px solid #dbe7df',
              lineHeight: 1.45,
            }}
          >
            💡 <b>Sugerencia para la contraseña:</b> Puede llevar un PIN numérico de 4 a 6 dígitos (ej. 1234) o una combinación de letras y números fácil de recordar.
          </div>

          <button
            className="primary-button"
            type="submit"
            style={{ height: '44px', fontSize: '13px', width: '100%' }}
          >
            Entrar al sistema <span>→</span>
          </button>
        </form>
      </div>
    </div>
  );
};
