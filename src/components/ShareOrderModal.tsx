import React, { useState } from 'react';
import { Order } from '../types';
import { formatMoney, formatDate } from '../services/storage';
import {
  getOrderDocumentName,
  openWhatsAppShare,
  sharePdfViaWhatsApp,
  shareExcelViaWhatsApp,
  downloadPdf,
  downloadExcel,
  copyOrderToClipboard,
} from '../services/exports';

import { User } from '../types';

interface ShareOrderModalProps {
  order: Order;
  allOrders?: Order[];
  isNewlyCreated?: boolean;
  currentUser?: User;
  onUpdateUserWhatsapp?: (userId: string, whatsapp: string) => void;
  onClose: () => void;
  onNavigateToOrders?: () => void;
  onNewSale?: () => void;
  showToast: (msg: string) => void;
}

export const ShareOrderModal: React.FC<ShareOrderModalProps> = ({
  order,
  allOrders = [],
  isNewlyCreated = false,
  currentUser,
  onUpdateUserWhatsapp,
  onClose,
  onNavigateToOrders,
  onNewSale,
  showToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [isSharingExcel, setIsSharingExcel] = useState(false);
  const [isEditingSellerWhatsapp, setIsEditingSellerWhatsapp] = useState(false);
  const [sellerWhatsappInput, setSellerWhatsappInput] = useState(currentUser?.whatsapp || '');

  const docName = getOrderDocumentName(order, allOrders);
  const sellerWhatsapp = currentUser?.whatsapp?.trim() || '';

  // Send directly to the logged-in seller / zone user WhatsApp
  const handleSendToMyWhatsapp = (phone: string) => {
    openWhatsAppShare(order, allOrders, phone);
    showToast(`Abriendo WhatsApp para auto-enviarte la orden (${phone})...`);
  };

  // Save/link seller WhatsApp
  const handleSaveSellerWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !onUpdateUserWhatsapp) return;
    const clean = sellerWhatsappInput.trim();
    onUpdateUserWhatsapp(currentUser.id, clean);
    setIsEditingSellerWhatsapp(false);
    showToast(clean ? `WhatsApp enlazado a tu usuario: ${clean}` : 'WhatsApp desenlazado de tu usuario.');
  };

  // Direct WhatsApp share to any contact (no phone number requested)
  const handleDirectWhatsAppShare = () => {
    openWhatsAppShare(order, allOrders);
    showToast('Abriendo WhatsApp para compartir orden...');
  };

  // Excel actions
  const handleDownloadExcel = () => {
    const ok = downloadExcel(order, allOrders);
    if (ok) {
      showToast(`Descargando Excel: ${docName}.xlsx`);
    } else {
      showToast('Error al descargar el archivo Excel.');
    }
  };

  const handleShareExcelWhatsApp = async () => {
    try {
      setIsSharingExcel(true);
      showToast('Preparando archivo Excel para WhatsApp...');
      const res = await shareExcelViaWhatsApp(order, allOrders);
      if (res.sharedDirectly) {
        showToast('Excel compartido por WhatsApp.');
      } else {
        showToast(`Excel descargado (${res.docName}.xlsx) y WhatsApp abierto.`);
      }
    } catch (err) {
      console.error(err);
      showToast('No se pudo compartir el Excel.');
    } finally {
      setIsSharingExcel(false);
    }
  };

  // PDF actions
  const handleDownloadPdf = () => {
    const ok = downloadPdf(order, allOrders);
    if (ok) {
      showToast(`Descargando PDF: ${docName}.pdf`);
    } else {
      showToast('Error al descargar el PDF.');
    }
  };

  const handleSharePdfWhatsApp = async () => {
    try {
      setIsSharingPdf(true);
      showToast('Preparando archivo PDF para WhatsApp...');
      const res = await sharePdfViaWhatsApp(order, allOrders);
      if (res.sharedDirectly) {
        showToast('PDF compartido por WhatsApp.');
      } else {
        showToast(`PDF descargado (${res.docName}.pdf) y WhatsApp abierto.`);
      }
    } catch (err) {
      console.error(err);
      showToast('No se pudo compartir el PDF.');
    } finally {
      setIsSharingPdf(false);
    }
  };

  const handleCopyText = async () => {
    const ok = await copyOrderToClipboard(order, allOrders);
    if (ok) {
      setCopied(true);
      showToast('Resumen de la orden copiado al portapapeles.');
      setTimeout(() => setCopied(false), 2500);
    } else {
      showToast('No se pudo copiar el texto.');
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && (navigator as any).share) {
      try {
        const text = (await import('../services/exports')).generateWhatsAppMessage(order, allOrders);
        await (navigator as any).share({
          title: `Orden de Venta: ${docName}`,
          text,
        });
        showToast('Orden compartida con éxito.');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          showToast('No se pudo compartir.');
        }
      }
    }
  };

  const canShare = typeof navigator !== 'undefined' && !!(navigator as any).share;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="product-dialog"
        style={{ width: 'min(560px, 100%)', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="dialog-head" style={{ marginBottom: '14px' }}>
          <div>
            <div
              className="eyebrow"
              style={{
                color: isNewlyCreated ? '#166534' : '#225c44',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isNewlyCreated ? '✓ ¡ORDEN GENERADA CON ÉXITO!' : 'COMPARTIR Y DESCARGAR ORDEN'}
            </div>
            <h2 style={{ fontSize: '18px', margin: '3px 0 2px 0' }}>
              Documento: <span style={{ color: '#225c44' }}>{docName}</span>
            </h2>
            <small style={{ color: '#8d9890', fontSize: '11px' }}>
              Ref. Sistema: {order.id} · Fecha: {formatDate(order.date)}
            </small>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            ×
          </button>
        </div>

        {/* Client & Summary Card */}
        <div
          style={{
            background: '#f5f8f5',
            border: '1px solid #e1ebe3',
            borderRadius: '9px',
            padding: '12px 14px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <strong style={{ fontSize: '13.5px', color: '#1f2e24', display: 'block' }}>
                {order.clientSnapshot?.company || order.customer}
              </strong>
              <div style={{ fontSize: '11px', color: '#68776b', marginTop: '2px' }}>
                <b>Código:</b> {order.clientSnapshot?.code || '—'} · <b>Zona:</b>{' '}
                {order.zone || order.clientSnapshot?.zone || '—'}
              </div>
              {order.seller && (
                <div style={{ fontSize: '11px', color: '#68776b', marginTop: '2px' }}>
                  <b>Vendedor:</b> {order.seller}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: '#8d9890', display: 'block' }}>Total con ITBIS</span>
              <strong style={{ fontSize: '17px', color: '#225c44' }}>{formatMoney(order.total)}</strong>
              <small style={{ display: 'block', fontSize: '10px', color: '#8d9890' }}>
                {order.items.length} {order.items.length === 1 ? 'artículo' : 'artículos'}
              </small>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 1: OPCIONES EXCEL (.xlsx) - Descargar & Compartir vía WhatsApp */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#f6fbf7',
            border: '1.5px solid #a7f3d0',
            borderRadius: '10px',
            padding: '13px 14px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📊</span>
              <div>
                <strong style={{ fontSize: '13px', color: '#065f46', display: 'block' }}>
                  Opciones para Excel (.xlsx)
                </strong>
                <span style={{ fontSize: '10.5px', color: '#047857' }}>
                  Hoja de cálculo editable con fórmulas y desglose de ITBIS
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: '1.5px solid #059669',
                color: '#065f46',
                background: '#ffffff',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '0 8px',
                transition: 'all 0.15s ease',
              }}
              title={`Descargar archivo Excel: ${docName}.xlsx`}
            >
              <span style={{ fontSize: '16px' }}>📥</span>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div>Descargar Excel</div>
                <small style={{ fontSize: '9px', fontWeight: 500, color: '#6b7280' }}>.xlsx en tu equipo</small>
              </div>
            </button>

            <button
              type="button"
              onClick={handleShareExcelWhatsApp}
              disabled={isSharingExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                color: '#ffffff',
                background: '#25D366',
                borderRadius: '8px',
                cursor: isSharingExcel ? 'wait' : 'pointer',
                padding: '0 8px',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
                transition: 'all 0.15s ease',
              }}
              title="Compartir archivo Excel por WhatsApp sin solicitar número"
            >
              <span style={{ fontSize: '16px' }}>💬</span>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div>{isSharingExcel ? 'Enviando...' : 'WhatsApp Excel'}</div>
                <small style={{ fontSize: '9px', fontWeight: 500, color: '#f0fdf4' }}>Compartir directo</small>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: OPCIONES PDF (.pdf) - Descargar & Compartir vía WhatsApp */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#faf5f5',
            border: '1.5px solid #fecaca',
            borderRadius: '10px',
            padding: '13px 14px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📄</span>
              <div>
                <strong style={{ fontSize: '13px', color: '#991b1b', display: 'block' }}>
                  Opciones para PDF (.pdf)
                </strong>
                <span style={{ fontSize: '10.5px', color: '#b91c1c' }}>
                  Formato formal con membrete institucional, firmas e impresión
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: '1.5px solid #dc2626',
                color: '#991b1b',
                background: '#ffffff',
                borderRadius: '8px',
                cursor: 'pointer',
                padding: '0 8px',
                transition: 'all 0.15s ease',
              }}
              title={`Descargar archivo PDF: ${docName}.pdf`}
            >
              <span style={{ fontSize: '16px' }}>📥</span>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div>Descargar PDF</div>
                <small style={{ fontSize: '9px', fontWeight: 500, color: '#6b7280' }}>.pdf formal</small>
              </div>
            </button>

            <button
              type="button"
              onClick={handleSharePdfWhatsApp}
              disabled={isSharingPdf}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                height: '42px',
                fontSize: '11.5px',
                fontWeight: 700,
                border: 'none',
                color: '#ffffff',
                background: '#25D366',
                borderRadius: '8px',
                cursor: isSharingPdf ? 'wait' : 'pointer',
                padding: '0 8px',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
                transition: 'all 0.15s ease',
              }}
              title="Compartir archivo PDF por WhatsApp sin solicitar número"
            >
              <span style={{ fontSize: '16px' }}>💬</span>
              <div style={{ textAlign: 'left', lineHeight: '1.2' }}>
                <div>{isSharingPdf ? 'Enviando...' : 'WhatsApp PDF'}</div>
                <small style={{ fontSize: '9px', fontWeight: 500, color: '#f0fdf4' }}>Compartir directo</small>
              </div>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: MI WHATSAPP ENLAZADO DE VENDEDOR / USUARIO */}
        {/* ========================================================================= */}
        <div
          style={{
            background: sellerWhatsapp ? '#f0fdf4' : '#f9fafb',
            border: `1.5px ${sellerWhatsapp ? 'solid #86efac' : 'dashed #bbf7d0'}`,
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>👤📱</span>
              <div>
                <strong style={{ fontSize: '12.5px', color: '#166534', display: 'block' }}>
                  {sellerWhatsapp
                    ? `Mi WhatsApp de Vendedor (${sellerWhatsapp})`
                    : 'Enlazar Mi WhatsApp de Vendedor'}
                </strong>
                <span style={{ fontSize: '10px', color: '#15803d' }}>
                  {sellerWhatsapp
                    ? 'Auto-envíate tus órdenes creadas a tu propio chat personal'
                    : 'Enlaza tu número para recibir una copia de tus órdenes al instante'}
                </span>
              </div>
            </div>

            {currentUser && onUpdateUserWhatsapp && (
              <button
                type="button"
                onClick={() => {
                  setSellerWhatsappInput(sellerWhatsapp);
                  setIsEditingSellerWhatsapp(!isEditingSellerWhatsapp);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#15803d',
                  fontSize: '11px',
                  fontWeight: 600,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '2px 4px',
                }}
              >
                {isEditingSellerWhatsapp
                  ? 'Cancelar'
                  : sellerWhatsapp
                  ? '✏️ Cambiar número'
                  : '🔗 Enlazar número'}
              </button>
            )}
          </div>

          {isEditingSellerWhatsapp && (
            <form onSubmit={handleSaveSellerWhatsapp} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="tel"
                  value={sellerWhatsappInput}
                  onChange={(e) => setSellerWhatsappInput(e.target.value)}
                  placeholder="Ej. 809-555-0100 o 8295551234"
                  style={{
                    flex: 1,
                    padding: '6px 10px',
                    fontSize: '11.5px',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                    background: '#ffffff',
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  className="primary-button compact"
                  style={{ background: '#166534', color: '#ffffff', fontSize: '11px', height: '32px' }}
                >
                  Guardar
                </button>
              </div>
              <small style={{ color: '#6b7280', display: 'block', marginTop: '3px', fontSize: '10px' }}>
                Se guardará en tu perfil de usuario para todas tus órdenes.
              </small>
            </form>
          )}

          {sellerWhatsapp && (
            <button
              type="button"
              className="primary-button"
              onClick={() => handleSendToMyWhatsapp(sellerWhatsapp)}
              style={{
                width: '100%',
                background: '#25D366',
                color: '#ffffff',
                height: '38px',
                fontSize: '12px',
                fontWeight: 700,
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>💬</span>
              Enviar orden a Mi WhatsApp ({sellerWhatsapp})
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* CARD 4: COMPARTIR RESUMEN POR WHATSAPP (DIRECTO SIN PEDIR NÚMERO) */}
        {/* ========================================================================= */}
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #d1fae5',
            borderRadius: '10px',
            padding: '12px 14px',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>📲</span>
              <div>
                <strong style={{ fontSize: '12.5px', color: '#166534', display: 'block' }}>
                  Compartir en WhatsApp (Elegir contacto o grupo)
                </strong>
                <span style={{ fontSize: '10px', color: '#15803d' }}>
                  Abre WhatsApp directamente para enviar a cualquier cliente o grupo sin pedir número
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={handleDirectWhatsAppShare}
            style={{
              width: '100%',
              borderColor: '#25D366',
              color: '#15803d',
              background: '#f0fdf4',
              height: '38px',
              fontSize: '12px',
              fontWeight: 700,
              justifyContent: 'center',
              borderRadius: '8px',
              cursor: 'pointer',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '16px' }}>💬</span>
            Compartir Resumen en WhatsApp (Contacto o Grupo)
          </button>
        </div>

        {/* Quick Utility Actions */}
        <div style={{ display: 'grid', gridTemplateColumns: canShare ? '1fr 1fr' : '1fr', gap: '6px', marginBottom: '8px' }}>
          <button
            type="button"
            className="secondary-button"
            onClick={handleCopyText}
            style={{ justifyContent: 'center', height: '34px', fontSize: '11px', color: '#56655a' }}
          >
            <span>📋</span> {copied ? '✓ Resumen Copiado' : 'Copiar texto al portapapeles'}
          </button>

          {canShare && (
            <button
              type="button"
              className="secondary-button"
              onClick={handleNativeShare}
              style={{ justifyContent: 'center', height: '34px', fontSize: '11px', color: '#56655a' }}
            >
              <span>📲</span> Más aplicaciones
            </button>
          )}
        </div>

        {/* Modal Bottom Actions */}
        <div
          style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid #edf1ee',
            display: isNewlyCreated ? 'grid' : 'flex',
            gridTemplateColumns: isNewlyCreated ? '1fr 1fr' : undefined,
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {isNewlyCreated ? (
            <>
              {onNewSale && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    onClose();
                    onNewSale();
                  }}
                  style={{ fontSize: '11px', justifyContent: 'center', height: '36px', fontWeight: 600 }}
                >
                  ＋ Nueva orden
                </button>
              )}
              {onNavigateToOrders && (
                <button
                  type="button"
                  className="primary-button compact"
                  onClick={() => {
                    onClose();
                    onNavigateToOrders();
                  }}
                  style={{ fontSize: '11px', justifyContent: 'center', height: '36px', fontWeight: 700 }}
                >
                  Ir a lista de órdenes →
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              style={{ fontSize: '11px', minWidth: '90px', justifyContent: 'center', height: '34px' }}
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
