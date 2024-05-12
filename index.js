const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();

// MiddleWare
app.use(express.json());
app.use(cors());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.zebesho.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const database = client.db("Nexus-Library");
    const allBooks = database.collection("all-books");
    const booksCategories = database.collection("books-categories");

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    app.get("/all-books", async (req, res) => {
      const cursor = allBooks.find();
      const result = (await cursor.toArray()).reverse();
      res.send(result);
    });

    app.get("/all-books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allBooks.findOne(query);
      res.send(result);
    });

    app.get("/books-categories", async (req, res) => {
      const cursor = booksCategories.find();
      const result = (await cursor.toArray()).reverse();
      res.send(result);
    });

    app.post("/add-book", async (req, res) => {
      const book = req.body.bookInfo;
      const result = await allBooks.insertOne(book);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(process.env.PORT || 5000, () =>
  console.log("Application is Running!")
);
