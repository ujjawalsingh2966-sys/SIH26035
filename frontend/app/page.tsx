import { redirect } from 'next/navigation';

export default function Home() {
  // Foundation-level redirect to the authenticated dashboard
  // In a real implementation this checks the session cookie first.
  redirect('/login');
}
