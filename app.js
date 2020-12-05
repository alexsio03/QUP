const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

app.get("/", function(req, res) {
    res.render("login");
});

app.get("/public", function(req, res) {
  res.render("public");
});

app.get("/private", function(req, res) {
  res.render("private");
});

app.get("/profile", function(req, res) {
  res.render("profile");
});

app.listen(3000, function() {
  console.log("Server started on port 3000 pog");
});

