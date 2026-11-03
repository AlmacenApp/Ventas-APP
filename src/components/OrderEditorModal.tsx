import React, { useState } from 'react';
import { Order, Product, Client, OrderItem } from '../types';
import { formatMoney } from '../services/storage';
import { exportOrder, getOrderDocumentName } from '../services/exports';

interface OrderEditorModalProps {
  order: Order;
  products: Product[];
  clients: Client[];
  orders?: Order[];
  onSave: (updatedOrder: Order, updatedProducts: Product[]) => void;
  onClose: () => void;
  showToast: (msg: string) => void;
}

interface EditableLine {
  id: string;
  productId: string;
  quantity: number;
}

export const OrderEditorModal: React.FC<OrderEditorModalProps> = ({
  order,
  products,
  clients,
  orders = [],
  onSave,
  onClose,
  showToast,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    const match = clients.find((c) => c.code === order.clientSnapshot?.code);
    return match ? match.id : '';
  });

  const [lines, setLines] = useState<EditableLine[]>(() => {
    return order.items.map((i, index) => ({
      id: `line-${index}-${i.productId}`,
      productId: i.productId,
      quantity: i.quantity,
    }));
  });

  const handleAddLine = () => {
    const firstProduct = products[0];
    if (!firstProduct) {
      showToast('No hay artículos disponibles en el catálogo.');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}-${prev.length}`,
        productId: firstProduct.id,
        quantity: 1,
      },
    ]);
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  const handleProductChange = (lineId: string, productId: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, productId } : l))
    );
  };

  const handleQuantityChange = (lineId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === lineId ? { ...l, quantity: Math.max(1, quantity) } : l
      )
    );
  };

  // Calculate live totals
  const total = lines.reduce((sum, line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) return sum;
    const base = product.price * line.quantity;
    const tax = (base * (Number(product.taxRate) || 0)) / 100;
    return sum + base + tax;
  }, 0);

  const handleSubmit = (e?: React.FormEvent, exportFormat?: 'pdf' | 'excel') => {
    if (e) e.preventDefault();

    if (lines.length === 0) {
      showToast('La orden debe tener al menos un artículo.');
      return;
    }

    // Previous quantities held by this order
    const previousQtyMap: Record<string, number> = {};
    order.items.forEach((item) => {
      previousQtyMap[item.productId] = (previousQtyMap[item.productId] || 0) + item.quantity;
    });

    // Newly requested quantities
    const newQtyMap: Record<string, number> = {};
    const newItems: OrderItem[] = [];

    for (const line of lines) {
      const product = products.find((p) => p.id === line.productId);
      if (!product) {
        showToast('Hay un artículo no válido en las líneas.');
        return;
      }
      newQtyMap[line.productId] = (newQtyMap[line.productId] || 0) + line.quantity;

      const subtotal = product.price * line.quantity;
      const taxRate = Number(product.taxRate) || 0;
      const taxAmount = (subtotal * taxRate) / 100;
      const totalWithTax = subtotal + taxAmount;

      newItems.push({
        productId: product.id,
        code: product.code,
        name: product.description || product.name,
        description: product.description || product.name,
        unit: product.unit || 'Unidad',
        category: product.category || product.unit || 'Unidad',
        price: product.price,
        taxRate,
        quantity: line.quantity,
        subtotal,
        taxAmount,
        totalWithTax,
      });
    }

    // Verify stock availability: live stock + what was returned from original order >= requested
    for (const [productId, reqQty] of Object.entries(newQtyMap)) {
      const product = products.find((p) => p.id === productId);
      if (!product) continue;
      const returned = previousQtyMap[productId] || 0;
      const maxAvailable = product.stock + returned;

      if (reqQty > maxAvailable) {
        showToast(
          `Stock insuficiente para ${product.description || product.name}. Disponible: ${maxAvailable}.`
        );
        return;
      }
    }

    // Adjust products stock
    const updatedProducts = products.map((p) => {
      const returned = previousQtyMap[p.id] || 0;
      const requested = newQtyMap[p.id] || 0;
      return {
        ...p,
        stock: p.stock + returned - requested,
      };
    });

    const chosenClient = clients.find((c) => c.id === selectedClientId);

    const updatedOrder: Order = {
      ...order,
      customer: chosenClient ? chosenClient.company : 'Cliente general',
      zone: chosenClient ? chosenClient.zone : order.zone,
      clientSnapshot: chosenClient
        ? {
            code: chosenClient.code,
            company: chosenClient.company,
            zone: chosenClient.zone || '',
            address: chosenClient.address,
            phone: chosenClient.phone,
          }
        : order.clientSnapshot,
      items: newItems,
      total,
    };

    onSave(updatedOrder, updatedProducts);
    if (exportFormat) {
      exportOrder(updatedOrder, exportFormat, orders);
      const docName = getOrderDocumentName(updatedOrder, orders);
      showToast(`Orden actualizada y descargada como ${docName}.${exportFormat === 'excel' ? 'xlsx' : 'pdf'}.`);
    } else {
      showToast('Orden actualizada correctamente.');
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-dialog"
        style={{ width: 'min(640px, 100%)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <form onSubmit={handleSubmit}>
          <div className="dialog-head">
            <div>
              <div className="eyebrow">MODIFICAR ORDEN</div>
              <h2>Editar orden {order.id}</h2>
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

          <label className="field-label" htmlFor="edit-customer-select">
            Cliente
          </label>
          <select
            id="edit-customer-select"
            className="text-input"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">Cliente general</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.company} · {c.zone || 'Sin zona'}
              </option>
            ))}
          </select>

          <div className="edit-lines-head">
            <strong>Artículos de la orden</strong>
            <button
              type="button"
              className="text-button"
              onClick={handleAddLine}
            >
              ＋ Agregar artículo
            </button>
          </div>

          <div className="edit-lines">
            {lines.map((line) => {
              const product = products.find((p) => p.id === line.productId);
              return (
                <div key={line.id} className="edit-line">
                  <select
                    className="text-input"
                    value={line.productId}
                    onChange={(e) => handleProductChange(line.id, e.target.value)}
                    required
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} · {p.description || p.name} ({formatMoney(p.price)} / {p.unit})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    className="text-input"
                    value={line.quantity}
                    onChange={(e) =>
                      handleQuantityChange(line.id, parseInt(e.target.value, 10) || 1)
                    }
                    aria-label="Cantidad"
                  />

                  <button
                    type="button"
                    className="icon-button remove-edit-line"
                    onClick={() => handleRemoveLine(line.id)}
                    aria-label="Eliminar línea"
                  >
                    ×
                  </button>

                  <small className="edit-line-price">
                    {product
                      ? `Precio unitario: ${formatMoney(product.price)} · ITBIS: ${product.taxRate || 0}% · Línea: ${formatMoney(
                          product.price * line.quantity * (1 + (product.taxRate || 0) / 100)
                        )}`
                      : 'Producto no encontrado'}
                  </small>
                </div>
              );
            })}
          </div>

          <div className="detail-total">
            <span>Total recalculado</span>
            <strong>{formatMoney(total)}</strong>
          </div>

          <div className="detail-actions" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleSubmit(undefined, 'pdf')}
              title="Guardar cambios y descargar en PDF"
            >
              Guardar y ↓ PDF
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => handleSubmit(undefined, 'excel')}
              title="Guardar cambios y descargar en Excel"
            >
              Guardar y ↓ Excel
            </button>
            <button className="primary-button compact" type="submit">
              Guardar cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
