import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRef } from "react";
import {
  Animated, Dimensions, type GestureResponderEvent, Modal, Pressable, StyleSheet, View,
} from "react-native";

const MAX_SCALE = 4;
const MIN_SCALE = 1;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Pinch-to-zoom + pan image surface. Dependency-free (built-in Animated +
 * bubbling touch events), so it works on Android without any native module.
 * Pinch with two fingers to zoom, drag to pan when zoomed, tap the ✕ (or the
 * backdrop while not zoomed) to close.
 *
 * Uses onTouch* bubbling events (not PanResponder) because PanResponder's
 * multi-touch delivery inside a Modal is flaky on Android; and animations run
 * on the JS driver so setValue() during a gesture always applies.
 *
 * Fills its parent — use inside a Modal (ImageZoomModal) or a full-screen route.
 */
export function ZoomableImage({
  uri, onRequestClose, label, onZoomChange, tapToClose = true,
}: { uri: string; onRequestClose?: () => void; label?: string; onZoomChange?: (zoomed: boolean) => void; tapToClose?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  // Committed gesture state we read/write directly.
  const g = useRef({ scale: 1, tx: 0, ty: 0, mode: 0, dist0: 0, scale0: 1, x0: 0, y0: 0, tx0: 0, ty0: 0, moved: false, zoomed: false }).current;

  // Report zoom on/off so a parent gallery can disable horizontal paging while
  // the image is zoomed (pan should win over swipe-to-next then).
  const reportZoom = (z: boolean) => { if (z !== g.zoomed) { g.zoomed = z; onZoomChange?.(z); } };

  const reset = (animated: boolean) => {
    g.scale = 1; g.tx = 0; g.ty = 0;
    reportZoom(false);
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, bounciness: 0 }),
        Animated.spring(tx, { toValue: 0, useNativeDriver: false, bounciness: 0 }),
        Animated.spring(ty, { toValue: 0, useNativeDriver: false, bounciness: 0 }),
      ]).start();
    } else {
      scale.setValue(1); tx.setValue(0); ty.setValue(0);
    }
  };

  const close = () => { reset(false); onRequestClose?.(); };

  const onTouchStart = () => { g.mode = 0; g.moved = false; };

  const onTouchMove = (e: GestureResponderEvent) => {
    const ts = e.nativeEvent.touches;
    const a = ts[0];
    const b = ts[1];
    if (a && b) {
      const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
      if (g.mode !== 2) { g.mode = 2; g.dist0 = dist || 1; g.scale0 = g.scale; g.moved = true; }
      const next = clamp((g.scale0 * dist) / g.dist0, MIN_SCALE, MAX_SCALE);
      g.scale = next;
      scale.setValue(next);
      reportZoom(next > MIN_SCALE + 0.01);
    } else if (a) {
      if (g.mode !== 1) { g.mode = 1; g.x0 = a.pageX; g.y0 = a.pageY; g.tx0 = g.tx; g.ty0 = g.ty; }
      const dx = a.pageX - g.x0;
      const dy = a.pageY - g.y0;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) g.moved = true;
      if (g.scale > 1) {
        g.tx = g.tx0 + dx;
        g.ty = g.ty0 + dy;
        tx.setValue(g.tx);
        ty.setValue(g.ty);
      }
    }
  };

  const onTouchEnd = (e: GestureResponderEvent) => {
    const remaining = e.nativeEvent.touches.length;
    // Re-baseline the next move so lifting one finger of a pinch doesn't jump.
    g.mode = 0;
    if (remaining === 0) {
      if (g.scale <= MIN_SCALE + 0.01) {
        reset(true);
        // Clean tap while not zoomed = dismiss. Disabled inside a horizontal
        // pager: a swipe the parent list consumes doesn't fire our onTouchMove,
        // so `moved` stays false and we'd misread the swipe as a tap and close.
        if (!g.moved && tapToClose) close();
      }
    }
  };

  const { width, height } = Dimensions.get("window");

  return (
    <View
      style={s.backdrop}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <View style={s.stage} pointerEvents="none">
        <Animated.View style={{ transform: [{ translateX: tx }, { translateY: ty }, { scale }] }}>
          <Image
            source={{ uri }}
            style={{ width, height }}
            contentFit="contain"
            accessibilityRole="image"
            accessibilityLabel={label ?? "Zoomable image"}
          />
        </Animated.View>
      </View>
      {onRequestClose ? (
        <Pressable style={s.close} onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Full-screen modal wrapper around ZoomableImage. */
export function ImageZoomModal({
  visible, uri, onClose, label,
}: { visible: boolean; uri: string; onClose: () => void; label?: string }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <ZoomableImage uri={uri} onRequestClose={onClose} label={label} />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "#000" },
  stage: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  close: { position: "absolute", top: 44, right: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" },
});
