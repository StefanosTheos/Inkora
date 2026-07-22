import {
  Canvas, Group, Image as SkImage, ImageShader, Rect, Shader, Skia, useCanvasRef, useImage,
} from "@shopify/react-native-skia";
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

// Background-key shader. Flash designs are a black or coloured design on a white
// / pale-beige / very-light background. This makes the light background fully
// transparent while keeping the design at its TRUE colour, so it can be dropped
// onto skin and dragged/scaled/rotated. A pixel counts as background only when
// it's both very bright (high luminance) AND nearly unsaturated — so a saturated
// colour (even a bright one) is kept as design, and only genuine paper/white/
// beige is removed. `image.eval` returns premultiplied colour; the source flash
// is opaque, so we key on its RGB and emit premultiplied output.
const BG_KEY = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float4 bounds;   // design rect: x, y, w, h (local coords)
half4 main(float2 xy) {
  half4 c = image.eval(xy);
  // Unsharp mask: fine lines get averaged with the white paper when the sheet is
  // downscaled, turning them light-grey — which the key below would drop. Pull
  // each pixel away from its local average so thin lines darken back to solid and
  // survive the key. Flat areas (paper, solid fills) equal their average → no change.
  half3 blur = (image.eval(xy + float2(1.4, 0.0)).rgb + image.eval(xy - float2(1.4, 0.0)).rgb
              + image.eval(xy + float2(0.0, 1.4)).rgb + image.eval(xy - float2(0.0, 1.4)).rgb) * 0.25;
  half3 rgb = clamp(c.rgb + (c.rgb - blur) * 0.9, 0.0, 1.0);
  half l = dot(rgb, half3(0.299, 0.587, 0.114));
  half mx = max(rgb.r, max(rgb.g, rgb.b));
  half mn = min(rgb.r, min(rgb.g, rgb.b));
  half sat = mx - mn;
  half bright = smoothstep(0.72, 0.93, l);          // 1 = very light
  half mono   = 1.0 - smoothstep(0.12, 0.32, sat);  // 1 = nearly greyscale
  half a = 1.0 - bright * mono;                       // background -> 0, design -> 1
  // Fade the outermost ~5% of the sheet to transparent so a dashed crop-frame /
  // border baked into the flash art (and JPEG edge ringing) doesn't read as a
  // rectangle around the design.
  float2 uv = (xy - bounds.xy) / bounds.zw;
  float m = 0.05;
  float edge = smoothstep(0.0, m, uv.x) * smoothstep(0.0, m, 1.0 - uv.x)
             * smoothstep(0.0, m, uv.y) * smoothstep(0.0, m, 1.0 - uv.y);
  a *= half(edge);
  return half4(rgb * a, a);
}
`);

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
 * On-device tattoo try-on: draws the body photo and lays the flash design over
 * the skin with its light background keyed out (see BG_KEY) so only the design
 * shows. Drag to move, pinch to scale, twist to rotate; opacity fades the ink
 * for a healed look. `capture()` returns the flattened PNG.
 */
export const TattooCompositor = forwardRef<CompositorHandle, {
  bodyUri: string;
  flashUri: string;
  opacity: number;
}>(({ bodyUri, flashUri, opacity }, ref) => {
  const canvasRef = useCanvasRef();
  const body = useImage(bodyUri);
  // Skia's remote loader (unlike RN's <Image>) does NOT URL-encode, and the
  // flash path often arrives with raw spaces — expo-router decodes the %20 in
  // "blackwork%20-%201.jpg" nav params back to a space — so the fetch silently
  // fails and the design never appears. Re-encode spaces before loading.
  const flash = useImage(flashUri.replace(/ /g, "%20"));
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
            <Group transform={transform} origin={origin} opacity={opacity}>
              {BG_KEY ? (
                // Key the light background to transparent, keep the design's colour.
                <Rect x={rect.x} y={rect.y} width={rect.w} height={rect.h}>
                  <Shader source={BG_KEY} uniforms={{ bounds: [rect.x, rect.y, rect.w, rect.h] }}>
                    <ImageShader image={flash} fit="fill" rect={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }} />
                  </Shader>
                </Rect>
              ) : (
                // Fallback if the runtime shader can't compile: multiply drops white.
                <SkImage image={flash} x={rect.x} y={rect.y} width={rect.w} height={rect.h} fit="fill" blendMode="multiply" />
              )}
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
