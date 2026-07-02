import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastKind = "success" | "error";
interface ToastState { message: string; kind: ToastKind }

const ToastCtx = createContext<{ show: (message: string, kind?: ToastKind) => void }>({ show: () => {} });

/** Lightweight global toast — a non-blocking alternative to Alert for confirmations. */
export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    setToast({ message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, 2500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [toast, opacity]);

  return (
    <ToastCtx.Provider value={{ show }}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[s.toast, { opacity, bottom: insets.bottom + 24 }, toast.kind === "error" && s.error]}>
          <Text style={s.text}>{toast.message}</Text>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

const s = StyleSheet.create({
  toast: { position: "absolute", left: 24, right: 24, backgroundColor: "#18181B", borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, alignItems: "center" },
  error: { backgroundColor: "#DC2626" },
  text: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
