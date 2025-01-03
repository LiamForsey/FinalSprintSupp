const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const User = require('./models/User'); 

const PORT = 3000;
const MONGO_URI = 'mongodb+srv://Liam:Diesel13@cluster0.ic4nl.mongodb.net/';

const app = express();
expressWs(app);  

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'voting-app-secret',
    resave: false,
    saveUninitialized: false,
}));

let connectedClients = [];

// WebSocket for voting updates
app.ws('/ws', (socket, request) => {
    connectedClients.push(socket);

    socket.on('message', async (message) => {
        const { type, pollId, selectedOption } = JSON.parse(message);

        if (type === 'vote') {
            const poll = await Poll.findById(pollId);
            const option = poll.options.find(opt => opt.answer === selectedOption);
            option.votes += 1;
            await poll.save();

            
            connectedClients.forEach(client => {
                client.send(JSON.stringify({ type: 'voteUpdate', poll }));
            });
        }
    });

    socket.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== socket);
    });
});

// Home Page - Landing Page for unauthenticated users
app.get('/', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }
    response.render('index/unauthenticatedIndex'); 
});

// Route for logging in users
app.get('/login', (req, res) => {
    if (req.session.user?.id) {
        return res.redirect('index/authenticatedIndex');
    }
    return res.render('login', { errorMessage: null });
});

// Handle login POST
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const foundUser = await User.findOne({ username });

        if (!foundUser) {
            return res.status(404).send('User not found');
        }

        const match = await bcrypt.compare(password, foundUser.password);
        if (match) {
            req.session.user = { id: foundUser.id, username: foundUser.username };
            return res.redirect('index/authenticatedIndex');  
        }

        return res.status(401).send('Invalid password');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
});

// Route for user signup
app.get('/signup', async (req, res) => {
    if (req.session.user?.id) {
        return res.redirect('index/authenticatedIndex');  // Redirect authenticated users
    }
    return res.render('signup', { errorMessage: null });
});

// Handle signup POST
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    await newUser.save();

    req.session.user = { id: newUser.id, username: newUser.username };  // Set session

    return res.redirect('index/authenticatedIndex');  // Redirect after signup
});

// Dashboard route (only accessible to logged-in users)
app.get('/dashboard', async (req, res) => {
    if (!req.session.user?.id) {
        return res.redirect('/login');  // Ensure user is logged in
    }

    const polls = await Poll.find(); // Assuming Poll is a valid model
    return res.render('index/authenticatedIndex', { polls: polls.length ? polls : [] });
});

// Profile route
app.get('/profile', async (req, res) => {
    if (!req.session.user?.id) {
        return res.redirect('/login');
    }

    const user = await User.findById(req.session.user.id).populate('pollsVoted');
    return res.render('profile', { user, pollsVoted: user.pollsVoted.length });
});

// Create a new poll
app.get('/createPoll', (req, res) => {
    if (!req.session.user?.id) {
        return res.redirect('/login');  // Redirect to login if not authenticated
    }
    return res.render('createPoll');
});

// Poll creation - save poll to database
app.post('/createPoll', async (req, res) => {
    const { question, options } = req.body;
    const formattedOptions = Object.values(options).map(option => ({ answer: option, votes: 0 }));

    try {
        const poll = new Poll({
            question,
            options: formattedOptions,
            createdBy: req.session.user.id,
        });
        await poll.save();

        return res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        return res.render('createPoll', { errorMessage: 'Error creating poll' });
    }
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

/**
 * Handles creating a new poll, based on the data provided to the server
 * 
 * @param {string} question The question the poll is asking
 * @param {[answer: string, votes: number]} pollOptions The various answers the poll allows and how many votes each answer should start with
 * @returns {string?} An error message if an error occurs, or null if no error occurs.
 */



async function onCreateNewPoll(question, pollOptions) {
    try {
        // Create a new poll document
        const newPoll = new Poll({
            question,
            options: pollOptions,
            createdBy: req.session.user._id, // Use 'req' directly here
         });
         
        await newPoll.save();

        
        connectedClients.forEach(client => {
            client.send(JSON.stringify({ type: 'newPoll', poll: newPoll }));
        });

        return null; 
    } catch (error) {
        console.error('Error creating poll:', error);
        return 'Error creating the poll, please try again'; // error message if something goes wrong
    }
}


/**
 * Handles processing a new vote on a poll
 * 
 * This function isn't necessary and should be removed if it's not used, but it's left as a hint to try and help give
 * an idea of how you might want to handle incoming votes
 * 
 * @param {string} pollId The ID of the poll that was voted on
 * @param {string} selectedOption Which option the user voted for
 */

// didn't use onNewVote function^
