'use client';

import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Upload,
  Paperclip,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  File as FileIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { validateFileAction, sendEmailsAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

type ValidationStatus = 'idle' | 'validating' | 'valid' | 'invalid';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove the prefix 'data:;base64,'
            const base64 = result.substring(result.indexOf(',') + 1);
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
    });
};


export default function MailForm() {
  const { toast } = useToast();

  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [recipientsFileContent, setRecipientsFileContent] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const recipientInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const processAndValidateFile = async (file: File) => {
    setValidationStatus('validating');
    setValidationMessage('');

    try {
      const reader = new FileReader();
      
      const fileContentPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          try {
            if (!event.target?.result) {
              return reject(new Error("Failed to read file."));
            }

            let csvContent = '';
            if (file.name.endsWith('.csv')) {
              csvContent = event.target.result as string;
            } else if (file.name.endsWith('.xlsx')) {
              const data = new Uint8Array(event.target.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              csvContent = XLSX.utils.sheet_to_csv(worksheet);
            } else {
              return reject(new Error("Unsupported file type. Please upload a .csv or .xlsx file."));
            }
            resolve(csvContent);
          } catch (err) {
            reject(err);
          }
        };

        reader.onerror = () => {
          reject(new Error("Failed to read the file."));
        };

        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else if(file.name.endsWith('.xlsx')) {
            reader.readAsArrayBuffer(file);
        } else {
           reject(new Error("Unsupported file type. Please upload a .csv or .xlsx file."));
        }
      });
      
      const content = await fileContentPromise;

      if (!content || content.trim() === '') {
        throw new Error('The uploaded file is empty or does not contain any data.');
      }
      
      setRecipientsFileContent(content);
      const result = await validateFileAction(content);
      
      if (result.isValid) {
        setValidationStatus('valid');
        toast({
          title: 'File Validated',
          description: 'Your recipient file is valid and ready.',
          variant: 'default',
        });
      } else {
        throw new Error(result.errorMessage || 'The uploaded file is invalid.');
      }

    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred.';
      setValidationStatus('invalid');
      setValidationMessage(errorMessage);
      toast({
        title: 'File Error',
        description: errorMessage,
        variant: 'destructive',
      });
      // Also clear the file so user can re-upload
      setRecipientsFile(null);
      setRecipientsFileContent('');
      if(recipientInputRef.current) recipientInputRef.current.value = '';
    }
  }

  const handleRecipientFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecipientsFile(file);
    await processAndValidateFile(file);
  };

  const handleAttachmentFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentFile(file);
    }
  };

  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validationStatus !== 'valid' || !subject || !message || !recipientsFileContent) {
       toast({
        title: 'Form Incomplete',
        description: 'Please upload a valid recipient file and fill out the subject and message.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);

    let attachmentPayload;
    if (attachmentFile) {
        try {
            const content = await fileToBase64(attachmentFile);
            attachmentPayload = {
                filename: attachmentFile.name,
                content,
            };
        } catch (error) {
            setIsSending(false);
            toast({
                title: 'Attachment Error',
                description: 'Could not process the attachment file.',
                variant: 'destructive',
            });
            return;
        }
    }

    const result = await sendEmailsAction({
        subject,
        message,
        recipientsFileContent: recipientsFileContent,
        attachment: attachmentPayload
    });
    setIsSending(false);
    
    if (result.success) {
        toast({
            title: 'Success!',
            description: result.message,
        });
        // Reset form
        setRecipientsFile(null);
        setRecipientsFileContent('');
        setAttachmentFile(null);
        setSubject('');
        setMessage('');
        setValidationStatus('idle');
        if(recipientInputRef.current) recipientInputRef.current.value = '';
        if(attachmentInputRef.current) attachmentInputRef.current.value = '';

    } else {
        toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
        });
    }
  };
  
  const renderValidationIndicator = () => {
    switch (validationStatus) {
      case 'validating':
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
      case 'valid':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'invalid':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Compose Email</CardTitle>
        <CardDescription>
          Fill in the details below to send your email blast.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSend}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="recipients-file">1. Recipient List (.csv or .xlsx)</Label>
            <div className="flex items-center gap-4">
               <Button type="button" variant="outline" onClick={() => recipientInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload File
              </Button>
              <Input
                id="recipients-file"
                type="file"
                className="hidden"
                ref={recipientInputRef}
                onChange={handleRecipientFileChange}
                accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1 min-w-0">
                {renderValidationIndicator()}
                {recipientsFile ? (
                    <span className="truncate">{recipientsFile.name}</span>
                ): (
                    <span>No file selected</span>
                )}
              </div>
            </div>
            {validationStatus === 'invalid' && validationMessage && (
                <p className='text-sm text-destructive mt-1'>{validationMessage}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">2. Subject</Label>
            <Input id="subject" placeholder="Enter email subject" value={subject} onChange={e => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">3. Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              className="min-h-[150px]"
              value={message} onChange={e => setMessage(e.target.value)} required
            />
            <p className="text-xs text-muted-foreground">
              Note: The greeting "Dear Prof. &lt;Lastname&gt;," will be automatically added to each email.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="attachment-file">4. Attachment (Optional)</Label>
             <div className="flex items-center gap-4">
                <Button type="button" variant="outline" onClick={() => attachmentInputRef.current?.click()}>
                    <Paperclip className="mr-2 h-4 w-4" />
                    Add Attachment
                </Button>
                <Input id="attachment-file" type="file" className="hidden" ref={attachmentInputRef} onChange={handleAttachmentFileChange} />
                {attachmentFile && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileIcon className="h-4 w-4" />
                        <span className="truncate">{attachmentFile.name}</span>
                    </div>
                )}
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className={cn(
              "w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all",
              "focus-visible:ring-accent"
            )}
            disabled={isSending || validationStatus !== 'valid'}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isSending ? 'Sending...' : 'Send Emails'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
