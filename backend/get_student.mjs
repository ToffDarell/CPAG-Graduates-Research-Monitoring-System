import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
dotenv.config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const student = await User.findOne({ _id: '69b180294fef797ccbf70416' });
    console.log(student.email);
    process.exit(0);
  });
