import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAdminSchema, type InsertAdmin } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  if (user) {
    setLocation("/");
    return null;
  }

  const loginForm = useForm<InsertAdmin>({
    resolver: zodResolver(insertAdminSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<InsertAdmin>({
    resolver: zodResolver(insertAdminSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const handleLogin = (data: InsertAdmin) => {
    loginMutation.mutate(data);
  };

  const handleRegister = (data: InsertAdmin) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-accent/10 flex">
      {/* Left side - Forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto w-16 h-16 bg-primary rounded-lg flex items-center justify-center mb-4">
              <i className="fas fa-trophy text-2xl text-primary-foreground"></i>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Centerfruit Durga Puja Contest</h1>
            <p className="text-muted-foreground mt-2">Admin Dashboard</p>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
              {/* <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger> */}
            </TabsList>

            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>Sign In</CardTitle>
                  <CardDescription>
                    Enter your credentials to access the admin dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Enter your username"
                                data-testid="input-login-username"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Enter your password"
                                data-testid="input-login-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loginMutation.isPending}
                        data-testid="button-login"
                      >
                        {loginMutation.isPending ? "Signing in..." : "Sign In"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>Create Account</CardTitle>
                  <CardDescription>
                    Create a new admin account for the dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...registerForm}>
                    <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                      <FormField
                        control={registerForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Choose a username"
                                data-testid="input-register-username"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={registerForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Choose a password"
                                data-testid="input-register-password"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={registerMutation.isPending}
                        data-testid="button-register"
                      >
                        {registerMutation.isPending ? "Creating account..." : "Create Account"}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex flex-1 bg-primary text-primary-foreground p-8 items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-32 h-32 mx-auto mb-8 bg-primary-foreground/10 rounded-full flex items-center justify-center">
            <i className="fas fa-microphone text-6xl"></i>
          </div>
          <h2 className="text-3xl font-bold mb-4">Manage Contest Submissions</h2>
          <p className="text-primary-foreground/80 text-lg mb-6">
            Review audio recordings, manage participant submissions, and oversee the Durga Puja tongue twister contest.
          </p>
          <div className="space-y-2 text-left">
            <div className="flex items-center space-x-3">
              <i className="fas fa-check-circle"></i>
              <span>Automated speech-to-text processing</span>
            </div>
            <div className="flex items-center space-x-3">
              <i className="fas fa-check-circle"></i>
              <span>Smart scoring system</span>
            </div>
            <div className="flex items-center space-x-3">
              <i className="fas fa-check-circle"></i>
              <span>SMS result notifications</span>
            </div>
            <div className="flex items-center space-x-3">
              <i className="fas fa-check-circle"></i>
              <span>Complete submission management</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
