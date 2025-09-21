export const slotKey = (s, profId) => {
  return `${profId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
};
