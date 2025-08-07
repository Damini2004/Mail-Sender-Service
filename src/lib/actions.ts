'use server';

import { validateDataUpload } from '@/ai/flows/validate-data-upload';
import { z } from 'zod';

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
  recipientsFileName: z.string(),
  attachmentFileName: z.string().optional(),
});

export async function sendEmailsAction(data: z.infer<typeof sendEmailsActionSchema>) {
  const validation = sendEmailsActionSchema.safeParse(data);

  if (!validation.success) {
    return { success: false, message: 'Invalid data provided.' };
  }

  console.log('--- SIMULATING EMAIL SEND ---');
  console.log('Subject:', data.subject);
  console.log('Message Body (template):', data.message);
  console.log('Recipient List:', data.recipientsFileName);
  if (data.attachmentFileName) {
    console.log('Attachment:', data.attachmentFileName);
  }
  console.log('Personalization note: Each email will start with "Dear Prof. <Lastname>".');
  console.log('--- SIMULATION COMPLETE ---');

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  return { success: true, message: 'Your emails have been sent successfully!' };
}
