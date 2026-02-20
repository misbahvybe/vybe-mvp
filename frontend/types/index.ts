export type Role = 'CUSTOMER' | 'RIDER' | 'STORE_OWNER' | 'ADMIN';

export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: Role;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
}

export interface Address {
  id: string;
  label?: string | null;
  fullAddress: string;
  city: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
}
