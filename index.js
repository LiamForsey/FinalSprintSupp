const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');

const User = require('./models/User');
const Poll = require('./models/Poll');


const PORT = 3000;
//TODO: Update this URI to match your own MongoDB setup
const MONGO_URI = 'mongodb+srv://Liam:Diesel13@cluster0.ic4nl.mongodb.net/';

const app = express();
expressWs(app);

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

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

// mongoose

// Setting up websocket for voting updates:

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


// Home Page - Landing Page for unauthenticated users:

app.get('/', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }

    response.render('index/unauthenticatedIndex', {});
});


// route for logging in users
app.get('/login', (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }
    return response.render('login', { errorMessage: null });
});



app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !await bcrypt.compare(password, user.password)) {
        return res.render('login', { errorMessage: 'Invalid credentials' });
    }

    req.session.user = user;
    res.redirect('/dashboard');
});

app.get('/signup', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }

    return response.render('signup', { errorMessage: null });
});

// Signup request (Create new user)
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const user = new User({ username, password: hashedPassword });
        await user.save();
        req.session.user = user;
        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        res.render('signup', { errorMessage: 'Username already taken' });
    }
});


app.get('/dashboard', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    const polls = await Poll.find();

    response.render('index/authenticatedIndex', { polls });

    //TODO: Fix the polls, this should contain all polls that are active. I'd recommend taking a look at the
    //authenticatedIndex template to see how it expects polls to be represented
    return response.render('index/authenticatedIndex', { polls: [] });
});



app.get('/profile', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }
    
    const user = await User.findById(request.session.user._id).populate('pollsVoted');
    response.render('profile', { user, pollsVoted: user.pollsVoted.length });
});


// Create a new poll
app.get('/createPoll', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    return response.render('createPoll')
});



// Poll creation - save poll to database
app.post('/createPoll', async (request, response) => {
    const { question, options } = request.body;
    const formattedOptions = Object.values(options).map(option => ({ answer: option, votes: 0 }));

    // Call the function to create the new poll
    const pollCreationError = await onCreateNewPoll(question, formattedOptions);

    if (pollCreationError) {
        return response.render('createPoll', { errorMessage: pollCreationError });
    }

    // If no error, redirect to dashboard
    response.redirect('/dashboard');
});

  
// logout:

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
            createdBy: request.session.user._id, // Link the poll to the logged-in user
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



mongoose.connect(MONGO_URI).then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
    });
})
.catch((error) => {
    console.error('Error connecting to MongoDB:', error);
});




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
