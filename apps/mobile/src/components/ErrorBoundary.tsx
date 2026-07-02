import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

/**
 * App-wide error boundary. Catches render/runtime crashes so a single bad
 * screen shows a recoverable fallback instead of white-screening the app.
 * TODO(observability): forward `error`/`info` to Sentry once wired.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Uncaught UI error:", error, info.componentStack);
  }
  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <View style={s.c}>
          <Text style={s.emoji}>🩹</Text>
          <Text style={s.t}>Something went wrong</Text>
          <Text style={s.m}>{this.state.error.message || "An unexpected error occurred."}</Text>
          <Pressable style={s.btn} onPress={this.reset}>
            <Text style={s.btnText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const s = StyleSheet.create({
  c: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 8, backgroundColor: "#fff" },
  emoji: { fontSize: 40 },
  t: { fontSize: 20, fontWeight: "800", color: "#18181B" },
  m: { color: "#71717A", textAlign: "center", lineHeight: 20 },
  btn: { marginTop: 16, backgroundColor: "#E5484D", borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  btnText: { color: "#fff", fontWeight: "800" },
});
