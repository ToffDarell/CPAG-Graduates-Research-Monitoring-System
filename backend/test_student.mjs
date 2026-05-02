import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { getAvailableDocuments } from './controllers/studentController.js';

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const req = { user: { id: '69b180294fef797ccbf70416', role: 'graduate student' } };
    const res = {
      json: (data) => { console.log(JSON.stringify(data, null, 2)); process.exit(0); },
      status: (code) => ({ json: (data) => { console.log(code, data); process.exit(1); } })
    };
    await getAvailableDocuments(req, res);
  });
