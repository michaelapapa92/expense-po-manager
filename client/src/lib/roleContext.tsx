import React, { createContext, useContext, useState } from 'react';
import type { Role, User } from './mockData';
import { useAuth } from '@/hooks/use-auth';

interface RoleContextType {
  role: Role;
  isAdmin: boolean;
  currentUser: User | null;
  realUser: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isViewingAs: boolean;
  viewAsUser: User | null;
  setViewAsUser: (user: User | null) => void;
  logout: () => void;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isLoading, isAuthenticated } = useAuth();
  const [viewAsUser, setViewAsUser] = useState<User | null>(null);

  const realUser = authUser || null;
  const isViewingAs = !!(viewAsUser && realUser?.isAdmin);
  const currentUser = isViewingAs ? viewAsUser : realUser;

  const role: Role = (currentUser?.role as Role) || 'Employee';
  const isAdmin = currentUser?.isAdmin || false;

  const logout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <RoleContext.Provider value={{
      role,
      isAdmin,
      currentUser,
      realUser,
      isLoading,
      isAuthenticated,
      isViewingAs,
      viewAsUser,
      setViewAsUser,
      logout,
    }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
