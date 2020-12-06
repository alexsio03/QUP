const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");

const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));

// Login
app.route("/") 

.get(function(req, res) {
    res.render("login");
})

.post(function(req, res) {
  const username = req.body.uname;
  const password = req.body.pswd;
  console.log(username + " " + password);
  res.redirect("/public");
});

app.post("/register", function(req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  const password = req.body.pswd;
  const confirm = req.body.pswdConfirm;

  console.log(email + ", " + username + ", " + password + ", " + confirm);
});

app.post("/recover", function(req, res) {
  const email = req.body.email;

  console.log(email);
});


// Public
app.get("/public", function(req, res) {
  res.render("public");
});

app.post("/filter", function(req, res) {
  const game = req.body.filterGame;
  const full = req.body.full;

  res.redirect("/public");
});


// Queue Creation
app.post("/create", function(req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  const avail = req.body.availability;
  const num = req.body.slots;

  console.log(game + ", " + desc + ", " + avail + ", " + num);
  res.redirect("/public");
});

app.post("/privateCreate", function(req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  const avail = req.body.availability;
  const num = req.body.slots;

  console.log(game + ", " + desc + ", " + avail + ", " + num);
  res.redirect("/private");
});


// Private
app.get("/private", function(req, res) {
  res.render("private");
});


// Profile
app.get("/profile", function(req, res) {
  res.render("profile");
});

app.post("/userEdit", function(req, res) {
  const newUser = req.body.newUser
  const confirm = req.body.confirmUser;

  res.redirect("profile");
});

app.post("/gameEdit", function(req, res) {
  const game1 = req.body.newGame1;
  const game2 = req.body.newGame2;
  const game3 = req.body.newGame3;

  res.redirect("profile");
});

app.listen(3000, function() {
  console.log("Server started on port 3000 pog");
});

