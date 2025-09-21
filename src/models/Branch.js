import { Schema, models, model } from "mongoose";

const BranchSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    state: { type: Boolean, default: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
  },
  { timestamps: true }
);

export default models?.Branch || model("Branch", BranchSchema);
