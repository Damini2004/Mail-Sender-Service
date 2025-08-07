import MailForm from "@/components/MailForm";
import { Mail } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full w-16 h-16 mb-4">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-foreground">
            Mail Merge Pro
          </h1>
          <p className="mt-2 text-lg text-muted-foreground max-w-md mx-auto">
            Upload a contact list, compose your message, and send personalized emails in bulk.
          </p>
        </div>
        <MailForm />
      </div>
    </main>
  );
}
