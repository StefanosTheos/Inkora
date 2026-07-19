import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Local yyyy-mm-dd (no UTC shift). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Props {
  selected?: string | null;
  onSelect?: (iso: string) => void;
  /** Weekdays (0=Sun..6=Sat) the artist works; other days are disabled. Omit to enable all. */
  enabledWeekdays?: number[];
  /** ISO dates to badge with a dot (e.g. days with appointments). */
  markedDates?: Set<string>;
  /** Allow navigating to and selecting past months/days (e.g. a studio owner
   *  reviewing completed bookings). Booking flows leave this off. */
  allowPast?: boolean;
}

export function MonthCalendar({ selected, onSelect, enabledWeekdays, markedDates, allowPast }: Props) {
  const today = startOfToday();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const cells = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const out: (Date | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(new Date(year, month, d));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const canGoBack = allowPast || cursor > new Date(today.getFullYear(), today.getMonth(), 1);

  return (
    <View>
      <View style={s.header}>
        <Pressable
          hitSlop={10}
          disabled={!canGoBack}
          onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        >
          <Ionicons name="chevron-back" size={22} color={canGoBack ? "#18181B" : "#D4D4D8"} />
        </Pressable>
        <Text style={s.headerText}>{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</Text>
        <Pressable hitSlop={10} onPress={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
          <Ionicons name="chevron-forward" size={22} color="#18181B" />
        </Pressable>
      </View>

      <View style={s.weekRow}>
        {WEEKDAY_INITIALS.map((w, i) => (
          <Text key={i} style={s.weekday}>{w}</Text>
        ))}
      </View>

      <View style={s.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={s.cell} />;
          const iso = toIsoDate(d);
          const isPast = d < today;
          const disabledDay = enabledWeekdays ? !enabledWeekdays.includes(d.getDay()) : false;
          const disabled = (isPast && !allowPast) || disabledDay;
          const isSelected = selected === iso;
          const marked = markedDates?.has(iso);
          return (
            <Pressable
              key={i}
              style={s.cell}
              disabled={disabled || !onSelect}
              onPress={() => onSelect?.(iso)}
            >
              <View style={[s.day, isSelected && s.daySelected]}>
                <Text style={[s.dayText, disabled && s.dayDisabled, isSelected && s.daySelectedText]}>{d.getDate()}</Text>
              </View>
              {marked && !isSelected ? <View style={s.dot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 },
  headerText: { fontSize: 16, fontWeight: "800" },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekday: { flex: 1, textAlign: "center", color: "#A1A1AA", fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  daySelected: { backgroundColor: "#E5484D" },
  dayText: { fontSize: 15, color: "#18181B", fontWeight: "600" },
  dayDisabled: { color: "#D4D4D8", fontWeight: "400" },
  daySelectedText: { color: "#fff", fontWeight: "800" },
  dot: { position: "absolute", bottom: 6, width: 5, height: 5, borderRadius: 3, backgroundColor: "#E5484D" },
});
