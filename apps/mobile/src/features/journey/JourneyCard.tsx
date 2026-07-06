import { Ionicons } from "@expo/vector-icons";
import { type BookingJourney, JOURNEY_STAGE_LABEL, JOURNEY_STAGES } from "@inkora/domain";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CountBadge } from "../../components/CountBadge";
import { fmtDate } from "../booking/components/ui";

function statusLine(j: BookingJourney): string {
  if (j.stageIndex >= 4) return "Journey complete 🎉";
  if (j.status !== "completed") return `Session ${fmtDate(j.scheduledStart)}`;
  if (!j.hasReview) return "Leave a review to continue";
  const done = j.milestones.filter((m) => m.completed).length;
  return `${done} of ${j.milestones.length} healing photos added`;
}

/** The 5-checkpoint stepper (Idea → Consult → Session → Healing → Done). */
export function JourneyStepper({ stageIndex }: { stageIndex: number }) {
  return (
    <View style={s.track}>
      {JOURNEY_STAGES.map((st, i) => {
        const on = i <= stageIndex;
        return (
          <Fragment key={st}>
            {i > 0 ? <View style={[s.line, on && s.lineOn]} /> : null}
            <View style={s.node}>
              <View style={[s.dot, on && s.dotOn]}>
                {on ? <Ionicons name="checkmark" size={10} color="#fff" /> : null}
              </View>
              <Text style={[s.nodeLabel, on && s.nodeLabelOn]} numberOfLines={1}>{JOURNEY_STAGE_LABEL[st]}</Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}

/** One booking's end-to-end journey: a 5-checkpoint stepper + status line. */
export function JourneyCard({ journey, onPress }: { journey: BookingJourney; onPress: () => void }) {
  const j = journey;
  return (
    <Pressable style={s.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Tattoo journey with ${j.artistName}`}>
      <View style={s.head}>
        <Text style={s.artist} numberOfLines={1}>{j.artistName}</Text>
        {j.dueCount > 0 ? <CountBadge count={j.dueCount} /> : null}
      </View>
      <JourneyStepper stageIndex={j.stageIndex} />
      <Text style={s.status}>{statusLine(j)}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderWidth: 1, borderColor: "#EEE", borderRadius: 16, padding: 14, marginBottom: 10, backgroundColor: "#fff" },
  head: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  artist: { fontWeight: "800", fontSize: 15, flex: 1, color: "#18181B" },
  track: { flexDirection: "row", alignItems: "flex-start" },
  node: { alignItems: "center", width: 48 },
  dot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#E4E4E7", alignItems: "center", justifyContent: "center" },
  dotOn: { backgroundColor: "#E5484D" },
  nodeLabel: { fontSize: 10, color: "#A1A1AA", marginTop: 4, fontWeight: "600" },
  nodeLabelOn: { color: "#18181B" },
  line: { flex: 1, height: 2, backgroundColor: "#E4E4E7", marginTop: 9 },
  lineOn: { backgroundColor: "#E5484D" },
  status: { marginTop: 12, color: "#52525B", fontSize: 13, fontWeight: "600" },
});
