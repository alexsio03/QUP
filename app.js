// Requiring the main packages
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');

// Setting up the app and mongoose
const app = express();

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
mongoose.connect("mongodb://localhost:27017/userinfoDB", {useNewUrlParser: true, useUnifiedTopology: true});

// Login
app.route("/") 

// Render the main page
.get(function(req, res) {
    res.render("login");
}
.post(function(req, res) {
  const username = req.body.uname;
  const password = req.body.pswd;
  console.log(username + " " + password);
  res.redirect("/public");
}));

// Creates a new user in the database if someone registers
const User = mongoose.model("User", userSchema);

app.post("/register", function(req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  const password = req.body.pswd;
  const confirm = req.body.pswdConfirm;

  if (password != confirm){
    /* reload the register page with an error in red text at the 
    top saying that the password and confirmation don't match */
    console.log("The passwords did not match.");
  }
/* check if the desired username is already taken; check if the 
email is already being used, maybe redirect to login screen; make sure 
the password conforms to certain rules; make sure the email has a "@" and a 
valid ending (.com, .net, etc.) 

if all of these rules are adhered to, create a new account using the given 
information; maybe someday we will allow for profile picture selection */

  const user = new User ({
    name: username,
    password: password,
    email: email
  });

  user.save();

  console.log(email + ", " + username + ", " + password + ", " + confirm);
});

app.post("/recover", function(req, res) {
  const email = req.body.email;

  console.log(email);
});

// Look for public lobbies
app.get("/public", function(req, res) {
  res.render("public");
});

app.post("/filter", function(req, res) {
  const game = req.body.filterGame;
  const full = req.body.full;

  res.redirect("/public");
});

// Creates a public queue
app.post("/create", function(req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  const avail = req.body.availability;
  const num = req.body.slots;

  console.log(game + ", " + desc + ", " + avail + ", " + num);
  res.redirect("/public");
});

// Creates a private queue
app.post("/privateCreate", function(req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  const avail = req.body.availability;
  const num = req.body.slots;

  console.log(game + ", " + desc + ", " + avail + ", " + num);
  res.redirect("/private");
});

// Renders private lobbies page
app.get("/private", function(req, res) {
  res.render("private");
});


// Renders profile page
app.get("/profile", function(req, res) {
  res.render("profile");
});

// Edit profile
app.post("/userEdit", function(req, res) {
  const newUsername = req.body.newUsername
  const confirm = req.body.confirmUsername;

  res.redirect("profile");
});

// Displays 3 favorite games on profile
app.post("/gameEdit", function(req, res) {
  const game1 = req.body.newGame1;
  const game2 = req.body.newGame2;
  const game3 = req.body.newGame3;

  res.redirect("profile");
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});

