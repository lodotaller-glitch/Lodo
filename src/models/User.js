const bcrypt = require("bcryptjs");
import mongoose, { Schema, models, model } from "mongoose";

export const USER_ROLES = ["admin", "professor", "networks", "student"];

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    passwordHash: { type: String },
    state: { type: Boolean, default: true },
    capacity: { type: Number, min: 1, default: 10 },
    clayKg: { type: Number, default: 0, min: 0 },
    refreshToken: { type: String },
    branch: {
      type: mongoose.Types.ObjectId,
      ref: "Branch",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Antes de guardar el usuario en la base de datos, hashea la password
UserSchema.pre("save", async function (next) {
  const user = this;

  // Verifica si la password está presente y es modificada
  if (user.isModified("passwordHash") && user.passwordHash) {
    user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
  }

  next();
});

// Método para comparar passwords hasheadas
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

export default models?.User || model("User", UserSchema);
