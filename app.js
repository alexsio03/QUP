// Requiring the main packages
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const passwordValidator = require('password-validator');
const emailValidator = require("email-validator");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const e = require("express");
const LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
      if (err) { return done(err); }
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    });
  }
));

// Setting up express and mongo
const app = express();
app.set('view engine', 'ejs');
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect("mongodb+srv://admin-alex:superSECUREpassWORD@qup.bqake.mongodb.net/QUP?retryWrites=true&w=majority", {useNewUrlParser: true, useUnifiedTopology: true});

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

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
    /* Maybe use _id 's instead?
    ! not implemented yet ! */
    type: String,
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

userSchema.plugin(passportLocalMongoose);

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
  availability: {
    type: Number,
    required: true,
    max: 12
  },
  slots: {
    type: Number,
    required: true,
    max: 12
    // determined by game maybe down the line?
  },
  visibility: {
    type: Boolean,
    /* true: public
    false: private */
    required: true
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
    res.render("login", { errorMessage: ""});
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
        res.redirect("/error/noUser");
      }
      else if (user[0].password != password)
      {
        res.redirect("/error/badPswd");
      } 
      else if (user.length > 0 && user[0].password == password){
        req.login(user, function(err) {
          if(err)
          {
            console.log(err);
          } else {
            passport.authenticate("local", { successRedirect: '/public', failureRedirect: '/error/badPswd' });
          }
        });
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

app.get("/error/:err", function(req, res) {
  const error = req.params.err;
  if(error == "noUser")
  {
    res.render("login", {errorMessage: "No user available. Please register."});
  }
  else if (error == "badPswd") {
    res.render("login", {errorMessage: "Invalid password."});
  }
  
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
  console.log(req.user);
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
  const visibility = true;

  if (avail >= num){
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  // Create a new queue object with the given properties
  const queue = new Queue ({
    game: game,
    description: desc,
    availability: avail,
    slots: num,
    visibility: visibility
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
  const avail = req.body.availability;
  const num = req.body.slots;
  const visibility = false;

  if (avail >= num){
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  // Create a new queue object with the given properties
  const queue = new Queue ({
    game: game,
    description: desc,
    availability: avail,
    slots: num,
    visibility: visibility
  });

  // Save the queue to the DB
  queue.save();

  console.log(game + ", " + desc + ", " + avail + ", " + num + "," + visibility);
  res.redirect("/private");
});

// Edit profile
app.post("/userEdit", function(req, res) {
  /* Need to have an enter old username so
  that the correct user's name can be changed */
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

