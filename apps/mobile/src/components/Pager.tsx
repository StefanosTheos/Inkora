import { Ionicons } from "@expo/vector-icons";
import { createContext, type ReactNode, type RefObject,useContext } from "react";
import { findNodeHandle, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

/** Lets a <Pager> nested anywhere below a screen's scroll container reach it so
 *  that changing pages resets the scroll position — otherwise a shorter page
 *  leaves you stranded mid-scroll (e.g. a page with a single item). The screen
 *  that owns the ScrollView wraps its content in <PagerScrollProvider>; every
 *  <Pager> inside consumes it automatically. */
const ScrollHostContext = createContext<RefObject<ScrollView | null> | null>(null);

export function PagerScrollProvider({ scrollRef, children }: { scrollRef: RefObject<ScrollView | null>; children: ReactNode }) {
  return <ScrollHostContext.Provider value={scrollRef}>{children}</ScrollHostContext.Provider>;
}

/** The page tokens to render: real page indices interspersed with "…" gaps.
 *  Keeps the control to a single row by showing at most four numbers — the
 *  current page and the next one (low side) plus the last two pages (high side),
 *  with an ellipsis bridging the gap. e.g. 5 6 … 19 20 (all 0-indexed).
 *  Small page counts (≤4) are shown in full. */
function pageWindow(page: number, total: number): (number | "dots")[] {
  const last = total - 1;
  if (total <= 4) return Array.from({ length: total }, (_, i) => i);
  const set = new Set<number>();
  set.add(page); // current
  if (page + 1 <= last) set.add(page + 1); // next
  set.add(last - 1); // second to last
  set.add(last); // last
  const nums = [...set].filter((n) => n >= 0 && n <= last).sort((a, b) => a - b);
  const out: (number | "dots")[] = [];
  let prev: number | null = null;
  for (const n of nums) {
    if (prev !== null && n - prev > 1) out.push("dots");
    out.push(n);
    prev = n;
  }
  return out;
}

/** Numbered page control: ‹ prev · 1 2 3 · next ›. Renders nothing for a single
 *  page. `page` is 0-indexed. Arrows and numbers always stay on one row — the
 *  numbers window (current + next, then the last two) with an ellipsis once
 *  there are more than 4 pages.
 *
 *  On every page change the enclosing scroll view is scrolled back to the top of
 *  this list so the first item of the new page is the first thing on screen.
 *  `scrollRef` (or, more commonly, a surrounding <PagerScrollProvider>) supplies
 *  the scroll container; `anchorRef` marks where the top of the list sits — omit
 *  it when the list starts at the very top of its scroll view (scrolls to 0). */
export function Pager({
  page,
  totalPages,
  onChange,
  anchorRef,
  scrollRef,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
  anchorRef?: RefObject<View | null>;
  scrollRef?: RefObject<ScrollView | null>;
}) {
  const ctxScroll = useContext(ScrollHostContext);
  const scroll = scrollRef ?? ctxScroll;
  if (totalPages <= 1) return null;

  const go = (p: number) => {
    onChange(p);
    const sc = scroll?.current;
    if (!sc) return;
    const anchor = anchorRef?.current;
    if (!anchor) {
      sc.scrollTo({ y: 0, animated: true });
      return;
    }
    const node = findNodeHandle(sc);
    if (node == null) {
      sc.scrollTo({ y: 0, animated: true });
      return;
    }
    // measureLayout gives the anchor's offset within the scroll content
    // (unaffected by the current scroll position), so we can land its top just
    // below the container edge regardless of how nested it is.
    anchor.measureLayout(
      node,
      (_x, y) => sc.scrollTo({ y: Math.max(y - 12, 0), animated: true }),
      () => sc.scrollTo({ y: 0, animated: true }),
    );
  };

  const tokens = pageWindow(page, totalPages);
  return (
    <View style={s.pager}>
      <Pressable disabled={page === 0} onPress={() => go(page - 1)} hitSlop={6} style={[s.arrow, page === 0 && s.off]} accessibilityRole="button" accessibilityLabel="Previous page">
        <Ionicons name="chevron-back" size={18} color={page === 0 ? "#D4D4D8" : "#18181B"} />
      </Pressable>
      {tokens.map((t, i) =>
        t === "dots" ? (
          <View key={`dots-${i}`} style={s.dots}><Text style={s.dotsText}>…</Text></View>
        ) : (
          <Pressable key={t} onPress={() => go(t)} style={[s.num, t === page && s.numActive]} accessibilityRole="button" accessibilityLabel={`Page ${t + 1}`}>
            <Text style={[s.numText, t === page && s.numTextActive]}>{t + 1}</Text>
          </Pressable>
        ),
      )}
      <Pressable disabled={page >= totalPages - 1} onPress={() => go(page + 1)} hitSlop={6} style={[s.arrow, page >= totalPages - 1 && s.off]} accessibilityRole="button" accessibilityLabel="Next page">
        <Ionicons name="chevron-forward" size={18} color={page >= totalPages - 1 ? "#D4D4D8" : "#18181B"} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 16 },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  off: { opacity: 0.4 },
  num: { minWidth: 34, height: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F4F5" },
  numActive: { backgroundColor: "#18181B" },
  numText: { fontWeight: "700", color: "#52525B", fontSize: 14 },
  numTextActive: { color: "#fff" },
  dots: { minWidth: 20, height: 34, alignItems: "center", justifyContent: "flex-end", paddingBottom: 6 },
  dotsText: { color: "#A1A1AA", fontWeight: "800", fontSize: 15 },
});
