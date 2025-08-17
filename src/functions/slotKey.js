export const slotKey = (s, profId) => {
  console.log(s, "slot in slotKey function");
  return `${profId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
};
