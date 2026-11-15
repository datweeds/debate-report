import { redirect } from 'next/navigation';

// The old Mod Tools overview: its links now live in the menu's Voter / Debater /
// Moderator sections, so send anyone arriving here to their Society dashboard.
export default function DashboardPage() {
  redirect('/scotparl');
}
