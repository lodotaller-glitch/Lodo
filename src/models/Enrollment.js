// models/Enrollment.js
import { Schema, models, model } from "mongoose";
import mongoose from "mongoose";

/**
 * Inscripción mensual de un student con un professor.
 * El student “fija” 1 o 2 franjas semanales para todo el mes (p.ej. lunes 12–14 y lunes 16–18).
 * También guarda estado de pago.
 */

const PaymentSchema = new Schema(
  {
    state: {
      type: String,
      enum: ["pendiente", "señado", "pagado", "cancelado"],
      default: "pendiente",
      index: true,
    },
    method: {
      type: String,
      enum: ["transferencia", "efectivo", "otro", "no_aplica"],
      default: "no_aplica",
    },
    amount: { type: Number, min: 0 },
    currency: { type: String, default: "ARS" },
    reference: { type: String }, // id de transferencia, recibo, etc.
    observations: { type: String },

    // NUEVO: bloqueo de edición
    locked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { _id: false, timestamps: true }
);

const ChosenSlotSchema = new Schema(
  {
    dayOfWeek: { type: Number, min: 0, max: 6, required: true },
    startMin: { type: Number, min: 0, max: 24 * 60 - 1, required: true },
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
    professor: {
      type: mongoose.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false }
);

const EnrollmentSchema = new Schema(
  {
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

    // Mes/año de la cursada (usa números naturales: 1–12)
    year: { type: Number, required: true, min: 2000, max: 3000, index: true },
    month: { type: Number, required: true, min: 1, max: 12, index: true },

    // Snapshot de las franjas elegidas (copiadas desde el schedule vigente en ese mes)
    chosenSlots: {
      type: [ChosenSlotSchema],
      required: true,
      validate: [
        {
          validator: function (arr) {
            return arr.length >= 1 && arr.length <= 2;
          },
          message: "El student debe elegir 1 o 2 franjas por semana.",
        },
        {
          // evita solapamientos entre las franjas elegidas
          validator: function (arr) {
            const sorted = [...arr].sort((a, b) =>
              a.dayOfWeek === b.dayOfWeek
                ? a.startMin - b.startMin
                : a.dayOfWeek - b.dayOfWeek
            );
            for (let i = 1; i < sorted.length; i++) {
              if (
                sorted[i].dayOfWeek === sorted[i - 1].dayOfWeek &&
                sorted[i].startMin < sorted[i - 1].endMin
              ) {
                return false;
              }
            }
            return true;
          },
          message: "Las franjas elegidas se solapan.",
        },
      ],
    },

    maxWeeklySlots: { type: Number, enum: [1, 2], default: 1 },

    // Estado de la inscripción
    state: {
      type: String,
      enum: ["activa", "cancelada"],
      default: "activa",
      index: true,
    },

    assigned: { type: Boolean, default: false, index: true },

    pay: { type: PaymentSchema, default: () => ({}) },
    pay2: { type: PaymentSchema, required: false, default: undefined },
    // Quién creó/asignó (admin o redes)
    createBy: { type: mongoose.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// Un student no puede tener dos inscripciones activas para el mismo professor y mes
EnrollmentSchema.index(
  { student: 1, professor: 1, year: 1, month: 1, state: 1 },
  { unique: true, partialFilterExpression: { state: "activa" } }
);

// Helper: verifica que las franjas elegidas existan en el horario del professor para ese mes
EnrollmentSchema.statics.validateSlotsAgainstProfessor = async function ({
  professorId,
  year,
  month,
  chosenSlots,
  ProfessorScheduleModel, // pásalo al llamar para evitar import circular
}) {
  const startOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const schedule = await ProfessorScheduleModel.findActiveForDate(
    professorId,
    startOfMonth
  );
  if (!schedule)
    return {
      ok: false,
      reason: "No existe un horario vigente del professor para ese mes.",
    };

  // Para cada slot elegido, debe existir un slot igual en el schedule vigente
  const key = (s) => `${professorId}-${s.dayOfWeek}-${s.startMin}-${s.endMin}`;
  const setSchedule = new Set(schedule.slots.map(key));
  for (const s of chosenSlots) {
    if (!setSchedule.has(key(s))) {
      return {
        ok: false,
        reason:
          "Alguna franja elegida no coincide con el horario vigente del professor para ese mes.",
      };
    }
  }
  return { ok: true };
};

export default models?.Enrollment || model("Enrollment", EnrollmentSchema);
