// Requiring the main packages
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const passwordValidator = require('password-validator');
const emailValidator = require("email-validator");

// Setting up express and mongo
const app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
mongoose.connect("mongodb://localhost:27017/qupDB", {useNewUrlParser: true, useUnifiedTopology: true});

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
  },
  friendNames: {
    // not implemented yet
    type: Array,
    of: userSchema,
    required: false
  },
  favoriteGames: {
    type: Array,
    of: String,
    requried: true
  }/*,
  picture: {

  }*/
});
const User = mongoose.model("User", userSchema);

// Adds the model for a queue
const queueSchema = new mongoose.Schema ({
  game: {
    type: String,
    required: true
    /* allow the user to choose from 
    the list of games */
  },
  description: {
    type: String,
    required: false,
    maxLength: 50
    /* maybe in the text box in the description
    field have a message in faded text saying 
    "description not necessary" or something */
  },
  visibility: {
    type: Boolean,
    /* true: public
    false: private */
    required: true
  },
  lobby: {
    type: Array,
    of: userSchema,
    required: true
  },
  full: {
    type: Boolean,
    required: false
  }
});
const Queue = mongoose.model("Queue", queueSchema);

// Password validator scheme
var pswdSchema = new passwordValidator();
pswdSchema
.is().min(8)                    // Minimum length 8
.is().max(30)                   // Maximum length 30
.has().uppercase()              // Must have uppercase letters
.has().lowercase()              // Must have lowercase letters
.has().digits(2)                // Must have at least 2 digits
.has().not().spaces();          // Spaces not allowed

// Adds route for main page and renders it
app.route("/") 
.get(function(req, res) {
    res.render("login");
})
.post(function(req, res) {
  const username = req.body.uname;
  const password = req.body.pswd;

  // Check if the user exists
  User.find({name: username}, function(err, user){
    if (err){
      console.log(err);
    } else {
      if (user.length == 0){
        /* that user does not exist! 
        suggest them to make an account*/
        console.log("Please make an account");
      }
      else if (user[0].password != password)
      {
        res.redirect("/");
        console.log("Passwords don't match!");
      } 
      else if (user.length > 0){
        // successful log in
        res.redirect("/public");
        console.log("Successfully logged in!");
      }
      else {
        // throw an error
        console.log("There was an error logging in. Please try again.");
      }
    }
  });

  // Logs the given username and password
  console.log(username + " " + password);
  // Redirects to the profile page
});

// Look for public lobbies
app.get("/public", function(req, res) {
  res.render("public");
});

// Renders private lobbies page
app.get("/private", function(req, res) {
  res.render("private");
});

// Renders profile page
app.get("/profile", function(req, res) {
  res.render("profile");
});

