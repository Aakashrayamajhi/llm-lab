export default async function info() {
  const data = await mongoose.connection
    .collection("info")
    .findOne({ ownerId: "aakash-rayamajahi" });

  return data;
}