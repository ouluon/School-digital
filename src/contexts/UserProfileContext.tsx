import React, { createContext, useContext } from 'react';
import type { UserProfileData } from '../services/userProfile';

interface UserProfileContextValue {
  profile: UserProfileData | null;
  openProfileEditor: () => void;
}

const UserProfileContext = createContext<UserProfileContextValue>({
  profile: null,
  openProfileEditor: () => {},
});

export const UserProfileProvider: React.FC<{
  value: UserProfileContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <UserProfileContext.Provider value={value}>
    {children}
  </UserProfileContext.Provider>
);

export function useUserProfileContext(): UserProfileContextValue {
  return useContext(UserProfileContext);
}
