import mongoose, { Schema, model, models } from "mongoose";

const AttendanceSchema = new Schema(
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
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    date: { type: Date, required: true, index: true }, // fecha de la clase en UTC (inicio)
    // estado
    status: {
      type: String,
      enum: ["presente", "ausente", "justificado", "reprogramado"],
      required: true,
    },
    // enlaces útiles
    reschedule: { type: mongoose.Types.ObjectId, ref: "StudentReschedule" },
    // auditoría
    markedBy: { type: mongoose.Types.ObjectId, ref: "User" },
    markedAt: { type: Date, default: () => new Date() },
    notes: { type: String },
  },
  { timestamps: true }
);

AttendanceSchema.index({ enrollment: 1, date: 1 }, { unique: true });

export default models.Attendance || model("Attendance", AttendanceSchema);
