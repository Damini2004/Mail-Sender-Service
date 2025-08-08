
'use server';

import { z } from 'zod';
import nodemailer from 'nodemailer';
import Handlebars from 'handlebars';

const sendEmailsActionSchema = z.object({
  subject: z.string(),
  message: z.string(),
  recipientsFileContent: z.string(),
  attachment: z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
  }).optional(),
  banner: z.object({
    filename: z.string(),
    content: z.string(), // data URI
  }).optional(),
});


export async function sendEmailsAction(data: z.infer<typeof sendEmailsActionSchema>) {
  const validation = sendEmailsActionSchema.safeParse(data);

  if (!validation.success) {
    console.error('Invalid data provided:', validation.error.flatten());
    return { success: false, message: 'Invalid data provided.' };
  }
  
  const { subject, recipientsFileContent, attachment, banner } = validation.data;
  const defaultPrefix = '<p>Dear Professor {{Lastname}},</p><p>&nbsp;</p><p>I am writing to you today...</p>';
  const fullMessage = defaultPrefix + validation.data.message;


  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    return { success: false, message: 'Email credentials are not configured on the server.' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
    pool: true, // Use a connection pool for better performance
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: 30, // Limit to 30 emails per second to be safe
  });
  
  // Pre-compile handlebars templates for performance
  const messageTemplate = Handlebars.compile(fullMessage, { noEscape: true });
  const subjectTemplate = Handlebars.compile(subject, { noEscape: true });


  try {
    const lines = recipientsFileContent.trim().split('\n');
    const headerLine = lines.shift() || '';
    const header = headerLine.toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    
    // Normalize headers to be valid variable names
    const normalizedHeader = header.map(h => h.replace(/[^a-zA-Z0-9_]/g, ''));
    
    const emailIndex = header.indexOf('email');

    if (emailIndex === -1) {
      return { success: false, message: `The recipient file must contain an "email" column. Please check your file.` };
    }
    
    let sentCount = 0;
    const emailPromises = lines.map(async (line) => {
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
      const email = values[emailIndex];
      
      if (!email) return;

      const recipientData = normalizedHeader.reduce((acc, currentHeader, index) => {
          acc[currentHeader] = values[index];
          return acc;
      }, {} as Record<string, string>);

      const personalizedMessage = messageTemplate(recipientData);
      const personalizedSubject = subjectTemplate(recipientData);
      
      const mailOptions: nodemailer.SendMailOptions = {
        from: `Pure Research Insights <${process.env.EMAIL_USER}>`,
        to: email,
        subject: personalizedSubject,
        html: personalizedMessage,
        attachments: [],
      };
      
      const attachments = mailOptions.attachments as nodemailer.Attachment[];

      if (banner) {
          const bannerCid = 'banner-image@mailmerge.pro';
          // Append banner to the end of the HTML message
          mailOptions.html += `
            <br>
            <div style="text-align: center;">
              <img src="cid:${bannerCid}" alt="Banner" style="max-width: 100%; height: auto;" />
            </div>
          `;
          attachments.push({
              filename: banner.filename,
              path: banner.content,
              cid: bannerCid,
          });
      }

      if (attachment) {
        attachments.push({
            filename: attachment.filename,
            content: attachment.content,
            encoding: 'base64',
        });
      }
      
      try {
        await transporter.sendMail(mailOptions);
        sentCount++;
      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        // Don't re-throw, so one failure doesn't stop the whole batch
      }
    });

    await Promise.all(emailPromises);
    transporter.close();

    if (sentCount === 0 && lines.length > 0) {
        return { success: false, message: 'No emails were sent. Please check your contact list and server logs.' };
    }

    const messageText = `Your email blast has been successfully sent to ${sentCount} of ${lines.length} recipients.`;

    return { success: true, message: messageText };
  } catch (error) {
    console.error('Error sending emails:', error);
    transporter.close();
    return { success: false, message: 'Failed to send emails. Please check server logs for details.' };
  }
}
