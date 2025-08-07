'use client';

import { Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function MobileSuggestion() {
  return (
    <Card className="mt-8 w-full shadow-2xl shadow-slate-200/50 border-accent/20">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex-shrink-0">
          <div className="inline-flex items-center justify-center bg-accent/10 text-accent rounded-full w-12 h-12">
            <Smartphone className="w-6 h-6" />
          </div>
        </div>
        <div className="flex-1">
          <CardTitle className="font-headline text-xl tracking-tight text-foreground">
            Thinking about a Mobile App?
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          To convert this web application into a mobile app for both iOS and Android, you can use a framework like{' '}
          <a
            href="https://reactnative.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            React Native
          </a>{' '}
          or{' '}
          <a
            href="https://ionicframework.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:underline"
          >
            Ionic
          </a>
          . These frameworks allow you to wrap your existing Next.js application in a native container, giving you access to device features and the ability to publish on the App Store and Google Play. This approach, often called a "hybrid app," is a great way to leverage your existing web code for mobile.
        </p>
      </CardContent>
    </Card>
  );
}
