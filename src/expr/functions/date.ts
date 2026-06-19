import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import advancedFormat from "dayjs/plugin/advancedFormat";
import relativeTime from "dayjs/plugin/relativeTime";
import { Value, NULL, str, bool, dateVal, DateValue } from "../values";

dayjs.extend(utc);
dayjs.extend(advancedFormat);
dayjs.extend(relativeTime);

export type MethodFn = (receiver: Value, args: Value[]) => Value;

function asDate(v: Value): DateValue | null {
  return v.type === "date" ? v : null;
}

export const dateMethods: Record<string, MethodFn> = {
  date: (recv) => {
    const d = asDate(recv);
    if (!d) return NULL;
    const dt = new Date(d.epochMs);
    const midnight = Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    return dateVal(midnight, false);
  },

  format: (recv, args) => {
    const d = asDate(recv);
    if (!d) return NULL;
    const fmt = args[0]?.type === "string" ? args[0].value : "YYYY-MM-DD";
    return str(dayjs.utc(d.epochMs).format(fmt));
  },

  time: (recv) => {
    const d = asDate(recv);
    if (!d) return NULL;
    return str(dayjs.utc(d.epochMs).format("HH:mm:ss"));
  },

  relative: (recv) => {
    const d = asDate(recv);
    if (!d) return NULL;
    return str(dayjs.utc(d.epochMs).fromNow());
  },

  isEmpty: () => bool(false),
};
