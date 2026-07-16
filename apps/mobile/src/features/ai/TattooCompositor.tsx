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

  // committed transform + gesture start, kept in refs to survive re-renders
  const base = useRef<Transform>(IDENTITY);
  const start = useRef<{ dist: number; angle: number } | null>(null);

  useImperativeHandle(ref, () => ({
    capture: () => {
      const img = canvasRef.current?.makeImageSnapshot();
      return img ? img.encodeToBytes() : null;
    },
  }), [canvasRef]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e) => {
      const touches = e.nativeEvent.touches;
      start.current = touches.length >= 2
        ? { dist: touchDistance(touches), angle: touchAngle(touches) }
        : null;
    },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length >= 2) {
        if (!start.current) start.current = { dist: touchDistance(touches), angle: touchAngle(touches) };
        const scaleFactor = start.current.dist > 0 ? touchDistance(touches) / start.current.dist : 1;
        setT({
          tx: base.current.tx + g.dx,
          ty: base.current.ty + g.dy,
          scale: Math.max(0.15, Math.min(6, base.current.scale * scaleFactor)),
          rot: base.current.rot + (touchAngle(touches) - start.current.angle),
        });
      } else {
        setT({ ...base.current, tx: base.current.tx + g.dx, ty: base.current.ty + g.dy });
      }
    },
    onPanResponderRelease: () => { base.current = { ...t }; start.current = null; },
    onPanResponderTerminate: () => { base.current = { ...t }; start.current = null; },
  }), [t]);

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
