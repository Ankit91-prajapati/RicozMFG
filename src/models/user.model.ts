
import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema({
    username: { type: String, },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isemailVerified: { type: Boolean, default: false },
    tokenVersion: { type: Number, default: 0 },
    resetPasswordToken: { type: String },
    resetPasswordExpiryDate: { type: Date }

}, { timestamps: true })

const UserModel = mongoose.model("users", UserSchema);
export default UserModel