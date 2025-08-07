'use client';

import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import Image from 'next/image';
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
  File as FileIcon,
  CheckCircle2,
  ImageIcon,
  Calendar as CalendarIcon,
  Clock,
  Menu,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { sendEmailsAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            resolve(result);
        };
        reader.onerror = (error) => reject(error);
    });
};

export default function MailForm() {
  const { toast } = useToast();

  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [recipientsFileContent, setRecipientsFileContent] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState('');


  const recipientInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  const resetForm = () => {
    setRecipientsFile(null);
    setRecipientsFileContent('');
    setAttachmentFile(null);
    setBannerFile(null);
    setBannerPreview(null);
    setSubject('');
    setMessage('');
    setScheduleEmail(false);
    setScheduledDate(undefined);
    setScheduledTime('');
    if(recipientInputRef.current) recipientInputRef.current.value = '';
    if(attachmentInputRef.current) attachmentInputRef.current.value = '';
    if(bannerInputRef.current) bannerInputRef.current.value = '';
    setIsScheduled(false);
  };

  const handleRecipientFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setRecipientsFile(file);
    setRecipientsFileContent('');

    try {
      const reader = new FileReader();
      
      const fileContentPromise = new Promise<string>((resolve, reject) => {
        reader.onload = (event) => {
          try {
            if (!event.target?.result) {
              return reject(new Error("Failed to read file. The file might be empty or corrupted."));
            }

            let csvContent: string;
            const fileExtension = file.name.split('.').pop()?.toLowerCase();

            if (fileExtension === 'csv') {
              csvContent = event.target.result as string;
            } else if (['xlsx', 'xls'].includes(fileExtension || '')) {
              const data = new Uint8Array(event.target.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const sheetName = workbook.SheetNames[0];
              if(!sheetName) {
                return reject(new Error("The Excel file seems to be empty or invalid. No sheets found."));
              }
              const worksheet = workbook.Sheets[sheetName];
              csvContent = XLSX.utils.sheet_to_csv(worksheet);
            } else {
              return reject(new Error("Unsupported file type. Please upload a .csv or .xlsx file."));
            }
            resolve(csvContent);
          } catch (err) {
            console.error("Error parsing file:", err);
            reject(new Error("There was an error parsing your file. Please check the file format and content."));
          }
        };

        reader.onerror = () => {
          reject(new Error("Failed to read the file. Please try again."));
        };

        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (fileExtension === 'csv') {
            reader.readAsText(file);
        } else if(['xlsx', 'xls'].includes(fileExtension || '')) {
            reader.readAsArrayBuffer(file);
        } else {
           reject(new Error("Unsupported file type. Please upload a .csv or .xlsx file."));
        }
      });
      
      const content = await fileContentPromise;

      if (!content || content.trim() === '') {
        throw new Error('The uploaded file is empty or does not contain any data.');
      }
      
      setRecipientsFile(file);
      setRecipientsFileContent(content);

    } catch (err: any) {
      const errorMessage = err.message || 'An unexpected error occurred while processing the file.';
      setRecipientsFile(null);
      setRecipientsFileContent('');
      if(recipientInputRef.current) recipientInputRef.current.value = '';
      
      toast({
        title: 'File Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
        setIsProcessingFile(false);
    }
  };

  const handleAttachmentFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentFile(file);
    }
  };
  
  const handleBannerFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload an image file for the banner.',
          variant: 'destructive',
        });
        return;
      }
      setBannerFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setBannerPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };
  
  const sendEmailRequest = async () => {
    setIsSending(true);

    let attachmentPayload;
    if (attachmentFile) {
        try {
            const content = await fileToBase64(attachmentFile);
            const base64Content = content.substring(content.indexOf(',') + 1);
            attachmentPayload = {
                filename: attachmentFile.name,
                content: base64Content,
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

    let bannerPayload;
    if (bannerFile) {
        try {
            const content = await fileToBase64(bannerFile);
            bannerPayload = {
                filename: bannerFile.name,
                content, // Pass the full data URI
            };
        } catch (error) {
            setIsSending(false);
            toast({
                title: 'Banner Error',
                description: 'Could not process the banner image.',
                variant: 'destructive',
            });
            return;
        }
    }

    const result = await sendEmailsAction({
        subject,
        message,
        recipientsFileContent,
        attachment: attachmentPayload,
        banner: bannerPayload,
    });
    
    setIsSending(false);
    
    if (result.success) {
        toast({
            title: 'Success!',
            description: result.message,
        });
        // We don't reset the form here anymore, 
        // as it was reset upon scheduling/sending.
        setIsScheduled(false);
    } else {
        toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
        });
        setIsScheduled(false); // Allow user to try again
    }
  };


  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recipientsFileContent || !subject || !message) {
       toast({
        title: 'Form Incomplete',
        description: 'Please upload a recipient file and fill out the subject and message.',
        variant: 'destructive',
      });
      return;
    }

    if (scheduleEmail) {
      if (!scheduledDate || !scheduledTime) {
        toast({
          title: 'Scheduling Incomplete',
          description: 'Please select a date and time to schedule the emails.',
          variant: 'destructive',
        });
        return;
      }
      const [hours, minutes] = scheduledTime.split(':').map(Number);
      const scheduledDateTime = new Date(scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      const delay = scheduledDateTime.getTime() - Date.now();

      if (delay <= 0) {
        toast({
          title: 'Invalid Schedule Time',
          description: 'Please select a time in the future.',
          variant: 'destructive',
        });
        return;
      }
      
      setTimeout(() => {
        sendEmailRequest();
      }, delay);
      
      toast({
        title: 'Emails Scheduled!',
        description: `Your emails are scheduled to be sent on ${format(scheduledDateTime, "PPP 'at' h:mm a")}.`,
        className: 'bg-green-100 border-green-300 text-green-800',
      });
      
      setIsScheduled(true); // Put UI in scheduled state
      
    } else {
      sendEmailRequest();
    }
  };
  
  const renderFileStatusIndicator = () => {
    if (isProcessingFile) {
        return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    }
    if (recipientsFileContent) {
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    return null;
  };

  const getButtonText = () => {
    if (isSending) {
      return scheduleEmail ? 'Sending Scheduled...' : 'Sending...';
    }
    if (isScheduled) {
        return 'Emails are Scheduled...';
    }
    return scheduleEmail ? 'Schedule Emails' : 'Send Emails';
  };

  return (
    <Card className="w-full shadow-2xl shadow-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="font-headline text-2xl tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" />
            Compose Your Masterpiece
        </CardTitle>
        <CardDescription>
          Fill in the details below to send your email blast.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSend}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="recipients-file">1. Recipient List (.csv or .xlsx)</Label>
            <div className="flex items-center gap-4">
               <Button type="button" variant="outline" onClick={() => recipientInputRef.current?.click()} disabled={isProcessingFile || isScheduled}>
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
                disabled={isScheduled}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1 min-w-0">
                {renderFileStatusIndicator()}
                {recipientsFile ? (
                    <span className="truncate">{recipientsFile.name}</span>
                ): (
                    <span>No file selected</span>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="subject">2. Subject</Label>
            <Input id="subject" placeholder="Enter email subject" value={subject} onChange={e => setSubject(e.target.value)} required disabled={isScheduled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">3. Message</Label>
            <Textarea
              id="message"
              placeholder="Type your message here..."
              className="min-h-[150px]"
              value={message} onChange={e => setMessage(e.target.value)} required
              disabled={isScheduled}
            />
            <p className="text-xs text-muted-foreground">
              Tip: Use placeholders like '{{FirstName}}' which match your CSV columns.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="attachment-file">4. Attachment (Optional)</Label>
               <div className="flex items-center gap-4">
                  <Button type="button" variant="outline" onClick={() => attachmentInputRef.current?.click()} disabled={isScheduled}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Add Attachment
                  </Button>
                  <Input id="attachment-file" type="file" className="hidden" ref={attachmentInputRef} onChange={handleAttachmentFileChange} disabled={isScheduled} />
                  {attachmentFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                          <FileIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{attachmentFile.name}</span>
                      </div>
                  )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-file">5. Banner Image (Optional)</Label>
              <div className="flex items-center gap-4">
                <Button type="button" variant="outline" onClick={() => bannerInputRef.current?.click()} disabled={isScheduled}>
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Upload Banner
                </Button>
                <Input
                  id="banner-file"
                  type="file"
                  className="hidden"
                  ref={bannerInputRef}
                  onChange={handleBannerFileChange}
                  accept="image/*"
                  disabled={isScheduled}
                />
                {bannerFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                    <FileIcon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{bannerFile.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {bannerPreview && (
            <div className="mt-4">
              <Label>Banner Preview</Label>
              <div className="mt-2 rounded-lg border p-2">
                <Image src={bannerPreview} alt="Banner Preview" width={500} height={150} className="w-full rounded-md object-contain" />
              </div>
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="schedule-email" className="font-medium flex items-center gap-2">
                <Menu className="w-5 h-5 text-muted-foreground" />
                6. Schedule for Later? (Optional)
              </Label>
              <Switch id="schedule-email" checked={scheduleEmail} onCheckedChange={setScheduleEmail} disabled={isScheduled} />
            </div>
            {scheduleEmail && (
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-300'>
                <div>
                  <Label className='text-xs'>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !scheduledDate && "text-muted-foreground"
                        )}
                        disabled={isScheduled}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledDate ? format(scheduledDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className='text-xs'>Time</Label>
                   <div className="relative">
                     <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="time" 
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="pl-10"
                      disabled={isScheduled}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            className={cn(
              "w-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all text-base font-medium",
              "focus-visible:ring-accent",
              "shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
            )}
            size="lg"
            disabled={isSending || isProcessingFile || !recipientsFileContent || isScheduled}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Send className="mr-2 h-5 w-5" />
            )}
            {getButtonText()}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
