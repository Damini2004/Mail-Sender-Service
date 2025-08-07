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
  fileData: z.string().describe('The data from the uploaded file, converted to a CSV string.'),
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
  prompt: `You are a data validation expert. Your task is to validate the provided CSV-formatted data.

The data MUST contain a header row with columns named "email" and "last name". These column names are case-insensitive and can have leading/trailing whitespace.

Validation Steps:
1.  Check for the header row. If the header is missing "email" or "last name", return an error specifying which header is missing (e.g., "Header 'last name' is missing.").
2.  For each data row (every line after the header):
    a. Verify that the "email" column contains a valid email address. If not, return an error with the row number and the invalid email (e.g., "Invalid email format on row 3: 'not-an-email'").
    b. Verify that the "last name" column is not empty or just whitespace. If it is, return an error with the row number (e.g., "Missing last name on row 5.").
3.  If all rows are valid, the data is valid.

Here is the data to validate:
\`\`\`
{{{fileData}}}
\`\`\`

Return a JSON object with your findings.
- If valid, return: {"isValid": true}
- If invalid, return: {"isValid": false, "errorMessage": "Specific error message here"}
`,
});

const validateDataUploadFlow = ai.defineFlow(
  {
    name: 'validateDataUploadFlow',
    inputSchema: ValidateDataUploadInputSchema,
    outputSchema: ValidateDataUploadOutputSchema,
  },
  async input => {
    if (!input.fileData || input.fileData.trim() === '') {
        return {
            isValid: false,
            errorMessage: 'The uploaded file is empty or does not contain any data.'
        }
    }
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
      console.error("Error in validateDataUploadFlow:", e);
      let errorMessage = 'An unexpected error occurred during validation.';
      if (e instanceof Error) {
        errorMessage = e.message;
      }
      return {
          isValid: false,
          errorMessage,
        };
    }
  }
);
