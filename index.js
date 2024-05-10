const express = require("express");
const app = express();
require("dotenv").config();

app.get("/", (req, res) => {
  res.send("Application is Running!");
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Application is Running!")
);