// Registers a user if the user doesn't already exist
app.post("/register", function(req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  const password = req.body.pswd;
  const confirm = req.body.pswdConfirm;
  var games = ["No game selected", "No game selected", "No game selected"];

  // Checks if the given passwords were the same
  if (password != confirm){
    /* reload the register page with an error in red text at the 
    top saying that the password and confirmation don't match */

    console.log("The passwords did not match.");
  }

  // Check if the email is valid
  if (!(emailValidator.validate(email))){
    /* return to register page, the
    email is invalid! */

    console.log("The given email was invalid!");
  }

  // Check if the password is valid
  if (!(pswdSchema.validate(password))){
    /* return to register page, the 
    password is invalid! */

    console.log("The given password was invalid! : " + pswdSchema.validate(password, { list: true }));
  }

  // Check if the username has been taken
  User.find({name: username}, function(err, user){
    if (err){
      console.log(err);
    } else {
      if (user.length  > 0){
        /* show that username has already been taken */
        console.log("The username has already been taken.");
      } else if (user.length == 0) {
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
      if (user.length  > 0){
        /* show that email has already been taken 
        maybe go to recovery page? */
        console.log("The email has already been used.");
      } else if (user.length == 0) {
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
    email: email,
    favoriteGames: games
  });

  // Save the user to the DB
  user.save();

  res.redirect("/public");

  // Log the info to the console
  console.log(email + ", " + username + ", " + password + ", " + confirm);
});

// Render email recovery page
app.post("/recover", function(req, res) {
  const email = req.body.email;

  console.log(email);
});

// Filter public lobbies -JS done-
app.post("/filter", function(req, res) {
  const game = req.body.filterGame;
  const full = req.body.full;

  Queue.find({game: game, full: full}, function(err, queue){
    if (err){
      console.log(err);
    } else {
      /* only prints the filtered queues to the 
      console for now, later Alex will have to 
      put it into the page */
      console.log(queue);
    }
  });

    res.redirect("/public");
  });

// Creates a public queue
app.post("/create", function(req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  //REMOVE req.body.availibility FROM THE CODE!!!!!
  const num = req.body.slots;
  const visibility = true;
  /* Alex will have to pass an array through
  from the html site to this js l0l  */
  //const reserved = req.body.reserved;
  var lobby = [];
  var isFull = true;

  if (reserved.length() >= num){
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  for (var i = 0; i<reserved; i++){
    lobby.push(reserved[i]);
  }
  for (var i = reserved.length(); i < num; i++){
    /* In the html, show that if userSchema == null,
    then show the spot as empty/available */
    lobby.push(null);
  }

  for (var i = 0; i<lobby.length(); i++){
    if (lobby[i] == null){
      isFull = false;
    }
  }

  // Create a new queue object with the given properties
  const queue = new Queue ({
    game: game,
    description: desc,
    visibility: visibility,
    lobby: lobby,
    full: isFull
  });

  // Save the queue to the DB
  queue.save();

  console.log(game + ", " + desc + ", " + avail + ", " + num + "," + visibility);
  res.redirect("/public");
});

// Creates a private queue
app.post("/privateCreate", function(req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  //REMOVE req.body.availibility FROM THE CODE!!!!!
  const num = req.body.slots;
  const visibility = false;
  /* Alex will have to pass an array through
  from the html site to this js l0l  */
  //const reserved = req.body.reserved;
  var lobby = [];
  var isFull = true;

  if (reserved.length() >= num){
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  for (var i = 0; i<reserved; i++){
    lobby.push(reserved[i]);
  }
  for (var i = reserved.length(); i < num; i++){
    /* In the html, show that if userSchema == null,
    then show the spot as empty/available */
    lobby.push(null);
  }

  for (var i = 0; i<lobby.length(); i++){
    if (lobby[i] == null){
      isFull = false;
    }
  }

  // Create a new queue object with the given properties
  const queue = new Queue ({
    game: game,
    description: desc,
    visibility: visibility,
    lobby: lobby,
    full: isFull
  });

  // Save the queue to the DB
  queue.save();

  console.log(game + ", " + desc + ", " + avail + ", " + num + "," + visibility);
  res.redirect("/private");
});

// Edit username -JS done-
app.post("/userEdit", function(req, res) {
  /* Enter old username
  const oldUsername = req.body.oldUsername; */
  const newUsername = req.body.newUsername
  const confirm = req.body.confirmUsername;

  if (newUsername != confirm){
    /* throw error and give "The usernames you entered did not match." 
    at the top of the page */
    console.log("The usernames you entered did not match.");
  }

  //User.updateOne({name: oldUsername}, {name: newUsername});

  res.redirect("profile");
});

// Edit 3 favorite games on profile -JS done-
app.post("/gameEdit", function(req, res) {
  /* Enter current username 
  const user = req.body.uname; */
  const game1 = req.body.newGame1;
  const game2 = req.body.newGame2;
  const game3 = req.body.newGame3;

  // Updates the user's three favorite games
  /* User.updateOne({name: user}, {favoriteGames: [game1, game2, game3]}); */

  res.redirect("profile");
});

// Loads the page
app.listen(3000, function() {
  console.log("Server started on port 3000");
});

