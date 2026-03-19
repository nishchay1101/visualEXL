import mongoose from "mongoose";
import { ENV } from "./env";

export const connectDB = async () => {
  await mongoose.connect(ENV.MONGO_URI);
  console.log("DB Connected");
};