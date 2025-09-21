import { Schema, models, model } from "mongoose";
import mongoose from "mongoose";

const SlotSnapshotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startMin: { type: Number, min: 0, max: 24 * 60 - 1, required: true },
    endMin: { type: Number, min: 1, max: 24 * 60, required: true },
  },
  { _id: false }
);

const StudentRescheduleSchema = new Schema(
  {
    enrollment: {
      type: mongoose.Types.ObjectId,
      ref: "Enrollment",
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    professor: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    year: { type: Number, required: true, min: 2000, max: 3000, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },

    fromDate: { type: Date, required: true }, // ocurrencia original (UTC)
    toDate: { type: Date, required: true }, // nueva ocurrencia (UTC)

    slotFrom: { type: SlotSnapshotSchema, required: true },
    slotTo: { type: SlotSnapshotSchema, required: true },
    fromProfessor: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
    },
    toProfessor: { type: mongoose.Types.ObjectId, ref: "User", required: true },
    motivo: { type: String },
    createBy: { type: mongoose.Types.ObjectId, ref: "User" },
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Máx 1 reprogramación por (inscripción, mes)
StudentRescheduleSchema.index(
  { enrollment: 1, year: 1, month: 1 },
  { unique: true }
);

export default models?.StudentReschedule ||
  model("StudentReschedule", StudentRescheduleSchema);
