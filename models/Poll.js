const mongoose = require('mongoose');


const pollOptionSchema = new mongoose.Schema({
    answer: { type: String, required: true },  
    votes: { type: Number, default: 0 }      
});


const pollSchema = new mongoose.Schema({
    question: { type: String, required: true },  
    options: [pollOptionSchema],                 
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    createdAt: { type: Date, default: Date.now } 
});


const Poll = mongoose.model('Poll', pollSchema);

module.exports = Poll;
