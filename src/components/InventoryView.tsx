import React, { useState, useMemo, useRef } from 'react';
import { Product, User } from '../types';
import { formatMoney } from '../services/storage';
import { downloadTemplate, parseProductsSpreadsheet } from '../services/exports';
import { sortProductsNatural } from '../utils/sorting';

interface InventoryViewProps {
  products: Product[];
  currentUser: User;
  onSaveProduct: (product: Product, isNew: boolean) => void;
  onDeleteProduct: (productId: string) => void;
  onBulkAddProducts: (newProducts: Product[]) => void;
  onBulkUpdateProducts: (updatedProducts: Product[]) => void;
  showToast: (msg: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  currentUser,
  onSaveProduct,
  onDeleteProduct,
  onBulkAddProducts,
  onBulkUpdateProducts,
  showToast,
}) => {
  const isAdmin = currentUser.role === 'admin';

  const [search, setSearch] = useState('');
  const [activeUnit, setActiveUnit] = useState('Todos');

  // Checkbox multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Modal: Add/Edit Single Product
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState('0');
  const [unit, setUnit] = useState('Unidad');
  const [taxRate, setTaxRate] = useState('18');
  const [price, setPrice] = useState('');

  // Modal: General ITBIS
  const [isItbisModalOpen, setIsItbisModalOpen] = useState(false);
  const [generalTaxRate, setGeneralTaxRate] = useState('18');
  const [itbisScope, setItbisScope] = useState<'all' | 'zero_only' | 'selected' | 'prefix'>('all');
  const [itbisPrefix, setItbisPrefix] = useState('');

  // Modal: Batch Price & ITBIS by Code Group
  const [isBatchPriceModalOpen, setIsBatchPriceModalOpen] = useState(false);
  const [batchTargetType, setBatchTargetType] = useState<'prefix' | 'selected' | 'unit' | 'all'>('prefix');
  const [batchPrefix, setBatchPrefix] = useState('');
  const [batchUnit, setBatchUnit] = useState('');
  const [priceOperation, setPriceOperation] = useState<'set' | 'percent_inc' | 'percent_dec' | 'amount_inc' | 'amount_dec' | 'none'>('set');
  const [priceValue, setPriceValue] = useState('');
  const [updateItbisToo, setUpdateItbisToo] = useState(false);
  const [batchItbisRate, setBatchItbisRate] = useState('18');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Stats
  const totalUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + (Number(p.stock) || 0), 0);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return products.filter((p) => p.stock === 0).length;
  }, [products]);

  // Detected code prefixes (e.g. ART, BEB, HOG, etc.)
  const detectedPrefixes = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const c = p.code.trim();
      if (!c) return;
      if (c.includes('-')) {
        const pre = c.split('-')[0].trim().toUpperCase();
        if (pre) set.add(pre);
      } else {
        const match = c.match(/^([A-Za-z]+)/);
        if (match && match[1]) set.add(match[1].toUpperCase());
      }
    });
    return Array.from(set).sort();
  }, [products]);

  // Unit filter options
  const unitOptions = useMemo(() => {
    const units = [...new Set(products.map((p) => p.unit || 'Unidad'))].sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    return ['Todos', ...units];
  }, [products]);

  // Filtered rows, ordered by code ascending (A-Z and 1..N de menor a mayor)
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = products.filter((p) => {
      const matchUnit = activeUnit === 'Todos' || (p.unit || 'Unidad') === activeUnit;
      if (!matchUnit) return false;
      if (!term) return true;
      const fullText = `${p.code} ${p.description} ${p.name} ${p.unit}`.toLowerCase();
      return fullText.includes(term);
    });
    return sortProductsNatural(list);
  }, [products, search, activeUnit]);

  // Toggle selection
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Add/Edit Single Product Handlers
  const handleOpenAddModal = () => {
    if (!isAdmin) {
      showToast('Solo el administrador puede agregar artículos.');
      return;
    }
    setEditingProduct(null);
    setCode('');
    setDescription('');
    setStock('10');
    setUnit('Unidad');
    setTaxRate('18');
    setPrice('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Product) => {
    if (!isAdmin) {
      showToast('Solo el administrador puede editar el inventario.');
      return;
    }
    setEditingProduct(p);
    setCode(p.code);
    setDescription(p.description || p.name);
    setStock(String(p.stock));
    setUnit(p.unit || 'Unidad');
    setTaxRate(String(p.taxRate || 0));
    setPrice(String(p.price));
    setIsModalOpen(true);
  };

  const handleSubmitSingleProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const trimmedCode = code.trim().toUpperCase();
    const trimmedDesc = description.trim();
    const parsedStock = parseInt(stock, 10);
    const parsedPrice = parseFloat(price);
    const parsedTax = parseFloat(taxRate) || 0;
    const formattedUnit = unit.trim() ? unit.trim().charAt(0).toUpperCase() + unit.trim().slice(1) : 'Unidad';

    if (!trimmedCode) {
      showToast('Introduce un código de artículo válido.');
      return;
    }

    if (!trimmedDesc) {
      showToast('Introduce una descripción.');
      return;
    }

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      showToast('Introduce un precio válido mayor a 0.');
      return;
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      showToast('La cantidad debe ser un número entero mayor o igual a 0.');
      return;
    }

    // Check duplicate code
    const isDuplicate = products.some(
      (p) => p.code.toLowerCase() === trimmedCode.toLowerCase() && p.id !== editingProduct?.id
    );

    if (isDuplicate) {
      showToast('Ese código de artículo ya existe en el inventario.');
      return;
    }

    const updatedProduct: Product = {
      id: editingProduct ? editingProduct.id : `p-${Date.now()}`,
      code: trimmedCode,
      name: trimmedDesc,
      description: trimmedDesc,
      unit: formattedUnit,
      category: formattedUnit,
      taxRate: parsedTax,
      price: parsedPrice,
      stock: parsedStock,
      cost: editingProduct?.cost || 0,
    };

    onSaveProduct(updatedProduct, !editingProduct);
    setIsModalOpen(false);
    showToast(editingProduct ? 'Artículo actualizado con éxito.' : 'Artículo agregado al inventario.');
  };

  const handleDelete = (p: Product) => {
    if (!isAdmin) return;
    if (confirm(`¿Eliminar “${p.description || p.name}” (${p.code}) del catálogo?`)) {
      onDeleteProduct(p.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
      showToast('Producto eliminado del inventario.');
    }
  };

  // -------------------------------------------------------------
  // General ITBIS Application
  // -------------------------------------------------------------
  const handleOpenItbisModal = () => {
    setGeneralTaxRate('18');
    setItbisScope(selectedIds.size > 0 ? 'selected' : 'all');
    setItbisPrefix(detectedPrefixes[0] || '');
    setIsItbisModalOpen(true);
  };

  const handleApplyGeneralItbis = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(generalTaxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      showToast('Introduce un porcentaje de ITBIS válido entre 0 y 100.');
      return;
    }

    let targets = [...products];
    if (itbisScope === 'zero_only') {
      targets = targets.filter((p) => !p.taxRate || p.taxRate === 0);
    } else if (itbisScope === 'selected') {
      targets = targets.filter((p) => selectedIds.has(p.id));
    } else if (itbisScope === 'prefix' && itbisPrefix) {
      const needle = itbisPrefix.trim().toUpperCase();
      targets = targets.filter((p) => p.code.toUpperCase().startsWith(needle));
    }

    if (targets.length === 0) {
      showToast('No hay artículos que coincidan con el criterio seleccionado.');
      return;
    }

    const updated = targets.map((p) => ({
      ...p,
      taxRate: rate,
    }));

    onBulkUpdateProducts(updated);
    setIsItbisModalOpen(false);
    showToast(`ITBIS general del ${rate}% aplicado a ${updated.length} artículo(s).`);
  };

  // -------------------------------------------------------------
  // Batch Price & ITBIS by Code Group / Prefix
  // -------------------------------------------------------------
  const handleOpenBatchPriceModal = () => {
    setBatchTargetType(selectedIds.size > 0 ? 'selected' : 'prefix');
    setBatchPrefix(detectedPrefixes[0] || '');
    setBatchUnit(unitOptions.find((u) => u !== 'Todos') || 'Unidad');
    setPriceOperation('set');
    setPriceValue('');
    setUpdateItbisToo(false);
    setBatchItbisRate('18');
    setIsBatchPriceModalOpen(true);
  };

  // Products targeted for batch operation
  const batchMatchingProducts = useMemo(() => {
    if (batchTargetType === 'selected') {
      return products.filter((p) => selectedIds.has(p.id));
    }
    if (batchTargetType === 'prefix') {
      const pre = batchPrefix.trim().toUpperCase();
      if (!pre) return products;
      return products.filter((p) => p.code.toUpperCase().startsWith(pre));
    }
    if (batchTargetType === 'unit') {
      return products.filter((p) => (p.unit || 'Unidad') === batchUnit);
    }
    return products;
  }, [products, batchTargetType, batchPrefix, batchUnit, selectedIds]);

  const computeNewPrice = (current: number): number => {
    const val = parseFloat(priceValue);
    if (isNaN(val) || priceOperation === 'none') return current;

    switch (priceOperation) {
      case 'set':
        return Math.max(0.01, val);
      case 'percent_inc':
        return Math.max(0.01, current * (1 + val / 100));
      case 'percent_dec':
        return Math.max(0.01, current * (1 - val / 100));
      case 'amount_inc':
        return Math.max(0.01, current + val);
      case 'amount_dec':
        return Math.max(0.01, current - val);
      default:
        return current;
    }
  };

  const handleApplyBatchChanges = (e: React.FormEvent) => {
    e.preventDefault();

    if (batchMatchingProducts.length === 0) {
      showToast('No hay artículos en el grupo seleccionado.');
      return;
    }

    if (priceOperation !== 'none') {
      const val = parseFloat(priceValue);
      if (isNaN(val) || (priceOperation === 'set' && val <= 0)) {
        showToast('Introduce un valor de precio válido mayor a 0.');
        return;
      }
    }

    const itbisNum = parseFloat(batchItbisRate);
    if (updateItbisToo && (isNaN(itbisNum) || itbisNum < 0 || itbisNum > 100)) {
      showToast('Introduce un porcentaje de ITBIS válido entre 0 y 100.');
      return;
    }

    const updated = batchMatchingProducts.map((p) => {
      const newP = priceOperation !== 'none' ? Math.round(computeNewPrice(p.price) * 100) / 100 : p.price;
      return {
        ...p,
        price: newP,
        taxRate: updateItbisToo ? itbisNum : p.taxRate,
      };
    });

    onBulkUpdateProducts(updated);
    setIsBatchPriceModalOpen(false);
    showToast(`Precios e ITBIS actualizados en ${updated.length} artículo(s) del grupo.`);
  };

  // File import
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const existingCodes = new Set(products.map((p) => p.code.toLowerCase()));
      const { added, skipped } = await parseProductsSpreadsheet(file, existingCodes);
      if (added.length > 0) {
        onBulkAddProducts(added);
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
          <div className="eyebrow">CONTROL DE STOCK &amp; PRECIOS</div>
          <h1>Inventario</h1>
          <p className="subheading">
            Catálogo de productos, existencias en tiempo real, gestión de precios por grupo y asignación general de ITBIS.
          </p>
        </div>

        <div className="heading-actions coupled-actions-bar">
          {isAdmin && (
            <>
              <button
                type="button"
                className="primary-button compact main-action-btn"
                onClick={handleOpenAddModal}
              >
                <span>＋</span> Agregar artículo
              </button>

              <div className="secondary-actions-strip" role="toolbar" aria-label="Acciones de inventario">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleOpenBatchPriceModal}
                  title="Modificar precios en bloque por código o grupo"
                  style={{ color: '#225c44', fontWeight: 600 }}
                >
                  🏷 Precios por grupo
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleOpenItbisModal}
                  title="Establecer ITBIS general a los artículos"
                  style={{ color: '#225c44', fontWeight: 600 }}
                >
                  ⚙ ITBIS General
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => downloadTemplate('products')}
                  title="Descargar plantilla Excel para inventario con hoja de instrucciones y ejemplos"
                >
                  📋 Plantilla Excel
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsGuideOpen(true)}
                  title="Ver cómo llenar los campos de inventario en pantalla"
                >
                  ℹ Guía
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Importar lista de productos desde Excel (se ordenarán alfabéticamente A-Z)"
                >
                  ↑ Importar
                </button>
              </div>
            </>
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

      {/* Stats Cards */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-label">Artículos en catálogo</div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-foot">{detectedPrefixes.length} grupos de código detectados</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Unidades en existencia</div>
          <div className="stat-value">{totalUnits}</div>
          <div className="stat-foot">
            {outOfStockCount > 0
              ? `${outOfStockCount} ${outOfStockCount === 1 ? 'agotado' : 'agotados'}`
              : 'Existencias disponibles'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Stock bajo (≤ 5 uds)</div>
          <div className="stat-value" style={{ color: lowStockCount > 0 ? '#b9793f' : undefined }}>
            {lowStockCount}
          </div>
          <div className="stat-foot">
            {lowStockCount === 1 ? 'artículo requiere reorden' : 'artículos requieren reorden'}
          </div>
        </div>
      </div>

      {/* Table Panel */}
      <div className="panel table-panel">
        <div className="panel-head">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2>Artículos en catálogo</h2>
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
                A-Z Alfabético
              </span>
            </div>
            <span className="muted">{filteredProducts.length} artículos mostrados en orden alfabético</span>
          </div>

          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Buscar por código o descripción…"
              aria-label="Buscar en inventario"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>

        {/* Multi-selection Bar */}
        {isAdmin && selectedIds.size > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#eef5f0',
              border: '1px solid #c9ded0',
              borderRadius: '8px',
              padding: '8px 14px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#225c44',
            }}
          >
            <span>
              <b>{selectedIds.size}</b> {selectedIds.size === 1 ? 'artículo seleccionado' : 'artículos seleccionados'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="secondary-button"
                onClick={handleOpenBatchPriceModal}
                style={{ height: '30px', minHeight: '30px', fontSize: '11px', padding: '0 10px' }}
              >
                🏷 Modificar precios del grupo
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={handleOpenItbisModal}
                style={{ height: '30px', minHeight: '30px', fontSize: '11px', padding: '0 10px' }}
              >
                ⚙ Asignar ITBIS
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setSelectedIds(new Set())}
                style={{ color: '#68756c' }}
              >
                Deseleccionar
              </button>
            </div>
          </div>
        )}

        {/* Unit Filter Chips */}
        {unitOptions.length > 1 && (
          <div className="category-row">
            {unitOptions.map((unitName) => (
              <button
                key={unitName}
                type="button"
                className={`category-chip ${activeUnit === unitName ? 'active' : ''}`}
                onClick={() => setActiveUnit(unitName)}
              >
                {unitName}
              </button>
            ))}
          </div>
        )}

        {/* Products Table */}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: '38px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedIds.size === filteredProducts.length
                      }
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                )}
                <th>CÓDIGO</th>
                <th>DESCRIPCIÓN</th>
                <th>CANTIDAD</th>
                <th>UNIDAD DE MEDIDA</th>
                <th>ITBIS %</th>
                <th>PRECIO (RD$)</th>
                {isAdmin && <th style={{ textAlign: 'right' }}>ACCIONES</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length > 0 ? (
                filteredProducts.map((p) => {
                  let badge = <span className="stock-pill">Disponible</span>;
                  if (p.stock === 0) {
                    badge = <span className="stock-pill out">Agotado</span>;
                  } else if (p.stock <= 5) {
                    badge = <span className="stock-pill low">Stock bajo</span>;
                  }

                  const isChecked = selectedIds.has(p.id);

                  return (
                    <tr
                      key={p.id}
                      style={{ background: isChecked ? '#f5faf6' : undefined }}
                    >
                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectItem(p.id)}
                            aria-label={`Seleccionar ${p.code}`}
                          />
                        </td>
                      )}
                      <td className="order-id">{p.code}</td>
                      <td>
                        <div className="item-name">{p.description || p.name}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, marginRight: '8px' }}>{p.stock}</span>
                        {badge}
                      </td>
                      <td>{p.unit || 'Unidad'}</td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: p.taxRate > 0 ? '#225c44' : '#859088',
                          }}
                        >
                          {p.taxRate || 0}%
                        </span>
                      </td>
                      <td className="item-name">{formatMoney(p.price)}</td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="row-action"
                            onClick={() => handleOpenEditModal(p)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="row-action danger"
                            onClick={() => handleDelete(p)}
                          >
                            Eliminar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={isAdmin ? 8 : 6}
                    style={{ textAlign: 'center', padding: '36px', color: '#9aa49d' }}
                  >
                    No se encontraron artículos con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Aplicar ITBIS General */}
      {/* ------------------------------------------------------------------ */}
      {isItbisModalOpen && (
        <div className="modal-overlay" onClick={() => setIsItbisModalOpen(false)}>
          <div
            className="product-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleApplyGeneralItbis}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow">IMPUESTOS EN INVENTARIO</div>
                  <h2>Aplicar ITBIS General</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsItbisModalOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <p style={{ fontSize: '12px', color: '#68756c', marginTop: 0, marginBottom: '16px' }}>
                Aplica la tasa de ITBIS seleccionada de manera masiva a los artículos de tu catálogo.
              </p>

              <label className="field-label" htmlFor="general-tax-input">
                Tasa de ITBIS (%)
              </label>
              <input
                id="general-tax-input"
                className="text-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={generalTaxRate}
                onChange={(e) => setGeneralTaxRate(e.target.value)}
                autoFocus
              />

              {/* Quick rate buttons */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', marginBottom: '16px' }}>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ height: '30px', minHeight: '30px', fontSize: '11px', padding: '0 10px' }}
                  onClick={() => setGeneralTaxRate('18')}
                >
                  18% (General RD)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ height: '30px', minHeight: '30px', fontSize: '11px', padding: '0 10px' }}
                  onClick={() => setGeneralTaxRate('16')}
                >
                  16%
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ height: '30px', minHeight: '30px', fontSize: '11px', padding: '0 10px' }}
                  onClick={() => setGeneralTaxRate('0')}
                >
                  0% (Exento)
                </button>
              </div>

              <label className="field-label">Alcance de la aplicación</label>
              <div style={{ display: 'grid', gap: '8px', fontSize: '12px', color: '#354239' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="itbis-scope"
                    checked={itbisScope === 'all'}
                    onChange={() => setItbisScope('all')}
                  />
                  <span>Todos los artículos del catálogo ({products.length} artículos)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="itbis-scope"
                    checked={itbisScope === 'zero_only'}
                    onChange={() => setItbisScope('zero_only')}
                  />
                  <span>
                    Solo artículos que actualmente tienen 0% ({products.filter((p) => !p.taxRate || p.taxRate === 0).length} artículos)
                  </span>
                </label>

                {selectedIds.size > 0 && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="itbis-scope"
                      checked={itbisScope === 'selected'}
                      onChange={() => setItbisScope('selected')}
                    />
                    <span>Solo los {selectedIds.size} artículos seleccionados con casilla</span>
                  </label>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="itbis-scope"
                    checked={itbisScope === 'prefix'}
                    onChange={() => setItbisScope('prefix')}
                  />
                  <span>Por prefijo de código</span>
                </label>
              </div>

              {itbisScope === 'prefix' && (
                <div style={{ marginTop: '10px' }}>
                  <input
                    className="text-input"
                    list="itbis-prefix-list"
                    placeholder="Ej. ART, BEB, HOG..."
                    value={itbisPrefix}
                    onChange={(e) => setItbisPrefix(e.target.value.toUpperCase())}
                  />
                  <datalist id="itbis-prefix-list">
                    {detectedPrefixes.map((pre) => (
                      <option key={pre} value={pre} />
                    ))}
                  </datalist>
                </div>
              )}

              <button className="primary-button dialog-submit" type="submit">
                Aplicar ITBIS General <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Modificar Precios e ITBIS por Grupo de Código */}
      {/* ------------------------------------------------------------------ */}
      {isBatchPriceModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBatchPriceModalOpen(false)}>
          <div
            className="product-dialog"
            style={{ width: 'min(640px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleApplyBatchChanges}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow">GESTIÓN MASIVA</div>
                  <h2>Modificar precios por grupo de código</h2>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsBatchPriceModalOpen(false)}
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>

              <label className="field-label" style={{ marginTop: 0 }}>
                1. Selecciona el grupo a modificar
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  className={`category-chip ${batchTargetType === 'prefix' ? 'active' : ''}`}
                  onClick={() => setBatchTargetType('prefix')}
                  style={{ textAlign: 'center' }}
                >
                  Por prefijo de código
                </button>

                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    className={`category-chip ${batchTargetType === 'selected' ? 'active' : ''}`}
                    onClick={() => setBatchTargetType('selected')}
                    style={{ textAlign: 'center' }}
                  >
                    Seleccionados ({selectedIds.size})
                  </button>
                )}

                <button
                  type="button"
                  className={`category-chip ${batchTargetType === 'unit' ? 'active' : ''}`}
                  onClick={() => setBatchTargetType('unit')}
                  style={{ textAlign: 'center' }}
                >
                  Por unidad de medida
                </button>

                <button
                  type="button"
                  className={`category-chip ${batchTargetType === 'all' ? 'active' : ''}`}
                  onClick={() => setBatchTargetType('all')}
                  style={{ textAlign: 'center' }}
                >
                  Todo el catálogo
                </button>
              </div>

              {batchTargetType === 'prefix' && (
                <div>
                  <label className="field-label" htmlFor="batch-prefix-select">
                    Código o prefijo de artículo
                  </label>
                  <input
                    id="batch-prefix-select"
                    className="text-input"
                    list="batch-prefix-list"
                    placeholder="Escribe o selecciona prefijo (ej. ART, BEB, HOG...)"
                    value={batchPrefix}
                    onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                  />
                  <datalist id="batch-prefix-list">
                    {detectedPrefixes.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <small style={{ color: '#859088', display: 'block', marginTop: '4px' }}>
                    Coinciden <b>{batchMatchingProducts.length}</b> artículos con este prefijo.
                  </small>
                </div>
              )}

              {batchTargetType === 'unit' && (
                <div>
                  <label className="field-label" htmlFor="batch-unit-select">
                    Unidad de medida
                  </label>
                  <select
                    id="batch-unit-select"
                    className="text-input"
                    value={batchUnit}
                    onChange={(e) => setBatchUnit(e.target.value)}
                  >
                    {unitOptions
                      .filter((u) => u !== 'Todos')
                      .map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Price Operation */}
              <label className="field-label">2. Operación de precio</label>
              <div className="form-two">
                <div>
                  <select
                    className="text-input"
                    value={priceOperation}
                    onChange={(e) => setPriceOperation(e.target.value as any)}
                  >
                    <option value="set">Fijar nuevo precio (RD$)</option>
                    <option value="percent_inc">Aumentar porcentaje (+%)</option>
                    <option value="percent_dec">Rebajar porcentaje (-%)</option>
                    <option value="amount_inc">Sumar monto fijo (+RD$)</option>
                    <option value="amount_dec">Restar monto fijo (-RD$)</option>
                    <option value="none">No modificar precio</option>
                  </select>
                </div>

                {priceOperation !== 'none' && (
                  <div>
                    <input
                      className="text-input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      placeholder={priceOperation === 'set' ? 'Ej. 250.00' : 'Ej. 10'}
                      value={priceValue}
                      onChange={(e) => setPriceValue(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Optional ITBIS rate */}
              <div style={{ marginTop: '16px', background: '#f5f8f5', padding: '12px', borderRadius: '8px', border: '1px solid #e8efe9' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>
                  <input
                    type="checkbox"
                    checked={updateItbisToo}
                    onChange={(e) => setUpdateItbisToo(e.target.checked)}
                  />
                  <span>Actualizar también el ITBIS % a este grupo</span>
                </label>

                {updateItbisToo && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: '#68756c' }}>Nuevo ITBIS:</span>
                    <input
                      className="text-input"
                      style={{ width: '100px', height: '34px' }}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={batchItbisRate}
                      onChange={(e) => setBatchItbisRate(e.target.value)}
                    />
                    <span style={{ fontSize: '11px', color: '#68756c' }}>%</span>
                  </div>
                )}
              </div>

              {/* Preview table */}
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <b style={{ fontSize: '12px', color: '#202923' }}>
                    Vista previa ({batchMatchingProducts.length} artículos afectados)
                  </b>
                  {batchMatchingProducts.length > 5 && (
                    <small style={{ color: '#859088' }}>Mostrando primeros 5</small>
                  )}
                </div>

                <div className="table-scroll" style={{ maxHeight: '150px', border: '1px solid #edf0ed', borderRadius: '7px' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>CÓDIGO</th>
                        <th>DESCRIPCIÓN</th>
                        <th>PRECIO ACTUAL</th>
                        <th>PRECIO NUEVO</th>
                        {updateItbisToo && <th>ITBIS NUEVO</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {batchMatchingProducts.slice(0, 5).map((p) => {
                        const newP = priceOperation !== 'none' ? computeNewPrice(p.price) : p.price;
                        return (
                          <tr key={p.id}>
                            <td className="order-id">{p.code}</td>
                            <td className="item-name">{p.description || p.name}</td>
                            <td>{formatMoney(p.price)}</td>
                            <td>
                              <b style={{ color: '#225c44' }}>{formatMoney(newP)}</b>
                            </td>
                            {updateItbisToo && (
                              <td>
                                <span style={{ color: '#225c44', fontWeight: 600 }}>
                                  {batchItbisRate}%
                                </span>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="detail-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsBatchPriceModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  className="primary-button compact"
                  type="submit"
                  disabled={batchMatchingProducts.length === 0}
                >
                  Aplicar cambios al grupo ({batchMatchingProducts.length}) <span>→</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Modal: Agregar / Editar Producto Individual */}
      {/* ------------------------------------------------------------------ */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="product-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <form onSubmit={handleSubmitSingleProduct}>
              <div className="dialog-head">
                <div>
                  <div className="eyebrow">CATÁLOGO</div>
                  <h2>{editingProduct ? 'Editar artículo' : 'Agregar artículo'}</h2>
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

              <label className="field-label" htmlFor="product-code-input">
                Código de artículo
              </label>
              <input
                id="product-code-input"
                className="text-input"
                required
                maxLength={32}
                placeholder="Ej. ART-001"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                autoFocus
              />

              <label className="field-label" htmlFor="product-desc-input">
                Descripción del artículo
              </label>
              <textarea
                id="product-desc-input"
                className="text-input text-area"
                required
                maxLength={240}
                placeholder="Nombre y especificaciones del producto"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="form-two">
                <div>
                  <label className="field-label" htmlFor="product-stock-input">
                    Cantidad en existencia
                  </label>
                  <input
                    id="product-stock-input"
                    className="text-input"
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="0"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="product-unit-input">
                    Unidad de medida
                  </label>
                  <input
                    id="product-unit-input"
                    className="text-input"
                    list="product-units-list"
                    required
                    maxLength={24}
                    placeholder="Ej. Unidad, Caja, Kg"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  />
                  <datalist id="product-units-list">
                    <option value="Unidad" />
                    <option value="Caja" />
                    <option value="Funda" />
                    <option value="Paquete" />
                    <option value="Kg" />
                    <option value="Gr" />
                    <option value="L" />
                    <option value="Ml" />
                    <option value="Metro" />
                    <option value="Docena" />
                  </datalist>
                </div>
              </div>

              <div className="form-two">
                <div>
                  <label className="field-label" htmlFor="product-tax-input">
                    ITBIS %
                  </label>
                  <input
                    id="product-tax-input"
                    className="text-input"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    placeholder="18"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="product-price-input">
                    Precio de venta (RD$)
                  </label>
                  <input
                    id="product-price-input"
                    className="text-input"
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </div>
              </div>

              <button className="primary-button dialog-submit" type="submit">
                {editingProduct ? 'Guardar cambios' : 'Guardar artículo'} <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Guía de Carga Masiva de Inventario */}
      {isGuideOpen && (
        <div className="modal-overlay" onClick={() => setIsGuideOpen(false)}>
          <div
            className="product-dialog"
            style={{ width: 'min(760px, 100%)' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="dialog-head">
              <div>
                <div className="eyebrow">INSTRUCTIVO PARA EXCEL</div>
                <h2>Cómo llenar los campos para cargar Inventario</h2>
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
              Para registrar o actualizar artículos masivamente, descargue la plantilla Excel oficial. Incluye columnas predefinidas y una hoja de instrucciones completas. Al importarse al sistema, todos los artículos se ordenarán automáticamente de forma <b>alfabética (A-Z)</b> por su descripción.
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
                    <td><b>Código</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>ART-001, BEB-10</code></td>
                    <td>Código o SKU único. Permite prefijos por grupo para ajustar precios o ITBIS por bloque.</td>
                  </tr>
                  <tr>
                    <td><b>Descripción</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td>Café de origen tostado 1 lb</td>
                    <td>Nombre y especificación del artículo. Se utiliza para el orden alfabético A-Z.</td>
                  </tr>
                  <tr>
                    <td><b>Cantidad</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>25, 50, 0</code></td>
                    <td>Existencias disponibles (número entero ≥ 0, sin letras ni decimales).</td>
                  </tr>
                  <tr>
                    <td><b>Unidad</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>Unidad, Caja, Funda, Kg</code></td>
                    <td>Presentación comercial o unidad de medida.</td>
                  </tr>
                  <tr>
                    <td><b>ITBIS %</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>18, 16, 0</code></td>
                    <td>Tasa de impuesto ITBIS (solo número, no poner %). 0 para artículos exentos.</td>
                  </tr>
                  <tr>
                    <td><b>Precio</b></td>
                    <td><span style={{ color: '#225c44', fontWeight: 600 }}>Obligatorio</span></td>
                    <td><code>295.00, 1500.00</code></td>
                    <td>Precio unitario de venta en Pesos Dominicanos (RD$) mayor a 0.</td>
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
              <b>💡 Funciones avanzadas para el Administrador:</b>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li><b>Orden alfabético A-Z automático:</b> Tanto al importar el archivo Excel como al agregar artículos individuales, el catálogo se ordena alfabéticamente por su descripción.</li>
                <li><b>Precios por grupo:</b> Podrá usar el botón "🏷 Precios por grupo" para fijar o variar porcentajes de precios a todos los artículos que compartan un mismo prefijo de código (ej. ART-, BEB-).</li>
                <li><b>ITBIS general:</b> Podrá asignar el ITBIS de manera masiva con el botón "⚙ ITBIS General".</li>
              </ul>
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
                  downloadTemplate('products');
                  showToast('Descargando Plantilla Instructiva de Inventario...');
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
