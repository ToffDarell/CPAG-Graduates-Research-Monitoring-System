const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const { Document, Panel, Research } = require('./models');

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    // We will just query the Research model directly
    const researches = await mongoose.model('Research').find({ students: '69b180294fef797ccbf70416' });
    let researchDocuments = [];
    researches.forEach(research => {
      const docs = (research.forms || [])
        .filter(f => f.type === 'other')
        .map(f => ({
          _id: f._id,
          title: f.partName || f.filename,
          sourceType: 'research',
        }));
      researchDocuments = [...researchDocuments, ...docs];
    });
    console.log(JSON.stringify(researchDocuments, null, 2));
    process.exit(0);
  });
