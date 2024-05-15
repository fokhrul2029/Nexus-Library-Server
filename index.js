const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

// MiddleWare
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://nexus-library-ab88f.web.app",
      "https://nexus-library-ab88f.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

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

// MiddleWare
const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;
  // console.log("1", token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized!" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      // console.log("The Error is:", err);
      return res.status(401).send({ message: "Unauthorized!" });
    }
    // console.log("Value of the token: ", decoded);
    req.decoded = decoded;
    next();
  });
};


async function run() {
  try {
    // Auth API

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.DEPLOYED === "production" ? false : true,
      sameSite: process.env.DEPLOYED === "production" ? "none" : "strict",
    };

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "24h",
      });

      res
        .cookie("token", token, cookieOptions)
        .status(200)
        .send({ success: true });
    });

    //clearing Token
    app.post("/logout", async (req, res) => {
      const user = req.body;
      // console.log("logging out", user);
      res
        .clearCookie("token", { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    // await client.connect();

    const database = client.db("Nexus-Library");
    const allBooks = database.collection("all-books");
    const booksCategories = database.collection("books-categories");
    const writerList = database.collection("writer-list");

    const borrowedBooks = database.collection("borrowed-books");

    // Normal Api

    app.get("/", (req, res) => {
      res.send("Hello World!");
    });

    app.get("/all-books", async (req, res) => {
      const cursor = allBooks.find();
      const result = (await cursor.toArray()).reverse();
      res.send(result);
    });

    app.get("/all-books/:id" ,  async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allBooks.findOne(query);
      res.send(result);
    });

    app.get("/category-books", async (req, res) => {
      let query = {};
      if (req.query?.category) {
        query = { category: req.query?.category };
      }

      const cursor = allBooks.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/books-categories", async (req, res) => {
      const cursor = booksCategories.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/writers", async (req, res) => {
      const cursor = writerList.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/borrowed-books", async (req, res) => {
      if (req.query?.email !== req.decoded?.email) {
        return res.status(403).send({ message: "Forbidden Access!" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query?.email };
      }
      // console.log(query)
      const cursor = borrowedBooks.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.put("/update/:id", async (req, res) => {
      const id = req.params.id;
      const book = req.body.bookInfo;
      const options = { upsert: true };
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          name: book.name,
          category: book.category,
          img: book.img,
          description: book.description,
          quantity: book.quantity,
          rating: book.rating,
        },
      };
      const result = await allBooks.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    app.post("/add-book" ,  async (req, res) => {
      const book = req.body.bookInfo;
      const result = await allBooks.insertOne(book);
      res.send(result);
    });

    app.patch("/borrowed", async (req, res) => {
      try {
        const borrowInfo = req.body.borrowInfo;
        const bookId = borrowInfo.bookInfo._id;
        const userEmail = borrowInfo.email;
        const filter = { _id: new ObjectId(bookId) };

        // Check if the book is already borrowed by the user
        const existingBorrowedBook = await borrowedBooks.findOne({
          "bookInfo._id": bookId,
          email: userEmail,
        });

        if (existingBorrowedBook) {
          return res
            .status(400)
            .send({ error: "This book is already borrowed by the user" });
        }

        // Check if the book is in stock
        const bookInStock = await allBooks.findOne(filter);

        if (!bookInStock || bookInStock.quantity <= 0) {
          return res.status(400).send({ error: "This book is out of stock" });
        }

        // Proceed with borrowing the book
        const insertResult = await borrowedBooks.insertOne(borrowInfo);

        const updateDoc = {
          $inc: { quantity: -1 },
        };

        const updateResult = await allBooks.updateOne(filter, updateDoc);

        res.status(200).send({ insertResult, updateResult });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "An error occurred while processing the request" });
      }
    });

    app.patch("/return-books/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };

        // Find the borrowed book
        const borrowedBook = await borrowedBooks.findOne(filter);

        if (!borrowedBook) {
          return res.status(404).send({ error: "Borrowed book not found" });
        }

        const bookId = borrowedBook.bookInfo._id;
        const filterBook = { _id: new ObjectId(bookId) };

        // Increment the book quantity
        const updateDoc = {
          $inc: {
            quantity: 1,
          },
        };

        const updateResult = await allBooks.updateOne(filterBook, updateDoc);

        if (updateResult.modifiedCount === 0) {
          return res
            .status(500)
            .send({ error: "Failed to update book quantity" });
        }

        // Remove the borrowed book entry
        const deleteResult = await borrowedBooks.deleteOne(filter);

        if (deleteResult.deletedCount === 0) {
          return res
            .status(500)
            .send({ error: "Failed to remove borrowed book entry" });
        }

        // Send the results
        res.status(200).send({ updateResult, deleteResult });
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .send({ error: "An error occurred while processing the return" });
      }
    });

    // await client.db("admin").command({ ping: 1 });
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
