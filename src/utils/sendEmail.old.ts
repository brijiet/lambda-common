import 'dotenv/config';
import * as sgMail from '@sendgrid/mail'
import axios from 'axios';
import { transport } from '../nodemailer';

export const sendEmail = async (msg: sgMail.MailDataRequired,sentEmail=false,id=undefined) => {
  try {

    // const sendgridKey = process.env.SENDGRID_API_KEY as string;

    // sgMail.setApiKey(sendgridKey);

    // console.log('from', process.env.SENDGRID_SENDER_EMAIL,msg.to,msg.from,msg.subject, 'id ', id);

    // const response = await sgMail.send(msg);
    // console.log('sendgrid email status ', response.toString());

    const info = await transport.sendMail({
      from: msg.from as  string,
      // to: 'srinivasreddy.pamireddy@ratnaglobaltech.com',
      to: msg.to as string,
      subject: msg.subject,
      html: msg.html
    });
    console.log('info id', info.response);
    // return info;
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

   

  } catch (error) {
    console.log('error in sendEmailVerifyLink', error);
    return error;
  }
}

