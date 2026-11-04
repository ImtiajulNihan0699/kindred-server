
import express from "express";
import { MongoClient } from "mongodb";
import { ObjectId } from "mongodb";
import dotenv from "dotenv";
import cors from "cors";



dotenv.config();

const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const connectedClient = await connectToMongoDB();
const db = connectedClient.db("kindredDB");
const usersCollection = db.collection("users");
const eventsCollection = db.collection("events");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.post("/events", async (req, res) => {
  const event = req.body;
  const result = await eventsCollection.insertOne(event);
  console.log(result);
  res.send(result);
});
app.get("/events", async (req, res) => {
  const events = await eventsCollection.find().toArray();

  res.send(events);
});

app.get("/events/user/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const userEvents = await eventsCollection
      .find({ createdBy: userId })
      .toArray();

    res.send(userEvents);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: "Failed to fetch user's events",
    });
  }
});
app.get("/events/:id", async (req, res) => {
  const {id} = req.params;
 const result = await eventsCollection.findOne({ _id: new ObjectId(id) });
  res.send(result);

});



app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
