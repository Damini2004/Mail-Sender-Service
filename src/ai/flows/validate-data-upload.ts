'use server';

/**
 * @fileOverview A flow to validate data uploaded from a CSV file.
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

The data must contain a header row with "email" and "last name" columns. The "email" column must contain valid email addresses. The "last name" column must contain professor last names.

Here is the data:

{{{fileData}}}

Please validate the data based on these requirements.
- Check for the presence of "email" and "last name" headers.
- Check if all rows under "email" are valid email addresses.
- The "last name" column should not be empty.

If the data is invalid, provide a clear and specific error message explaining what's wrong (e.g., "Header 'last name' is missing.", "Invalid email format on row 3.").
If the data is valid, return true with no error message.

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
    try {
      const {output} = await validateDataUploadPrompt(input);
      if (!output) {
         return {
          isValid: false,
          errorMessage: 'The validation service did not return a response. Please try again.',
        };
      }
      return output;
    } catch(e) {
      console.error(e);
      return {
          isValid: false,
          errorMessage: 'Could not validate the file. Please ensure it is a valid CSV with "email" and "last name" columns.',
        };
    }
  }
);
