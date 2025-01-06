// Establish WebSocket connection
const socket = new WebSocket('ws://localhost:3000/ws');

// Listen for messages from the server
socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'voteUpdate') {
        // Call function to update the vote count in the UI
        updateVoteCounts(data.poll);
    } else if (data.type === 'newPoll') {
        // Handle new poll being created (optional for your use case)
        onNewPollAdded(data);
    }
});

// Function to update vote counts on the page
function updateVoteCounts(poll) {
    const pollElement = document.getElementById(poll.id);
    const optionsList = pollElement.querySelector('.poll-options');
    
    // Update each option's vote count
    poll.options.forEach(option => {
        const optionElement = document.getElementById(`${poll.id}_${option.answer}`);
        if (optionElement) {
            optionElement.innerHTML = `<strong>${option.answer}:</strong> ${option.votes} votes`;
        }
    });
}

// Handle form submission for voting
document.querySelectorAll('.poll-form').forEach((pollForm) => {
    pollForm.addEventListener('submit', onVoteClicked);
});

// Function for handling a vote click
function onVoteClicked(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    const pollId = formData.get("poll-id");
    const selectedOption = event.submitter.value;

    // Send the vote data to the server via WebSocket
    socket.send(JSON.stringify({
        type: 'vote',
        pollId: pollId,
        selectedOption: selectedOption
    }));
    socket.send(JSON.stringify(message));  // Send the vote to the server
}


//Adds a listener to each existing poll to handle things when the user attempts to vote
document.querySelectorAll('.poll-form').forEach((pollForm) => {
    pollForm.addEventListener('submit', onVoteClicked);
});
