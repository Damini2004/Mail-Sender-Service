'use server';

import { validateDataUpload } from '@/ai/flows/validate-data-upload';
import { z } from 'zod';
import nodemailer from 'nodemailer';

export async function validateFileAction(fileContent: string) {
  try {
    const result = await validateDataUpload({ fileData: fileContent });
    return result;
  } catch (error) {
    console.error('Validation error:', error);
    return {
      isValid: false,
      errorMessage: 'An unexpected error occurred during validation.',
    };
  }
}

const sendEmailsActionSchema = z.object({
  subject: z.string(),
  message: z.string(),
  recipientsFileContent: z.string(),
  attachment: z.object({
    filename: z.string(),
    content: z.string(), // base64 encoded
  }).optional(),
});


export async function sendEmailsAction(data: z.infer<typeof sendEmailsActionSchema>) {
  const validation = sendEmailsActionSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, message: 'Invalid data provided.' };
  }
  
  const { subject, message, recipientsFileContent, attachment } = validation.data;

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
    // Assuming CSV format: email,lastName
    const lines = recipientsFileContent.trim().split('\n');
    const header = lines.shift()?.toLowerCase().split(',').map(h => h.trim()) || [];
    const emailIndex = header.indexOf('email');
    const lastNameIndex = header.indexOf('last name');

    if (emailIndex === -1 || lastNameIndex === -1) {
      return { success: false, message: 'CSV must contain "email" and "last name" columns.' };
    }

    const emailPromises = lines.map(async (line) => {
      const values = line.split(',');
      const email = values[emailIndex]?.trim();
      const lastName = values[lastNameIndex]?.trim();

      if (!email || !lastName) return;

      const personalizedMessage = `Dear Prof. ${lastName},\n\n${message}`;

      const mailOptions: nodemailer.SendMailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: subject,
        text: personalizedMessage,
      };

      if (attachment) {
        mailOptions.attachments = [
          {
            filename: attachment.filename,
            content: attachment.content,
            encoding: 'base64',
          },
        ];
      }
      return transporter.sendMail(mailOptions);
    });

    await Promise.all(emailPromises);

    return { success: true, message: 'Your emails have been sent successfully!' };
  } catch (error) {
    console.error('Error sending emails:', error);
    return { success: false, message: 'Failed to send emails. Please check server logs.' };
  }
}