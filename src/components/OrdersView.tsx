import React, { useState, useMemo } from 'react';
import { Order, Product, Client, User } from '../types';
import { formatDate, formatMoney } from '../services/storage';
import { exportOrder, getOrderDocumentName } from '../services/exports';
import { OrderEditorModal } from './OrderEditorModal';
import { ShareOrderModal } from './ShareOrderModal';

interface OrdersViewProps {
  orders: Order[];
  products: Product[];
  clients: Client[];
  currentUser: User;
  onUpdateOrder: (updatedOrder: Order, updatedProducts: Product[]) => void;
  onDeleteOrder?: (orderId: string, restoreStock: boolean) => void;
  onUpdateUserWhatsapp?: (userId: string, whatsapp: string) => void;
  showToast: (msg: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  orders,
  products,
  clients,
  currentUser,
  onUpdateOrder,
  onDeleteOrder,
  onUpdateUserWhatsapp,
  showToast,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [search, setSearch] = useState('');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [shareOrder, setShareOrder] = useState<Order | null>(null);
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [restoreStockOnDelete, setRestoreStockOnDelete] = useState(true);

  // Filter orders by zone for sellers
  const visibleOrders = useMemo(() => {
    return isAdmin ? orders : orders.filter((o) => o.zone === currentUser.zone);
  }, [orders, isAdmin, currentUser.zone]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visibleOrders;
    return visibleOrders.filter((o) => {
      const fullText = `${o.id} ${o.customer} ${o.clientSnapshot?.code || ''} ${o.clientSnapshot?.company || ''} ${o.zone || ''} ${o.seller || ''}`.toLowerCase();
      return fullText.includes(term);
    });
  }, [visibleOrders, search]);

  const handleExport = (order: Order, format: 'excel' | 'pdf') => {
    const ok = exportOrder(order, format, orders);
    const docName = getOrderDocumentName(order, orders);
    showToast(
      ok
        ? `Documento ${docName}.${format === 'excel' ? 'xlsx' : 'pdf'} descargado.`
        : 'No se pudo generar el documento.'
    );
  };

  const handleConfirmDelete = () => {
    if (!orderToDelete) return;
    if (onDeleteOrder) {
      onDeleteOrder(orderToDelete.id, restoreStockOnDelete);
    }
    if (activeOrder?.id === orderToDelete.id) {
      setActiveOrder(null);
    }
    setOrderToDelete(null);
  };

