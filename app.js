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
// New encryption package
const bcrypt = require('bcrypt');
const {
  assert
} = require('console');
const saltRounds = 10;

// Setting up express and mongo
const app = express();
app.set('view engine', 'ejs');
app.use(session({
  secret: process.env.SESSION_SECRET,
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
  useUnifiedTopology: true,
  useFindAndModify: false
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
    required: true
  },
  email: {
    type: String,
    required: true
  },
  friends: {
    type: [mongoose.ObjectId],
    required: false
  },
  requestedFriends: {
    type: [mongoose.ObjectId],
    required: false
  },
  favoriteGames: {
    type: Array,
    of: String,
    required: true
  }
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
    maxLength: 100
  },
  visibility: {
    type: Boolean,
    // true: public
    // false: private
    required: true
  },
  lobby: {
    type: Array,
    of: mongoose.ObjectId,
    required: true
  },
  waiting: {
    type: Array,
    of: mongoose.ObjectId,
    required: false
  },
  full: {
    type: Boolean,
    required: false
  },
  creator: {
    type: mongoose.ObjectId,
    required: true
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
  .has().digits(1) // Must have at least 1 digit
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
    if (req.isAuthenticated()) {
      res.redirect("/public");
    } else {
      res.render("login", {
        errorMessage: ""
      });
    }
  })
  .post(function (req, res) {
    const username = req.body.uname;

    // Check if the user exists
    User.find({
      name: username
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length == 0) {
          res.redirect("/error/noUser");
        } else if (user.length > 0 && bcrypt.compareSync(req.body.pswd, user[0].password)) {
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
  });

// This page gets loaded when there is an error
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

// Allows the user to log out
app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
})

