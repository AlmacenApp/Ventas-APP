import React, { useState, useMemo, useRef } from 'react';
import { Client, User, Order } from '../types';
import { formatMoney, formatDate } from '../services/storage';
import { downloadTemplate, parseClientsSpreadsheet } from '../services/exports';
import { sortClientsNatural, naturalCompare } from '../utils/sorting';

interface ClientsViewProps {
  clients: Client[];
  orders?: Order[];
  currentUser: User;
  availableZones: string[];
  onSaveClient: (client: Client, isNew: boolean) => void;
  onDeleteClient: (clientId: string) => void;
  onBulkAddClients: (newClients: Client[]) => void;
  showToast: (msg: string) => void;
}

interface ClientArticleStat {
  code: string;
  description: string;
  unit: string;
  totalQuantity: number;
  ordersCount: number;
  lastPrice: number;
  lastDate: string;
  history: {
    orderId: string;
    date: string;
    quantity: number;
    price: number;
    total: number;
  }[];
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  orders = [],
  currentUser,
  availableZones,
  onSaveClient,
  onDeleteClient,
  onBulkAddClients,
  showToast,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [search, setSearch] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('Todas');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Client History Modal State
  const [historyClient, setHistoryClient] = useState<Client | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [expandedArticleCode, setExpandedArticleCode] = useState<string | null>(null);

  // Form fields
  const [code, setCode] = useState('');
  const [company, setCompany] = useState('');
  const [zone, setZone] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract all available zones dynamically from client base and predefined zones
  const allZones = useMemo(() => {
    const set = new Set<string>();
    availableZones.forEach((z) => set.add(z));
    clients.forEach((c) => {
      if (c.zone) set.add(c.zone);
    });
    return Array.from(set).sort((a, b) => naturalCompare(a, b));
  }, [availableZones, clients]);

  // Universal visibility: All sellers/users see ALL clients across all zones
  // Sorted naturally by code (A-Z and 1..N de menor a mayor)
  const visibleClients = useMemo(() => {
    let list = clients;
    if (selectedZone !== 'Todas') {
      list = list.filter((c) => c.zone === selectedZone);
    }
    return sortClientsNatural(list);
  }, [clients, selectedZone]);

