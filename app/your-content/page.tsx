import { redirect } from 'next/navigation';

// Renamed My Content, now folded into My Stuff
export default function YourContentPage() { redirect('/my-stuff'); }
