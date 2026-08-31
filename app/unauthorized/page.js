"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-xl border-0">
        <CardHeader className="items-center text-center pb-2">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <Shield className="h-8 w-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-800">
            Access Denied
          </CardTitle>
          <CardDescription className="text-gray-500 text-sm">
            You don&apos;t have permission to access this page. Please contact
            your administrator if you believe this is an error.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-3 pt-4">
          <Button asChild className="w-full bg-teal-600 hover:bg-teal-700">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <p className="text-sm text-gray-400">Need help? Contact support</p>
        </CardContent>
      </Card>
    </div>
  );
}
