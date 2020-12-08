// Requiring the main packages
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require('mongoose');
const passwordValidator = require('password-validator');
const emailValidator = require("email-validator");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const {
  json
} = require('body-parser');

// Setting up express and mongo
const app = express();
app.set('view engine', 'ejs');
app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.static("public"));
app.use(passport.initialize());
app.use(passport.session());
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);

// Adds the model for a user
const userSchema = new mongoose.Schema({
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
  friends: [String],
  favoriteGames: {
    type: Array,
    of: String,
    required: true
  }
  /*,
    picture: {

    }*/
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

// Adds the model for a queue
const queueSchema = new mongoose.Schema({
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
    of: String,
    required: true
  },
  full: {
    type: Boolean,
    required: false
  }
});

const Queue = new mongoose.model("Queue", queueSchema);

// Password validator scheme
var pswdSchema = new passwordValidator();
pswdSchema
  .is().min(8) // Minimum length 8
  .is().max(30) // Maximum length 30
  .has().uppercase() // Must have uppercase letters
  .has().lowercase() // Must have lowercase letters
  .has().digits(1) // Must have at least 2 digits
  .has().not().spaces(); // Spaces not allowed

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

// Adds route for main page and renders it
app.route("/")
  .get(function (req, res) {
    res.render("login", {
      errorMessage: ""
    });
  })

  .post(function (req, res) {
    const username = req.body.uname;
    const password = req.body.pswd;

    // Check if the user exists
    User.find({
      name: username
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length == 0) {
          res.redirect("/error/noUser");
        } else if (user.length > 0 && user[0].password == password) {
          req.login(user, function (err) {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/public");
            }
          });
          console.log("Successfully logged in!");
        } else {
          // throw an error
          res.redirect('/error/badPswd');
          console.log("There was an error logging in. Please try again.");
        }
      }
    });
    // Logs the given username and password
    console.log(username + " " + password);
    // Redirects to the profile page
  });



app.get("/error/:err", function (req, res) {
  const error = req.params.err;
  if (error == "noUser") {
    res.render("login", {
      errorMessage: "No user available. Please register."
    });
  } else if (error == "badPswd") {
    res.render("login", {
      errorMessage: "Invalid password."
    });
  } else if (error == "userTaken") {
    res.render("login", {
      errorMessage: "That username was already taken."
    });
  } else if (error == "emailTaken") {
    res.render("login", {
      errorMessage: "That email was already taken."
    });
  } else if (error == "badRegister") {
    res.render("login", {
      errorMessage: "Server side error. Please report this issue."
    });
  } else if (error == "noMatch") {
    res.render("login", {
      errorMessage: "Passwords did not match."
    });
  } else if (error == "invalidEmail") {
    res.render("login", {
      errorMessage: "Email was invalid. Please use proper format."
    });
  } else if (error == "invalidPassword") {
    res.render("login", {
      errorMessage: "Password was invalid. Please use user proper format."
    });
  } else if (error == "login") {
    res.render("login", {
      errorMessage: "Please login before entering"
    });
  }

});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
})

// Look for public lobbies
app.get("/public", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("public");
  } else {
    res.redirect("/error/login");
  }
});

// Renders private lobbies page
app.get("/private", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("private");
  } else {
    res.redirect("/error/login");
  }
});

// Renders profile page
app.get("/profile", function (req, res) {
  if (req.isAuthenticated()) {
    res.redirect("/profile/" + req._passport.session.user[0].name);
  } else {
    res.redirect("/error/login");
  }
});

app.get("/profile/:name", function (req, res) {
  const user = req.params.name;

  User.findOne({
    name: user
  }, function (err, found) {
    if (err) {
      console.log(err);
    } else {
      res.render("profile", {
        username: user,
        email: found.email,
        games: found.favoriteGames
      });
    }
  })
});

