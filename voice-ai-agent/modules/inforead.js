
import mongoose from "mongoose";

export default async function info() {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("MongoDB is not connected.");
  }

  const resume = await mongoose.connection
    .collection("info")
    .findOne({ ownerId: "aakash-rayamajahi" });

  if (!resume) {
    throw new Error("Resume document was not found.");
  }

  return resume;
}
