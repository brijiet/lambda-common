import Mailgun from "mailgun.js";
import * as formData from 'form-data';
import 'dotenv/config';

const mailgun = new Mailgun(formData);
const MAILGUN_KEY = process.env.MAILGUN_API_KEY as string;

export const mailgunClient = mailgun.client({ username: 'api', key: MAILGUN_KEY });