// Registers a user if the user doesn't already exist
app.post("/register", function (req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  const password = req.body.pswd;
  const confirm = req.body.pswdConfirm;
  var games = ["No game selected", "No game selected", "No game selected"];


  // Checks if the given passwords were the same
  if (password != confirm) {
    /* reload the register page with an error in red text at the 
    top saying that the password and confirmation don't match */
    res.redirect("/error/noMatch");
    console.log("The passwords did not match.");
  }

  // Check if the email is valid
  else if (!(emailValidator.validate(email))) {
    /* return to register page, the
    email is invalid! */
    res.redirect("/error/invalidEmail");
    console.log("The given email was invalid!");
  }

  // Check if the password is valid
  else if (!(pswdSchema.validate(password))) {
    /* return to register page, the 
    password is invalid! */
    res.redirect("/error/invalidPassword");
    console.log("The given password was invalid! : " + pswdSchema.validate(password, {
      list: true
    }));
  } else {
    // Check if the username has been taken
    User.find({
      name: username
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length > 0) {
          res.redirect("/error/userTaken");
        } else if (user.length == 0) {
          User.find({
            email: email
          }, function (err, user) {
            if (err) {
              console.log(err);
            } else {
              if (user.length > 0) {
                /* show that email has already been taken 
                maybe go to recovery page? */
                res.redirect("/error/emailTaken");
              } else if (user.length == 0) {
                const user = new User({
                  name: username,
                  password: password,
                  email: email,
                  favoriteGames: games
                });

                user.save();

                setTimeout(function () {
                  User.find({
                    name: username
                  }, function (err, user) {
                    if (err) {
                      console.log(err);
                    } else {
                      if (user.length == 0) {
                        res.redirect("/error/noUser");
                      } else if (user[0].password != password) {
                        res.redirect("/error/badPswd");
                      } else if (user.length > 0 && user[0].password == password) {
                        req.login(user, function (err) {
                          if (err) {
                            console.log(err);
                          } else {
                            res.redirect("/public");
                          }
                        });
                        console.log("Successfully logged in!");
                      } else {
                        // throw an error
                        console.log("There was an error logging in. Please try again.");
                      }
                    }
                  });
                }, 3000);
              } else {
                /* throw error */
                console.log("There was an error entering your email.");
              }
            }
          });
        } else {
          /* throw error */
          console.log("There was an error entering your username.");
        }
      }
    });
  }
  // Log the info to the console
  console.log(email + ", " + username + ", " + password + ", " + confirm);
});

// Render email recovery page
app.post("/recover", function (req, res) {
  const email = req.body.email;

  console.log(email);
});

// Filter public lobbies -JS done-
app.post("/filter", function (req, res) {
  const game = req.body.filterGame;
  const full = req.body.full;

  Queue.find({
    game: game,
    full: full
  }, function (err, queue) {
    if (err) {
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
app.post("/create", function (req, res) {
  const avai = req.body.availability;
  if (avai == "open") {
    res.redirect("/publicCreate");
  } else if (avai == "friends") {
    res.redirect("/privateCreate");
  }
});

app.post("/publicCreate", function (req, res) {
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

  if (reserved.length() >= num) {
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  for (var i = 0; i < reserved; i++) {
    lobby.push(reserved[i]);
  }
  for (var i = reserved.length(); i < num; i++) {
    /* In the html, show that if userSchema == null,
    then show the spot as empty/available */
    lobby.push(null);
  }

  for (var i = 0; i < lobby.length(); i++) {
    if (lobby[i] == null) {
      isFull = false;
    }
  }

  // Create a new queue object with the given properties
  const queue = new Queue({
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
app.post("/privateCreate", function (req, res) {
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

  if (reserved.length() >= num) {
    // throw error
    console.log("You cannot have more available slots than slots total.")
  }

  for (var i = 0; i < reserved; i++) {
    lobby.push(reserved[i]);
  }
  for (var i = reserved.length(); i < num; i++) {
    /* In the html, show that if userSchema == null,
    then show the spot as empty/available */
    lobby.push(null);
  }

  for (var i = 0; i < lobby.length(); i++) {
    if (lobby[i] == null) {
      isFull = false;
    }
  }

  // Create a new queue object with the given properties
  const queue = new Queue({
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
app.post("/userEdit", function (req, res) {
  /* Enter old username
  const oldUsername = req.body.oldUsername; */
  const newUsername = req.body.newUsername
  const confirm = req.body.confirmUsername;

  if (newUsername != confirm) {
    /* throw error and give "The usernames you entered did not match." 
    at the top of the page */
    console.log("The usernames you entered did not match.");
  }

  //User.updateOne({name: oldUsername}, {name: newUsername});

  res.redirect("profile");
});

// Edit 3 favorite games on profile -JS done-
app.post("/gameEdit", function (req, res) {
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
app.listen(3000, function () {
  console.log("Server started on port 3000");
});