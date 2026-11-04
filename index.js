
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
const joinedEventsCollection = db.collection("joinedEvents");
await joinedEventsCollection.createIndex(
  { userId: 1, eventId: 1 },
  { unique: true }
);

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

app.patch("/events/:id", async (req, res) => {
const { id } = req.params;
const updatedEvent = req.body;

const result = await eventsCollection.updateOne(
  { _id: new ObjectId(id) },
  { $set: updatedEvent }
);

res.send(result);
});

app.delete("/events/:id", async (req, res) => {
  const { id } = req.params;
  const result = await eventsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});  

app.post("/joined-events", async (req, res) => {
  try {
    const { userId, eventId } = req.body;

    if (!userId || !ObjectId.isValid(eventId)) {
      return res.status(400).send({
        message: "Invalid user or event information",
      });
    }

    const event = await eventsCollection.findOne({
      _id: new ObjectId(eventId),
    });

    if (!event) {
      return res.status(404).send({
        message: "Event not found",
      });
    }

    const joinedEvent = {
      userId,
      eventId,
      joinedAt: new Date(),
    };

    await joinedEventsCollection.insertOne(joinedEvent);

    res.status(201).send({
      message: "Successfully joined the event",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).send({
        message: "You have already joined this event",
      });
    }

    console.error("Join event error:", error);

    res.status(500).send({
      message: "Failed to join event",
    });
  }
});
app.get("/joined-events/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const joinedEvents = await joinedEventsCollection
      .aggregate([
        {
          $match: { userId },
        },
        {
          $addFields: {
            eventObjectId: {
              $toObjectId: "$eventId",
            },
          },
        },
        {
          $lookup: {
            from: "events",
            localField: "eventObjectId",
            foreignField: "_id",
            as: "event",
          },
        },
        {
          $unwind: "$event",
        },
        {
          $replaceRoot: {
            newRoot: {
              $mergeObjects: [
                "$event",
                {
                  joinedAt: "$joinedAt",
                },
              ],
            },
          },
        },
        {
          $sort: {
            joinedAt: -1,
          },
        },
      ])
      .toArray();

    res.send(joinedEvents);
  } catch (error) {
    console.error("Fetch joined events error:", error);

    res.status(500).send({
      message: "Failed to fetch joined events",
    });
  }
});

app.get(
  "/joined-events/user/:userId/check/:eventId",
  async (req, res) => {
    try {
      const { userId, eventId } = req.params;

      if (!ObjectId.isValid(eventId)) {
        return res.status(400).send({
          message: "Invalid event ID",
        });
      }

      const joinedEvent = await joinedEventsCollection.findOne({
        userId,
        eventId,
      });

      res.send({
        isJoined: Boolean(joinedEvent),
      });
    } catch (error) {
      console.error("Check joined event error:", error);

      res.status(500).send({
        message: "Failed to check joined event",
      });
    }
  },
);

app.delete(
  "/joined-events/:eventId/user/:userId",
  async (req, res) => {
    try {
      const { eventId, userId } = req.params;

      if (!ObjectId.isValid(eventId)) {
        return res.status(400).send({
          message: "Invalid event ID",
        });
      }

      const result = await joinedEventsCollection.deleteOne({
        userId,
        eventId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).send({
          message: "Joined event not found",
        });
      }

      res.send({
        message: "Event removed from joined events",
      });
    } catch (error) {
      console.error("Remove joined event error:", error);

      res.status(500).send({
        message: "Failed to remove joined event",
      });
    }
  },
);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