  // Filtered rows by search term
  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visibleClients;
    return visibleClients.filter((c) => {
      const fullText = `${c.code} ${c.company} ${c.zone} ${c.address} ${c.phone}`.toLowerCase();
      return fullText.includes(term);
    });
  }, [visibleClients, search]);

  // Client History: Gather orders and compute per-article purchases for the selected client
  const clientOrders = useMemo(() => {
    if (!historyClient) return [];
    const targetCode = (historyClient.code || '').trim().toUpperCase();
    const targetComp = (historyClient.company || '').trim().toLowerCase();

    return orders.filter((o) => {
      const orderClientCode = (o.clientSnapshot?.code || '').trim().toUpperCase();
      const orderCustomer = (o.customer || '').trim().toLowerCase();
      return (orderClientCode && orderClientCode === targetCode) || orderCustomer === targetComp;
    });
  }, [historyClient, orders]);

  // Aggregate items across all client orders
  const clientArticleStats = useMemo(() => {
    if (!historyClient || clientOrders.length === 0) return [];

    const map = new Map<string, ClientArticleStat>();

    clientOrders.forEach((order) => {
      order.items.forEach((item) => {
        const itemCode = (item.code || 'ART').trim().toUpperCase();
        const itemName = (item.description || item.name || 'Artículo').trim();
        const itemKey = `${itemCode}__${itemName.toLowerCase()}`;
        const itemDate = order.date;
        const itemQty = Number(item.quantity) || 0;
        const itemPrice = Number(item.price) || 0;
        const itemTotal = Number(item.totalWithTax) || itemPrice * itemQty;

        const existing = map.get(itemKey);
        if (!existing) {
          map.set(itemKey, {
            code: itemCode,
            description: itemName,
            unit: item.unit || 'Unidad',
            totalQuantity: itemQty,
            ordersCount: 1,
            lastPrice: itemPrice,
            lastDate: itemDate,
            history: [
              {
                orderId: order.id,
                date: itemDate,
                quantity: itemQty,
                price: itemPrice,
                total: itemTotal,
              },
            ],
          });
        } else {
          existing.totalQuantity += itemQty;
          existing.ordersCount += 1;
          existing.history.push({
            orderId: order.id,
            date: itemDate,
            quantity: itemQty,
            price: itemPrice,
            total: itemTotal,
          });

          // Track newest order date and price
          if (new Date(itemDate).getTime() > new Date(existing.lastDate).getTime()) {
            existing.lastDate = itemDate;
            existing.lastPrice = itemPrice;
          }
        }
      });
    });

    const list = Array.from(map.values());

    // Sort naturally by code ascending (A-Z and 1..N)
    return list.sort((a, b) => {
      const diff = naturalCompare(a.code, b.code);
      if (diff !== 0) return diff;
      return naturalCompare(a.description, b.description);
    });
  }, [historyClient, clientOrders]);

  // Filtered articles inside history modal
  const filteredArticleStats = useMemo(() => {
    const term = historySearch.trim().toLowerCase();
    if (!term) return clientArticleStats;
    return clientArticleStats.filter(
      (a) => a.code.toLowerCase().includes(term) || a.description.toLowerCase().includes(term)
    );
  }, [clientArticleStats, historySearch]);

  const totalHistoryUnits = useMemo(() => {
    return clientArticleStats.reduce((acc, curr) => acc + curr.totalQuantity, 0);
  }, [clientArticleStats]);

  const totalHistorySpent = useMemo(() => {
    return clientOrders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  }, [clientOrders]);

  const handleOpenAddModal = () => {
    setEditingClient(null);
    setCode('');
    setCompany('');
    setZone(isAdmin ? (availableZones[0] || 'Zona:01') : currentUser.zone);
    setAddress('');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) {
      showToast('Solo el administrador puede editar los datos del cliente.');
      return;
    }
    setEditingClient(client);
    setCode(client.code);
    setCompany(client.company);
    setZone(client.zone || '');
    setAddress(client.address);
    setPhone(client.phone);
    setIsModalOpen(true);
  };

  const handleOpenHistory = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setHistoryClient(client);
    setHistorySearch('');
    setExpandedArticleCode(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedCode = code.trim().toUpperCase();
    const trimmedCompany = company.trim();
    const assignedZone = isAdmin ? zone.trim() : (zone.trim() || currentUser.zone);
    const trimmedAddress = address.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedCode) {
      showToast('Introduce un código de cliente válido.');
      return;
    }

    if (!trimmedCompany) {
      showToast('Introduce el nombre de la compañía.');
      return;
    }

    if (!assignedZone) {
      showToast('Debes especificar o seleccionar una zona.');
      return;
    }

    // Check duplicate code
    const isDuplicate = clients.some(
      (c) => c.code.toLowerCase() === trimmedCode.toLowerCase() && c.id !== editingClient?.id
    );

    if (isDuplicate) {
      showToast('Ese código de cliente ya existe en el directorio.');
      return;
    }

    const updatedClient: Client = {
      id: editingClient ? editingClient.id : `c-${Date.now()}`,
      code: trimmedCode,
      company: trimmedCompany,
      zone: assignedZone,
      address: trimmedAddress || 'Sin dirección registrada',
      phone: trimmedPhone || 'Sin teléfono',
    };

    onSaveClient(updatedClient, !editingClient);
    setIsModalOpen(false);
    showToast(editingClient ? 'Cliente actualizado con éxito.' : 'Cliente agregado al directorio.');
  };

  const handleDelete = (client: Client, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) return;
    if (confirm(`¿Eliminar a “${client.company}” (${client.code}) del directorio?`)) {
      onDeleteClient(client.id);
      showToast('Cliente eliminado del directorio.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const existingCodes = new Set(clients.map((c) => c.code.toLowerCase()));
      const { added, skipped } = await parseClientsSpreadsheet(file, existingCodes);
      if (added.length > 0) {
        onBulkAddClients(added);
      }
      showToast(`Importación lista: ${added.length} agregado(s), ${skipped} omitido(s).`);
    } catch (err) {
      console.error(err);
      showToast('Error al procesar el archivo. Usa una plantilla válida de Excel o CSV.');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  return (
    <section className="view active">
      <div className="page-heading">
        <div>
          <div className="eyebrow">DIRECTORIO</div>
          <h1>Clientes</h1>
          <p className="subheading">
            Acceso global a clientes de todas las zonas. Haz clic en un cliente para ver su historial detallado por artículo.
          </p>
        </div>

        <div className="heading-actions coupled-actions-bar">
          <button
            type="button"
            className="primary-button compact main-action-btn"
            onClick={handleOpenAddModal}
          >
            <span>＋</span> Agregar cliente
          </button>

          {isAdmin && (
            <div className="secondary-actions-strip" role="toolbar" aria-label="Acciones de clientes">
              <button
                type="button"
                className="secondary-button"
                onClick={() => downloadTemplate('clients')}
                title="Descargar plantilla Excel con hoja de instrucciones detalladas y ejemplos"
                style={{ color: '#225c44', fontWeight: 600 }}
              >
                📋 Plantilla Excel
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsGuideOpen(true)}
                title="Ver cómo llenar los campos en pantalla"
              >
                ℹ Guía
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
                title="Importar lista de clientes desde Excel (se ordenarán automáticamente de menor a mayor)"
              >
                ↑ Importar
              </button>
            </div>
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="panel table-panel">
        <div className="panel-head" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2>Directorio de clientes</h2>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#225c44',
                  background: '#e8f3ec',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                Código A-Z · 1..N (De menor a mayor)
              </span>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#2b5f8f',
                  background: '#e8f1f8',
                  padding: '2px 8px',
                  borderRadius: '12px',
                }}
              >
                Todas las zonas visibles
              </span>
            </div>
            <span className="muted">
              {filteredClients.length} de {clients.length} {clients.length === 1 ? 'cliente registrado' : 'clientes registrados'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Zone Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label htmlFor="zone-filter-select" style={{ fontSize: '12px', color: '#68756c', fontWeight: 600 }}>
                Zona:
              </label>
              <select
                id="zone-filter-select"
                className="text-input"
                style={{ width: 'auto', padding: '6px 10px', fontSize: '12px', height: '36px' }}
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
              >
                <option value="Todas">Todas las zonas ({clients.length})</option>
                {allZones.map((z) => {
                  const count = clients.filter((c) => c.zone === z).length;
                  return (
                    <option key={z} value={z}>
                      {z} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <label className="search-box">
              <span>⌕</span>
              <input
                type="search"
                placeholder="Buscar código, nombre, zona…"
                aria-label="Buscar clientes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>CÓDIGO</th>
                <th>COMPAÑÍA</th>
                <th>ZONA</th>
                <th>DIRECCIÓN</th>
                <th>TELÉFONO</th>
                <th style={{ textAlign: 'center' }}>HISTORIAL</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => handleOpenHistory(c)}
                    style={{ cursor: 'pointer' }}
                    title="Haz clic para ver el historial por artículo que pide este cliente"
                  >
                    <td className="order-id">
                      <span style={{ fontWeight: 700, color: '#163a2b' }}>{c.code}</span>
                    </td>
                    <td className="item-name">
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{c.company}</div>
                      <small style={{ color: '#7a867e', fontSize: '11px' }}>Toca para ver compras</small>
                    </td>
                    <td>
                      <span className="stock-pill" style={{ background: '#eaf3ed', color: '#225c44' }}>
                        {c.zone || '—'}
                      </span>
                    </td>
                    <td>{c.address}</td>
                    <td>{c.phone}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          background: '#f2f7f3',
                          borderColor: '#cce2d3',
                          color: '#1d5e3c',
                          fontWeight: 600,
                        }}
                        onClick={(e) => handleOpenHistory(c, e)}
                      >
                        📋 Ver artículos
                      </button>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="row-action"
                          onClick={(e) => handleOpenEditModal(c, e)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="row-action danger"
                          onClick={(e) => handleDelete(c, e)}
                        >
                          Eliminar
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    style={{ textAlign: 'center', padding: '36px', color: '#9aa49d' }}
                  >
                    {visibleClients.length === 0
                      ? 'No hay clientes registrados en esta zona.'
                      : 'No se encontraron clientes con el criterio de búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: HISTORIAL POR ARTÍCULO DEL CLIENTE */}
      {historyClient && (
        <div className="modal-overlay" onClick={() => setHistoryClient(null)}>
          <div
            className="product-dialog"
            style={{ width: 'min(860px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="dialog-head" style={{ borderBottom: '1px solid #e1e7e2', paddingBottom: '14px' }}>
              <div>
                <div className="eyebrow" style={{ color: '#2b5f8f' }}>HISTORIAL DE COMPRAS POR ARTÍCULO</div>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span>{historyClient.company}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      background: '#eaf3ed',
                      color: '#225c44',
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {historyClient.code}
                  </span>
                </h2>
                <div style={{ fontSize: '12px', color: '#68756c', marginTop: '4px' }}>
                  <b>Zona:</b> {historyClient.zone || '—'} &nbsp;•&nbsp; <b>Teléfono:</b> {historyClient.phone} &nbsp;•&nbsp; <b>Dirección:</b> {historyClient.address}
                </div>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setHistoryClient(null)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            {/* Client Stats Summary Ribbon */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '10px',
                padding: '14px 0',
                borderBottom: '1px solid #edf1ee',
              }}
            >
              <div
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e5ece6',
                  borderRadius: '8px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#7a867e', fontWeight: 600 }}>ÓRDENES REALIZADAS</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--ink)' }}>
                  {clientOrders.length}
                </div>
              </div>

              <div
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e5ece6',
                  borderRadius: '8px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#7a867e', fontWeight: 600 }}>ARTÍCULOS DISTINTOS</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#225c44' }}>
                  {clientArticleStats.length}
                </div>
              </div>

              <div
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e5ece6',
                  borderRadius: '8px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#7a867e', fontWeight: 600 }}>UNIDADES TOTALES PEDIDAS</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#2b5f8f' }}>
                  {totalHistoryUnits}
                </div>
              </div>

              <div
                style={{
                  background: '#f8faf8',
                  border: '1px solid #e5ece6',
                  borderRadius: '8px',
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#7a867e', fontWeight: 600 }}>MONTO TOTAL INVERTIDO</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#225c44' }}>
                  {formatMoney(totalHistorySpent)}
                </div>
              </div>
            </div>

            {/* Search filter inside history */}
            <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ink)' }}>
                Artículos solicitados históricamente ({filteredArticleStats.length})
              </div>
              <input
                type="search"
                className="text-input"
                style={{ maxWidth: '280px', height: '34px', fontSize: '12px' }}
                placeholder="Filtrar por código o nombre…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>

            {/* Articles Table */}
            <div className="table-scroll" style={{ flex: 1, minHeight: '200px', maxHeight: '380px', border: '1px solid #e2e8e3', borderRadius: '8px' }}>
              <table>
                <thead>
                  <tr style={{ background: '#f5f8f5' }}>
                    <th style={{ fontSize: '11px' }}>CÓDIGO</th>
                    <th style={{ fontSize: '11px' }}>ARTÍCULO</th>
                    <th style={{ fontSize: '11px', textAlign: 'center' }}>TOTAL PEDIDO</th>
                    <th style={{ fontSize: '11px', textAlign: 'right' }}>ÚLTIMO PRECIO</th>
                    <th style={{ fontSize: '11px' }}>ÚLTIMA FECHA</th>
                    <th style={{ fontSize: '11px', textAlign: 'center' }}>DETALLES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArticleStats.length > 0 ? (
                    filteredArticleStats.map((stat) => {
                      const isExpanded = expandedArticleCode === stat.code;
                      return (
                        <React.Fragment key={stat.code}>
                          <tr style={{ background: isExpanded ? '#f6fbf8' : undefined }}>
                            <td className="order-id">
                              <span style={{ fontWeight: 700 }}>{stat.code}</span>
                            </td>
                            <td>
                              <div style={{ fontWeight: 600, color: 'var(--ink)' }}>{stat.description}</div>
                              <small style={{ color: '#7d8a81', fontSize: '11px' }}>
                                Presentación: {stat.unit} • En {stat.ordersCount} {stat.ordersCount === 1 ? 'orden' : 'órdenes'}
                              </small>
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  background: '#e8f3ec',
                                  color: '#1d5e3c',
                                  fontWeight: 800,
                                  fontSize: '12px',
                                }}
                              >
                                {stat.totalQuantity} {stat.unit}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>
                              {formatMoney(stat.lastPrice)}
                            </td>
                            <td style={{ fontSize: '11px', color: '#68756c' }}>
                              {formatDate(stat.lastDate)}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                className="row-action"
                                style={{ fontSize: '11px', padding: '3px 8px' }}
                                onClick={() =>
                                  setExpandedArticleCode(isExpanded ? null : stat.code)
                                }
                              >
                                {isExpanded ? '▲ Ocultar' : '▼ Ver órdenes'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded breakdown of orders for this specific article */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={6} style={{ background: '#f8faf8', padding: '12px 18px', borderLeft: '3px solid #225c44' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#225c44', marginBottom: '8px' }}>
                                  HISTORIAL DE PEDIDOS DONDE SE SOLICITÓ ESTE ARTÍCULO:
                                </div>
                                <div style={{ display: 'grid', gap: '6px' }}>
                                  {stat.history.map((hist, idx) => (
                                    <div
                                      key={`${hist.orderId}-${idx}`}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 10px',
                                        background: '#fff',
                                        borderRadius: '6px',
                                        border: '1px solid #e2ece4',
                                        fontSize: '11px',
                                      }}
                                    >
                                      <div>
                                        <b style={{ color: '#225c44' }}>{hist.orderId}</b>
                                        <span style={{ color: '#7a867e', marginLeft: '10px' }}>{formatDate(hist.date)}</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                                        <span>Cantidad: <b>{hist.quantity} {stat.unit}</b></span>
                                        <span>Precio: <b>{formatMoney(hist.price)}</b></span>
                                        <span style={{ color: '#225c44', fontWeight: 700 }}>Total: {formatMoney(hist.total)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#8a948d' }}>
                        {clientOrders.length === 0
                          ? 'Este cliente aún no registra órdenes de compra finalizadas en el sistema.'
                          : 'No se encontraron artículos con el término de búsqueda ingresado.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '10px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setHistoryClient(null)}
              >
                Cerrar historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Agregar / Editar Cliente */}
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
                  <div className="eyebrow">DIRECTORIO</div>
                  <h2>{editingClient ? 'Editar cliente' : 'Agregar cliente'}</h2>
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

              <label className="field-label" htmlFor="client-code-input">
                Código de cliente
              </label>
              <input
                id="client-code-input"
                className="text-input"
                required
                maxLength={24}
                placeholder="Ej. CLI-001 o 101"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoFocus
              />

              <label className="field-label" htmlFor="client-company-input">
                Nombre de la compañía
              </label>
              <input
                id="client-company-input"
                className="text-input"
                required
                maxLength={90}
                placeholder="Nombre comercial o razón social"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />

              <label className="field-label" htmlFor="client-zone-select">
                Vendedor / Zona asignada
              </label>
              <input
                id="client-zone-select"
                className="text-input"
                list="zones-datalist"
                required
                placeholder="Ej. Zona:01, Zona:02, Santo Domingo..."
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
              <datalist id="zones-datalist">
                {allZones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>

              <label className="field-label" htmlFor="client-address-input">
                Dirección
              </label>
              <input
                id="client-address-input"
                className="text-input"
                required
                maxLength={140}
                placeholder="Calle, sector, ciudad"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />

              <label className="field-label" htmlFor="client-phone-input">
                Número de teléfono
              </label>
              <input
                id="client-phone-input"
                className="text-input"
                type="tel"
                required
                maxLength={30}
                placeholder="Ej. 809-555-0101"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />

              <button className="primary-button dialog-submit" type="submit">
                {editingClient ? 'Guardar cambios' : 'Guardar cliente'} <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Guía de Carga Masiva de Clientes */}
      {isGuideOpen && (
        <div className="modal-overlay" onClick={() => setIsGuideOpen(false)}>
          <div
            className="product-dialog"
            style={{ width: 'min(720px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-head">
              <div>
                <div className="eyebrow">INSTRUCTIVO PARA EXCEL</div>
                <h2>Cómo llenar los campos para cargar Clientes</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setIsGuideOpen(false)}
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#49554d', marginBottom: '14px', lineHeight: '1.5' }}>
              Para cargar clientes de forma masiva, descargue la plantilla oficial en Excel. La plantilla ya contiene los encabezados requeridos y una segunda hoja de instrucciones detalladas. Al importarse, el sistema ordenará automáticamente todos los clientes por su <b>código de menor a mayor (A-Z alfabético y 1..N numérico ascendente)</b>.
            </div>

            <div className="table-scroll" style={{ maxHeight: '280px', border: '1px solid #e1e7e2', borderRadius: '8px', marginBottom: '16px' }}>
              <table>
                <thead>
                  <tr style={{ background: '#f5f8f5' }}>
                    <th style={{ fontSize: '11px' }}>COLUMNA</th>
                    <th style={{ fontSize: '11px' }}>¿REQUERIDO?</th>
                    <th style={{ fontSize: '11px' }}>EJEMPLO</th>
                    <th style={{ fontSize: '11px' }}>REGLA / FORMATO</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: '11px' }}>
                  <tr>
                    <td><b>Código cliente</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>CLI-001</code> / <code>1</code></td>
                    <td>Identificador único. Se ordena de menor a mayor (1 en adelante, A-Z).</td>
                  </tr>
                  <tr>
                    <td><b>Compañía</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td>Distribuidora del Caribe</td>
                    <td>Razón social o nombre comercial del cliente.</td>
                  </tr>
                  <tr>
                    <td><b>Zona asignada</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>Zona:01</code></td>
                    <td>Zona comercial. Todos los vendedores pueden ver clientes de cualquier zona.</td>
                  </tr>
                  <tr>
                    <td><b>Dirección</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td>Av. Winston Churchill #45</td>
                    <td>Dirección física de entrega o facturación.</td>
                  </tr>
                  <tr>
                    <td><b>Teléfono</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>809-555-0142</code></td>
                    <td>Teléfono para contacto y compartir órdenes por WhatsApp.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                background: '#eef6f0',
                border: '1px solid #cce4d3',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: '#24593e',
                lineHeight: '1.4',
                marginBottom: '16px',
              }}
            >
              <b>💡 Nota de ordenamiento y visibilidad:</b> El sistema mantiene ordenados todos los clientes de menor a mayor por código (alfabético A-Z y numérico de 1 en adelante). Todas las zonas tienen visibilidad cruzada para facilitar ventas y consultas de historial por artículo.
            </div>

            <div className="detail-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsGuideOpen(false)}
              >
                Cerrar guía
              </button>
              <button
                type="button"
                className="primary-button compact"
                onClick={() => {
                  downloadTemplate('clients');
                  showToast('Descargando Plantilla Instructiva de Clientes...');
                }}
              >
                📥 Descargar Plantilla en Excel (.xlsx) <span>→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
