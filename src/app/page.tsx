import MailForm from "@/components/MailForm";
import { Mail, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/10 via-white to-accent/10 -z-10" />
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center bg-primary text-primary-foreground rounded-full w-16 h-16 mb-4 shadow-lg shadow-primary/20">
            <Mail className="w-8 h-8" />
          </div>
          <h1 className="font-headline text-4xl md:text-5xl font-bold text-gray-800">
            Mail Merge Pro
          </h1>
          <p className="mt-3 text-lg text-gray-500 max-w-md mx-auto">
            Upload a contact list, compose your message, and send personalized emails in bulk.
          </p>
        </div>
        <MailForm />
      </div>
    </main>
  );
}