// Renders public lobbies page
app.get("/public", function (req, res) {
  if (req.isAuthenticated()) {

    User.findOne({
      name: req._passport.session.user[0].name
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else if (user.requestedFriends.length == 0 && user.friends.length == 0) {
        getQueues();
        res.render("public", {
          hasRequests: false,
          hasFriends: false
        });
      } else if (user.requestedFriends.length == 0 && user.friends.length > 0) {
        let firstFriendArr = [];
        user.friends.forEach(function (friendsId) {
          User.findById(friendsId, function (err, friend) {
            if (err) {
              console.log(err);
            } else {
              firstFriendArr.push(friend.name);
              if (firstFriendArr.length == user.friends.length) {
                Queue.find({visibility: true}, function(err, qs) {
                  if(err) {
                    console.log(err);
                  } else {
                    var newQs = [];
                    qs.forEach(function(queue) {
                      User.findById(queue.lobby[0], function(err, lobbyist) {
                        if(err) {
                          console.log(err);
                        } else {
                          var newLobby = queue.lobby;
                          newLobby[0] = lobbyist.name;
                          var newQueue = {
                            id: queue._id,
                            game: queue.game,
                            desc: queue.description,
                            lobby: newLobby,
                            waiting: queue.waiting,
                            isCreator: lobbyist._id == req._passport.session.user[0]._id
                          };
                          newQs.push(newQueue);
                        }
                        if(newQs.length == qs.length) {
                            res.render("public", {
                              hasRequests: false,
                              hasFriends: true,
                              friends: firstFriendArr,
                              queues: newQs,
                            });
                        }
                      })
                    })
                  }
                });
              }
            }
          });
        });
      } else {
        let requested = [];
        user.requestedFriends.forEach(function (foundId) {
          User.findById(foundId, function (err, found) {
            if (err) {
              console.log(err);
            } else {
              requested.push(found.name);
              if (requested.length == user.requestedFriends.length) {
                User.findOne({
                  name: req._passport.session.user[0].name
                }, function (err, main) {
                  if (err) {
                    console.log(err);
                  } else if (main.friends.length == 0) {
                    getQueues();
                    res.render("public", {
                      hasRequests: true,
                      hasFriends: false,
                      requestedFriends: requested
                    });
                  } else {
                    let friendArr = [];
                    main.friends.forEach(function (friendId) {
                      User.findById(friendId, function (err, friend) {
                        if (err) {
                          console.log(err);
                        } else {
                          friendArr.push(friend.name);
                          if (friendArr.length == main.friends.length) {
                            getQueues();
                            res.render("public", {
                              hasRequests: true,
                              hasFriends: false,
                              requestedFriends: requested,
                              friends: friendArr
                            });
                          }
                        }
                      })
                    })
                  }
                });
              }
            }
          })
        })
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Renders private lobbies page
app.get("/private", function (req, res) {
  if (req.isAuthenticated()) {
    console.log("redirected");
    User.findOne({
      name: req._passport.session.user[0].name
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else if (user.requestedFriends.length == 0 && user.friends.length == 0) {
        res.render("private", {
          hasRequests: false,
          hasFriends: false
        });
      } else if (user.requestedFriends.length == 0 && user.friends.length > 0) {
        let firstFriendArr = [];
        user.friends.forEach(function (friendsId) {
          User.findById(friendsId, function (err, friend) {
            if (err) {
              console.log(err);
            } else {
              firstFriendArr.push(friend.name);
              if (firstFriendArr.length == user.friends.length) {
                res.render("private", {
                  hasRequests: false,
                  hasFriends: true,
                  friends: firstFriendArr
                });
              }
            }
          });
        });
      } else {
        let requested = [];
        user.requestedFriends.forEach(function (foundId) {
          User.findById(foundId, function (err, found) {
            if (err) {
              console.log(err);
            } else {
              requested.push(found.name);
              if (requested.length == user.requestedFriends.length) {
                User.findOne({
                  name: req._passport.session.user[0].name
                }, function (err, main) {
                  if (err) {
                    console.log(err);
                  } else if (main.friends.length == 0) {
                    res.render("private", {
                      hasRequests: true,
                      hasFriends: false,
                      requestedFriends: requested
                    });
                  } else {
                    let friendArr = [];
                    main.friends.forEach(function (friendId) {
                      User.findById(friendId, function (err, friend) {
                        if (err) {
                          console.log(err);
                        } else {
                          friendArr.push(friend.name);
                          if (friendArr.length == main.friends.length) {
                            res.render("private", {
                              hasRequests: true,
                              hasFriends: false,
                              requestedFriends: requested,
                              friends: friendArr
                            });
                          }
                        }
                      })
                    })
                  }
                });
              }
            }
          })
        })
      }
    });
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

// Shows the profile page of a specific user
app.get("/profile/:name", function (req, res) {
  if (req.isAuthenticated()) {
    const user = req.params.name;

    User.findOne({
      name: user
    }, function (err, found) {
      if (err) {
        console.log(err);
      } else if (user == req._passport.session.user[0].name) {
        res.render("profile", {
          username: user,
          email: found.email,
          games: found.favoriteGames,
          userError: "",
          gameError: "",
          isUser: true
        });
      } else {
        res.render("profile", {
          username: user,
          email: found.email,
          games: found.favoriteGames,
          userError: "",
          gameError: "",
          isUser: false
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Registers a user if the user doesn't already exist
app.post("/register", function (req, res) {
  const email = req.body.email;
  const username = req.body.uname;
  var password = req.body.pswd;
  var confirm = req.body.pswdConfirm;
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
    bcrypt.hash(password, saltRounds, function (err, hash) {
      password = hash;
    });
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
});

// Allows the user to add a friend
app.post("/addFriend", function (req, res) {
  if (req.isAuthenticated()) {
    const mainUser = req._passport.session.user[0].name;
    const newFriend = req.body.friendName;

    function addFriend() {
      User.findOne({
        name: newFriend
      }, function (err, user) {
        if (err) {
          console.log(err);
        } else {
          User.findOne({
            name: mainUser
          }, function (err, requester) {
            if (err) {
              console.log(err);
            } else if (newFriend == mainUser) {
              res.redirect("/public");
            } else {
              User.findOneAndUpdate({
                name: user.name
              }, {
                $addToSet: {
                  requestedFriends: requester._id
                }
              }, {
                new: true
              }, function (err) {
                if (err) {
                  console.log(err);
                } else {
                  res.redirect("/public");
                }
              });
            }
          });
        }
      })
    }

    User.findOne({
      name: newFriend
    }, function (err, friend) {
      if (err) {
        console.log(err);
      } else if (friend == null) {
        res.redirect("/public");
      } else {
        User.findOne({
          name: mainUser
        }, function (err, userRequesting) {
          if (err) {
            console.log(err);
          } else {
            var hasUser = false;
            for (var i = 0; i < friend.friends.length; i++) {
              if (userRequesting._id.str === friend.friends[i].str) {
                hasUser = true;
              }
            }
            if (hasUser) {
              res.redirect("/public");
            } else {
              addFriend();
            }
          }
        });
      }
    });
  } else {
    res.redirect("/error/login")
  }
});

// Lets the user accept a friend request
app.post("/acceptFriendRequest", function (req, res) {
  if (req.isAuthenticated()) {
    var requester = req._passport.session.user[0].name;
    var newFriend = req.body.accept;
    User.findOne({
      name: requester
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        User.findOne({
          name: newFriend
        }, function (err, friend) {
          if (err) {
            console.log(err);
          } else {
            User.findOneAndUpdate({
              name: user.name
            }, {
              $addToSet: {
                friends: friend._id
              }
            }, {
              new: true
            }, function (err, oldUser) {
              if (err) {
                console.log(err);
              } else {
                User.findOneAndUpdate({
                  name: oldUser.name
                }, {
                  $pull: {
                    requestedFriends: friend._id
                  }
                }, {
                  new: true
                }, function (err) {
                  if (err) {
                    console.log(err);
                  } else {
                    res.redirect("/public");
                  }
                });
              }
            });
            User.findOneAndUpdate({
              name: friend.name
            }, {
              $addToSet: {
                friends: user._id
              }
            }, {
              new: true
            }, function (err) {
              if (err) {
                console.log(err);
              }
            });
          }
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Lets the user reject a friend request
app.post("/rejectFriendRequest", function (req, res) {
  if (req.isAuthenticated()) {
    var requester = req._passport.session.user[0].name;
    var newFriend = req.body.reject;
    User.findOne({
      name: requester
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        User.findOne({
          name: newFriend
        }, function (err, friend) {
          if (err) {
            console.log(err);
          } else {
            User.findOneAndUpdate({
              name: user.name
            }, {
              $pull: {
                requestedFriends: friend._id
              }
            }, {
              new: true
            }, function (err) {
              if (err) {
                console.log(err);
              } else {
                res.redirect("/public");
              }
            });
          }
        });
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Renders email recovery page
app.post("/recover", function (req, res) {
  const email = req.body.email;

  console.log(email);
});

// Filters public lobbies
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

// Creates a public or private queue based on user selection
app.post("/create", function (req, res) {
  const avai = req.body.availability;
  if (avai == "open") {
    res.redirect("/publicCreate");
  } else if (avai == "friends") {
    res.redirect("/privateCreate");
  }
});

// Creates a public queue
app.post("/publicCreate", function (req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  const num = req.body.slots;
  const visibility = true;
  /* Alex will have to pass an array through
  from the html site to this js l0l  */
  //const reserved = req.body.reserved;
  var lobby = [req._passport.session.user[0]._id];
  var isFull = true;

  // if (reserved.length >= num) {
  //   // throw error
  //   console.log("You cannot have more available slots than slots total.");
  // }

  for (var i = lobby.length; i <= num; i++) {
    /* In the html, show that if userSchema == null,
    then show the spot as empty/available */
    lobby.push(null);
  }

  for (var i = 0; i < lobby.length; i++) {
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
    full: isFull,
    creator: req._passport.session.user[0]._id
  });

  // Save the queue to the DB
  queue.save();
  console.log("saved queue");

  res.redirect("/public");
});

// Creates a private queue
app.post("/privateCreate", function (req, res) {
  const game = req.body.game;
  const desc = req.body.desc;
  const num = req.body.slots;
  const visibility = false;
  /* Alex will have to pass an array through
  from the html site to this js l0l  */
  //const reserved = req.body.reserved;
  var lobby = [];
  var isFull = true;

  // if (reserved.length() >= num) {
  //   // throw error
  //   console.log("You cannot have more available slots than slots total.")
  // }

  for (var i = 0; i < reserved; i++) {
    lobby.push(reserved[i]);
  }
  for (var i = reserved.length(); i < num; i++) {
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

// Allows the user to join a queue
app.post("/joinQueue", function(req, res){
  // This might be bugged out the wazoo

  /* In the html find a way to know which queue
  the user wants to join. Im just going to call
  it "theQueue" */
  // var currentQueue = theQueue;
  // const avai = currentQueue.visibility;

  /*
  Queue.findOne({theQueue}, function(err, lobby){    // Remember to use findById of you're going to use ID
    if(err){
      console.log(err);
    } else {
      for (var i = 0; i<lobby.length; i++){
        if (lobby[i] == null){
          lobby[i] = req._passport.session.user[0];
          break;
        }
      }
    }
  });
  */

  /*
  if (avai == true) {
    res.redirect("/public");
  } else if (avai == false) {
    res.redirect("/private");
  }
  */
});

app.post("/leaveQueue", function(req, res){
  /* In the html find a way to know which queue
  the user wants to join. Im just going to call
  it "theQueue" */

  /*
  Queue.findOne({theQueue}, function(err, lobby){    // Remember to use findById of you're going to use ID
    if(err){
      console.log(err);
    } else {
      for (var i = 0; i<lobby.length; i++){
        if (lobby[i] == req._passport.session.user[0]){
          lobby[i] = null;
          break;
        }
      }
    }
  });

  // Delete the queue if it is empty
  var numNulls = 0;
  for (var i = 0; i<lobby.length; i++){
    if (lobby[i] == null){
      numNulls++;
    }
  }
  if(numNulls == lobby.length){
    //DELETE THE QUEUE
  }
  */

  /*
  if (avai == true) {
    res.redirect("/public");
  } else if (avai == false) {
    res.redirect("/private");
  }
  */
});

// Deletes a queue
app.post("/deleteQueue", function(req, res) {
  if(req.isAuthenticated()) {
    const id = req.body.id;
    Queue.findByIdAndRemove(id, function(err) {
      if(err) {
        console.log(err);
      } else {
        res.redirect("/public");
      }
    });
  } else {
    res.redirect("/error/login");
  }
});

// Edit username
app.post("/userEdit", function (req, res) {
  /* Enter old username */
  const oldUsername = req.body.oldUsername;
  const newUsername = req.body.newUsername
  const confirm = req.body.confirmUsername;

  if (newUsername != confirm) {
    res.render("profile", {
      username: req._passport.session.user[0].name,
      email: req._passport.session.user[0].email,
      games: req._passport.session.user[0].favoriteGames,
      userError: "Usernames didn't match",
      gameError: "",
      isUser: true
    });
  } else if (oldUsername != req._passport.session.user[0].name) {
    res.render("profile", {
      username: req._passport.session.user[0].name,
      email: req._passport.session.user[0].email,
      games: req._passport.session.user[0].favoriteGames,
      userError: "Usernames didn't match",
      gameError: "",
      isUser: true
    });
  } else {
    User.find({
      name: newUsername
    }, function (err, user) {
      if (err) {
        console.log(err);
      } else {
        if (user.length > 0) {
          res.render("profile", {
            username: req._passport.session.user[0].name,
            email: req._passport.session.user[0].email,
            games: req._passport.session.user[0].favoriteGames,
            userError: "Username is already taken",
            gameError: "",
            isUser: true
          });
        } else {
          User.findOneAndUpdate({
            name: oldUsername
          }, {
            name: newUsername
          }, {
            new: true
          }, function () {
            req._passport.session.user[0].name = newUsername;
            res.redirect("profile/" + newUsername);
          });
        }
      }
    });
  }
});

// Edit 3 favorite games on profile
app.post("/gameEdit", function (req, res) {
  /* Enter current username */
  const user = req._passport.session.user[0].name;
  const game1 = req.body.newGame1;
  const game2 = req.body.newGame2;
  const game3 = req.body.newGame3;
  const gameArr = [game1, game2, game3];

  // Updates the user's three favorite games
  User.findOneAndUpdate({
    name: user
  }, {
    favoriteGames: gameArr
  }, {
    new: true
  }, function () {
    req._passport.session.user[0].favoriteGames = gameArr;
    res.redirect("profile/" + user);
  });
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port, function() {
  console.log("Server started on port " + port);
});
