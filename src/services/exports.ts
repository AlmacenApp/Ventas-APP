import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Order } from '../types';
import { formatDate, formatMoney, getAdminPhone } from './storage';
import { sortProductsNatural, sortClientsNatural } from '../utils/sorting';

/**
 * Generates unique document name based on client code and order date.
 * If the same client makes multiple orders on the same calendar day,
 * appends a hyphen differentiator: -2, -3, etc.
 * Example: CLI-001_2026-11-02.pdf, CLI-001_2026-11-02-2.pdf
 */
export function getOrderDocumentName(order: Order, allOrders: Order[] = []): string {
  const rawCode = order.clientSnapshot?.code || order.customer || 'CLI';
  // Sanitize code removing special filesystem characters
  const clientCode = rawCode
    .trim()
    .replace(/[\/\s\\:*?"<>|]+/g, '_')
    .toUpperCase();

  const d = new Date(order.date);
  const validDate = isNaN(d.getTime()) ? new Date() : d;
  const year = validDate.getFullYear();
  const month = String(validDate.getMonth() + 1).padStart(2, '0');
  const day = String(validDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  // Find all orders for this same client on this same calendar day
  const sameClientSameDay = allOrders.filter((o) => {
    const oRawCode = o.clientSnapshot?.code || o.customer || 'CLI';
    const oCode = oRawCode.trim().replace(/[\/\s\\:*?"<>|]+/g, '_').toUpperCase();
    if (oCode !== clientCode) return false;

    const od = new Date(o.date);
    const oValidDate = isNaN(od.getTime()) ? new Date() : od;
    const oDateStr = `${oValidDate.getFullYear()}-${String(oValidDate.getMonth() + 1).padStart(2, '0')}-${String(oValidDate.getDate()).padStart(2, '0')}`;
    return oDateStr === dateStr;
  });

  // Sort chronologically by date/time
  sameClientSameDay.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine index (1-based)
  const orderIdx = sameClientSameDay.findIndex((o) => o.id === order.id);
  let suffix = '';
  if (orderIdx > 0) {
    // 2nd order is -2, 3rd is -3, etc.
    suffix = `-${orderIdx + 1}`;
  } else if (orderIdx === -1 && sameClientSameDay.length > 0) {
    // If order was just created and not in allOrders yet
    suffix = `-${sameClientSameDay.length + 1}`;
  }

  return `${clientCode}_${dateStr}${suffix}`;
}

export function fileBase(order: Order, allOrders: Order[] = []): string {
  return getOrderDocumentName(order, allOrders);
}

export function generateExcelBlob(
  order: Order,
  allOrders: Order[] = []
): { blob: Blob; docName: string; wb: XLSX.WorkBook } | null {
  try {
    const docName = getOrderDocumentName(order, allOrders);
    const wb = XLSX.utils.book_new();
    const rows = [
      ['ORDEN DE VENTA', docName],
      ['Documento', docName],
      ['ID Sistema', order.id],
      ['Fecha', formatDate(order.date)],
      ['Código de cliente', order.clientSnapshot?.code || '—'],
      ['Compañía', order.clientSnapshot?.company || order.customer],
      ['Vendedor / Zona', order.clientSnapshot?.zone || order.zone || '—'],
      ['Dirección', order.clientSnapshot?.address || '—'],
      ['Teléfono', order.clientSnapshot?.phone || '—'],
      [],
      ['Código artículo', 'Descripción', 'Unidad', 'Cantidad', 'Precio unitario', 'ITBIS %', 'ITBIS', 'Subtotal', 'Total'],
      ...order.items.map((i) => {
        const subtotal = Number(i.subtotal) || i.price * i.quantity;
        const tax = Number(i.taxAmount) || (subtotal * (Number(i.taxRate) || 0)) / 100;
        const total = Number(i.totalWithTax) || subtotal + tax;
        return [
          i.code || '—',
          i.description || i.name,
          i.unit || 'Unidad',
          i.quantity,
          i.price,
          Number(i.taxRate) || 0,
          tax,
          subtotal,
          total,
        ];
      }),
      [],
      ['', '', '', '', '', '', '', 'TOTAL', order.total],
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 18 },
      { wch: 32 },
      { wch: 14 },
      { wch: 12 },
      { wch: 17 },
      { wch: 12 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Orden');
    const u8 = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([u8], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    return { blob, docName, wb };
  } catch (err) {
    console.error('Error al generar blob Excel:', err);
    return null;
  }
}

export function downloadExcel(order: Order, allOrders: Order[] = []): boolean {
  try {
    const res = generateExcelBlob(order, allOrders);
    if (!res) return false;
    XLSX.writeFile(res.wb, `${res.docName}.xlsx`);
    return true;
  } catch (err) {
    console.error('Error al generar Excel:', err);
    return false;
  }
}

export function createOrderPdfDoc(
  order: Order,
  allOrders: Order[] = []
): { doc: jsPDF; docName: string } {
  const docName = getOrderDocumentName(order, allOrders);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210;
  const margin = 13;

  doc.setTextColor(30, 39, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('VI · VENTA & INVENTARIO APP', margin, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`ORDEN DE VENTA: ${docName}`, margin, 21);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('COPIA', pageW - margin, 15, { align: 'right' });

  doc.setDrawColor(105, 114, 107);
  doc.setLineWidth(0.45);
  doc.rect(margin, 25, pageW - margin * 2, 8);
  doc.setFillColor(236, 239, 236);
  doc.rect(margin, 25, pageW - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('PEDIDO CLIENTE', pageW / 2, 30.5, { align: 'center' });

  const client = order.clientSnapshot;
  const leftX = margin + 2;
  const rightX = 108;
  const y = 42;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CLIENTE:', leftX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(String(client?.code || 'Cliente general'), leftX + 22, y);

  doc.setFont('helvetica', 'bold');
  doc.text('NOMBRE:', leftX, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(String(client?.company || order.customer || 'Cliente general'), 75), leftX + 22, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('DIRECCIÓN:', leftX, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(doc.splitTextToSize(String(client?.address || '—'), 73), leftX + 22, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.text('TELÉFONO:', leftX, y + 27);
  doc.setFont('helvetica', 'normal');
  doc.text(String(client?.phone || '—'), leftX + 22, y + 27);

  const rightRows = [
    ['DOC / REF:', docName],
    ['ID SISTEMA:', order.id],
    ['FECHA:', formatDate(order.date)],
    ['ZONA:', order.zone || client?.zone || '—'],
    ['VENDEDOR:', order.seller || '—'],
  ];

  rightRows.forEach((r, i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(r[0], rightX, y + i * 6.5);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(String(r[1]), 72), rightX + 26, y + i * 6.5);
  });

  const body = order.items.map((item, index) => {
    const subtotal = Number(item.subtotal) || item.price * item.quantity;
    return [
      String(index + 1),
      String(item.code || '—'),
      String(item.description || item.name),
      `${item.quantity} ${item.unit || 'Unidad'}`,
      formatMoney(item.price),
      formatMoney(subtotal),
    ];
  });

  autoTable(doc, {
    startY: 80,
    margin: { left: margin, right: margin },
    head: [['#', 'ARTÍCULO', 'DESCRIPCIÓN', 'CANTIDAD', 'PRECIO', 'TOTAL']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.4,
      textColor: [45, 52, 47],
      lineColor: [85, 91, 86],
      lineWidth: 0.18,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [226, 229, 226],
      textColor: [25, 31, 27],
      fontStyle: 'bold',
      lineColor: [70, 76, 71],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 30 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 28 },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 25, halign: 'right' },
    },
    didDrawPage: () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(120, 126, 121);
      doc.text(`Página: ${doc.getNumberOfPages()} · Ref: ${docName}`, pageW - margin, 290, { align: 'right' });
    },
  });

  const lastTable = (doc as any).lastAutoTable;
  let yEnd = (lastTable ? lastTable.finalY : 80) + 8;
  if (yEnd > 245) {
    doc.addPage();
    yEnd = 25;
  }

  const subtotal = order.items.reduce((sum, i) => sum + (Number(i.subtotal) || i.price * i.quantity), 0);
  const tax = order.items.reduce(
    (sum, i) =>
      sum + (Number(i.taxAmount) || ((Number(i.subtotal) || i.price * i.quantity) * (Number(i.taxRate) || 0)) / 100),
    0
  );
  const sumX = pageW - margin;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(35, 42, 37);
  doc.text('SUBTOTAL:', sumX - 42, yEnd, { align: 'right' });
  doc.text(formatMoney(subtotal), sumX, yEnd, { align: 'right' });

  doc.text('ITBIS:', sumX - 42, yEnd + 7, { align: 'right' });
  doc.text(formatMoney(tax), sumX, yEnd + 7, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('TOTAL:', sumX - 42, yEnd + 14, { align: 'right' });
  doc.text(formatMoney(order.total), sumX, yEnd + 14, { align: 'right' });

  const signY = Math.min(yEnd + 27, 260);
  const signW = (pageW - margin * 2 - 8) / 3;

  ['HECHO POR', 'REVISADO POR', 'APROBADO POR'].forEach((label, i) => {
    const x = margin + i * (signW + 4);
    doc.setFillColor(230, 232, 230);
    doc.rect(x, signY, signW, 7, 'F');
    doc.rect(x, signY, signW, 18);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(label, x + signW / 2, signY + 4.8, { align: 'center' });
  });

  return { doc, docName };
}

export function generatePdfBlob(
  order: Order,
  allOrders: Order[] = []
): { blob: Blob; docName: string } | null {
  try {
    const { doc, docName } = createOrderPdfDoc(order, allOrders);
    const blob = doc.output('blob');
    return { blob, docName };
  } catch (err) {
    console.error('Error al generar blob PDF:', err);
    return null;
  }
}

export function downloadPdf(order: Order, allOrders: Order[] = []): boolean {
  try {
    const { doc, docName } = createOrderPdfDoc(order, allOrders);
    doc.save(`${docName}.pdf`);
    return true;
  } catch (err) {
    console.error('Error al generar PDF:', err);
    return false;
  }
}

export function exportOrder(order: Order, format: 'excel' | 'pdf', allOrders: Order[] = []): boolean {
  return format === 'excel' ? downloadExcel(order, allOrders) : downloadPdf(order, allOrders);
}

/**
 * Builds formatted text message suitable for WhatsApp sharing
 */
export function generateWhatsAppMessage(order: Order, allOrders: Order[] = []): string {
  const docName = getOrderDocumentName(order, allOrders);
  const clientCode = order.clientSnapshot?.code || '—';
  const clientCompany = order.clientSnapshot?.company || order.customer || 'Cliente general';
  const dateFormatted = formatDate(order.date);
  const zone = order.zone || order.clientSnapshot?.zone || '—';
  const seller = order.seller || '—';
  const phone = order.clientSnapshot?.phone || '';

  const itemsList = order.items
    .map((item, idx) => {
      const subtotal = Number(item.subtotal) || item.price * item.quantity;
      const taxRate = Number(item.taxRate) || 0;
      const taxAmount = Number(item.taxAmount) || (subtotal * taxRate) / 100;
      const total = Number(item.totalWithTax) || subtotal + taxAmount;
      return `${idx + 1}. *${item.description || item.name}* (${item.code || 'S/C'})\n   ${item.quantity} ${item.unit || 'Und'} × ${formatMoney(item.price)} = ${formatMoney(total)}${taxRate > 0 ? ` (ITBIS ${taxRate}%)` : ''}`;
    })
    .join('\n');

  const subtotalSum = order.items.reduce(
    (sum, i) => sum + (Number(i.subtotal) || i.price * i.quantity),
    0
  );
  const taxSum = order.items.reduce(
    (sum, i) =>
      sum + (Number(i.taxAmount) || ((Number(i.subtotal) || i.price * i.quantity) * (Number(i.taxRate) || 0)) / 100),
    0
  );

  return [
    `📋 *ORDEN DE VENTA: ${docName}*`,
    `Ref. Sistema: ${order.id}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🏢 *Cliente:* ${clientCompany}`,
    `🏷️ *Código de cliente:* ${clientCode}`,
    `📅 *Fecha:* ${dateFormatted}`,
    `📍 *Zona:* ${zone}`,
    `👤 *Vendedor:* ${seller}`,
    phone ? `📞 *Teléfono:* ${phone}` : '',
    `━━━━━━━━━━━━━━━━━━━━`,
    `🛒 *DETALLE DE ARTÍCULOS:*`,
    itemsList,
    `━━━━━━━━━━━━━━━━━━━━`,
    `💵 *Subtotal:* ${formatMoney(subtotalSum)}`,
    taxSum > 0 ? `🧾 *ITBIS:* ${formatMoney(taxSum)}` : `🧾 *ITBIS:* Exento`,
    `💰 *TOTAL:* ${formatMoney(order.total)}`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `_VI · Venta & Inventario APP_`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Sanitizes phone number to international format when possible
 */
export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  // Dominican numbers (809, 829, 849) or 10-digit North American: prepend '1'
  if (digits.length === 10) {
    digits = `1${digits}`;
  }
  return digits;
}

/**
 * Opens WhatsApp web / mobile app with pre-filled message directly.
 * Does NOT require or solicit a phone number, allowing user to pick any contact or group directly.
 */
export function openWhatsAppShare(
  order: Order,
  allOrders: Order[] = [],
  destinationPhone?: string
): void {
  const text = generateWhatsAppMessage(order, allOrders);
  const digits = destinationPhone ? cleanPhoneNumber(destinationPhone) : '';

  let url: string;
  if (digits && digits.length >= 10) {
    url = `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
  } else {
    // Direct share without target phone: WhatsApp opens contact / chat chooser
    url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Shares PDF file via WhatsApp directly (using Web Share API when supported),
 * or triggers PDF download and opens WhatsApp directly without soliciting a phone number.
 */
export async function sharePdfViaWhatsApp(
  order: Order,
  allOrders: Order[] = []
): Promise<{ success: boolean; sharedDirectly: boolean; docName: string }> {
  const docName = getOrderDocumentName(order, allOrders);
  const text = generateWhatsAppMessage(order, allOrders);
  const pdfRes = generatePdfBlob(order, allOrders);

  if (pdfRes && typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      const file = new File([pdfRes.blob], `${docName}.pdf`, { type: 'application/pdf' });
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
          title: `Orden de Venta: ${docName}`,
          text,
          files: [file],
        });
        return { success: true, sharedDirectly: true, docName };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, sharedDirectly: true, docName };
      }
      console.warn('Web Share API error, using direct WhatsApp fallback:', err);
    }
  }

  // Fallback: download the PDF file and open WhatsApp directly with prefilled order text (no phone asked)
  downloadPdf(order, allOrders);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return { success: true, sharedDirectly: false, docName };
}

/**
 * Shares Excel file via WhatsApp directly (using Web Share API when supported),
 * or triggers Excel download and opens WhatsApp directly without soliciting a phone number.
 */
export async function shareExcelViaWhatsApp(
  order: Order,
  allOrders: Order[] = []
): Promise<{ success: boolean; sharedDirectly: boolean; docName: string }> {
  const docName = getOrderDocumentName(order, allOrders);
  const text = generateWhatsAppMessage(order, allOrders);
  const excelRes = generateExcelBlob(order, allOrders);

  if (excelRes && typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function') {
    try {
      const file = new File([excelRes.blob], `${docName}.xlsx`, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      if ((navigator as any).canShare && (navigator as any).canShare({ files: [file] })) {
        await (navigator as any).share({
          title: `Orden de Venta: ${docName} (Excel)`,
          text,
          files: [file],
        });
        return { success: true, sharedDirectly: true, docName };
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: true, sharedDirectly: true, docName };
      }
      console.warn('Web Share API error, using direct WhatsApp fallback:', err);
    }
  }

  // Fallback: download Excel file and open WhatsApp directly with prefilled order text (no phone asked)
  downloadExcel(order, allOrders);
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return { success: true, sharedDirectly: false, docName };
}

/**
 * Copies order summary text to clipboard
 */
export async function copyOrderToClipboard(order: Order, allOrders: Order[] = []): Promise<boolean> {
  const text = generateWhatsAppMessage(order, allOrders);
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn('Clipboard API error, trying fallback', e);
  }

  // Fallback for older or restricted environments
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch {
    return false;
  }
}

export function downloadTemplate(kind: 'products' | 'clients' | 'all'): void {
  const wb = XLSX.utils.book_new();

  if (kind === 'clients' || kind === 'all') {
    // Sheet: Clientes
    const clientHeaders = ['Código cliente', 'Compañía', 'Zona asignada', 'Dirección', 'Teléfono'];
    const clientExamples = [
      ['CLI-001', 'Distribuidora del Caribe SRL', 'Zona:01', 'Av. Winston Churchill #45, Piantini, Santo Domingo', '809-555-0142'],
      ['CLI-002', 'Comercial Quisqueyana SAS', 'Zona:02', 'Calle El Sol #120, Santiago de los Caballeros', '809-582-9900'],
      ['CLI-003', 'Gourmet Market RD', 'Zona:01', 'Av. Roberto Pastoriza #210, Naco, Santo Domingo', '809-567-3321'],
      ['CLI-004', 'Supermercado Los Prados', 'Zona:01', 'Av. Charles Sumner #18, Los Prados, Santo Domingo', '809-541-2020'],
      ['CLI-005', 'Farmacia y Provisiones Duarte', 'Zona:02', 'Av. Juan Pablo Duarte #50, Santiago', '829-583-4040'],
    ];
    const wsClients = XLSX.utils.aoa_to_sheet([clientHeaders, ...clientExamples]);
    wsClients['!cols'] = [
      { wch: 18 },
      { wch: 34 },
      { wch: 18 },
      { wch: 48 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsClients, 'Clientes');

    // Sheet: Instrucciones Clientes
    const clientInstHeaders = ['COLUMNA', '¿OBLIGATORIO?', 'TIPO DE DATO', 'VALORES / FORMATO', 'INSTRUCCIONES DETALLADAS Y REGLAS'];
    const clientInstRows = [
      ['Código cliente', 'SÍ (Requerido)', 'Texto único', 'Ej. CLI-001, C-102', 'Código único de identificación para cada cliente. No se permiten duplicados. Si un código ya existe en el sistema se omitirá esa fila.'],
      ['Compañía', 'SÍ (Requerido)', 'Texto', 'Ej. Distribuidora del Caribe SRL', 'Nombre comercial o razón social. Al cargarse en la app, los clientes se ordenan automáticamente por CÓDIGO de menor a mayor (A-Z y 1..N).'],
      ['Zona asignada', 'SÍ (Requerido)', 'Texto', 'Ej. Zona:01, Zona:02', 'Zona comercial del cliente. Todas las zonas pueden ver a todos los clientes para facilitar ventas cruzadas.'],
      ['Dirección', 'SÍ (Requerido)', 'Texto', 'Ej. Calle El Sol #120, Santiago', 'Dirección física completa del local o cliente (calle, número, sector, municipio).'],
      ['Teléfono', 'SÍ (Requerido)', 'Texto / Numérico', 'Ej. 809-555-0142, 8295551234', 'Teléfono de contacto. Puede colocarse con o sin guiones. Se utilizará para el envío directo de órdenes por WhatsApp.'],
      [],
      ['REGLAS GENERALES PARA LA CARGA DE CLIENTES:', '', '', '', ''],
      ['1. Mantenga exactamente los nombres de los encabezados de la fila 1 de la hoja "Clientes".', '', '', '', ''],
      ['2. Puede borrar las filas de ejemplo y pegar sus datos reales a partir de la fila 2.', '', '', '', ''],
      ['3. El sistema ordena la lista completa de clientes por código de menor a mayor (A-Z y 1..N) automáticamente al importar.', '', '', '', ''],
      ['4. Guarde el archivo en formato Excel (.xlsx) o CSV antes de cargarlo en la aplicación.', '', '', '', ''],
    ];
    const wsClientInst = XLSX.utils.aoa_to_sheet([clientInstHeaders, ...clientInstRows]);
    wsClientInst['!cols'] = [
      { wch: 20 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 80 },
    ];
    XLSX.utils.book_append_sheet(wb, wsClientInst, 'Instrucciones_Clientes');
  }

  if (kind === 'products' || kind === 'all') {
    // Sheet: Inventario
    const productHeaders = ['Código', 'Descripción', 'Cantidad', 'Unidad', 'ITBIS %', 'Precio'];
    const productExamples = [
      ['ART-001', 'Café de origen tostado medio 1 lb', 24, 'Funda', 0, 295.00],
      ['ART-002', 'Taza artesanal de cerámica 12 oz', 12, 'Unidad', 18, 350.00],
      ['ART-003', 'Bolsa de algodón reutilizable premium', 31, 'Unidad', 18, 180.00],
      ['ART-004', 'Cuaderno botánico pasta dura hojas punteadas', 8, 'Unidad', 18, 420.00],
      ['ART-005', 'Vela aromática de cera de soja con cedro', 16, 'Unidad', 18, 580.00],
      ['ART-006', 'Té de jazmín hojas sueltas 100g', 19, 'Caja', 0, 240.00],
      ['ART-007', 'Lámina ilustrada botánica A4', 5, 'Unidad', 18, 390.00],
      ['ART-008', 'Estuche multiuso de lino natural', 10, 'Unidad', 18, 310.00],
      ['ART-009', 'Jabón artesanal exfoliante de avena y miel', 27, 'Unidad', 18, 160.00],
    ];
    const wsProducts = XLSX.utils.aoa_to_sheet([productHeaders, ...productExamples]);
    wsProducts['!cols'] = [
      { wch: 16 },
      { wch: 44 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsProducts, 'Inventario');

    // Sheet: Instrucciones Inventario
    const prodInstHeaders = ['COLUMNA', '¿OBLIGATORIO?', 'TIPO DE DATO', 'VALORES / FORMATO', 'INSTRUCCIONES DETALLADAS Y REGLAS'];
    const prodInstRows = [
      ['Código', 'SÍ (Requerido)', 'Texto único', 'Ej. ART-001, BEB-101', 'Código o SKU único de cada artículo. Puede usar prefijos o números. El sistema ordenará todo de menor a mayor (A-Z y 1..N).'],
      ['Descripción', 'SÍ (Requerido)', 'Texto', 'Ej. Café de origen tostado 1 lb', 'Nombre y especificación del artículo. Si dos artículos tienen el mismo código, se desempatarán por su nombre.'],
      ['Cantidad', 'SÍ (Requerido)', 'Número entero ≥ 0', 'Ej. 25, 100, 0', 'Existencias iniciales en almacén. Debe ser un número entero sin comas ni letras. Si no tiene stock disponible coloque 0.'],
      ['Unidad', 'SÍ (Requerido)', 'Texto', 'Ej. Unidad, Caja, Funda, Kg, Paquete', 'Unidad de medida o presentación. Si se deja vacía la aplicación asignará automáticamente "Unidad".'],
      ['ITBIS %', 'SÍ (Requerido)', 'Número (0 a 100)', 'Ej. 18, 16, 0', 'Porcentaje de impuesto ITBIS. Ingrese solo el número (ej. 18 para 18%, 0 para exento). No coloque el signo de porcentaje %.'],
      ['Precio', 'SÍ (Requerido)', 'Número decimal > 0', 'Ej. 295.00, 1500.50', 'Precio de venta unitario en Pesos Dominicanos (RD$). No incluya signos de pesos ni letras. Use punto o coma para decimales.'],
      [],
      ['REGLAS GENERALES PARA LA CARGA DE INVENTARIO:', '', '', '', ''],
      ['1. Mantenga exactamente los encabezados de la fila 1 de la hoja "Inventario".', '', '', '', ''],
      ['2. Puede borrar las filas de ejemplo y pegar sus artículos reales a partir de la fila 2.', '', '', '', ''],
      ['3. Al cargarse en la aplicación, el catálogo completo se ordenará automáticamente por su código de menor a mayor (A-Z y 1..N).', '', '', '', ''],
      ['4. Los códigos ya existentes en la base de datos no se sobreescribirán; se omitirán para evitar duplicidad.', '', '', '', ''],
      ['5. Guarde el archivo en formato Excel (.xlsx) o CSV antes de importarlo.', '', '', '', ''],
    ];
    const wsProdInst = XLSX.utils.aoa_to_sheet([prodInstHeaders, ...prodInstRows]);
    wsProdInst['!cols'] = [
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 28 },
      { wch: 80 },
    ];
    XLSX.utils.book_append_sheet(wb, wsProdInst, 'Instrucciones_Inventario');
  }

  const fileName =
    kind === 'clients'
      ? 'Plantilla_Instructiva_Clientes.xlsx'
      : kind === 'products'
      ? 'Plantilla_Instructiva_Inventario.xlsx'
      : 'Guia_Carga_Masiva_Clientes_e_Inventario.xlsx';

  XLSX.writeFile(wb, fileName);
}

function normalizeHeader(value: any): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function sheetValue(row: Record<string, any>, aliases: string[]): any {
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalizeHeader(key))) {
      return row[key];
    }
  }
  return '';
}

export async function parseProductsSpreadsheet(
  file: File,
  existingCodes: Set<string>
): Promise<{ added: any[]; skipped: number }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  
  // Prefer sheet named "inventario" or "productos" or "articulos", otherwise first sheet
  const targetSheetName =
    wb.SheetNames.find((name) => {
      const n = name.trim().toLowerCase();
      return n.includes('inventario') || n.includes('producto') || n.includes('articulo');
    }) || wb.SheetNames[0];

  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[targetSheetName], { defval: '' });

  const added: any[] = [];
  let skipped = 0;

  for (const row of rows) {
    const code = String(sheetValue(row, ['codigo', 'codigodearticulo', 'articulo', 'sku'])).trim();
    if (!code) {
      skipped++;
      continue;
    }

    const description = String(sheetValue(row, ['descripcion', 'descripciondelarticulo', 'producto', 'nombre'])).trim();
    const stock = Number(String(sheetValue(row, ['cantidad', 'existencia', 'stock'])).replace(',', '.'));
    const unit = String(sheetValue(row, ['unidad', 'unidadmedida', 'presentacion'])).trim() || 'Unidad';
    const tax = Number(String(sheetValue(row, ['itbis', 'itbispct', 'impuesto', 'tax'])).replace(',', '.')) || 0;
    const price = Number(String(sheetValue(row, ['precio', 'precioventa', 'preciounitario'])).replace(',', '.'));

    if (
      !description ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      !Number.isFinite(tax) ||
      tax < 0 ||
      !Number.isFinite(price) ||
      price <= 0 ||
      existingCodes.has(code.toLowerCase())
    ) {
      skipped++;
      continue;
    }

    existingCodes.add(code.toLowerCase());
    added.push({
      id: `p-${Date.now()}-${added.length}`,
      code,
      description,
      name: description,
      unit,
      category: unit,
      taxRate: tax,
      price,
      stock,
      cost: 0,
    });
  }

  // Sort loaded products naturally by code ascending (A-Z and 1..N)
  const sortedAdded = sortProductsNatural(added);

  return { added: sortedAdded, skipped };
}

export async function parseClientsSpreadsheet(
  file: File,
  existingCodes: Set<string>
): Promise<{ added: any[]; skipped: number }> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });

  // Prefer sheet named "clientes" or "directorio", otherwise first sheet
  const targetSheetName =
    wb.SheetNames.find((name) => {
      const n = name.trim().toLowerCase();
      return n.includes('cliente') || n.includes('directorio');
    }) || wb.SheetNames[0];

  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(wb.Sheets[targetSheetName], { defval: '' });

  const added: any[] = [];
  let skipped = 0;

  for (const row of rows) {
    const code = String(sheetValue(row, ['codigocliente', 'codigo', 'cliente'])).trim();
    if (!code) {
      skipped++;
      continue;
    }

    const company = String(sheetValue(row, ['compania', 'empresa', 'nombre', 'nombredecompania'])).trim();
    const zone = String(sheetValue(row, ['zonaasignada', 'zona', 'vendedorzona'])).trim();
    const address = String(sheetValue(row, ['direccion', 'domicilio'])).trim();
    const phone = String(sheetValue(row, ['telefono', 'tel'])).trim();

    if (!company || !zone || !address || !phone || existingCodes.has(code.toLowerCase())) {
      skipped++;
      continue;
    }

    existingCodes.add(code.toLowerCase());
    added.push({
      id: `c-${Date.now()}-${added.length}`,
      code,
      company,
      zone,
      address,
      phone,
    });
  }

  // Sort loaded clients naturally by code ascending (A-Z and 1..N)
  const sortedAdded = sortClientsNatural(added);

  return { added: sortedAdded, skipped };
}
