import { createContext, useCallback, useContext, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions; dark button otherwise. */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

/** Promise-based confirm dialog, styled to match the app (replaces Alert.alert). */
export const useConfirm = (): ConfirmFn => useContext(ConfirmContext);

interface Request {
  opts: ConfirmOptions;
  resolve: (result: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<Request | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setReq({ opts, resolve })),
    [],
  );

  const settle = (result: boolean) => {
    setReq((r) => {
      r?.resolve(result);
      return null;
    });
  };

  const opts = req?.opts;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => settle(false)}>
        <Pressable style={s.backdrop} onPress={() => settle(false)} accessibilityLabel="Dismiss" accessibilityRole="button">
          <Pressable style={s.card} accessibilityViewIsModal onPress={() => { /* absorb taps */ }}>
            <Text style={s.title} accessibilityRole="header">{opts?.title}</Text>
            {opts?.message ? <Text style={s.message}>{opts.message}</Text> : null}
            <View style={s.actions}>
              <Pressable style={[s.btn, s.cancel]} onPress={() => settle(false)} accessibilityRole="button">
                <Text style={s.cancelText}>{opts?.cancelLabel ?? "Cancel"}</Text>
              </Pressable>
              <Pressable
                style={[s.btn, opts?.destructive ? s.confirmDanger : s.confirm]}
                onPress={() => settle(true)}
                accessibilityRole="button"
              >
                <Text style={s.confirmText}>{opts?.confirmLabel ?? "Confirm"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ConfirmContext.Provider>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 28 },
  card: { width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 20, padding: 22, gap: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  title: { fontSize: 18, fontWeight: "800", color: "#18181B" },
  message: { fontSize: 14, color: "#52525B", lineHeight: 20 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  cancel: { borderWidth: 1, borderColor: "#E4E4E7", backgroundColor: "#fff" },
  cancelText: { fontWeight: "700", fontSize: 15, color: "#18181B", textAlign: "center" },
  confirm: { backgroundColor: "#18181B" },
  confirmDanger: { backgroundColor: "#E5484D" },
  confirmText: { color: "#fff", fontWeight: "800", fontSize: 15, textAlign: "center" },
});
