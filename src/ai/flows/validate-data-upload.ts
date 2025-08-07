'use server';

/**
 * @fileOverview A flow to validate data uploaded from a CSV or Excel file.
 *
 * - validateDataUpload - Validates the uploaded data for required columns and correct data format.
 * - ValidateDataUploadInput - The input type for the validateDataUpload function.
 * - ValidateDataUploadOutput - The return type for the validateDataUpload function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateDataUploadInputSchema = z.object({
  fileData: z.string().describe('The data from the uploaded CSV file as a string.'),
});
export type ValidateDataUploadInput = z.infer<typeof ValidateDataUploadInputSchema>;

const ValidateDataUploadOutputSchema = z.object({
  isValid: z.boolean().describe('Whether the uploaded data is valid or not.'),
  errorMessage: z.string().optional().describe('Error message if the data is invalid.'),
});
export type ValidateDataUploadOutput = z.infer<typeof ValidateDataUploadOutputSchema>;

export async function validateDataUpload(input: ValidateDataUploadInput): Promise<ValidateDataUploadOutput> {
  return validateDataUploadFlow(input);
}

const validateDataUploadPrompt = ai.definePrompt({
  name: 'validateDataUploadPrompt',
  input: {schema: ValidateDataUploadInputSchema},
  output: {schema: ValidateDataUploadOutputSchema},
  prompt: `You are an expert data validator. Your task is to validate the data provided from a CSV file.

The data should contain two columns: "email" and "last name". The email column should contain valid email addresses, and the last name column should contain professor last names.

Given the following data:

{{fileData}}

Determine if the data is valid based on the above criteria. If the data is invalid, provide an informative error message describing the issue.

Return a JSON object with the following format:
{
  "isValid": true or false,
  "errorMessage": "error message if isValid is false"
}
`,
});

const validateDataUploadFlow = ai.defineFlow(
  {
    name: 'validateDataUploadFlow',
    inputSchema: ValidateDataUploadInputSchema,
    outputSchema: ValidateDataUploadOutputSchema,
  },
  async input => {
    const {output} = await validateDataUploadPrompt(input);
    return output!;
  }
);
