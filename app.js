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

// Adds route for main page
app.route("/") 

// Render the main page
.get(function(req, res) {
    res.render("login");
}

.post(function(req, res) {
  const username = req.body.uname;
  const password = req.body.pswd;

  // Check if the user exists
  User.find({name: username, password: password}, function(err, user){
    if (err){
      console.log(err);
    } else {
      if (user.length() == 0){
        /* that user does not exist! 
        suggest them to make an account*/
      } else if (user.length() > 0){
        // successful log in
        console.log("Successfully logged in!");
      } else {
        // throw an error
        console.log("There was an error logging in. Please try again.");
      }
    }
  });

  // Logs the given username and password
  console.log(username + " " + password);
  // Redirects to the profile page
  res.redirect("/profile");
}));

// Adds the model for a user
const userSchema = new mongoose.Schema ({
  name: {
    type: String,
    minLength: 3,
    maxLength: 20,
    required: true
  },
  password: {
    type: String,
    minLength: 8,
    maxLength: 30,
    required: true
  },
  email: {
    type: String,
    required: true
  }
});

const User = mongoose.model("User", userSchema);

// Function to validate email
function validateEmail(mail) 
{
 if (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(mail)){
    return (true);
  } else {
    return (false);
  }
}

// Function to validate password
function validatePassword(inputtxt) { 
var passw =  /^[A-Za-z]\w{7,14}$/;

if(inputtxt.value.match(passw)) { 
  return true;
  } else { 
  return false;
  }
}

// Registers a user if the user doesn't already exist
app.post("/register", function(req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  const password = req.body.pswd;
  const confirm = req.body.pswdConfirm;

  // Checks if the given passwords were the same
  if (password != confirm){
    /* reload the register page with an error in red text at the 
    top saying that the password and confirmation don't match */

    console.log("The passwords did not match.");
  }

  // Check if the email is valid
  if (!(validateEmail(email))){
    /* return to register page, the
    email is invalid! */

    console.log("The given email was invalid!");
  }

  // Check if the password is valid
  if (!(validatePassword(password))){
    /* return to register page, the 
    password is invalid! */

    console.log("The given password was invalid!");
  }

  // Check if the username has been taken
  User.find({name: username}, function(err, user){
    if (err){
      console.log(err);
    } else {
      if (user.length()  > 0){
        /* show that username has already been taken */
        console.log("The username has already been taken.");
      } else if (user.length() == 0) {
        /* the username is available; continue 
        no console log necessary */
      } else {
        /* throw error */
        console.log("There was an error entering your username.");
      }
    }
  });

  // Check if the email has already been used
  User.find({email: email}, function(err, user){
    if (err){
      console.log(err);
    } else {
      if (user.length()  > 0){
        /* show that email has already been taken 
        maybe go to recovery page? */
        console.log("The email has already been used.");
      } else if (user.length() == 0) {
        /* the email is available; continue
        no console log necessary */
      } else {
        /* throw error */
        console.log("There was an error entering your email.");
      }
    }
  });

  // Create a new user object with the given properties
  const user = new User ({
    name: username,
    password: password,
    email: email
  });

  // Save the user to the DB
  user.save();

  // Log the info to the console
  console.log(email + ", " + username + ", " + password + ", " + confirm);
});

// Render email recovery page
app.post("/recover", function(req, res) {
  const email = req.body.email;

  console.log(email);
});

// Look for public lobbies
app.get("/public", function(req, res) {
  res.render("public");
});

// Filter public lobbies
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

// Loads the page
app.listen(3000, function() {
  console.log("Server started on port 3000");
});

