/* ==========================================================================
   GLASS PROVIDER — OpenGlass UI provider wrapper
   Sets up the liquid glass design system with TV-optimized settings
   ========================================================================== */

import { GlassProvider, GlassThemeProvider } from '@open-glass-ui/react';
import type { ReactNode } from 'react';

export function AtlanticGlassProvider({ children }: { children: ReactNode }) {
  return (
    <GlassProvider
      renderer="auto"
      quality="auto"
      motion="system"
    >
      <GlassThemeProvider
        appearance="system"
        defaultAppearance="dark"
        design="liquid"
        theme={{
          glass: "liquid",
          accent: "oklch(0.65 0.2 250)",
        }}
      >
        {children}
      </GlassThemeProvider>
    </GlassProvider>
  );
}