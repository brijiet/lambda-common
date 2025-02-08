import 'dotenv/config';
import * as sgMail from '@sendgrid/mail';
import { transport } from '../nodemailer';
import { mailgunClient } from './mailgun';
import { MailgunMessageData } from 'mailgun.js';
import axios from 'axios';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN as string;

export const sendEmail = async (msg: MailgunMessageData, sentEmail = false, id = undefined) => {
  //async (msg: sgMail.MailDataRequired) == sendgrid
  try {

    // const sendgridKey = process.env.SENDGRID_API_KEY as string;

    // sgMail.setApiKey(sendgridKey);

    console.log('to', msg.to, 'subject', msg.subject, 'content ');

    // const response = await sgMail.send(msg);
    // console.log('sendgrid email status ', response.toString())
    // const info = await transport.sendMail({
    //   from: process.env.NODEMAILER_USER as string,
    //   // to: 'srinivasreddy.pamireddy@ratnaglobaltech.com',
    //   to: msg.to as string,
    //   subject: msg.subject,
    //   html: msg.html
    // });
    // console.log('info id', info.response);

    //mailgun send message

    mailgunClient.messages.create(MAILGUN_DOMAIN, msg).then((res) => console.log('mailgun success', res)).catch((err) => console.log('error in mailgun', err));
    const APIUrl: string = process.env.NODE_BACKEND_SERVER as string;
  
    if (sentEmail) {
      const emailStagingParams = {
        id,
        emailStagingStatus: 'sent'
      };
      const responseEmailStaging = await axios.put(`${APIUrl}/serverless/emailStaging`, emailStagingParams);
      const emailSentParams = {
        emailStaging: id,
        emailBody: msg.html
      };
      const responseEmailSent = await axios.post(`${APIUrl}/serverless/emailSent`, emailSentParams);
    };

    return;

  } catch (error) {
    console.log('error in sendEmail', error);
    return error;
  }
}

