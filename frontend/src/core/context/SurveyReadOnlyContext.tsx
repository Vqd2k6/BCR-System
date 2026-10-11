import React, { createContext, useContext, useMemo } from 'react';

const SurveyReadOnlyContext = createContext<boolean | undefined>(undefined);

export interface SurveyReadOnlyProviderProps {
  value: boolean;
  children: React.ReactNode;
}

export const SurveyReadOnlyProvider: React.FC<SurveyReadOnlyProviderProps> = ({ value, children }) => {
  const memoizedValue = useMemo(() => value, [value]);
  return (
    <SurveyReadOnlyContext.Provider value={memoizedValue}>
      {children}
    </SurveyReadOnlyContext.Provider>
  );
};

export function useSurveyReadOnly(): boolean | undefined {
  return useContext(SurveyReadOnlyContext);
}
