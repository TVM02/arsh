"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { collection, query, where, getDocs, or } from "firebase/firestore";
import { db } from "@/lib/firebase";
import useAuthStore from "@/lib/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Building, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function MekhalaLogin() {
  const [formData, setFormData] = useState({
    loginCredential: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const router = useRouter();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.loginCredential.trim() || !formData.password.trim()) {
      setError("Please enter both login credential and password");
      return;
    }

    setLoading(true);

    try {
      // Query mekhala collection for matching credentials (either loginId or email)
      const mekhalaQuery = query(
        collection(db, "mekhala"),
        or(
          where("loginId", "==", formData.loginCredential.trim()),
          where("email", "==", formData.loginCredential.trim())
        )
      );

      const querySnapshot = await getDocs(mekhalaQuery);

      if (querySnapshot.empty) {
        setError("Invalid login credentials or password");
        return;
      }

      const mekhalaDoc = querySnapshot.docs[0];
      const mekhalaData = mekhalaDoc.data();

      // Verify password
      if (mekhalaData.password !== formData.password) {
        setError("Invalid login credentials or password");
        return;
      }

      // Create user object for auth store
      const userData = {
        uid: mekhalaDoc.id,
        email: mekhalaData.email,
        role: "mekhala_admin",
        ...mekhalaData,
      };

      // Set authentication state
      setAuth(userData, "mekhala_admin");

      toast.success("Login successful!");

      // Redirect to mekhala dashboard
      router.push("/dashboard/district");
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center flex-col justify-center p-4 relative overflow-hidden">
      <div className="flex w-full md:w-fit items-center bg-blue-700 p-2 rounded-lg space-x-3 mb-4 md:fixed top-5 left-5">
        <div className="w-12 h-12 bg-gradient-to-br from-blue-200 to-white rounded-xl flex items-center justify-center shadow-lg">
          <Image src={"/logo.png"} alt="Logo" width={48} height={48} />
        </div>
        <div>
          <span className="text-xl font-bold text-white">DKJU</span>
          <p className="text-xs text-blue-100">Smart Islamic Education</p>
        </div>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-full bg-gradient-to-r from-blue-100/20 to-purple-100/20"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg">
            <CardTitle className="text-2xl font-semibold text-center">
              Mekhala Admin Login
            </CardTitle>
            <CardDescription className="text-center text-blue-100">
              Enter your mekhala credentials to access the dashboard
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert
                  variant="destructive"
                  className="bg-red-50 border-red-200 text-red-800"
                >
                  <AlertDescription className="font-medium">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="loginCredential"
                  className="text-sm font-semibold text-gray-700"
                >
                  Login ID or Email
                </Label>
                <Input
                  id="loginCredential"
                  name="loginCredential"
                  type="text"
                  value={formData.loginCredential}
                  onChange={handleChange}
                  required
                  className="h-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all duration-200"
                  placeholder="Enter your login ID or email"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="password"
                  className="text-sm font-semibold text-gray-700"
                >
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="h-12 pr-12 border-gray-200 focus:border-blue-500 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-all duration-200"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-blue-600 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-base shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  "Mekhala Sign In"
                )}
              </Button>
            </form>

            <div className="mt-8 space-y-6">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-4">
                  Access other portals:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 text-sm">

                  <Link
                    href="/auth/login/student"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 font-medium transition-colors"
                  >
                    Student Portal
                  </Link>
                  <Link
                    href="/auth/login/teacher"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 hover:text-purple-800 font-medium transition-colors"
                  >
                    Teacher Portal
                  </Link>
                  <Link
                    href="/auth/login/madarsa-admin"
                    className="inline-flex items-center px-3 py-2 rounded-lg bg-orange-50 text-orange-700 hover:bg-orange-100 hover:text-orange-800 font-medium transition-colors"
                  >
                    Sadar Admin
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Back to Home
          </Link>
          <div className="flex bottom-0 w-full items-center text-center mt-8 justify-center py-4 bg-blue-900">
            <span className="text-sm text-white">
              {"Contact technical Support : 8891177850"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
