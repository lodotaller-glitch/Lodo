import { Schema, models, model } from "mongoose";
import mongoose from "mongoose";

/**
 * Representa un conjunto de franjas horarias semanales para un professor,
 * con un período de vigencia (versionado por fecha). Ej:
 * - effectiveFrom: 2025-08-01 (aplica desde agosto)
 * - effectiveTo: null (vigente hasta que se cree otro)
 */
const TimeSlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true }, // 0=Domingo ... 6=Sábado
    startMin: { type: Number, min: 0, max: 24 * 60 - 1, required: true }, // minutos desde 00:00
    endMin: {
      type: Number,
      min: 1,
      max: 24 * 60,
      required: true,
      validate: {
        validator: function (v) {
          return v > this.startMin;
        },
        message: "endMin debe ser mayor que startMin",
      },
    },
  },
  { _id: false }
);

const professorScheduleSchema = new Schema(
  {
    professor: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    effectiveFrom: { type: Date, required: true, index: true }, // típicamente primer día del mes (UTC a las 00:00)
    effectiveTo: { type: Date, default: null, index: true }, // null = vigente hasta nuevo aviso
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
    slots: {
      type: [TimeSlotSchema],
      validate: [
        {
          validator: function (slots) {
            // Evitar solapamientos dentro del mismo dayOfWeek
            const byDay = {};
            for (const s of slots) {
              byDay[s.dayOfWeek] ||= [];
              byDay[s.dayOfWeek].push([s.startMin, s.endMin]);
            }
            for (const day in byDay) {
              const list = byDay[day].sort((a, b) => a[0] - b[0]);
              for (let i = 1; i < list.length; i++) {
                if (list[i][0] < list[i - 1][1]) return false;
              }
            }
            return true;
          },
          message: "Hay solapamientos de franjas en los slots del professor.",
        },
      ],
    },
  },
  { timestamps: true }
);

// Garantiza que solo haya una versión activa que cubra una fecha dada
professorScheduleSchema.index(
  { professor: 1, effectiveFrom: 1 },
  { unique: false }
);

// Método helper: devuelve los slots vigentes para una fecha dada
professorScheduleSchema.statics.findActiveForDate = async function (
  professorId,
  date
) {
  return this.findOne({
    professor: professorId,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gt: date } }],
  }).lean();
};

export default models?.professorSchedule ||
  model("professorSchedule", professorScheduleSchema);
