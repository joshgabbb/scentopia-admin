// app/admin/(auth)/sign-up-success/page.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-white">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card className="bg-[#faf8f3] border-[#e8e0d0]">
            <CardHeader>
              <CardTitle className="text-2xl text-[#1c1810]">
                Thank you for signing up!
              </CardTitle>
              <CardDescription className="text-[#d4af37]">
                Check your email to confirm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#7a6a4a]">
                You&apos;ve successfully signed up. Please check your email to
                confirm your account before signing in.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}