import mongoose, { Schema, model, models } from "mongoose";

const PieceSchema = new Schema(
  {
    title: { type: String, required: true },
    images: {
      type: [String],
      validate: [(arr) => arr.length <= 5, "Máximo 5 imágenes"],
    },
    status: {
      type: String,
      enum: [
        "Lista",
        "En preparacion",
        "En el horno",
        "Destruida",
        "Sin terminar",
      ],
      default: "Sin terminar",
      required: true,
    },
    student: {
      type: mongoose.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch", // <-- nombre del modelo de tu colección Branch
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export default models?.Piece || model("Piece", PieceSchema);
