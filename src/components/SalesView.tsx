import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Product, Client, Order, User, OrderItem, ClientSnapshot } from '../types';
import { formatMoney, generateOrderId } from '../services/storage';
import { ShareOrderModal } from './ShareOrderModal';
import { sortClientsNatural, sortProductsNatural } from '../utils/sorting';

interface SalesViewProps {
  products: Product[];
  clients: Client[];
  orders: Order[];
  currentUser: User;
  onSaveOrder: (newOrder: Order, updatedProducts: Product[]) => void;
  onNavigateToOrders: () => void;
  onUpdateUserWhatsapp?: (userId: string, whatsapp: string) => void;
  showToast: (msg: string) => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  products,
  clients,
  orders,
  currentUser,
  onSaveOrder,
  onNavigateToOrders,
  onUpdateUserWhatsapp,
  showToast,
}) => {
  const isAdmin = currentUser.role === 'admin';

  // All sellers and users can see all clients across all zones, sorted naturally by code (A-Z and 1..N)
  const visibleClients = useMemo(() => {
    return sortClientsNatural(clients);
  }, [clients]);

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  // Special Code 9999 (Ad-hoc / Occasional Client)
  const [is9999Mode, setIs9999Mode] = useState(false);
  const [client9999Name, setClient9999Name] = useState('');
  const [client9999Address, setClient9999Address] = useState('');
  const [client9999Phone, setClient9999Phone] = useState('');
  const [is9999Confirmed, setIs9999Confirmed] = useState(false);

  // Cart: productId -> quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [productSearch, setProductSearch] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const productSuggestionBoxRef = useRef<HTMLDivElement>(null);

  // Newly created order for sharing/downloading modal
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // Close customer suggestions and product suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionBoxRef.current &&
        !suggestionBoxRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
      if (
        productSuggestionBoxRef.current &&
        !productSuggestionBoxRef.current.contains(e.target as Node)
      ) {
        setShowProductSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered customer suggestions
  const customerSuggestions = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) return visibleClients.slice(0, 10);
    return visibleClients
      .filter((c) => `${c.code} ${c.company} ${c.zone} ${c.phone}`.toLowerCase().includes(needle))
      .slice(0, 15);
  }, [visibleClients, customerSearch]);

  const handleSelectCustomer = (client: Client) => {
    setIs9999Mode(false);
    setIs9999Confirmed(false);
    setSelectedClient(client);
    setCustomerSearch(`${client.code} · ${client.company}`);
    setShowSuggestions(false);
  };

  const handleClearCustomer = () => {
    setSelectedClient(null);
    setCustomerSearch('');
    setIs9999Mode(false);
    setIs9999Confirmed(false);
    setClient9999Name('');
    setClient9999Address('');
    setClient9999Phone('');
  };

  const handleActivate9999 = () => {
    setSelectedClient(null);
    setCustomerSearch('9999 · Cliente Ocasional');
    setShowSuggestions(false);
    setIs9999Mode(true);
    setIs9999Confirmed(false);
  };

  const handleConfirm9999 = () => {
    if (!client9999Name.trim()) {
      showToast('Por favor escribe el nombre del cliente para el código 9999.');
      return;
    }
    setIs9999Confirmed(true);
    showToast(`Cliente código 9999 (${client9999Name.trim()}) listo. Ahora puedes agregar artículos.`);
  };

  // Products available to add (stock > quantity in cart), sorted naturally by code (A-Z and 1..N de menor a mayor)
  const availableProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const list = products
      .filter((p) => p.stock > (cart[p.id] || 0))
      .filter((p) => {
        if (!term) return true;
        const text = `${p.code} ${p.description} ${p.name} ${p.unit || ''}`.toLowerCase();
        return text.includes(term);
      });
    return sortProductsNatural(list);
  }, [products, cart, productSearch]);

  const handleAddToCart = (product: Product) => {
    const currentQty = cart[product.id] || 0;
    if (currentQty < product.stock) {
      setCart((prev) => ({
        ...prev,
        [product.id]: currentQty + 1,
      }));
      setProductSearch('');
    } else {
      showToast(`Stock insuficiente para ${product.description || product.name}.`);
    }
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    setCart((prev) => {
      const current = prev[productId] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      }
      if (next > product.stock) {
        showToast(`Stock máximo alcanzado para ${product.description || product.name}.`);
        return prev;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleSetExactQuantity = (productId: string, rawVal: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (rawVal === '') {
      setCart((prev) => ({ ...prev, [productId]: 0 }));
      return;
    }

    const val = parseInt(rawVal, 10);
    if (isNaN(val) || val <= 0) {
      setCart((prev) => {
        const copy = { ...prev };
        delete copy[productId];
        return copy;
      });
      return;
    }

    if (val > product.stock) {
      showToast(`Stock máximo disponible para ${product.description || product.name} es ${product.stock}.`);
      setCart((prev) => ({ ...prev, [productId]: product.stock }));
      return;
    }

    setCart((prev) => ({ ...prev, [productId]: val }));
  };

  const handleClearCart = () => {
    setCart({});
  };

  // Cart summary calculations
  const cartEntries = useMemo(() => {
    return Object.entries(cart)
      .map(([id, quantity]) => {
        const product = products.find((p) => p.id === id);
        if (!product || quantity <= 0) return null;
        const subtotal = product.price * quantity;
        const taxRate = Number(product.taxRate) || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const total = subtotal + taxAmount;
        return {
          product,
          quantity,
          subtotal,
          taxRate,
          taxAmount,
          total,
        };
      })
      .filter(Boolean) as {
      product: Product;
      quantity: number;
      subtotal: number;
      taxRate: number;
      taxAmount: number;
      total: number;
    }[];
  }, [cart, products]);

  const totalItemCount = cartEntries.reduce((sum, item) => sum + item.quantity, 0);
  const cartGrandTotal = cartEntries.reduce((sum, item) => sum + item.total, 0);

  const handleCreateOrder = () => {
    if (cartEntries.length === 0) {
      showToast('Agrega al menos un artículo a la orden.');
      return;
    }

    let orderClientSnapshot: ClientSnapshot | null = null;
    let orderCustomerName = 'Cliente general';

    if (is9999Mode) {
      if (!client9999Name.trim()) {
        showToast('Escribe el nombre del cliente para el código 9999.');
        setIs9999Confirmed(false);
        return;
      }
      orderCustomerName = client9999Name.trim();
      orderClientSnapshot = {
        code: '9999',
        company: client9999Name.trim(),
        zone: currentUser.zone || 'General',
        address: client9999Address.trim() || 'Sin dirección',
        phone: client9999Phone.trim() || 'Sin teléfono',
      };
    } else {
      if (customerSearch.trim() && !selectedClient) {
        showToast('Selecciona un cliente de la lista de sugerencias o usa el Código 9999.');
        return;
      }

      if (selectedClient) {
        orderCustomerName = selectedClient.company;
        orderClientSnapshot = {
          code: selectedClient.code,
          company: selectedClient.company,
          zone: selectedClient.zone || '',
          address: selectedClient.address,
          phone: selectedClient.phone,
        };
      }
    }

    // Verify stock availability
    for (const entry of cartEntries) {
      const liveProduct = products.find((p) => p.id === entry.product.id);
      if (!liveProduct || liveProduct.stock < entry.quantity) {
        showToast(`Stock insuficiente para ${entry.product.description || entry.product.name}.`);
        return;
      }
    }

    const orderItems: OrderItem[] = cartEntries.map((e) => ({
      productId: e.product.id,
      code: e.product.code,
      name: e.product.description || e.product.name,
      description: e.product.description || e.product.name,
      unit: e.product.unit || 'Unidad',
      category: e.product.category || e.product.unit || 'Unidad',
      price: e.product.price,
      taxRate: e.taxRate,
      quantity: e.quantity,
      subtotal: e.subtotal,
      taxAmount: e.taxAmount,
      totalWithTax: e.total,
    }));

    const newOrderId = generateOrderId(orders);
    const newOrder: Order = {
      id: newOrderId,
      date: new Date().toISOString(),
      customer: orderCustomerName,
      clientSnapshot: orderClientSnapshot,
      items: orderItems,
      total: cartGrandTotal,
      zone: currentUser.zone || orderClientSnapshot?.zone || '',
      seller: currentUser.username,
    };

    // Deduct stock from products
    const updatedProducts = products.map((prod) => {
      const purchased = cart[prod.id] || 0;
      if (purchased > 0) {
        return {
          ...prod,
          stock: Math.max(0, prod.stock - purchased),
        };
      }
      return prod;
    });

    onSaveOrder(newOrder, updatedProducts);

    // Clear state
    setCart({});
    setSelectedClient(null);
    setCustomerSearch('');
    setIs9999Mode(false);
    setIs9999Confirmed(false);
    setClient9999Name('');
    setClient9999Address('');
    setClient9999Phone('');

    // Open sharing / download modal
    setCreatedOrder(newOrder);
    showToast(`Orden ${newOrder.id} creada y guardada con éxito.`);
  };

  return (
    <section className="view active">
      <div className="page-heading">
        <div>
          <div className="eyebrow">PUNTO DE VENTA</div>
          <h1 style={{ fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--ink)' }}>
            Nueva Orden
          </h1>
          <p className="subheading">
            Busca y agrega artículos con cálculo automático de ITBIS para completar la orden.
          </p>
        </div>
        <div className="order-tag">
          <span className="live-dot"></span> Nueva orden
        </div>
      </div>

      <div className="order-builder panel">
        <div className="builder-top">
          <div>
            <h2>Datos de la orden</h2>
            <span className="muted">Selecciona cualquier cliente o usa Código 9999 para cliente rápido.</span>
          </div>

          {!is9999Mode && !selectedClient && (
            <button
              type="button"
              className="secondary-button"
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#225c44',
                background: '#ebf5ee',
                borderColor: '#c6dfcc',
                padding: '6px 12px',
              }}
              onClick={handleActivate9999}
              title="Crear orden rápida con código 9999 ingresando nombre, dirección y teléfono"
            >
              ⚡ Código 9999: Cliente rápido
            </button>
          )}
        </div>

        {/* Client selector with autocomplete (Visible to all zones) */}
        {!is9999Mode ? (
          <div style={{ position: 'relative' }} ref={suggestionBoxRef}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label className="field-label" htmlFor="customer-search-input" style={{ margin: 0 }}>
                Cliente <small style={{ color: '#62a47d' }}>(Todas las zonas disponibles)</small>
              </label>
            </div>

            <div className="coupled-input-wrap">
              <input
                id="customer-search-input"
                className="text-input customer-picker"
                autoComplete="off"
                placeholder="Escribe código (ej. 1, CLI-001 o 9999) o nombre del cliente…"
                value={customerSearch}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerSearch(val);
                  setSelectedClient(null);
                  setShowSuggestions(true);
                  if (val.trim() === '9999') {
                    handleActivate9999();
                  }
                }}
                onFocus={() => setShowSuggestions(true)}
              />
              {selectedClient && (
                <button
                  type="button"
                  className="coupled-clear-button"
                  onClick={handleClearCustomer}
                  title="Quitar cliente seleccionado"
                >
                  ✕ Limpiar
                </button>
              )}
            </div>

            {showSuggestions && (
              <div className="customer-suggestions">
                {/* 9999 Quick Option at top of suggestions */}
                <button
                  type="button"
                  className="customer-option"
                  style={{ background: '#f5faf7', borderBottom: '1px solid #dcebe1' }}
                  onClick={handleActivate9999}
                >
                  <strong style={{ color: '#225c44' }}>⚡ 9999</strong>
                  <span>Cliente Ocasional / Rápido</span>
                  <small style={{ color: '#225c44', fontWeight: 600 }}>Llenar nombre, dirección y teléfono</small>
                </button>

                {customerSuggestions.length > 0 ? (
                  customerSuggestions.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="customer-option"
                      onClick={() => handleSelectCustomer(c)}
                    >
                      <strong>{c.code}</strong>
                      <span>{c.company}</span>
                      <small>{c.zone || 'Zona sin asignar'}</small>
                    </button>
                  ))
                ) : (
                  <div className="customer-no-results">
                    No se encontraron clientes registrados con "{customerSearch}". Puedes usar el <b>Código 9999</b> arriba.
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* CODE 9999 INLINE FORM */
          <div
            style={{
              background: '#f6fbf8',
              border: '1.5px solid #225c44',
              borderRadius: '10px',
              padding: '16px',
              marginTop: '8px',
              boxShadow: '0 4px 16px rgba(34, 92, 68, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    background: '#225c44',
                    color: '#fff',
                    padding: '3px 10px',
                    borderRadius: '6px',
                    fontWeight: 800,
                    fontSize: '12px',
                    letterSpacing: '0.05em',
                  }}
                >
                  CÓDIGO 9999
                </span>
                <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                  Cliente Ocasional / Rápido
                </strong>
              </div>
              <button
                type="button"
                className="text-button"
                style={{ fontSize: '11px', color: '#c44536' }}
                onClick={handleClearCustomer}
              >
                ✕ Cancelar y volver al directorio
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#55655b', margin: '0 0 14px 0', lineHeight: '1.4' }}>
              Completa los datos del cliente para asociarlos directamente a este pedido sin necesidad de registrarlo previamente en el catálogo:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              <div>
                <label className="field-label" htmlFor="input-9999-name" style={{ fontSize: '11px', marginBottom: '4px' }}>
                  Nombre del cliente o compañía <span style={{ color: '#c44536' }}>*</span>
                </label>
                <input
                  id="input-9999-name"
                  className="text-input"
                  style={{ background: '#fff' }}
                  required
                  placeholder="Ej. Comercial Los Ángeles / Juan Pérez"
                  value={client9999Name}
                  onChange={(e) => setClient9999Name(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="field-label" htmlFor="input-9999-address" style={{ fontSize: '11px', marginBottom: '4px' }}>
                  Dirección
                </label>
                <input
                  id="input-9999-address"
                  className="text-input"
                  style={{ background: '#fff' }}
                  placeholder="Ej. Av. Duarte #45, Santo Domingo"
                  value={client9999Address}
                  onChange={(e) => setClient9999Address(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="input-9999-phone" style={{ fontSize: '11px', marginBottom: '4px' }}>
                  Número de teléfono
                </label>
                <input
                  id="input-9999-phone"
                  className="text-input"
                  style={{ background: '#fff' }}
                  type="tel"
                  placeholder="Ej. 809-555-0199"
                  value={client9999Phone}
                  onChange={(e) => setClient9999Phone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '11px', color: '#68756c' }}>
                Zona de facturación: <b>{currentUser.zone || 'General'}</b> • Vendedor: <b>{currentUser.username}</b>
              </span>
              <button
                type="button"
                className="primary-button compact"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={handleConfirm9999}
              >
                {is9999Confirmed ? '✓ Datos fijados' : 'Continuar con la orden →'}
              </button>
            </div>
          </div>
        )}

        {/* Selected Standard Client Card */}
        {!is9999Mode && selectedClient && (
          <div className="client-card">
            <strong>{selectedClient.company}</strong>
            <span>
              <b>Código:</b> {selectedClient.code}
            </span>
            <span>
              <b>Zona asignada:</b> {selectedClient.zone || '—'}
            </span>
            <span>
              <b>Dirección:</b> {selectedClient.address}
            </span>
            <span>
              <b>Teléfono:</b> {selectedClient.phone}
            </span>
          </div>
        )}

        {/* Search & Add Article (Floating autocomplete dropdown only when searching) */}
        <div style={{ position: 'relative', marginTop: '14px' }} ref={productSuggestionBoxRef}>
          <div className="picker-heading" style={{ marginTop: 0 }}>
            <label className="field-label" htmlFor="product-search-input" style={{ margin: 0 }}>
              Buscar y agregar artículo <small style={{ color: '#62a47d' }}>(De menor a mayor A-Z · 1..N)</small>
            </label>
            {productSearch.trim() && (
              <span className="muted">
                {availableProducts.length} {availableProducts.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            )}
          </div>

          <div style={{ position: 'relative', marginTop: '6px' }}>
            <div className="search-box product-search-box" style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ marginRight: '6px', fontSize: '18px', color: '#8d988f' }}>⌕</span>
              <input
                id="product-search-input"
                type="search"
                autoComplete="off"
                placeholder="Escribe código o nombre del producto para agregarlo…"
                aria-label="Buscar y agregar artículo"
                value={productSearch}
                onChange={(e) => {
                  setProductSearch(e.target.value);
                  setShowProductSuggestions(true);
                }}
                onFocus={() => {
                  if (productSearch.trim().length > 0) setShowProductSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (availableProducts.length > 0) {
                      handleAddToCart(availableProducts[0]);
                    }
                  }
                  if (e.key === 'Escape') {
                    setShowProductSuggestions(false);
                  }
                }}
              />
              {productSearch.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setProductSearch('');
                    setShowProductSuggestions(false);
                  }}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: '#8d988f',
                    cursor: 'pointer',
                    fontSize: '17px',
                    padding: '0 4px',
                    lineHeight: 1,
                  }}
                  title="Limpiar búsqueda"
                >
                  ×
                </button>
              )}
            </div>

            {/* Floating popover dropdown results only when searching */}
            {showProductSuggestions && productSearch.trim().length > 0 && (
              <div
                className="customer-suggestions"
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 35,
                  maxHeight: '280px',
                  boxShadow: '0 12px 32px rgba(32, 48, 39, 0.16)',
                }}
                aria-live="polite"
              >
                {availableProducts.length > 0 ? (
                  availableProducts.slice(0, 10).map((p) => {
                    const inCart = cart[p.id] || 0;
                    const left = p.stock - inCart;
                    return (
                      <div
                        key={p.id}
                        className="suggestion-item"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px minmax(0, 1fr) auto auto',
                          gap: '10px',
                          alignItems: 'center',
                          padding: '9px 12px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleAddToCart(p)}
                      >
                        <span className="suggestion-code">{p.code}</span>
                        <span className="suggestion-main">
                          <strong>{p.description || p.name}</strong>
                          <small>
                            {p.unit || 'Unidad'} · {left} disponibles · ITBIS {p.taxRate || 0}%
                          </small>
                        </span>
                        <span className="suggestion-price">
                          {formatMoney(p.price)}
                        </span>
                        <button
                          type="button"
                          className="primary-button compact"
                          style={{
                            height: '30px',
                            minHeight: '30px',
                            padding: '0 10px',
                            fontSize: '11px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(p);
                          }}
                        >
                          ＋ Agregar
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="suggestion-empty" style={{ padding: '20px' }}>
                    No se encontraron artículos con existencia para "{productSearch}".
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Cart items list */}
        <div className="selected-items-head">
          <div>
            <h2>Artículos de la orden</h2>
            <span className="muted">
              {totalItemCount} {totalItemCount === 1 ? 'artículo' : 'artículos'}
            </span>
          </div>
          {cartEntries.length > 0 && (
            <button
              className="text-button"
              type="button"
              onClick={handleClearCart}
            >
              Limpiar orden
            </button>
          )}
        </div>

        <div className="cart-items">
          {cartEntries.length === 0 ? (
            <div className="empty-cart">
              <span className="empty-basket">⌑</span>
              <strong>La orden está vacía</strong>
              <span>Usa el buscador de arriba para agregar artículos a la orden</span>
            </div>
          ) : (
            cartEntries.map(({ product, quantity, subtotal, taxRate, taxAmount, total }) => (
              <div key={product.id} className="cart-line">
                <div>
                  <div className="cart-line-title">
                    <span style={{ color: '#225c44', fontWeight: 700, marginRight: '6px' }}>
                      {product.code}
                    </span>
                    {product.description || product.name}
                  </div>
                  <div className="cart-line-price">
                    {quantity} {product.unit || 'Unidad'} × {formatMoney(product.price)} · Subtotal {formatMoney(subtotal)}
                    {taxRate > 0 ? ` · ITBIS ${taxRate}% (${formatMoney(taxAmount)})` : ' · Exento de ITBIS'}
                    {' = '}
                    <b style={{ color: '#225c44' }}>{formatMoney(total)}</b>
                  </div>
                </div>

                <div className="quantity-control" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    aria-label="Quitar uno"
                    onClick={() => handleUpdateQuantity(product.id, -1)}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={product.stock}
                    className="quantity-input"
                    value={quantity === 0 ? '' : quantity}
                    onChange={(e) => handleSetExactQuantity(product.id, e.target.value)}
                    onBlur={() => {
                      if (!cart[product.id] || cart[product.id] < 1) {
                        handleSetExactQuantity(product.id, '1');
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                    title={`Editar cantidad manualmente (Máximo disponible: ${product.stock})`}
                    aria-label={`Cantidad para ${product.description || product.name}`}
                  />
                  <button
                    type="button"
                    aria-label="Agregar uno"
                    disabled={quantity >= product.stock}
                    onClick={() => handleUpdateQuantity(product.id, 1)}
                  >
                    ＋
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart footer (Tightly coupled on mobile) */}
        <div className="cart-footer mobile-docked-footer">
          <div className="total-row">
            <span>Total con ITBIS</span>
            <strong>{formatMoney(cartGrandTotal)}</strong>
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={totalItemCount === 0}
            onClick={handleCreateOrder}
          >
            Generar orden <span>→</span>
          </button>
        </div>
      </div>

      {/* Share & Download modal upon creating order */}
      {createdOrder && (
        <ShareOrderModal
          order={createdOrder}
          allOrders={[createdOrder, ...orders]}
          isNewlyCreated={true}
          currentUser={currentUser}
          onUpdateUserWhatsapp={onUpdateUserWhatsapp}
          onClose={() => setCreatedOrder(null)}
          onNavigateToOrders={() => {
            setCreatedOrder(null);
            onNavigateToOrders();
          }}
          onNewSale={() => {
            setCreatedOrder(null);
          }}
          showToast={showToast}
        />
      )}
    </section>
  );
};
