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

Follow these steps carefully:
1.  Analyze the header row. The header MUST contain columns named "email" and "last name". The column names are case-insensitive and can have leading/trailing whitespace.
2.  If the header is missing either "email" or "last name", immediately return an error message specifying which header is missing. For example: "Header 'last name' is missing."
3.  Iterate through each data row (every line after the header).
4.  For each row, check the value in the "email" column. It must be a validly formatted email address. If not, return an error specifying the row number and the invalid email. For example: "Invalid email format on row 3: 'not-an-email'".
5.  For each row, check the value in the "last name" column. It must not be empty or just whitespace. If it is, return an error specifying the row number. For example: "Missing last name on row 5."
6.  If you have checked all rows and found no errors, the data is valid.

The data to validate is here:

{{{fileData}}}

Return a JSON object with your findings. The JSON object must have two fields: "isValid" (boolean) and "errorMessage" (string, optional).
- If the data is valid, set "isValid" to true and omit "errorMessage".
- If the data is invalid, set "isValid" to false and provide a clear, specific "errorMessage" explaining the FIRST error you found.
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
          errorMessage: 'An unexpected error occurred during validation.',
        };
    }
  }
);
