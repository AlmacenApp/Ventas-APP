export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  category?: string;
  price: number;
  taxRate: number;
  stock: number;
  cost?: number;
}

export interface Client {
  id: string;
  code: string;
  company: string;
  zone: string;
  address: string;
  phone: string;
}

export interface OrderItem {
  productId: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  category?: string;
  price: number;
  taxRate: number;
  quantity: number;
  subtotal: number;
  taxAmount: number;
  totalWithTax: number;
}

export interface ClientSnapshot {
  code: string;
  company: string;
  zone: string;
  address: string;
  phone: string;
}

export interface Order {
  id: string;
  date: string;
  customer: string;
  clientSnapshot: ClientSnapshot | null;
  items: OrderItem[];
  total: number;
  zone: string;
  seller: string;
}

export interface User {
  id: string;
  username: string;
  pin: string;
  role: 'admin' | 'seller';
  zone: string;
  whatsapp?: string;
}

export interface AppState {
  products: Product[];
  orders: Order[];
  clients: Client[];
  users: User[];
  currentUserId: string;
}

export type ViewType = 'ventas' | 'inventario' | 'clientes' | 'ordenes' | 'usuarios';
