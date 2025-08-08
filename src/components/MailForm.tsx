
'use client';

import { useState, useRef, type ChangeEvent, type FormEvent, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
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
  History,
  Users,
  User,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { sendEmailsAction } from '@/lib/actions';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Switch } from './ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Dynamically import CKEditor
const CKEditor = dynamic(
  () => import('@ckeditor/ckeditor5-react').then((mod) => mod.CKEditor),
  { ssr: false }
);

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

interface ScheduledJob {
  id: string;
  subject: string;
  scheduledTime: Date;
  status: 'Scheduled' | 'Sent' | 'Failed';
}

export default function MailForm() {
  const { toast } = useToast();
  const defaultMessage = '<p></p>';

  const [sendMode, setSendMode] = useState<'bulk' | 'single'>('bulk');
  const [singleRecipientEmail, setSingleRecipientEmail] = useState('');
  const [singleRecipientLastName, setSingleRecipientLastName] = useState('');
  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [recipientsFileContent, setRecipientsFileContent] = useState<string>('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [editorLoaded, setEditorLoaded] = useState(false);
  const editorRef = useRef<any>(null);


  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [scheduleEmail, setScheduleEmail] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [scheduledTime, setScheduledTime] = useState('');

  const [scheduledJobs, setScheduledJobs] = useState<ScheduledJob[]>([]);

  const recipientInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    // Dynamically import the editor build
    import('@ckeditor/ckeditor5-build-classic')
      .then(editorModule => {
        editorRef.current = editorModule.default;
        setEditorLoaded(true);
      })
      .catch(error => {
        console.error("Failed to load CKEditor", error);
        toast({
            title: "Editor Error",
            description: "The text editor could not be loaded. Please refresh the page.",
            variant: "destructive"
        });
      });
  }, [toast]);


  const resetForm = () => {
    setRecipientsFile(null);
    setRecipientsFileContent('');
    setAttachmentFile(null);
    setBannerFile(null);
    setBannerPreview(null);
    setSubject('');
    setMessage(defaultMessage);
    setScheduleEmail(false);
    setScheduledDate(undefined);
    setScheduledTime('');
    setSingleRecipientEmail('');
    setSingleRecipientLastName('');
    if (recipientInputRef.current) recipientInputRef.current.value = '';
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    if (bannerInputRef.current) bannerInputRef.current.value = '';
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

  const updateJobStatus = (jobId: string, status: 'Sent' | 'Failed') => {
    setScheduledJobs(prevJobs => prevJobs.map(job => job.id === jobId ? { ...job, status } : job));
  };
  
  const sendEmailRequest = async (jobId?: string) => {
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
            if (jobId) updateJobStatus(jobId, 'Failed');
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
            if (jobId) updateJobStatus(jobId, 'Failed');
            toast({
                title: 'Banner Error',
                description: 'Could not process the banner image.',
                variant: 'destructive',
            });
            return;
        }
    }
    
    const singleRecipient = sendMode === 'single' ? { email: singleRecipientEmail, lastname: singleRecipientLastName } : undefined;

    const result = await sendEmailsAction({
        subject,
        message,
        recipientsFileContent: sendMode === 'bulk' ? recipientsFileContent : undefined,
        singleRecipient,
        attachment: attachmentPayload,
        banner: bannerPayload,
    });
    
    setIsSending(false);
    
    if (result.success) {
        toast({
            title: 'Success!',
            description: result.message,
        });
        if (jobId) updateJobStatus(jobId, 'Sent');
        resetForm();
    } else {
        toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
        });
        if (jobId) updateJobStatus(jobId, 'Failed');
    }
  };


  const handleSend = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    let isRecipientInfoMissing = false;
    if (sendMode === 'bulk') {
      if (!recipientsFileContent) {
        isRecipientInfoMissing = true;
      }
    } else { // single mode
      if (!singleRecipientEmail || !singleRecipientLastName) {
        isRecipientInfoMissing = true;
      }
    }

    if (isRecipientInfoMissing || !subject || !message) {
       toast({
        title: 'Form Incomplete',
        description: 'Please provide recipient information, a subject, and a message.',
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
      
      const jobId = `job-${Date.now()}`;
      const newJob: ScheduledJob = {
        id: jobId,
        subject: subject,
        scheduledTime: scheduledDateTime,
        status: 'Scheduled',
      };
      setScheduledJobs(prev => [...prev, newJob]);

      setTimeout(() => {
        sendEmailRequest(jobId);
      }, delay);
      
      toast({
        title: 'Emails Scheduled!',
        description: `Your emails are scheduled for ${format(scheduledDateTime, "PPP 'at' h:mm a")}.`,
        className: 'bg-green-100 border-green-300 text-green-800',
      });
      
      resetForm();
      
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
      return 'Sending...';
    }
    return scheduleEmail ? 'Schedule Email' : 'Send Email';
  };

  return (
    <Card className="w-full shadow-2xl rounded-t-none rounded-b-3xl border-none">
      <div className="absolute top-4 right-4 z-10">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-white text-primary hover:bg-gray-100 border-border rounded-full">
              <History className="h-6 w-6" />
              <span className="sr-only">View Scheduled Email Logs</span>
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Scheduled Email Logs</SheetTitle>
              <SheetDescription>
                Here is a history of emails you have scheduled in this session.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {scheduledJobs.length > 0 ? (
                scheduledJobs.map((job) => (
                  <div key={job.id} className="p-3 rounded-md border bg-card text-card-foreground">
                    <p className="font-semibold truncate">{job.subject}</p>
                    <p className="text-sm text-muted-foreground">
                      Scheduled for: {format(job.scheduledTime, "PPP 'at' h:mm a")}
                    </p>
                    <p className={cn(
                      "text-sm font-medium",
                      job.status === 'Scheduled' && 'text-blue-500',
                      job.status === 'Sent' && 'text-green-500',
                      job.status === 'Failed' && 'text-red-500',
                    )}>
                      Status: {job.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center text-muted-foreground py-8">
                  No emails have been scheduled yet.
                </p>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <CardHeader>
        <CardTitle className="font-headline text-2xl tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-accent" />
            Compose Message
        </CardTitle>
        <CardDescription>
          Fill in the details below to send your email blast.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSend}>
        <CardContent className="space-y-6">
          <Tabs value={sendMode} onValueChange={(value) => setSendMode(value as 'bulk' | 'single')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bulk"><Users className="mr-2 h-4 w-4" />Bulk Upload</TabsTrigger>
              <TabsTrigger value="single"><User className="mr-2 h-4 w-4" />Single Recipient</TabsTrigger>
            </TabsList>
            <TabsContent value="bulk" className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="recipients-file" className="text-base font-semibold tracking-tight">Recipient List (.csv or .xlsx)</Label>
                <div className="flex items-center gap-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="outline" className="rounded-full" onClick={() => recipientInputRef.current?.click()}>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload File
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Tip: Use placeholders like FirstName which match your CSV columns.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <Input
                    id="recipients-file"
                    type="file"
                    className="hidden"
                    ref={recipientInputRef}
                    onChange={handleRecipientFileChange}
                    accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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
            </TabsContent>
            <TabsContent value="single" className="pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="single-email" className="text-base font-semibold tracking-tight">Recipient Email</Label>
                  <Input id="single-email" type="email" placeholder="professor@university.edu" value={singleRecipientEmail} onChange={e => setSingleRecipientEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="single-lastname" className="text-base font-semibold tracking-tight">Recipient Last Name</Label>
                  <Input id="single-lastname" placeholder="Smith" value={singleRecipientLastName} onChange={e => setSingleRecipientLastName(e.target.value)} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="subject" className="text-base font-semibold tracking-tight">Subject</Label>
            <Input id="subject" placeholder="Your email subject line" value={subject} onChange={e => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message" className="text-base font-semibold tracking-tight">Message</Label>
            {editorLoaded && editorRef.current ? (
              <div className='prose max-w-none [&_.ck-editor__main>.ck-editor__editable]:min-h-[150px]'>
                  <CKEditor
                      editor={editorRef.current}
                      data={message}
                      onChange={(event, editor) => {
                          const data = editor.getData();
                          setMessage(data);
                      }}
                  />
              </div>
            ) : (
                <div className="w-full min-h-[190px] p-4 border rounded-md animate-pulse bg-muted"></div>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="attachment-file" className="text-base font-semibold tracking-tight">Attachment (Optional)</Label>
               <div className="flex items-center gap-4">
                  <Button type="button" variant="outline" className="rounded-full" onClick={() => attachmentInputRef.current?.click()}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Add Attachment
                  </Button>
                  <Input id="attachment-file" type="file" className="hidden" ref={attachmentInputRef} onChange={handleAttachmentFileChange} />
                  {attachmentFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground truncate">
                          <FileIcon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{attachmentFile.name}</span>
                      </div>
                  )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="banner-file" className="text-base font-semibold tracking-tight">Banner Image (Optional)</Label>
              <div className="flex items-center gap-4">
                <Button type="button" variant="outline" className="rounded-full" onClick={() => bannerInputRef.current?.click()}>
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

          <div className="space-y-4 rounded-2xl border border-border bg-background/50 p-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="schedule-email" className="font-medium flex items-center gap-2 text-base font-semibold tracking-tight">
                <Menu className="w-5 h-5 text-muted-foreground" />
                Schedule for Later? (Optional)
              </Label>
              <Switch id="schedule-email" checked={scheduleEmail} onCheckedChange={setScheduleEmail} />
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
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      type="time" 
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="pl-10"
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
              "w-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-base font-medium rounded-full",
              "focus-visible:ring-primary",
              "shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
            )}
            size="lg"
            disabled={isSending || isProcessingFile}
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