  return (
    <section className="view active">
      <div className="page-heading">
        <div>
          <div className="eyebrow">HISTORIAL</div>
          <h1>Órdenes</h1>
          <p className="subheading">
            {isAdmin
              ? 'Historial de todas las ventas registradas. Revisa, comparte en PDF o Excel, envía por WhatsApp directo, edita o elimina órdenes con errores.'
              : `Órdenes correspondientes a tu zona asignada (${currentUser.zone}).`}
          </p>
        </div>
      </div>

      <div className="panel table-panel orders-panel">
        <div className="panel-head">
          <div>
            <h2>Ventas registradas</h2>
            <span className="muted">
              {visibleOrders.length} {visibleOrders.length === 1 ? 'orden' : 'órdenes'} en total
            </span>
          </div>

          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Buscar orden o cliente…"
              aria-label="Buscar órdenes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* Mobile order cards (Tightly coupled mobile view) */}
        <div className="mobile-orders-list mobile-only" aria-label="Lista de órdenes para móvil">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => {
              const docName = getOrderDocumentName(order, orders);
              return (
                <div key={order.id} className="mobile-order-card">
                  <div className="mobile-order-card-header">
                    <div>
                      <span className="mobile-order-code">{order.clientSnapshot?.code || '—'}</span>
                      <strong className="mobile-order-company">
                        {order.clientSnapshot?.company || order.customer}
                      </strong>
                    </div>
                    <span className="stock-pill mobile-zone-pill">
                      {order.zone || order.clientSnapshot?.zone || '—'}
                    </span>
                  </div>

                  <div className="mobile-order-card-body">
                    <span className="mobile-order-doc">Doc: {docName}</span>
                    <span className="mobile-order-date">{formatDate(order.date)}</span>
                    <span className="mobile-order-items">
                      {order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'}
                    </span>
                    <strong className="mobile-order-total">{formatMoney(order.total)}</strong>
                  </div>

                  {/* Tightly coupled mobile action bar */}
                  <div className="mobile-coupled-doc-strip" role="group" aria-label="Acciones de la orden">
                    <button
                      type="button"
                      className="mobile-doc-action-btn"
                      onClick={() => setActiveOrder(order)}
                      title="Ver detalle completo"
                    >
                      👁 Ver
                    </button>
                    <button
                      type="button"
                      className="mobile-doc-action-btn primary-doc-btn"
                      onClick={() => setShareOrder(order)}
                      title="Compartir o descargar orden (Excel, PDF o WhatsApp)"
                    >
                      ↗ Compartir
                    </button>
                    <button
                      type="button"
                      className="mobile-doc-action-btn"
                      onClick={() => handleExport(order, 'pdf')}
                      title={`Descargar PDF (${docName}.pdf)`}
                    >
                      📄 PDF
                    </button>
                    <button
                      type="button"
                      className="mobile-doc-action-btn"
                      onClick={() => handleExport(order, 'excel')}
                      title={`Descargar Excel (${docName}.xlsx)`}
                    >
                      📊 Excel
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="mobile-doc-action-btn danger-doc-btn"
                        onClick={() => {
                          setRestoreStockOnDelete(true);
                          setOrderToDelete(order);
                        }}
                        title="Eliminar orden con error"
                      >
                        🗑
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-orders" style={{ padding: '30px 10px', textAlign: 'center' }}>
              <span>⌑</span>
              <strong>No se encontraron órdenes</strong>
              <small>Prueba con otro término de búsqueda o cambia de zona.</small>
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <div className="table-scroll desktop-only">
          <table>
            <thead>
              <tr>
                <th>CÓDIGO DE CLIENTE</th>
                <th>NOMBRE DE LA EMPRESA</th>
                <th>ZONA ASIGNADA</th>
                <th>FECHA DE LA ORDEN</th>
                <th style={{ textAlign: 'right' }}>ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const docName = getOrderDocumentName(order, orders);
                  return (
                    <tr key={order.id}>
                      <td className="order-id">{order.clientSnapshot?.code || '—'}</td>
                      <td className="item-name">
                        <div>{order.clientSnapshot?.company || order.customer}</div>
                        <small style={{ color: '#8d9890', fontSize: '10px' }}>
                          Doc: {docName} · Ref: {order.id} · {order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'} · Total: {formatMoney(order.total)}
                        </small>
                      </td>
                      <td>
                        <span className="stock-pill" style={{ background: '#eaf3ed', color: '#225c44' }}>
                          {order.zone || order.clientSnapshot?.zone || '—'}
                        </span>
                      </td>
                      <td>{formatDate(order.date)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="doc-actions coupled-doc-actions" style={{ justifyContent: 'flex-end', gap: '4px', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="doc-button"
                            onClick={() => setActiveOrder(order)}
                          >
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            className="doc-button"
                            style={{ color: '#166534', borderColor: '#b8e7cf', background: '#f5faf7', fontWeight: 600 }}
                            onClick={() => setShareOrder(order)}
                            title="Compartir o descargar orden (Excel, PDF o WhatsApp)"
                          >
                            ↗ Compartir / Docs
                          </button>
                          <button
                            type="button"
                            className="doc-button"
                            onClick={() => handleExport(order, 'pdf')}
                            title={`Descargar PDF (${docName}.pdf)`}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="doc-button"
                            onClick={() => handleExport(order, 'excel')}
                            title={`Descargar Excel (${docName}.xlsx)`}
                          >
                            Excel
                          </button>

                          {isAdmin && (
                            <button
                              type="button"
                              className="doc-button"
                              style={{
                                color: '#b91c1c',
                                borderColor: '#fca5a5',
                                background: '#fff5f5',
                                fontWeight: 600,
                              }}
                              onClick={() => {
                                setRestoreStockOnDelete(true);
                                setOrderToDelete(order);
                              }}
                              title="Eliminar esta orden con error y restaurar stock"
                            >
                              🗑 Borrar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: 'center', padding: '40px', color: '#9aa49d' }}
                  >
                    {visibleOrders.length === 0
                      ? 'Aún no se han generado órdenes de venta en esta zona.'
                      : 'No se encontraron órdenes con ese criterio de búsqueda.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {activeOrder && !isEditingOrder && (
        <div className="modal-overlay" onClick={() => setActiveOrder(null)}>
          <div
            className="order-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-head">
              <div>
                <div className="eyebrow">DETALLE DE ORDEN</div>
                <h2 style={{ fontSize: '19px' }}>
                  Documento: <span style={{ color: '#225c44' }}>{getOrderDocumentName(activeOrder, orders)}</span>
                </h2>
                <p className="muted" style={{ margin: '4px 0 0', fontSize: '12px' }}>
                  <b>Ref. Sistema:</b> {activeOrder.id} · <b>Cliente:</b> {activeOrder.clientSnapshot?.code || '—'} · {activeOrder.clientSnapshot?.company || activeOrder.customer}
                  {' · '}
                  <b>Zona:</b> {activeOrder.zone || activeOrder.clientSnapshot?.zone || '—'}
                  {' · '}
                  <b>Fecha:</b> {formatDate(activeOrder.date)}
                  {activeOrder.seller && ` · Vendedor: ${activeOrder.seller}`}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setActiveOrder(null)}
                aria-label="Cerrar detalle"
              >
                ×
              </button>
            </div>

            <div className="detail-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>CÓDIGO</th>
                    <th>ARTÍCULO / DESCRIPCIÓN</th>
                    <th style={{ textAlign: 'center' }}>CANT.</th>
                    <th style={{ textAlign: 'right' }}>PRECIO</th>
                    <th style={{ textAlign: 'right' }}>ITBIS %</th>
                    <th style={{ textAlign: 'right' }}>SUBTOTAL</th>
                    <th style={{ textAlign: 'right' }}>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {activeOrder.items.map((item, idx) => {
                    const subtotal = Number(item.subtotal) || item.price * item.quantity;
                    const taxRate = Number(item.taxRate) || 0;
                    const taxAmount = Number(item.taxAmount) || (subtotal * taxRate) / 100;
                    const total = Number(item.totalWithTax) || subtotal + taxAmount;
                    return (
                      <tr key={idx}>
                        <td className="code-cell" style={{ fontWeight: 600 }}>{item.code || '—'}</td>
                        <td className="item-name">
                          <div>{item.description || item.name}</div>
                          <small style={{ color: '#8d9890' }}>{item.unit || 'Unidad'}</small>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <b>{item.quantity}</b>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(item.price)}</td>
                        <td style={{ textAlign: 'right' }}>{taxRate > 0 ? `${taxRate}%` : '0%'}</td>
                        <td style={{ textAlign: 'right' }}>{formatMoney(subtotal)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatMoney(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="detail-total">
              <span>Total de la orden con ITBIS</span>
              <strong>{formatMoney(activeOrder.total)}</strong>
            </div>

            <div className="detail-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
              <button
                type="button"
                className="secondary-button"
                style={{ borderColor: '#225c44', color: '#225c44', fontWeight: 600 }}
                onClick={() => setShareOrder(activeOrder)}
              >
                ↗ Compartir / WhatsApp / Docs
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleExport(activeOrder, 'excel')}
              >
                ↓ Excel
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleExport(activeOrder, 'pdf')}
              >
                ↓ PDF
              </button>
              {isAdmin && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsEditingOrder(true)}
                >
                  ✎ Editar orden
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ borderColor: '#fca5a5', color: '#b91c1c', background: '#fff5f5', fontWeight: 600 }}
                  onClick={() => {
                    setRestoreStockOnDelete(true);
                    setOrderToDelete(activeOrder);
                  }}
                >
                  🗑 Borrar orden con error
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Order Editor Modal */}
      {isEditingOrder && activeOrder && (
        <OrderEditorModal
          order={activeOrder}
          products={products}
          clients={clients}
          orders={orders}
          onSave={(updatedOrder, updatedProducts) => {
            onUpdateOrder(updatedOrder, updatedProducts);
            setActiveOrder(updatedOrder);
            setIsEditingOrder(false);
          }}
          onClose={() => setIsEditingOrder(false)}
          showToast={showToast}
        />
      )}

      {/* Share / WhatsApp & Download Modal */}
      {shareOrder && (
        <ShareOrderModal
          order={shareOrder}
          allOrders={orders}
          currentUser={currentUser}
          onUpdateUserWhatsapp={onUpdateUserWhatsapp}
          onClose={() => setShareOrder(null)}
          showToast={showToast}
        />
      )}

      {/* Delete Order Confirmation Dialog (Admin only) */}
      {orderToDelete && (
        <div className="modal-overlay" onClick={() => setOrderToDelete(null)}>
          <div
            className="product-dialog"
            style={{ width: 'min(480px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-head" style={{ marginBottom: '12px' }}>
              <div>
                <div className="eyebrow" style={{ color: '#b91c1c', fontWeight: 700 }}>
                  ⚠️ ACCIÓN DE ADMINISTRADOR
                </div>
                <h2 style={{ fontSize: '18px', color: '#991b1b' }}>
                  ¿Eliminar orden con error?
                </h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setOrderToDelete(null)}
                aria-label="Cancelar eliminación"
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#4b5563', margin: '0 0 14px 0', lineHeight: '1.4' }}>
              Esta acción eliminará permanentemente la orden del historial. Es ideal para corregir órdenes creadas con errores o equivocaciones.
            </p>

            {/* Order details summary card */}
            <div
              style={{
                background: '#fff8f8',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                fontSize: '12px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#6b7280' }}>Documento:</span>
                <strong style={{ color: '#111827' }}>{getOrderDocumentName(orderToDelete, orders)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#6b7280' }}>Ref. Sistema:</span>
                <span>{orderToDelete.id}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#6b7280' }}>Cliente:</span>
                <span>{orderToDelete.clientSnapshot?.company || orderToDelete.customer}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#6b7280' }}>Total:</span>
                <strong style={{ color: '#991b1b' }}>{formatMoney(orderToDelete.total)}</strong>
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #fee2e2' }}>
                <span style={{ color: '#6b7280', display: 'block', marginBottom: '4px' }}>
                  Artículos en la orden ({orderToDelete.items.length}):
                </span>
                <ul style={{ margin: 0, paddingLeft: '16px', color: '#4b5563' }}>
                  {orderToDelete.items.map((i, idx) => (
                    <li key={idx}>
                      <b>{i.quantity} {i.unit || 'Und'}</b> × {i.description || i.name} ({i.code || 'S/C'})
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Restore stock checkbox */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '18px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={restoreStockOnDelete}
                onChange={(e) => setRestoreStockOnDelete(e.target.checked)}
                style={{ marginTop: '3px', cursor: 'pointer' }}
              />
              <div style={{ fontSize: '12px', lineHeight: '1.35' }}>
                <strong style={{ color: '#166534', display: 'block' }}>
                  Reintegrar artículos al stock de inventario (Recomendado)
                </strong>
                <span style={{ color: '#4b5563', fontSize: '11px' }}>
                  Las cantidades vendidas en esta orden se devolverán al inventario disponible de cada producto.
                </span>
              </div>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOrderToDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="primary-button compact"
                onClick={handleConfirmDelete}
                style={{
                  background: '#dc2626',
                  borderColor: '#b91c1c',
                  color: '#ffffff',
                }}
              >
                🗑 Sí, borrar orden
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
