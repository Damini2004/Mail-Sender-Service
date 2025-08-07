'use server';

import { z } from 'zod';
import nodemailer from 'nodemailer';

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
  
  const { subject, message, recipientsFileContent, attachment, banner } = validation.data;

  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    return { success: false, message: 'Email credentials are not configured on the server.' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  try {
    const lines = recipientsFileContent.trim().split('\n');
    const headerLine = lines.shift() || '';
    const header = headerLine.toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
    
    const emailIndex = header.indexOf('email');
    const lastNameIndex = header.indexOf('last name');

    if (emailIndex === -1 || lastNameIndex === -1) {
      let missingColumns = [];
      if (emailIndex === -1) missingColumns.push('"email"');
      if (lastNameIndex === -1) missingColumns.push('"last name"');
      return { success: false, message: `The recipient file must contain ${missingColumns.join(' and ')} columns. Please check your file.` };
    }
    
    const emailPromises = lines.map(async (line) => {
      // Handle CSVs that might have commas inside quoted fields
      const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/"/g, ''));
      const email = values[emailIndex];
      const lastName = values[lastNameIndex];

      if (!email || !lastName) return;

      const textMessage = `Dear Prof. ${lastName},\n\n${message}`;

      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        text: textMessage,
        html: '', // will be populated below
        attachments: [],
      };
      
      let htmlMessage = `<p>Dear Prof. ${lastName},</p><p>${message.replace(/\n/g, '<br>')}</p>`;
      const attachments = mailOptions.attachments as nodemailer.Attachment[];

      if (banner) {
          const bannerCid = 'banner-image@mailmerge.pro';
          htmlMessage += `
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
      
      mailOptions.html = htmlMessage;

      if (attachment) {
        attachments.push({
            filename: attachment.filename,
            content: attachment.content,
            encoding: 'base64',
        });
      }
      return transporter.sendMail(mailOptions);
    });

    const results = await Promise.allSettled(emailPromises);
    
    const failedSends = results.filter(r => r.status === 'rejected');
    if (failedSends.length > 0) {
        console.error('Some emails failed to send:', failedSends);
    }

    return { success: true, message: `Your emails have been sent! (${lines.length} total)` };
  } catch (error) {
    console.error('Error sending emails:', error);
    return { success: false, message: 'Failed to send emails. Please check server logs for details.' };
  }
}
