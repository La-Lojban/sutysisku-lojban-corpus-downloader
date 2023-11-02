import { Dict } from "../types/index.js";

export const log = (
  message: string | Dict,
  level: "log" | "warn" | "error" = "log"
) => {
  if (typeof message === "string")
    return console[level ?? "log"]({
      event: message,
      startedAt: (new Date().getTime()/1000).toFixed(3),
    });
  return console[level ?? "log"]({
    ...(message as Dict),
    startedAt: (new Date().getTime()/1000).toFixed(3),
  });
};
