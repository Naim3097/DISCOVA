import { redirect } from "next/navigation";

// No public front page: the root goes straight into the app.
// Unauthenticated visitors are bounced to /login by the middleware.
export default function Home() {
  redirect("/dashboard");
}
