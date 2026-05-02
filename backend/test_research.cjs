const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    // We will just query the Research model directly
    const Research = mongoose.model('Research', new mongoose.Schema({}, { strict: false }));
    const research = await Research.findOne({ title: /MASTERAL/i });
    console.log(JSON.stringify(research, null, 2));
    process.exit(0);
  });
but 