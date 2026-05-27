import { LegalPage } from "@/components/legal/LegalPage";

export const metadata = {
  title: "Privacy — Mikian.Photos",
};

export default function Page() {
  return (
    <LegalPage title="Privacy policy" accent="policy" effective="2026-05-27">
      <p>
        Short version: we collect the minimum we need to sell you race photos, we don&rsquo;t
        sell your data to anyone, and selfies you upload to find your photos are not kept.
      </p>

      <h2>What we collect</h2>
      <p>We collect three categories of data, and only when you give it to us:</p>
      <ul>
        <li>
          <strong>Search inputs.</strong> A bib number you type or a selfie you upload. Bib
          numbers are stored alongside your purchase so we can re-deliver photos later. Selfies
          are used only to run a one-time face match against the event&rsquo;s photos and are{" "}
          <strong>deleted within 24 hours</strong> of that match.
        </li>
        <li>
          <strong>Purchase + account data.</strong> If you buy photos or create an account, we
          keep your email, the event and photos you bought, the amount you paid, and the date
          of purchase. This lets you re-download and gives you a receipt.
        </li>
        <li>
          <strong>Basic technical data.</strong> Standard server logs (IP address, browser, page
          URL, timestamps) for security and to debug issues. We keep these for 30 days.
        </li>
      </ul>

      <h2>What we do NOT collect</h2>
      <ul>
        <li>We don&rsquo;t store your credit card number — that goes straight to Stripe or PayPal.</li>
        <li>We don&rsquo;t run third-party advertising or marketing trackers.</li>
        <li>We don&rsquo;t train AI models on your selfie or your photos.</li>
        <li>We don&rsquo;t sell or rent your data to anyone.</li>
      </ul>

      <h2>Who we share data with</h2>
      <p>We share data with a small set of service providers, only as needed:</p>
      <ul>
        <li>
          <strong>Stripe / PayPal</strong> — process payments. They receive the purchase
          amount, your email, and standard payment metadata.
        </li>
        <li>
          <strong>Google</strong> — if you choose to sign in with Google, we receive your name,
          email, and profile picture from Google.
        </li>
        <li>
          <strong>Our hosting provider</strong> (Vercel) — hosts the site; receives standard
          server logs.
        </li>
      </ul>
      <p>That&rsquo;s it. No data brokers, no ad networks.</p>

      <h2>Cookies</h2>
      <p>
        We use a small number of strictly-necessary cookies and browser-storage entries to
        remember your cart and let you sign in. We do not set tracking or advertising cookies.
      </p>

      <h2>Face data</h2>
      <p>
        When you upload a selfie to find your photos, the image is processed to extract a face
        embedding (a numerical fingerprint of facial features) that we compare against the
        embeddings of faces in the event photos. The original selfie is deleted within 24
        hours. The embedding itself is deleted with it. We do not link your face embedding to
        your name or email unless you also buy photos in the same session.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>
          <strong>Access.</strong> Email{" "}
          <a href="mailto:hello@mikian.photos">hello@mikian.photos</a> and we&rsquo;ll send you
          a copy of the data we have on you.
        </li>
        <li>
          <strong>Deletion.</strong> Same email — we&rsquo;ll delete your account and all
          associated data within 30 days. (We may keep a minimal record of past transactions for
          tax and accounting purposes, as required by law.)
        </li>
        <li>
          <strong>Takedown.</strong> If a photo you appear in shouldn&rsquo;t be public, email
          us and we&rsquo;ll remove it from public view within a few business days.
        </li>
      </ul>

      <h2>Children</h2>
      <p>
        The service is not directed at children under 13. We don&rsquo;t knowingly collect
        personal data from anyone under 13. If you believe we have, email us and we&rsquo;ll
        delete it.
      </p>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit (HTTPS) and at rest on our hosting provider. Payments are
        handled by Stripe / PayPal under their own PCI-compliant infrastructure. No system is
        100% secure; if we ever have a breach that affects your data, we&rsquo;ll notify you by
        email within 72 hours of discovering it.
      </p>

      <h2>International users</h2>
      <p>
        We operate from the United States. If you use the service from elsewhere, your data
        will be transferred to and processed in the US. EU/UK users have the additional rights
        described under GDPR; reach us at{" "}
        <a href="mailto:hello@mikian.photos">hello@mikian.photos</a> to exercise them.
      </p>

      <h2>Changes</h2>
      <p>
        We&rsquo;ll update the effective date at the top of this page when we change anything,
        and notify account holders by email if a change is material.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, data requests, or anything else:{" "}
        <a href="mailto:hello@mikian.photos">hello@mikian.photos</a>.
      </p>
    </LegalPage>
  );
}
