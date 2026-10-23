import L from 'leaflet';

/**
 * ============================================================================
 * LEAFLET DEFENSIVE LIFECYCLE & EVENT MONKEY-PATCH
 * ============================================================================
 * Giải quyết triệt để 2 lỗi kinh điển trong React Leaflet:
 * 1. "Uncaught TypeError: Cannot read properties of undefined (reading '_leaflet_pos')"
 *    Xảy ra khi CSS zoom animation đang chạy mà React component unmount hoặc
 *    ChangeView/flyTo ngắt quãng khiến map._mapPane bị reset/hủy.
 * 2. "Unable to preventDefault inside passive event listener invocation"
 *    Xảy ra khi trình duyệt coi wheel/touch listener là passive nhưng Leaflet
 *    gọi preventDefault() để chặn cuộn trang.
 * ============================================================================
 */
let isLeafletPatched = false;

// Internal Leaflet Map interface for type-safe monkey patching
interface LeafletInternalMap {
  _mapPane?: HTMLElement;
  _animatingZoom?: boolean;
  _getMapPanePos?: () => L.Point;
  _onZoomTransitionEnd?: () => void;
  _catchMarkerAnim?: (e: unknown) => void;
}

export function applyLeafletDefensiveFix(): void {
  if (isLeafletPatched || typeof window === 'undefined') return;

  try {
    // 1. Vá an toàn cho _getMapPanePos (nguồn gốc của lỗi reading '_leaflet_pos')
    if (L.Map && L.Map.prototype) {
      const mapProto = L.Map.prototype as unknown as LeafletInternalMap;
      const origGetMapPanePos = mapProto._getMapPanePos;

      mapProto._getMapPanePos = function (this: LeafletInternalMap) {
        if (!this._mapPane) {
          return new L.Point(0, 0);
        }
        try {
          const pos = typeof origGetMapPanePos === 'function' ? origGetMapPanePos.call(this) : null;
          return pos || new L.Point(0, 0);
        } catch {
          return new L.Point(0, 0);
        }
      };

      // 2. Vá an toàn cho _onZoomTransitionEnd
      const origOnZoomTransitionEnd = mapProto._onZoomTransitionEnd;
      if (typeof origOnZoomTransitionEnd === 'function') {
        mapProto._onZoomTransitionEnd = function (this: LeafletInternalMap) {
          if (!this || !this._mapPane) {
            this._animatingZoom = false;
            return;
          }
          try {
            origOnZoomTransitionEnd.call(this);
          } catch (err) {
            this._animatingZoom = false;
            console.debug('[LeafletFix] Caught zoom animation race condition safely:', err);
          }
        };
      }

      // 3. Vá an toàn cho _catchMarkerAnim
      const origCatchMarkerAnim = mapProto._catchMarkerAnim;
      if (typeof origCatchMarkerAnim === 'function') {
        mapProto._catchMarkerAnim = function (this: LeafletInternalMap, e: unknown) {
          if (!this || !this._mapPane) return;
          try {
            origCatchMarkerAnim.call(this, e);
          } catch {
            // Safe ignore marker animation race
          }
        };
      }
    }

    // 4. Vá an toàn cho L.DomEvent.preventDefault
    if (L.DomEvent && typeof L.DomEvent.preventDefault === 'function') {
      const origPreventDefault = L.DomEvent.preventDefault;
      L.DomEvent.preventDefault = function (e: Event) {
        if (!e) return this;
        // Kiểm tra xem event có bị defaultPrevented hoặc không cancelable không
        if (!e.cancelable) {
          return this;
        }
        try {
          origPreventDefault.call(this, e);
        } catch {
          // Bỏ qua lỗi trình duyệt nếu event listener là passive
        }
        return this;
      };
    }

    isLeafletPatched = true;
    console.debug('[LeafletFix] Leaflet defensive runtime patches applied successfully.');
  } catch (err) {
    console.warn('[LeafletFix] Could not apply Leaflet defensive fix:', err);
  }
}
