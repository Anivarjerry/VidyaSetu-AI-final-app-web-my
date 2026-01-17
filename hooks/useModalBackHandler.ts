
import { useEffect, useRef } from 'react';

const MODAL_MARKER = 'vidyasetu_layer';

/**
 * Handles Android/Physical back button.
 * Improved for PWA Standalone stability.
 */
export const useModalBackHandler = (isOpen: boolean, onClose: () => void) => {
  const onCloseRef = useRef(onClose);
  const layerIdRef = useRef<string | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const layerId = `layer_${Date.now()}`;
      layerIdRef.current = layerId;

      // PWA Standalone apps sometimes behave weird with history.pushState
      // We only push if we are not already in that state
      try {
        if (window.history.state?.marker !== layerId) {
          window.history.pushState({ marker: layerId }, '');
        }
      } catch (e) {
        console.warn("History push failed", e);
      }

      const handlePopState = (event: PopStateEvent) => {
        // If the marker in history doesn't match ours, it means back was pressed
        if (!event.state || event.state.marker !== layerId) {
          onCloseRef.current();
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('popstate', handlePopState);
        // Clean up: if we are closing via UI (X button), go back in history
        if (window.history.state?.marker === layerId) {
          window.history.back();
        }
        layerIdRef.current = null;
      };
    }
  }, [isOpen]);
};
