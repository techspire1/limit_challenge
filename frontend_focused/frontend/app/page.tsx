import { redirect } from 'next/navigation';

/** The workspace is the product; there is nothing useful to show at the root. */
export default function HomePage() {
  redirect('/submissions');
}
