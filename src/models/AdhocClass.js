// models/AdhocClass.js
import mongoose, { Schema, model, models } from "mongoose";

const SlotSnapshotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startMin: { type: Number, min: 0, max: 24 * 60 - 1, required: true },
    endMin: { type: Number, min: 1, max: 24 * 60, required: true },
  },
  { _id: false }
);

const AdhocClassSchema = new Schema(
  {
    professor: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true }, // fecha UTC de la clase (solo día)
    slotSnapshot: { type: SlotSnapshotSchema, required: true }, // franja para esa clase
    students: [{ type: mongoose.Types.ObjectId, ref: "User", index: true }], // inscritos manuales
    capacity: { type: Number, min: 1, default: 10 },
    notes: { type: String },
    removed: { type: Boolean, default: false },
    createdBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Evitar duplicados exactos (una clase adhoc por prof/branch/date/slot)
AdhocClassSchema.index(
  {
    professor: 1,
    branch: 1,
    date: 1,
    "slotSnapshot.startMin": 1,
    "slotSnapshot.endMin": 1,
  },
  { unique: true, partialFilterExpression: { removed: { $ne: true } } }
);

export default models?.AdhocClass || model("AdhocClass", AdhocClassSchema);
