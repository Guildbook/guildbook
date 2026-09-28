import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold text-gold">Lost in the Wilds</h1>
      <hr className="rule-gold my-4 w-32" />
      <p className="text-muted">That page does not exist.</p>
      <Link href="/" className="btn btn-ghost mt-6">
        Return home
      </Link>
    </main>
  );
}
