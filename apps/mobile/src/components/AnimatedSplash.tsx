import { Image } from "expo-image";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Dimensions, Easing, StyleSheet } from "react-native";

import LOGO from "../../assets/images/inkora_logo.png";

const GOLD = "#E8C36B";
const GOLD_BRIGHT = "#F7E4A6";
const PARTICLE_COUNT = 22;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Premium animated intro shown over the native (static) splash while the app
 * boots: gold particles scatter in random arcs around a spring-revealed logo,
 * with a shimmer flash, then the whole thing fades out. Dependency-free — all
 * animations run on the native driver (transform/opacity only).
 */
export function AnimatedSplash({ onDone }: { onDone: () => void }) {
  const { width, height } = Dimensions.get("window");
  const cx = width / 2;
  const cy = height / 2;

  // Logo starts at the exact size/opacity of the native splash so the handoff
  // is invisible; it then does a subtle settle pulse (never shrinks below 1).
  const logoScale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const root = useRef(new Animated.Value(1)).current;

  // Each particle radiates from the center along a random arc, twinkling.
  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, () => {
        const angle = rand(0, Math.PI * 2);
        const dist = rand(90, 200);
        return {
          anim: new Animated.Value(0),
          size: rand(2.5, 6),
          delay: rand(0, 1100),
          dur: rand(1100, 2200),
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          drift: rand(-40, 40),
          bright: Math.random() > 0.5,
        };
      }),
    [],
  );

  useEffect(() => {
    Animated.parallel([
      // gentle settle pulse — up then back, so it never looks smaller than the
      // native splash it takes over from.
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.06, duration: 360, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(logoScale, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      // shimmer flash
      Animated.sequence([
        Animated.delay(220),
        Animated.timing(flash, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start();

    const loops = particles.map((p) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: p.dur, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());

    const t = setTimeout(() => {
      Animated.timing(root, { toValue: 0, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => onDone());
    }, 2700);

    return () => { clearTimeout(t); loops.forEach((l) => l.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, { opacity: root }]} pointerEvents="none">
      {/* gold particles */}
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: cx,
            top: cy,
            width: p.size,
            height: p.size,
            borderRadius: p.size / 2,
            backgroundColor: p.bright ? GOLD_BRIGHT : GOLD,
            shadowColor: GOLD,
            shadowOpacity: 0.9,
            shadowRadius: 4,
            opacity: p.anim.interpolate({ inputRange: [0, 0.12, 0.75, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx + p.drift] }) },
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
              { scale: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
            ],
          }}
        />
      ))}

      {/* logo */}
      <Animated.View style={{ transform: [{ scale: logoScale }] }}>
        <Image source={LOGO} style={s.logo} contentFit="contain" />
      </Animated.View>

      {/* shimmer flash */}
      <Animated.View
        pointerEvents="none"
        style={[s.flash, { opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}
      />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { backgroundColor: "#000", alignItems: "center", justifyContent: "center", zIndex: 999 },
  logo: { width: 240, height: 240 },
  flash: { ...StyleSheet.absoluteFillObject, backgroundColor: "#fff" },
});
