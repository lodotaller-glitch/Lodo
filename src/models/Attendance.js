// models/Attendance.js
import mongoose, { Schema, model, models } from "mongoose";

const SlotSnapshotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startMin: { type: Number, min: 0, max: 24 * 60 - 1, required: true },
    endMin: { type: Number, min: 1, max: 24 * 60, required: true },
  },
  { _id: false }
);

const AttendanceSchema = new Schema(
  {
    enrollment: {
      type: mongoose.Types.ObjectId,
      ref: "Enrollment",
      required: false,
      index: true,
    },
    adhocClass: {
      type: mongoose.Types.ObjectId,
      ref: "AdhocClass",
      required: false,
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
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true },

    status: {
      type: String,
      enum: ["presente", "ausente", "justificado", "reprogramado"],
      required: true,
    },

    // NUEVO
    origin: {
      type: String,
      enum: ["regular", "adhoc"],
      default: "regular",
      index: true,
    },
    slotSnapshot: { type: SlotSnapshotSchema, required: false }, // requerido si origin === "adhoc"
    removed: { type: Boolean, default: false }, // para "eliminar" asistencias ad-hoc

    // existentes
    reschedule: { type: mongoose.Types.ObjectId, ref: "StudentReschedule" },
    markedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    markedAt: { type: Date, default: () => new Date() },
    notes: { type: String },
  },
  { timestamps: true }
);

// Índice único para regulares: solo cuando hay enrollment
AttendanceSchema.index(
  { enrollment: 1, date: 1 },
  {
    unique: true,
    name: "regular_enrollment_date_unique",
    partialFilterExpression: { enrollment: { $type: "objectId" } },
  }
);

// Índice único para ad-hoc: por alumno/profe/sede/día
AttendanceSchema.index(
  { student: 1, professor: 1, branch: 1, date: 1, origin: 1 },
  {
    unique: true,
    name: "adhoc_unique",
    partialFilterExpression: { origin: "adhoc" },
  }
);

export default models?.Attendance || model("Attendance", AttendanceSchema);
