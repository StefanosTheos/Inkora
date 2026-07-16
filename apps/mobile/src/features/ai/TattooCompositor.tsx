import { Canvas, Group, Image as SkImage, useCanvasRef, useImage } from "@shopify/react-native-skia";
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  type GestureResponderEvent, type LayoutChangeEvent, PanResponder, StyleSheet, Text, View,
} from "react-native";

export interface CompositorHandle {
  /** Snapshot the composited canvas to PNG bytes (null if not ready). */
  capture: () => Uint8Array | null;
}

type Transform = { tx: number; ty: number; scale: number; rot: number };
const IDENTITY: Transform = { tx: 0, ty: 0, scale: 1, rot: 0 };

function touchDistance(a: GestureResponderEvent["nativeEvent"]["touches"]): number {
  const [p, q] = a;
  return p && q ? Math.hypot(p.pageX - q.pageX, p.pageY - q.pageY) : 0;
}
function touchAngle(a: GestureResponderEvent["nativeEvent"]["touches"]): number {
  const [p, q] = a;
  return p && q ? Math.atan2(q.pageY - p.pageY, q.pageX - p.pageX) : 0;
}
function touchCentroid(a: GestureResponderEvent["nativeEvent"]["touches"]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const p of a) { x += p.pageX; y += p.pageY; }
  const n = a.length || 1;
  return { x: x / n, y: y / n };
}

/**
 * On-device tattoo try-on: draws the body photo and multiply-blends the flash
 * (black-ink-on-white) over the skin so white drops out and the linework lands
 * on the body. Drag to move, pinch to scale, twist to rotate; opacity fades the
 * ink for a healed look. `capture()` returns the flattened PNG.
 */
export const TattooCompositor = forwardRef<CompositorHandle, {
  bodyUri: string;
  flashUri: string;
  opacity: number;
}>(({ bodyUri, flashUri, opacity }, ref) => {
  const canvasRef = useCanvasRef();
  const body = useImage(bodyUri);
  const flash = useImage(flashUri);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [t, setT] = useState<Transform>(IDENTITY);

  // `cur` is the single source of truth — it persists across gestures and is
  // never reset. Each move applies the delta since the PREVIOUS frame (`prev`),
  // so lifting one finger of a pinch re-baselines instead of discarding the
  // scale/rotation. State just mirrors `cur` for rendering.
  const cur = useRef<Transform>(IDENTITY);
  const prev = useRef<{ cx: number; cy: number; dist: number; angle: number; count: number } | null>(null);

  useImperativeHandle(ref, () => ({
    capture: () => {
      const img = canvasRef.current?.makeImageSnapshot();
      return img ? img.encodeToBytes() : null;
    },
  }), [canvasRef]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { prev.current = null; },
    onPanResponderMove: (e) => {
      const touches = e.nativeEvent.touches;
      if (touches.length === 0) return;
      const c = touchCentroid(touches);
      const two = touches.length >= 2;
      const dist = two ? touchDistance(touches) : 0;
      const angle = two ? touchAngle(touches) : 0;
      const p = prev.current;
      // Only apply a delta when the finger count is unchanged; on grant or a
      // finger add/remove we just re-baseline this frame (no jump, no reset).
      if (p && p.count === touches.length) {
        const next: Transform = { ...cur.current, tx: cur.current.tx + (c.x - p.cx), ty: cur.current.ty + (c.y - p.cy) };
        if (two && p.dist > 0) {
          next.scale = Math.max(0.15, Math.min(6, next.scale * (dist / p.dist)));
          next.rot += angle - p.angle;
        }
        cur.current = next;
        setT(next);
      }
      prev.current = { cx: c.x, cy: c.y, dist, angle, count: touches.length };
    },
    onPanResponderRelease: () => { prev.current = null; },
    onPanResponderTerminate: () => { prev.current = null; },
  }), []);

  // Flash base rect: centred, ~48% of the canvas width, aspect-correct.
  const rect = useMemo(() => {
    if (!flash || box.w === 0) return null;
    const aspect = flash.width() / Math.max(1, flash.height());
    let w = box.w * 0.48;
    let h = w / aspect;
    const maxH = box.h * 0.6;
    if (h > maxH) { h = maxH; w = h * aspect; }
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h };
  }, [flash, box]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: Math.round(width), h: Math.round(height) });
  };

  const origin = { x: box.w / 2, y: box.h / 2 };
  const transform = [{ translateX: t.tx }, { translateY: t.ty }, { rotate: t.rot }, { scale: t.scale }];

  return (
    <View style={s.wrap} onLayout={onLayout} {...pan.panHandlers}>
      {box.w > 0 ? (
        <Canvas ref={canvasRef} style={{ width: box.w, height: box.h }}>
          {body ? <SkImage image={body} x={0} y={0} width={box.w} height={box.h} fit="cover" /> : null}
          {flash && rect ? (
            <Group transform={transform} origin={origin}>
              <SkImage image={flash} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fit="fill" blendMode="multiply" opacity={opacity} />
            </Group>
          ) : null}
        </Canvas>
      ) : null}
      {!body ? <View style={s.hintWrap}><Text style={s.hint}>Add a photo to begin</Text></View> : null}
    </View>
  );
});
TattooCompositor.displayName = "TattooCompositor";

const s = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 20, overflow: "hidden", backgroundColor: "#0B0B0F" },
  hintWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  hint: { color: "#A1A1AA", fontWeight: "600" },
});
