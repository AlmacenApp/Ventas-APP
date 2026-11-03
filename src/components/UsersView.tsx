import React, { useState, useMemo } from 'react';
import { User, AppState, Client } from '../types';
import { downloadTemplate } from '../services/exports';

interface UsersViewProps {
  users: User[];
  currentUserId: string;
  availableZones: string[];
  clients: Client[];
  onAddUser: (newUser: User) => void;
  onDeleteUser: (userId: string) => void;
  onUpdatePassword: (userId: string, newPin: string) => void;
  onUpdateUserWhatsapp?: (userId: string, whatsapp: string) => void;
  appState: AppState;
  onRestoreState: (state: AppState) => void;
  showToast: (msg: string) => void;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  currentUserId,
  availableZones,
  clients,
  onAddUser,
  onDeleteUser,
  onUpdatePassword,
  onUpdateUserWhatsapp,
  appState,
  onRestoreState,
  showToast,
}) => {
  // Modal: Create seller user for a zone
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [sellerWhatsapp, setSellerWhatsapp] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [isCustomZone, setIsCustomZone] = useState(false);
  const [customZone, setCustomZone] = useState('');

  // Filter in users table
  const [filterZone, setFilterZone] = useState('Todas');

  // Modal: Change password
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Modal: Link / Edit WhatsApp
  const [isWhatsappModalOpen, setIsWhatsappModalOpen] = useState(false);
  const [targetWhatsappUser, setTargetWhatsappUser] = useState<User | null>(null);
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState('');



  const currentUser = users.find((u) => u.id === currentUserId) || users[0];

  // List of all zones derived from clients, existing sellers, and props
  const allZones = useMemo(() => {
    const set = new Set<string>();
    availableZones.forEach((z) => z && set.add(z));
    clients.forEach((c) => c.zone && set.add(c.zone));
    users.forEach((u) => u.zone && set.add(u.zone));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [availableZones, clients, users]);

  // Zone status summary (zone, sellers in that zone, clients in that zone)
  const zoneSummary = useMemo(() => {
    return allZones.map((z) => {
      const sellersInZone = users.filter((u) => u.role === 'seller' && u.zone.toLowerCase() === z.toLowerCase());
      const clientsInZone = clients.filter((c) => c.zone.toLowerCase() === z.toLowerCase());
      return {
        zone: z,
        sellers: sellersInZone,
        clientCount: clientsInZone.length,
      };
    });
  }, [allZones, users, clients]);

  const handleOpenModal = (preselectedZone?: string) => {
    setUsername('');
    setPin('');
    setSellerWhatsapp('');
    if (preselectedZone) {
      setSelectedZone(preselectedZone);
      setIsCustomZone(false);
      setCustomZone('');
    } else {
      setSelectedZone(allZones[0] || 'Zona:01');
      setIsCustomZone(false);
      setCustomZone('');
    }
    setIsModalOpen(true);
  };

  const handleOpenPasswordModal = (user: User) => {
    setTargetUser(user);
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordText(false);
    setIsPasswordModalOpen(true);
  };

  const handleOpenWhatsappModal = (user: User) => {
    setTargetWhatsappUser(user);
    setWhatsappPhoneInput(user.whatsapp || '');
    setIsWhatsappModalOpen(true);
  };

  const handleSaveWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetWhatsappUser) return;
    const clean = whatsappPhoneInput.trim();
    if (onUpdateUserWhatsapp) {
      onUpdateUserWhatsapp(targetWhatsappUser.id, clean);
    } else {
      showToast(clean ? `WhatsApp guardado: ${clean}` : 'WhatsApp desenlazado.');
    }
    setIsWhatsappModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedUser = username.trim();
    const trimmedPin = pin.trim();
    const finalZone = isCustomZone ? customZone.trim() : selectedZone.trim();

    if (!trimmedUser) {
      showToast('Introduce un nombre de usuario para el vendedor.');
      return;
    }

    if (trimmedPin.length < 4) {
      showToast('El PIN o contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (!finalZone) {
      showToast('Debes seleccionar o especificar la zona del vendedor.');
      return;
    }

    // Check duplicate username
    if (users.some((u) => u.username.toLowerCase() === trimmedUser.toLowerCase())) {
      showToast('Ese nombre de usuario ya está registrado en el sistema.');
      return;
    }

    const newUser: User = {
      id: `u-${Date.now()}`,
      username: trimmedUser,
      pin: trimmedPin,
      zone: finalZone,
      role: 'seller',
      whatsapp: sellerWhatsapp.trim(),
    };

    onAddUser(newUser);
    setIsModalOpen(false);
    showToast(`Vendedor "${trimmedUser}" creado y asignado exitosamente a ${finalZone}.`);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetUser) return;

    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (trimmedNew.length < 4) {
      showToast('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (trimmedNew !== trimmedConfirm) {
      showToast('Las contraseñas no coinciden. Por favor verifícalas.');
      return;
    }

    onUpdatePassword(targetUser.id, trimmedNew);
    setIsPasswordModalOpen(false);
    showToast(`Contraseña de "${targetUser.username}" actualizada correctamente.`);
  };

  const handleDelete = (u: User) => {
    if (u.role === 'admin') {
      showToast('No es posible eliminar el usuario administrador principal.');
      return;
    }
    if (confirm(`¿Eliminar al vendedor "${u.username}" asignado a ${u.zone}?`)) {
      onDeleteUser(u.id);
      showToast(`Usuario vendedor ${u.username} eliminado.`);
    }
  };

  // Export full backup
  const handleExportBackup = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `VI_VentaInventario_Backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Copia de seguridad descargada en formato JSON.');
  };

  // Restore backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.users)) {
          onRestoreState(parsed);
          showToast('Datos restaurados correctamente.');
        } else {
          showToast('El archivo de respaldo no tiene el formato esperado.');
        }
      } catch (err) {
        showToast('Error al leer el archivo JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Filtered users for table
  const filteredUsers = useMemo(() => {
    if (filterZone === 'Todas') return users;
    if (filterZone === 'Admin') return users.filter((u) => u.role === 'admin');
    return users.filter((u) => u.zone.toLowerCase() === filterZone.toLowerCase());
  }, [users, filterZone]);

  return (
    <section className="view active">
      <div className="page-heading">
        <div>
          <div className="eyebrow">EQUIPO COMERCIAL &amp; ZONAS</div>
          <h1>Usuarios y Vendedores por Zona</h1>
          <p className="subheading">
            Crea y administra las cuentas de vendedores vinculadas a las zonas comerciales registradas.
          </p>
        </div>

        <div className="heading-actions coupled-actions-bar">
          <button
            type="button"
            className="primary-button compact main-action-btn"
            onClick={() => handleOpenModal()}
          >
            <span>＋</span> Crear vendedor de zona
          </button>

          <div className="secondary-actions-strip" role="toolbar" aria-label="Acciones de usuario">
            {currentUser && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleOpenPasswordModal(currentUser)}
                title="Cambiar la contraseña de la sesión actual"
              >
                🔒 Cambiar contraseña
              </button>
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={handleExportBackup}
              title="Exportar respaldo completo de base de datos"
            >
              ↓ Copia seguridad
            </button>
            <label className="secondary-button" style={{ cursor: 'pointer' }} title="Restaurar copia de seguridad">
              ↑ Restaurar copia
              <input
                type="file"
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleImportBackup}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Resumen de Zonas de Vendedores */}
      {/* ------------------------------------------------------------- */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: 700, margin: 0, fontFamily: 'var(--display)' }}>
              Zonas de Vendedores Registradas
            </h2>
            <small style={{ color: '#859088' }}>
              Zonas comerciales activas en el directorio de clientes y asignaciones de vendedores.
            </small>
          </div>
          <button
            type="button"
            className="secondary-button"
            style={{ fontSize: '11px', height: '32px', minHeight: '32px' }}
            onClick={() => {
              setIsCustomZone(true);
              setCustomZone('');
              setUsername('');
              setPin('');
              setIsModalOpen(true);
            }}
          >
            ＋ Agregar nueva zona
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '12px',
          }}
        >
          {zoneSummary.map((item) => {
            const hasSeller = item.sellers.length > 0;
            return (
              <div
                key={item.zone}
                className="panel"
                style={{
                  padding: '14px 16px',
                  border: hasSeller ? '1px solid #dbe6dd' : '1px dashed #e0c8b0',
                  background: hasSeller ? '#ffffff' : '#fffaf5',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <b style={{ color: '#225c44', fontSize: '14px' }}>{item.zone}</b>
                  <span
                    className="stock-pill"
                    style={{
                      fontSize: '9px',
                      background: hasSeller ? '#eaf3ed' : '#fff3e8',
                      color: hasSeller ? '#225c44' : '#b9793f',
                    }}
                  >
                    {hasSeller ? `${item.sellers.length} vendedor(es)` : 'Sin vendedor'}
                  </span>
                </div>

                <div style={{ margin: '8px 0', fontSize: '11px', color: '#657168' }}>
                  <div>
                    <b>Clientes en zona:</b> {item.clientCount}
                  </div>
                  <div>
                    <b>Vendedor(es):</b>{' '}
                    {hasSeller ? (
                      item.sellers.map((s) => s.username).join(', ')
                    ) : (
                      <span style={{ color: '#b9793f' }}>Requiere asignar vendedor</span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f0f3f0' }}>
                  {hasSeller ? (
                    <button
                      type="button"
                      className="row-action"
                      style={{ fontSize: '11px', color: '#225c44', fontWeight: 600 }}
                      onClick={() => handleOpenModal(item.zone)}
                    >
                      ＋ Agregar otro vendedor a esta zona
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="row-action"
                      style={{ fontSize: '11px', color: '#b9793f', fontWeight: 600 }}
                      onClick={() => handleOpenModal(item.zone)}
                    >
                      ＋ Asignar vendedor a {item.zone}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Tabla de Usuarios y Vendedores */}
      {/* ------------------------------------------------------------- */}
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <h2>Cuentas configuradas ({filteredUsers.length})</h2>
            <span className="muted">Selecciona o filtra por zona para gestionar vendedores</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#859088' }}>Filtrar zona:</span>
            <select
              className="text-input"
              style={{ width: '150px', height: '34px', fontSize: '11px' }}
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
            >
              <option value="Todas">Todas las zonas</option>
              <option value="Admin">Solo Administradores</option>
              {allZones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>USUARIO</th>
                <th>ROL</th>
                <th>ZONA COMERCIAL ASIGNADA</th>
                <th>WHATSAPP ENLAZADO</th>
                <th>CLIENTES EN SU ZONA</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isCurrent = u.id === currentUserId;
                const zoneClients = u.zone ? clients.filter((c) => c.zone.toLowerCase() === u.zone.toLowerCase()) : clients;

                return (
                  <tr key={u.id}>
                    <td className="item-name">
                      {u.username}
                      {isCurrent && (
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '10px',
                            color: '#225c44',
                            fontWeight: 700,
                            background: '#eaf3ed',
                            padding: '2px 6px',
                            borderRadius: '6px',
                          }}
                        >
                          Sesión activa
                        </span>
                      )}
                    </td>
                    <td>
                      <span
                        className="stock-pill"
                        style={{
                          background: u.role === 'admin' ? '#edf5ee' : '#f0f3f6',
                          color: u.role === 'admin' ? '#225c44' : '#496075',
                        }}
                      >
                        {u.role === 'admin' ? 'Administrador' : 'Vendedor de Zona'}
                      </span>
                    </td>
                    <td>
                      {u.role === 'admin' ? (
                        <span style={{ color: '#225c44', fontWeight: 600 }}>Todas las zonas (Global)</span>
                      ) : (
                        <span className="stock-pill" style={{ background: '#eaf3ed', color: '#225c44' }}>
                          {u.zone || 'Sin zona asignada'}
                        </span>
                      )}
                    </td>
                    <td>
                      {u.whatsapp ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ color: '#166534', fontWeight: 600, fontSize: '12px' }}>
                            💬 {u.whatsapp}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af', fontSize: '11px', fontStyle: 'italic' }}>
                          Sin enlazar
                        </span>
                      )}
                    </td>
                    <td>
                      {u.role === 'admin' ? (
                        <span>{clients.length} clientes (Total)</span>
                      ) : (
                        <span>{zoneClients.length} clientes ({u.zone})</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="row-action"
                        onClick={() => handleOpenWhatsappModal(u)}
                        title={`Enlazar o modificar WhatsApp de ${u.username}`}
                        style={{ color: '#166534', fontWeight: 600, marginRight: '4px' }}
                      >
                        💬 {u.whatsapp ? 'Editar WhatsApp' : 'Enlazar WhatsApp'}
                      </button>
                      <button
                        type="button"
                        className="row-action"
                        onClick={() => handleOpenPasswordModal(u)}
                        title={`Cambiar contraseña de ${u.username}`}
                        style={{ color: '#225c44', fontWeight: 600 }}
                      >
                        🔑 Clave
                      </button>
                      {u.role === 'seller' && (
                        <button
                          type="button"
                          className="row-action danger"
                          onClick={() => handleDelete(u)}
                        >
                          Eliminar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>



      {/* ------------------------------------------------------------- */}
      {/* Panel: Documentos e Instructivos Excel para Carga Masiva */}
      {/* ------------------------------------------------------------- */}
      <div className="panel" style={{ marginTop: '24px' }}>
        <div className="panel-head">
          <div>
            <div className="eyebrow" style={{ color: '#225c44' }}>GESTIÓN PARA EL ADMINISTRADOR</div>
            <h2>Documentos e Instructivos Excel para Carga Masiva</h2>
            <span className="muted">
              Descargue plantillas oficiales en Excel con instructivo paso a paso para poblar Clientes e Inventario. Al importarse al sistema, todos los registros se ordenan automáticamente de forma alfabética (A-Z).
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '14px' }}>
          {/* Tarjeta 1: Clientes */}
          <div
            style={{
              background: '#f8faf9',
              border: '1px solid #d8e5dc',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <b style={{ color: '#225c44', fontSize: '14px' }}>👥 Plantilla de Clientes</b>
                <span style={{ fontSize: '10px', background: '#eaf4ee', color: '#1f5940', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  A-Z Automático
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#556358', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                Contiene las columnas: <code>Código cliente</code>, <code>Compañía</code>, <code>Zona asignada</code>, <code>Dirección</code> y <code>Teléfono</code>, además de una hoja con instrucciones y ejemplos.
              </p>
              <ul style={{ fontSize: '11px', color: '#68756c', margin: '0 0 14px 16px', padding: 0 }}>
                <li>Se ordenan alfabéticamente por Compañía (A-Z).</li>
                <li>La zona asignada debe coincidir con la del vendedor.</li>
              </ul>
            </div>

            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                downloadTemplate('clients');
                showToast('Descargando Plantilla Instructiva de Clientes (.xlsx)...');
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              📥 Descargar Plantilla Clientes <span>→</span>
            </button>
          </div>

          {/* Tarjeta 2: Inventario */}
          <div
            style={{
              background: '#f8faf9',
              border: '1px solid #d8e5dc',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <b style={{ color: '#225c44', fontSize: '14px' }}>📦 Plantilla de Inventario</b>
                <span style={{ fontSize: '10px', background: '#eaf4ee', color: '#1f5940', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                  A-Z Automático
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#556358', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                Contiene las columnas: <code>Código</code>, <code>Descripción</code>, <code>Cantidad</code>, <code>Unidad</code>, <code>ITBIS %</code> y <code>Precio</code>, con hoja de instrucciones detalladas.
              </p>
              <ul style={{ fontSize: '11px', color: '#68756c', margin: '0 0 14px 16px', padding: 0 }}>
                <li>Se ordenan alfabéticamente por Descripción (A-Z).</li>
                <li>Permite agrupación por prefijo de código (ej. ART, BEB).</li>
              </ul>
            </div>

            <button
              type="button"
              className="primary-button compact"
              onClick={() => {
                downloadTemplate('products');
                showToast('Descargando Plantilla Instructiva de Inventario (.xlsx)...');
              }}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              📥 Descargar Plantilla Inventario <span>→</span>
            </button>
          </div>

          {/* Tarjeta 3: Guía Maestra Completa */}
          <div
            style={{
              background: '#eef5f0',
              border: '1px solid #c4dec9',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <b style={{ color: '#1d4f37', fontSize: '14px' }}>📑 Guía Maestra (Ambas Hojas)</b>
                <span style={{ fontSize: '10px', background: '#d4ebd9', color: '#14462e', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                  Recomendado
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#445749', margin: '0 0 10px 0', lineHeight: '1.4' }}>
                Documento integral en Excel que incluye tanto la hoja de Clientes como la de Inventario con sus respectivas hojas de instrucciones en un solo libro de trabajo.
              </p>
              <ul style={{ fontSize: '11px', color: '#4d6153', margin: '0 0 14px 16px', padding: 0 }}>
                <li>Ideal para nuevos administradores o cargas completas.</li>
                <li>Incluye ejemplos reales de República Dominicana.</li>
              </ul>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                downloadTemplate('all');
                showToast('Descargando Guía Completa de Carga Masiva (.xlsx)...');
              }}
              style={{ width: '100%', justifyContent: 'center', borderColor: '#2d6a4a', color: '#1d4f37', fontWeight: 600 }}
            >
              📥 Descargar Guía Completa (Ambas) <span>→</span>
            </button>
          </div>
        </div>
      </div>

      <p className="local-security-note">
        💡 <b>Sugerencia de contraseña:</b> Puede llevar un PIN numérico de 4 a 6 dígitos o una clave alfanumérica fácil de recordar. Cada vendedor opera dentro de la zona comercial que tiene asignada.
      </p>

      {/* ------------------------------------------------------------- */}
      {/* Modal: Cambiar Contraseña */}
      {/* ------------------------------------------------------------- */}
      {isPasswordModalOpen && targetUser && (
        <div className="modal-overlay" onClick={() => setIsPasswordModalOpen(false)}>
          <div
            className="product-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSavePassword}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow">SEGURIDAD</div>
                  <h2>Cambiar contraseña</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  background: '#f5f8f5',
                  border: '1px solid #e8efe9',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#49554d',
                }}
              >
                Modificando clave para: <b style={{ color: '#225c44' }}>{targetUser.username}</b>{' '}
                <span style={{ color: '#8a958d' }}>
                  ({targetUser.role === 'admin' ? 'Administrador' : `Vendedor Zona: ${targetUser.zone}`})
                </span>
              </div>

              <label className="field-label" htmlFor="new-password-input">
                Nueva contraseña o PIN
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="new-password-input"
                  className="text-input"
                  required
                  minLength={4}
                  maxLength={40}
                  type={showPasswordText ? 'text' : 'password'}
                  placeholder="Mínimo 4 caracteres (ej. 5678)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordText(!showPasswordText)}
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
                  {showPasswordText ? 'Ocultar' : 'Ver'}
                </button>
              </div>

              <label className="field-label" htmlFor="confirm-password-input">
                Confirmar nueva contraseña
              </label>
              <input
                id="confirm-password-input"
                className="text-input"
                required
                minLength={4}
                maxLength={40}
                type={showPasswordText ? 'text' : 'password'}
                placeholder="Repite la contraseña para confirmar"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <small style={{ color: '#c46e68', display: 'block', marginTop: '6px', fontSize: '11px' }}>
                  ⚠ Las contraseñas no coinciden.
                </small>
              )}

              <button
                className="primary-button dialog-submit"
                type="submit"
                disabled={!newPassword || newPassword.length < 4 || newPassword !== confirmPassword}
              >
                Actualizar contraseña <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Crear Vendedor para una Zona */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="product-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSubmit}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow">CREAR VENDEDOR DE ZONA</div>
                  <h2>Asignar Vendedor</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsModalOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <div
                style={{
                  background: '#f2f7f3',
                  border: '1px solid #dbe8dd',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '16px',
                  fontSize: '11px',
                  color: '#2d5c3f',
                  lineHeight: '1.4',
                }}
              >
                ✓ Este usuario se creará específicamente como <b>Vendedor Autorizado</b> para la zona seleccionada. Al iniciar sesión, solo tendrá acceso a los clientes y órdenes de su zona.
              </div>

              {/* Selección de Zona ya agregada */}
              <label className="field-label" htmlFor="seller-zone-select">
                Zona comercial del vendedor
              </label>
              <div style={{ display: 'grid', gap: '8px' }}>
                <select
                  id="seller-zone-select"
                  className="text-input"
                  value={isCustomZone ? '__custom__' : selectedZone}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomZone(true);
                    } else {
                      setIsCustomZone(false);
                      setSelectedZone(e.target.value);
                    }
                  }}
                  required
                >
                  <optgroup label="Zonas de vendedores ya registradas">
                    {allZones.map((z) => {
                      const sellersCount = users.filter((u) => u.role === 'seller' && u.zone.toLowerCase() === z.toLowerCase()).length;
                      const clientsCount = clients.filter((c) => c.zone.toLowerCase() === z.toLowerCase()).length;
                      return (
                        <option key={z} value={z}>
                          {z} ({clientsCount} clientes · {sellersCount > 0 ? `${sellersCount} vendedor` : 'Sin vendedor'})
                        </option>
                      );
                    })}
                  </optgroup>
                  <option value="__custom__">＋ Crear y agregar una nueva zona...</option>
                </select>

                {isCustomZone && (
                  <div>
                    <input
                      className="text-input"
                      required
                      placeholder="Nombre de la nueva zona (ej. Zona:03, Zona Oriental...)"
                      value={customZone}
                      onChange={(e) => setCustomZone(e.target.value)}
                      autoFocus
                    />
                    <small style={{ color: '#859088', display: 'block', marginTop: '4px' }}>
                      Esta nueva zona quedará disponible para clientes y vendedores.
                    </small>
                  </div>
                )}
              </div>

              <label className="field-label" htmlFor="seller-username-input">
                Nombre de usuario para el vendedor
              </label>
              <input
                id="seller-username-input"
                className="text-input"
                required
                maxLength={40}
                autoComplete="off"
                placeholder="Ej. vendedor_norte, carlos_zona1..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <label className="field-label" htmlFor="seller-pin-input">
                Contraseña / PIN de acceso
              </label>
              <input
                id="seller-pin-input"
                className="text-input"
                required
                minLength={4}
                maxLength={40}
                type="password"
                placeholder="Mínimo 4 caracteres (ej. 1234)"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />

              <label className="field-label" htmlFor="seller-whatsapp-input">
                Número de WhatsApp del vendedor (Opcional)
              </label>
              <input
                id="seller-whatsapp-input"
                className="text-input"
                type="tel"
                placeholder="Ej. 809-555-0199 o 8295551234"
                value={sellerWhatsapp}
                onChange={(e) => setSellerWhatsapp(e.target.value)}
              />
              <small style={{ color: '#859088', display: 'block', marginTop: '3px', fontSize: '11px' }}>
                Permite al vendedor auto-enviarse y compartir las órdenes creadas en su propio WhatsApp.
              </small>

              <button className="primary-button dialog-submit" type="submit" style={{ marginTop: '14px' }}>
                Crear vendedor para {isCustomZone ? customZone || 'nueva zona' : selectedZone} <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Modal: Enlazar / Editar WhatsApp de Usuario */}
      {/* ------------------------------------------------------------- */}
      {isWhatsappModalOpen && targetWhatsappUser && (
        <div className="modal-overlay" onClick={() => setIsWhatsappModalOpen(false)}>
          <div
            className="product-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSaveWhatsapp}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow" style={{ color: '#166534' }}>WHATSAPP DE VENDEDOR</div>
                  <h2>Enlazar WhatsApp</h2>
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
                  marginBottom: '16px',
                  fontSize: '12px',
                  color: '#166534',
                }}
              >
                Configurando WhatsApp para: <b>{targetWhatsappUser.username}</b>{' '}
                <span style={{ color: '#15803d' }}>
                  ({targetWhatsappUser.role === 'admin' ? 'Administrador' : `Zona: ${targetWhatsappUser.zone}`})
                </span>
              </div>

              <label className="field-label" htmlFor="whatsapp-number-input">
                Número de teléfono móvil para WhatsApp
              </label>
              <input
                id="whatsapp-number-input"
                className="text-input"
                type="tel"
                placeholder="Ej. 809-555-0100 o 8295551234"
                value={whatsappPhoneInput}
                onChange={(e) => setWhatsappPhoneInput(e.target.value)}
                autoFocus
              />
              <small style={{ color: '#6b7280', display: 'block', marginTop: '4px', fontSize: '11px' }}>
                Al crear órdenes de venta, el usuario podrá enviarse la orden a este número con un solo toque. Déjalo en blanco para desenlazar.
              </small>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  className="primary-button"
                  type="submit"
                  style={{ flex: 1, background: '#25D366', color: '#ffffff', fontWeight: 700 }}
                >
                  Guardar y Enlazar WhatsApp <span>✓</span>
                </button>
                {targetWhatsappUser.whatsapp && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      if (onUpdateUserWhatsapp) {
                        onUpdateUserWhatsapp(targetWhatsappUser.id, '');
                      }
                      setIsWhatsappModalOpen(false);
                      showToast(`WhatsApp desenlazado de ${targetWhatsappUser.username}.`);
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
    </section>
  );
};
