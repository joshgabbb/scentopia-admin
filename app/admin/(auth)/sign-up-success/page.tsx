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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-[#0a0a0a]">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card className="bg-[#1a1a1a] border-[#d4af37]/20">
            <CardHeader>
              <CardTitle className="text-2xl text-[#f5e6d3]">
                Thank you for signing up!
              </CardTitle>
              <CardDescription className="text-[#d4af37]">
                Check your email to confirm
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[#b8a070]">
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