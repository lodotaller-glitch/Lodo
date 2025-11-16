// models/DisabledClass.js
import mongoose from "mongoose";

const DisabledClassSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true },
    enrollmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Enrollment",
      required: true,
    },
    start: { type: String, required: true }, // fecha/hora ISO exacta de la clase
    slot: { type: String, required: true }, // "HH:mm" o toma tu slotSnapshot key
  },
  { timestamps: true }
);

// se asegura de no duplicar la deshabilitación de la misma clase
DisabledClassSchema.index(
  { enrollmentId: 1, start: 1, slot: 1 },
  { unique: true }
);

export default mongoose.models.DisabledClass ||
  mongoose.model("DisabledClass", DisabledClassSchema);
