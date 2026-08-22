import { createContext, useContext, useEffect, useState } from "react";

const ACTIVE_ORGANISATION_KEY = "amarktai-property.active-organisation-id";

type ActiveOrganisationContextValue = {
  organisationId?: number;
  setOrganisationId: (organisationId?: number) => void;
};

const ActiveOrganisationContext = createContext<ActiveOrganisationContextValue | undefined>(undefined);

export function ActiveOrganisationProvider({ children }: { children: React.ReactNode }) {
  const [organisationId, setOrganisationId] = useState<number | undefined>(() => {
    const stored = window.localStorage.getItem(ACTIVE_ORGANISATION_KEY);
    const parsed = stored ? Number(stored) : undefined;
    return parsed && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
  });

  useEffect(() => {
    if (organisationId) {
      window.localStorage.setItem(ACTIVE_ORGANISATION_KEY, String(organisationId));
      return;
    }
    window.localStorage.removeItem(ACTIVE_ORGANISATION_KEY);
  }, [organisationId]);

  return (
    <ActiveOrganisationContext.Provider value={{ organisationId, setOrganisationId }}>
      {children}
    </ActiveOrganisationContext.Provider>
  );
}

export function useActiveOrganisation() {
  const context = useContext(ActiveOrganisationContext);
  if (!context) {
    throw new Error("useActiveOrganisation must be used within ActiveOrganisationProvider");
  }
  return context;
}
