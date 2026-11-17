import Link from "next/link";

// Root 404 page — rendered for any URL that matches no route.
export default function NotFound() {
  return (
    <div>
      <h1>404 — Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <p>
        <Link href="/">Back to storefront</Link>
      </p>
    </div>
  );
}
